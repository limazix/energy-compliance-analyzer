
'use server';

import { Timestamp, doc, getDocs, orderBy, query, updateDoc, writeBatch, serverTimestamp, getDoc, FirestoreError, collection } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadString, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { summarizePowerQualityData, SummarizePowerQualityDataInput, SummarizePowerQualityDataOutput } from '@/ai/flows/summarize-power-quality-data';
import { identifyAEEEResolutions, IdentifyAEEEResolutionsInput, IdentifyAEEEResolutionsOutput } from '@/ai/flows/identify-aneel-resolutions';
import { analyzeComplianceReport, AnalyzeComplianceReportInput, AnalyzeComplianceReportOutput } from '@/ai/flows/analyze-compliance-report';
import { convertStructuredReportToMdx } from '@/lib/reportUtils';
import type { Analysis, AnalysisReportData } from '@/types/analysis'; 

const CHUNK_SIZE = 100000;
const OVERLAP_SIZE = 10000;
const MAX_ERROR_MESSAGE_LENGTH = 1500; 
const CLIENT_ERROR_MESSAGE_MAX_LENGTH = 250; 

async function getFileContentFromStorage(filePath: string): Promise<string> {
  console.log(`[getFileContentFromStorage] Attempting to download: ${filePath}`);
  const fileRef = storageRef(storage, filePath);
  let downloadURL;
  try {
    downloadURL = await getDownloadURL(fileRef);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[getFileContentFromStorage] Failed to get download URL for ${filePath}:`, errorMessage);
    throw new Error(`Failed to get download URL: ${errorMessage}`);
  }

  let response;
  try {
    response = await fetch(downloadURL);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[getFileContentFromStorage] Network error fetching ${downloadURL}:`, errorMessage);
    throw new Error(`Network error fetching file: ${errorMessage}`);
  }

  if (!response.ok) {
    let errorText = 'Could not read error response text.';
    try {
      errorText = await response.text();
    } catch (e) {
      // Ignore if reading error text fails
    }
    console.error(`[getFileContentFromStorage] Failed to download. Status: ${response.status} ${response.statusText}. Body: ${errorText}`);
    throw new Error(`Failed to download file from GCS: ${response.statusText}. Details: ${errorText}`);
  }

  let textContent;
  try {
    textContent = await response.text();
  } catch (error) {
     const errorMessage = error instanceof Error ? error.message : String(error);
     console.error(`[getFileContentFromStorage] Error reading response text:`, errorMessage);
     throw new Error(`Error reading file content: ${errorMessage}`);
  }
  return textContent;
}

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

  // Helper function to check for cancellation
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
    if (!isCriticalError) { // Only try to update Firestore if it's not a critical startup error
        try {
          // Check if already cancelled to avoid overwriting 'cancelled' status with 'error'
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
    return { success: false, analysisId: analysisIdInput || 'unknown_id_on_error', error: clientSafeErrorMessage };
  }
}


