
'use server';

import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { ref as storageRef, uploadString } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { summarizePowerQualityData, SummarizePowerQualityDataInput, SummarizePowerQualityDataOutput } from '@/ai/flows/summarize-power-quality-data';
import { identifyAEEEResolutions, IdentifyAEEEResolutionsInput, IdentifyAEEEResolutionsOutput } from '@/ai/flows/identify-aneel-resolutions';
import { analyzeComplianceReport, AnalyzeComplianceReportInput, AnalyzeComplianceReportOutput } from '@/ai/flows/analyze-compliance-report';
import { convertStructuredReportToMdx } from '@/lib/reportUtils';
import type { Analysis } from '@/types/analysis';
import { getFileContentFromStorage } from '@/lib/gcsUtils';

const CHUNK_SIZE = 100000;
const OVERLAP_SIZE = 10000;
const MAX_ERROR_MESSAGE_LENGTH = 1500;
const CLIENT_ERROR_MESSAGE_MAX_LENGTH = 250;

export async function processAnalysisFile(
  analysisIdInput: string,
  userIdInput: string
): Promise<{ success: boolean; analysisId: string; error?: string }> {
  const userId = userIdInput?.trim() ?? '';
  const analysisId = analysisIdInput?.trim() ?? '';

  console.log(`[processAnalysisFile] Starting for analysisId: ${analysisId} (input: ${analysisIdInput}), userId: ${userId} (input: ${userIdInput})`);

  if (!userId || typeof userId !== 'string' || userId.trim() === "") {
    const criticalMsg = `[processAnalysisFile] CRITICAL: userId is invalid (input: '${userIdInput}' -> effective: '${userId}') for analysisId: ${analysisIdInput || 'N/A'}. Aborting.`;
    console.error(criticalMsg);
    return { success: false, analysisId: analysisIdInput || 'unknown_analysis_id_input', error: criticalMsg };
  }
  if (!analysisId || typeof analysisId !== 'string' || analysisId.trim() === "") {
    const criticalMsg = `[processAnalysisFile] CRITICAL: analysisId is invalid (input: '${analysisIdInput}' -> effective: '${analysisId}') for userId: ${userId}. Aborting.`;
    console.error(criticalMsg);
    return { success: false, analysisId: analysisIdInput || 'unknown_analysis_id_input', error: criticalMsg };
  }

  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
  const analysisRef = doc(db, analysisDocPath);

  const UPLOAD_COMPLETION_PROGRESS = 10;
  const SUMMARIZATION_COMPLETION_PROGRESS = 40;
  const SUMMARIZATION_PROGRESS_SPAN = SUMMARIZATION_COMPLETION_PROGRESS - UPLOAD_COMPLETION_PROGRESS;

  const checkCancellation = async (): Promise<boolean> => {
    const currentSnap = await getDoc(analysisRef);
    if (currentSnap.exists() && (currentSnap.data().status === 'cancelling' || currentSnap.data().status === 'cancelled')) {
      console.log(`[processAnalysisFile_checkCancellation] Cancellation detected for ${analysisId}. Current status: ${currentSnap.data().status}.`);
      if (currentSnap.data().status === 'cancelling') {
        await updateDoc(analysisRef, { status: 'cancelled', errorMessage: 'Análise cancelada pelo usuário.', progress: currentSnap.data().progress || 0 });
      }
      return true;
    }
    return false;
  };

  try {
    if (await checkCancellation()) return { success: false, analysisId, error: 'Análise cancelada pelo usuário.' };

    let analysisSnap = await getDoc(analysisRef);
    if (!analysisSnap.exists()) {
      const notFoundMsg = `Analysis document ${analysisId} not found at path ${analysisDocPath}. Aborting.`;
      console.error(`[processAnalysisFile] ${notFoundMsg}`);
      return { success: false, analysisId, error: notFoundMsg };
    }

    const analysisData = analysisSnap.data() as Analysis;
    const filePath = analysisData.powerQualityDataUrl;
    const originalFileName = analysisData.fileName;
    const languageCode = analysisData.languageCode || 'pt-BR';

    if (!filePath) {
      const noFilePathMsg = `File path (powerQualityDataUrl) not found for analysisId: ${analysisId}.`;
      console.error(`[processAnalysisFile] ${noFilePathMsg}`);
      await updateDoc(analysisRef, { status: 'error', errorMessage: 'URL do arquivo de dados não encontrada.', progress: 0 });
      return { success: false, analysisId, error: noFilePathMsg };
    }
    
    if (analysisData.status === 'uploading' || !analysisData.status || (analysisData.progress != null && analysisData.progress < UPLOAD_COMPLETION_PROGRESS)) {
        console.log(`[processAnalysisFile] File path: ${filePath}. Current status: ${analysisData.status}. Updating to 'summarizing_data' and progress ${UPLOAD_COMPLETION_PROGRESS}.`);
        await updateDoc(analysisRef, { status: 'summarizing_data', progress: UPLOAD_COMPLETION_PROGRESS });
    } else if (analysisData.status !== 'error' && analysisData.status !== 'completed' && (analysisData.progress != null && analysisData.progress < UPLOAD_COMPLETION_PROGRESS)) {
        await updateDoc(analysisRef, { progress: Math.max(analysisData.progress || 0, UPLOAD_COMPLETION_PROGRESS) });
    }

    if (await checkCancellation()) return { success: false, analysisId, error: 'Análise cancelada durante a preparação.' };

    let powerQualityDataCsv;
    try {
      powerQualityDataCsv = await getFileContentFromStorage(filePath);
      console.log(`[processAnalysisFile] File content read for ${analysisId}. Size: ${powerQualityDataCsv.length} chars.`);
    } catch (fileError) {
      const errMsg = fileError instanceof Error ? fileError.message : String(fileError);
      const clientErrMsg = `Falha ao ler arquivo: ${errMsg.substring(0, CLIENT_ERROR_MESSAGE_MAX_LENGTH - 25)}...`;
      console.error(`[processAnalysisFile] Error getting file content for ${analysisId}:`, errMsg);
      await updateDoc(analysisRef, { status: 'error', errorMessage: clientErrMsg.substring(0, MAX_ERROR_MESSAGE_LENGTH), progress: UPLOAD_COMPLETION_PROGRESS -1 });
      return { success: false, analysisId, error: clientErrMsg };
    }

    const chunks: string[] = [];
    let isDataActuallyChunked = false;
    if (powerQualityDataCsv.length > CHUNK_SIZE) {
      isDataActuallyChunked = true;
      for (let i = 0; i < powerQualityDataCsv.length; i += (CHUNK_SIZE - OVERLAP_SIZE)) {
        const chunkEnd = Math.min(i + CHUNK_SIZE, powerQualityDataCsv.length);
        chunks.push(powerQualityDataCsv.substring(i, chunkEnd));
        if (chunkEnd === powerQualityDataCsv.length) break; 
      }
      console.log(`[processAnalysisFile] Created ${chunks.length} chunks for ${analysisId}.`);
    } else {
      chunks.push(powerQualityDataCsv);
      console.log(`[processAnalysisFile] Data for ${analysisId} small, no chunking.`);
    }
    await updateDoc(analysisRef, { isDataChunked: isDataActuallyChunked });

    let aggregatedSummary = "";
    let currentOverallProgress = UPLOAD_COMPLETION_PROGRESS;
    const progressIncrementPerChunk = chunks.length > 0 ? SUMMARIZATION_PROGRESS_SPAN / chunks.length : SUMMARIZATION_PROGRESS_SPAN;

    for (let i = 0; i < chunks.length; i++) {
      if (await checkCancellation()) return { success: false, analysisId, error: 'Análise cancelada durante a sumarização.' };
      const chunk = chunks[i];
      console.log(`[processAnalysisFile] Summarizing ${analysisId}, chunk ${i + 1}/${chunks.length}. Size: ${chunk.length} chars.`);
      try {
        const summarizeInput: SummarizePowerQualityDataInput = { powerQualityDataCsv: chunk, languageCode };
        if (chunk.trim() === "") {
            console.warn(`[processAnalysisFile] Chunk ${i + 1} for ${analysisId} is empty. Skipping.`);
            aggregatedSummary += ""; 
        } else {
            const summaryOutput: SummarizePowerQualityDataOutput = await summarizePowerQualityData(summarizeInput);
            aggregatedSummary += (summaryOutput.dataSummary || "") + "\n\n";
        }
        currentOverallProgress += progressIncrementPerChunk;
        await updateDoc(analysisRef, {
          progress: Math.min(SUMMARIZATION_COMPLETION_PROGRESS, Math.round(currentOverallProgress)),
          status: 'summarizing_data'
        });
      } catch (aiError) {
        const errMsg = aiError instanceof Error ? aiError.message : String(aiError);
        const clientErrMsg = `Falha IA (sumarização chunk ${i + 1}): ${errMsg.substring(0, CLIENT_ERROR_MESSAGE_MAX_LENGTH - 40)}...`;
        console.error(`[processAnalysisFile] Error summarizing chunk ${i + 1} for ${analysisId}:`, errMsg);
        await updateDoc(analysisRef, { status: 'error', errorMessage: clientErrMsg.substring(0, MAX_ERROR_MESSAGE_LENGTH), progress: Math.round(currentOverallProgress) });
        return { success: false, analysisId, error: clientErrMsg };
      }
    }
    
    if (await checkCancellation()) return { success: false, analysisId, error: 'Análise cancelada após sumarização.' };

    const powerQualityDataSummary = aggregatedSummary.trim();
    console.log(`[processAnalysisFile] All chunks summarized for ${analysisId}. Aggregated length: ${powerQualityDataSummary.length}.`);
    await updateDoc(analysisRef, {
      status: 'identifying_regulations',
      powerQualityDataSummary,
      progress: SUMMARIZATION_COMPLETION_PROGRESS
    });

    if (await checkCancellation()) return { success: false, analysisId, error: 'Análise cancelada antes de identificar regulações.' };

    console.log(`[processAnalysisFile] Identifying regulations for ${analysisId}.`);
    let resolutionsOutput: IdentifyAEEEResolutionsOutput;
    try {
      const identifyInput: IdentifyAEEEResolutionsInput = { powerQualityDataSummary, languageCode };
      resolutionsOutput = await identifyAEEEResolutions(identifyInput);
    } catch (aiError) {
      const errMsg = aiError instanceof Error ? aiError.message : String(aiError);
      const clientErrMsg = `Falha IA (identificar resoluções): ${errMsg.substring(0, CLIENT_ERROR_MESSAGE_MAX_LENGTH - 40)}...`;
      console.error(`[processAnalysisFile] Error identifying resolutions for ${analysisId}:`, errMsg);
      await updateDoc(analysisRef, { status: 'error', errorMessage: clientErrMsg.substring(0, MAX_ERROR_MESSAGE_LENGTH), progress: SUMMARIZATION_COMPLETION_PROGRESS });
      return { success: false, analysisId, error: clientErrMsg };
    }

    if (await checkCancellation()) return { success: false, analysisId, error: 'Análise cancelada após identificar regulações.' };

    const identifiedRegulations = resolutionsOutput.relevantResolutions;
    const identifiedRegulationsString = identifiedRegulations.join(', ');
    const IDENTIFY_REG_COMPLETION_PROGRESS = 70;
    console.log(`[processAnalysisFile] Regulations for ${analysisId}: ${identifiedRegulationsString}.`);
    await updateDoc(analysisRef, {
      status: 'assessing_compliance',
      identifiedRegulations, 
      progress: IDENTIFY_REG_COMPLETION_PROGRESS
    });

    if (await checkCancellation()) return { success: false, analysisId, error: 'Análise cancelada antes da análise de conformidade.' };

    console.log(`[processAnalysisFile] Analyzing compliance for ${analysisId}.`);
    let structuredReportOutput: AnalyzeComplianceReportOutput;
    try {
      const reportInput: AnalyzeComplianceReportInput = {
        powerQualityDataSummary,
        identifiedRegulations: identifiedRegulationsString,
        fileName: originalFileName,
        languageCode
      };
      structuredReportOutput = await analyzeComplianceReport(reportInput);
    } catch (aiError) {
      const errMsg = aiError instanceof Error ? aiError.message : String(aiError);
      const clientErrMsg = `Falha IA (análise conformidade): ${errMsg.substring(0, CLIENT_ERROR_MESSAGE_MAX_LENGTH - 35)}...`;
      console.error(`[processAnalysisFile] Error analyzing compliance for ${analysisId}:`, errMsg);
      await updateDoc(analysisRef, { status: 'error', errorMessage: clientErrMsg.substring(0, MAX_ERROR_MESSAGE_LENGTH), progress: IDENTIFY_REG_COMPLETION_PROGRESS });
      return { success: false, analysisId, error: clientErrMsg };
    }

    if (await checkCancellation()) return { success: false, analysisId, error: 'Análise cancelada após análise de conformidade.' };

    console.log(`[processAnalysisFile] Structured report for ${analysisId} generated. Converting to MDX.`);
    let mdxReportStoragePath = '';
    try {
      const mdxContent = convertStructuredReportToMdx(structuredReportOutput, originalFileName);
      const mdxFilePath = `user_reports/${userId}/${analysisId}/report.mdx`;
      const mdxFileRef = storageRef(storage, mdxFilePath);
      await uploadString(mdxFileRef, mdxContent, 'raw', { contentType: 'text/markdown' });
      mdxReportStoragePath = mdxFilePath; 
      console.log(`[processAnalysisFile] MDX report for ${analysisId} uploaded to ${mdxReportStoragePath}.`);
    } catch(mdxError) {
      const errMsg = mdxError instanceof Error ? mdxError.message : String(mdxError);
      console.warn(`[processAnalysisFile] Failed to generate/upload MDX for ${analysisId}: ${errMsg}.`);
       // Do not fail the whole process, but log it. The MDX path will be empty.
    }

    if (await checkCancellation()) return { success: false, analysisId, error: 'Análise cancelada antes de finalizar.' };

    console.log(`[processAnalysisFile] Updating Firestore for ${analysisId} to 'completed'.`);
    await updateDoc(analysisRef, {
      status: 'completed',
      structuredReport: structuredReportOutput,
      mdxReportStoragePath: mdxReportStoragePath || null,
      summary: structuredReportOutput.introduction.overallResultsSummary,
      progress: 100,
      completedAt: serverTimestamp(),
    });
    console.log(`[processAnalysisFile] Analysis ${analysisId} completed for user ${userId}.`);
    return { success: true, analysisId };

  } catch (error) {
    const originalErrorMessage = error instanceof Error ? error.message : String(error);
    const isCriticalError = originalErrorMessage.startsWith("[processAnalysisFile] CRITICAL:");
    
    if (!isCriticalError) {
        console.error(`[processAnalysisFile] Overall error for ${analysisId}, user ${userId}:`, originalErrorMessage, error);
    }

    let detailedErrorMessageForFirestore = `Error: ${originalErrorMessage}`;
    const finalErrorMessageForFirestore = detailedErrorMessageForFirestore.substring(0, MAX_ERROR_MESSAGE_LENGTH);

    let firestoreUpdateFailed = false;
    if (!isCriticalError) { 
        try {
          const currentSnapForError = await getDoc(analysisRef);
          if (currentSnapForError.exists() && currentSnapForError.data().status !== 'cancelled' && currentSnapForError.data().status !== 'cancelling') {
            const existingData = currentSnapForError.data() as Analysis;
            const errorProgress = existingData.progress != null && existingData.progress > 0 && existingData.progress < 100 && existingData.status !== 'uploading' ? existingData.progress : UPLOAD_COMPLETION_PROGRESS;
            await updateDoc(analysisRef, { status: 'error', errorMessage: finalErrorMessageForFirestore, progress: errorProgress });
            console.log(`[processAnalysisFile] Firestore updated with error for ${analysisId}.`);
          } else if (currentSnapForError.exists()) {
             console.log(`[processAnalysisFile] Error occurred for ${analysisId}, but status is already ${currentSnapForError.data().status}. Not overwriting with general error.`);
          } else {
             console.error(`[processAnalysisFile] CRITICAL: Doc ${analysisId} not found when trying to update with overall error.`);
          }
        } catch (firestoreError) {
          const fsErrorMsg = firestoreError instanceof Error ? firestoreError.message : String(firestoreError);
          console.error(`[processAnalysisFile] CRITICAL: Failed to update Firestore with error for ${analysisId} (Original: ${finalErrorMessageForFirestore.substring(0,200)}...):`, fsErrorMsg);
          firestoreUpdateFailed = true;
        }
    }

    let clientSafeErrorMessage = `Erro no processamento (ID: ${analysisId}). Verifique logs.`;
    if (firestoreUpdateFailed) {
      clientSafeErrorMessage = `Erro crítico no servidor (ID: ${analysisId}). Verifique logs.`;
    } else if (isCriticalError) {
        clientSafeErrorMessage = originalErrorMessage; 
    }
    
    console.error("[processAnalysisFile] Final error returned to client: " + clientSafeErrorMessage);
    return { success: false, analysisId: analysisIdInput || 'unknown_id_on_error', error: clientSafeErrorMessage.substring(0, CLIENT_ERROR_MESSAGE_MAX_LENGTH) };
  }
}