export async function getPastAnalysesAction(userIdInput: string): Promise<Analysis[]> {
  const userId = userIdInput?.trim() ?? '';
  if (!userId) {
    const errorMsg = `[getPastAnalysesAction] CRITICAL: userId is invalid (input: '${userIdInput}').`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const analysesCollectionPath = `users/${userId}/analyses`;
  console.log(`[getPastAnalysesAction] Fetching for userId: ${userId}, path: '${analysesCollectionPath}', Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV_VAR_NOT_SET'}`);
  const analysesCol = collection(db, analysesCollectionPath);
  const q = query(analysesCol, orderBy('createdAt', 'desc'));

  try {
    const snapshot = await getDocs(q);
    console.log(`[getPastAnalysesAction] Found ${snapshot.docs.length} analyses for userId: ${userId}`);

    const mapTimestampToISO = (timestampFieldValue: any): string | undefined => {
      if (timestampFieldValue && typeof timestampFieldValue.toDate === 'function') {
        return (timestampFieldValue as Timestamp).toDate().toISOString();
      }
      if (typeof timestampFieldValue === 'string' && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(timestampFieldValue)) {
        return timestampFieldValue;
      }
      return undefined;
    };

    return snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const analysisResult: Partial<Analysis> = {
        id: docSnap.id,
        userId: data.userId as string,
        fileName: data.fileName as string,
        title: data.title as string | undefined,
        description: data.description as string | undefined,
        languageCode: data.languageCode as string | undefined,
        status: data.status as Analysis['status'],
        progress: data.progress as number,
        uploadProgress: data.uploadProgress as number | undefined,
        powerQualityDataUrl: data.powerQualityDataUrl as string | undefined,
        powerQualityDataSummary: data.powerQualityDataSummary as string | undefined,
        isDataChunked: data.isDataChunked as boolean | undefined,
        identifiedRegulations: data.identifiedRegulations as string[] | undefined,
        summary: data.summary as string | undefined, 
        structuredReport: data.structuredReport as AnalyzeComplianceReportOutput | undefined,
        mdxReportStoragePath: data.mdxReportStoragePath as string | undefined,
        errorMessage: data.errorMessage as string | undefined,
        tags: (data.tags || []) as string[],
      };

      analysisResult.createdAt = mapTimestampToISO(data.createdAt) || new Date(0).toISOString();
      analysisResult.completedAt = mapTimestampToISO(data.completedAt);
      if (!statusIsValid(analysisResult.status)) {
        console.warn(`[getPastAnalysesAction] Analysis ${docSnap.id} has invalid status: ${analysisResult.status}. Defaulting to 'error'.`);
        analysisResult.status = 'error';
        analysisResult.errorMessage = analysisResult.errorMessage || `Status inválido (${data.status}) recebido do Firestore.`;
      }

      return analysisResult as Analysis;
    });
  } catch (error) {
    const originalErrorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[getPastAnalysesAction] Error fetching for userId ${userId} from ${analysesCollectionPath}:`, originalErrorMessage, error);
    if (error instanceof FirestoreError && (error.code === 'permission-denied' || error.code === 7)) {
        console.error(`[getPastAnalysesAction] PERMISSION_DENIED query path '${analysesCollectionPath}' for userId '${userId}'. Project '${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV_VAR_NOT_SET'}'. Firestore error: ${error.code}, ${error.message}`);
    }
    throw new Error(`Falha ao buscar análises: ${originalErrorMessage}`);
  }
}
function statusIsValid(status: any): status is Analysis['status'] {
    const validStatuses: Analysis['status'][] = ['uploading', 'summarizing_data', 'identifying_regulations', 'assessing_compliance', 'completed', 'error', 'deleted', 'cancelling', 'cancelled'];
    return typeof status === 'string' && validStatuses.includes(status as Analysis['status']);
}

export async function addTagToAction(userIdInput: string, analysisIdInput: string, tag: string): Promise<void> {
  const userId = userIdInput?.trim() ?? '';
  const analysisId = analysisIdInput?.trim() ?? '';
  const trimmedTag = tag?.trim() ?? '';

  if (!userId || !analysisId || !trimmedTag) {
    const errorMsg = `[addTagToAction] CRITICAL: Invalid params. userId: '${userIdInput}', analysisId: '${analysisIdInput}', tag: '${tag}'.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
  console.log(`[addTagToAction] Adding tag '${trimmedTag}' to ${analysisDocPath}. Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV_VAR_NOT_SET'}`);
  const analysisRef = doc(db, analysisDocPath);
  try {
    const analysisSnap = await getDoc(analysisRef);
    if (!analysisSnap.exists()) throw new Error("Análise não encontrada.");
    const currentTags = analysisSnap.data().tags || [];
    if (!currentTags.includes(trimmedTag)) {
      await updateDoc(analysisRef, { tags: [...currentTags, trimmedTag] });
    }
  } catch (error) {
    const originalErrorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[addTagToAction] Error for ${analysisDocPath}:`, originalErrorMessage);
    throw new Error(originalErrorMessage);
  }
}

export async function removeTagAction(userIdInput: string, analysisIdInput: string, tagToRemove: string): Promise<void> {
  const userId = userIdInput?.trim() ?? '';
  const analysisId = analysisIdInput?.trim() ?? '';
  const trimmedTagToRemove = tagToRemove?.trim() ?? '';

  if (!userId || !analysisId || !trimmedTagToRemove) {
    const errorMsg = `[removeTagAction] CRITICAL: Invalid params. userId: '${userIdInput}', analysisId: '${analysisIdInput}', tag: '${tagToRemove}'.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
  console.log(`[removeTagAction] Removing tag '${trimmedTagToRemove}' from ${analysisDocPath}. Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV_VAR_NOT_SET'}`);
  const analysisRef = doc(db, analysisDocPath);
  try {
    const analysisSnap = await getDoc(analysisRef);
    if (!analysisSnap.exists()) throw new Error("Análise não encontrada.");
    const currentTags = analysisSnap.data().tags || [];
    await updateDoc(analysisRef, { tags: currentTags.filter((t: string) => t !== trimmedTagToRemove) });
  } catch (error) {
    const originalErrorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[removeTagAction] Error for ${analysisDocPath}:`, originalErrorMessage);
    throw new Error(originalErrorMessage);
  }
}

export async function deleteAnalysisAction(userIdInput: string, analysisIdInput: string): Promise<void> {
  const userId = userIdInput?.trim() ?? '';
  const analysisId = analysisIdInput?.trim() ?? '';

  if (!userId || !analysisId) {
    const errorMsg = `[deleteAnalysisAction] CRITICAL: userId ('${userIdInput}') or analysisId ('${analysisIdInput}') invalid.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
  console.log(`[deleteAnalysisAction] Marking ${analysisDocPath} as 'deleted'. Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV_VAR_NOT_SET'}`);
  const analysisRef = doc(db, analysisDocPath);
  try {
    const analysisSnap = await getDoc(analysisRef);
    if (!analysisSnap.exists()) throw new Error("Análise não encontrada para exclusão.");

    await updateDoc(analysisRef, {
        status: 'deleted',
        summary: null, 
        structuredReport: null,
        mdxReportStoragePath: null, 
        powerQualityDataUrl: null, 
        identifiedRegulations: null,
        powerQualityDataSummary: null,
        errorMessage: 'Análise excluída pelo usuário.'
    });

    const dataToDelete = analysisSnap.data();
    if (dataToDelete.powerQualityDataUrl) {
        try {
            await deleteObject(storageRef(storage, dataToDelete.powerQualityDataUrl));
            console.log(`[deleteAnalysisAction] Original data file ${dataToDelete.powerQualityDataUrl} deleted.`);
        } catch (e) { console.warn(`[deleteAnalysisAction] Failed to delete original data file ${dataToDelete.powerQualityDataUrl}:`, e); }
    }
    if (dataToDelete.mdxReportStoragePath) {
        try {
            await deleteObject(storageRef(storage, dataToDelete.mdxReportStoragePath));
            console.log(`[deleteAnalysisAction] MDX report ${dataToDelete.mdxReportStoragePath} deleted.`);
        } catch (e) { console.warn(`[deleteAnalysisAction] Failed to delete MDX ${dataToDelete.mdxReportStoragePath}:`, e); }
    }
  } catch (error) {
    const originalErrorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[deleteAnalysisAction] Error for ${analysisDocPath}:`, originalErrorMessage);
    throw new Error(originalErrorMessage);
  }
}


export async function getAnalysisReportAction(
  userIdInput: string,
  analysisIdInput: string
): Promise<AnalysisReportData> {
  const userId = userIdInput?.trim() ?? '';
  const analysisId = analysisIdInput?.trim() ?? '';
  const baseReturn = { mdxContent: null, fileName: null, analysisId: analysisIdInput || null };

  if (!userId || !analysisId) {
    const errorMsg = "[getAnalysisReportAction] User ID e Analysis ID são obrigatórios.";
    console.error(errorMsg + ` User: ${userIdInput}, Analysis: ${analysisIdInput}`);
    return { ...baseReturn, analysisId: analysisId || null, error: errorMsg };
  }

  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
  console.log(`[getAnalysisReportAction] Fetching report from ${analysisDocPath}. Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV_VAR_NOT_SET'}`);
  const analysisRef = doc(db, analysisDocPath);

  try {
    const docSnap = await getDoc(analysisRef);
    if (!docSnap.exists()) {
      return { ...baseReturn, error: "Análise não encontrada ou você não tem permissão." };
    }

    const analysisData = docSnap.data() as Analysis;
    if (analysisData.userId !== userId) {
      return { ...baseReturn, error: "Você não tem permissão para acessar este relatório." };
    }
    if (analysisData.status === 'deleted') {
        return { ...baseReturn, fileName: analysisData.fileName, error: "Esta análise foi excluída." };
    }
    if (analysisData.status === 'cancelled' || analysisData.status === 'cancelling') {
        return { ...baseReturn, fileName: analysisData.fileName, error: "Esta análise foi cancelada." };
    }
    if (!analysisData.mdxReportStoragePath) {
      return { ...baseReturn, fileName: analysisData.fileName, error: "Relatório MDX não encontrado para esta análise." };
    }

    const mdxContent = await getFileContentFromStorage(analysisData.mdxReportStoragePath);
    return { mdxContent, fileName: analysisData.fileName, analysisId, error: null };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[getAnalysisReportAction] Error for ${analysisDocPath}:`, errorMessage);
    return { ...baseReturn, error: `Erro ao carregar o relatório: ${errorMessage.substring(0, CLIENT_ERROR_MESSAGE_MAX_LENGTH)}` };
  }
}


export async function cancelAnalysisAction(
  userIdInput: string,
  analysisIdInput: string
): Promise<{ success: boolean; error?: string }> {
  const userId = userIdInput?.trim() ?? '';
  const analysisId = analysisIdInput?.trim() ?? '';

  if (!userId || !analysisId) {
    const msg = `[cancelAnalysisAction] CRITICAL: userId ('${userIdInput}' -> '${userId}') or analysisId ('${analysisIdInput}' -> '${analysisId}') is invalid. Aborting.`;
    console.error(msg);
    return { success: false, error: msg };
  }

  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
  const analysisRef = doc(db, analysisDocPath);
  console.log(`[cancelAnalysisAction] Requesting cancellation for ${analysisDocPath}. Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV_VAR_NOT_SET'}`);

  try {
    const docSnap = await getDoc(analysisRef);
    if (!docSnap.exists()) {
      const notFoundMsg = `Análise ${analysisId} não encontrada para cancelamento.`;
      console.warn(`[cancelAnalysisAction] ${notFoundMsg} Path: ${analysisDocPath}`);
      return { success: false, error: notFoundMsg };
    }

    const currentStatus = docSnap.data().status;
    if (currentStatus === 'completed' || currentStatus === 'error' || currentStatus === 'cancelled' || currentStatus === 'deleted') {
      const msg = `Análise ${analysisId} já está em um estado final (${currentStatus}) e não pode ser cancelada.`;
      console.warn(`[cancelAnalysisAction] ${msg}`);
      return { success: false, error: msg };
    }

    await updateDoc(analysisRef, {
      status: 'cancelling',
      errorMessage: 'Cancelamento solicitado pelo usuário...', 
    });
    console.log(`[cancelAnalysisAction] Analysis ${analysisId} status set to 'cancelling'.`);
    return { success: true };
  } catch (error) {
    const originalErrorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[cancelAnalysisAction] Error for ${analysisDocPath}:`, originalErrorMessage);
    return { success: false, error: `Falha ao solicitar cancelamento: ${originalErrorMessage.substring(0, CLIENT_ERROR_MESSAGE_MAX_LENGTH)}` };
  }
}
