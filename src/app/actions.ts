
'use server';

import { Timestamp, addDoc, collection, doc, getDocs, orderBy, query, updateDoc, where, writeBatch, serverTimestamp, getDoc, FirestoreError } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { summarizePowerQualityData } from '@/ai/flows/summarize-power-quality-data';
import { identifyAEEEResolutions } from '@/ai/flows/identify-aneel-resolutions';
import { analyzeComplianceReport } from '@/ai/flows/analyze-compliance-report';
import type { Analysis } from '@/types/analysis';

const CSV_TRUNCATION_LIMIT_CHARS = 100000; // Approx 25k tokens
const MAX_ERROR_MESSAGE_LENGTH = 1500;

// Helper function to read file content from Firebase Storage
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

export async function processAnalysisFile(analysisIdInput: string, userIdInput: string): Promise<void> {
  const userId = userIdInput ? userIdInput.trim() : '';
  const analysisId = analysisIdInput ? analysisIdInput.trim() : '';

  console.log(`[processAnalysisFile] Starting for analysisId: ${analysisId}, userId: ${userId}`);

  if (!userId || typeof userId !== 'string' || userId.trim() === "") {
    const criticalMsg = `[processAnalysisFile] CRITICAL: userId is invalid (null, empty, or whitespace after trim): '${userIdInput}' -> '${userId}' for analysisId: ${analysisId}. Aborting.`;
    console.error(criticalMsg);
    throw new Error(criticalMsg);
  }
  if (!analysisId || typeof analysisId !== 'string' || analysisId.trim() === "") {
    const criticalMsg = `[processAnalysisFile] CRITICAL: analysisId is invalid (null, empty, or whitespace after trim): '${analysisIdInput}' -> '${analysisId}' for userId: ${userId}. Aborting.`;
    console.error(criticalMsg);
    throw new Error(criticalMsg);
  }

  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
  const analysisRef = doc(db, analysisDocPath);


  try {
    let analysisSnap = await getDoc(analysisRef);
    if (!analysisSnap.exists()) {
      const notFoundMsg = `[processAnalysisFile] Analysis document ${analysisId} not found at path ${analysisDocPath}. Aborting.`;
      console.error(notFoundMsg);
      throw new Error(notFoundMsg);
    }

    const analysisData = analysisSnap.data() as Analysis;
    const filePath = analysisData.powerQualityDataUrl;

    if (!filePath) {
      const noFilePathMsg = `[processAnalysisFile] File path (powerQualityDataUrl) not found for analysisId: ${analysisId} (path: ${analysisDocPath}).`;
      console.error(noFilePathMsg);
      await updateDoc(analysisRef, { status: 'error', errorMessage: 'URL do arquivo de dados não encontrada no registro da análise.', progress: 0 });
      throw new Error(noFilePathMsg);
    }

    // Ensure status is 'summarizing_data' before fetching content
    if (analysisData.status === 'uploading' || !analysisData.status) {
        console.log(`[processAnalysisFile] File path: ${filePath}. Current status: ${analysisData.status}. Updating to 'summarizing_data'.`);
        await updateDoc(analysisRef, { status: 'summarizing_data', progress: 15 }); // Progress for starting content fetch + summarization
    } else if (analysisData.status !== 'summarizing_data' && analysisData.status !== 'error' && analysisData.status !== 'completed') {
        // If it's some other valid processing status, ensure progress is at least at summarization start
        await updateDoc(analysisRef, { progress: Math.max(analysisData.progress, 15) });
    }


    let powerQualityDataCsv;
    try {
      powerQualityDataCsv = await getFileContentFromStorage(filePath);
      console.log(`[processAnalysisFile] File content read for analysis ${analysisId}. Original size: ${powerQualityDataCsv.length} chars.`);
    } catch (fileError) {
      const errMsg = fileError instanceof Error ? fileError.message : String(fileError);
      console.error(`[processAnalysisFile] Error getting file content for ${analysisId} (path: ${analysisDocPath}):`, errMsg);
      await updateDoc(analysisRef, { status: 'error', errorMessage: `Falha ao ler arquivo: ${errMsg.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`, progress: 0 });
      throw new Error(errMsg);
    }

    let isDataTruncated = false;
    if (powerQualityDataCsv.length > CSV_TRUNCATION_LIMIT_CHARS) {
      const originalSize = powerQualityDataCsv.length;
      powerQualityDataCsv = powerQualityDataCsv.substring(0, CSV_TRUNCATION_LIMIT_CHARS);
      isDataTruncated = true;
      console.log(`[processAnalysisFile] CSV data for analysis ${analysisId} was truncated. Original size: ${originalSize} chars, Truncated size: ${powerQualityDataCsv.length} chars.`);
      await updateDoc(analysisRef, { isDataTruncated: true });
    } else {
      await updateDoc(analysisRef, { isDataTruncated: false });
    }


    console.log(`[processAnalysisFile] Calling summarizePowerQualityData for analysis ${analysisId}. Data size: ${powerQualityDataCsv.length} chars.`);
    let summaryOutput;
    try {
      summaryOutput = await summarizePowerQualityData({ powerQualityDataCsv });
    } catch (aiError) {
      const errMsg = aiError instanceof Error ? aiError.message : String(aiError);
      console.error(`[processAnalysisFile] Error from summarizePowerQualityData for ${analysisId} (path: ${analysisDocPath}):`, errMsg);
      await updateDoc(analysisRef, { status: 'error', errorMessage: `Falha na sumarização dos dados pela IA: ${errMsg.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`, progress: 20 });
      throw new Error(errMsg);
    }
    const powerQualityDataSummary = summaryOutput.dataSummary;
    console.log(`[processAnalysisFile] Data summary generated for ${analysisId}. Updating status to 'identifying_regulations'.`);
    await updateDoc(analysisRef, {
      status: 'identifying_regulations',
      powerQualityDataSummary,
      progress: 40
    });


    console.log(`[processAnalysisFile] Calling identifyAEEEResolutions for analysis ${analysisId} using summary.`);
    let resolutionsOutput;
    try {
      resolutionsOutput = await identifyAEEEResolutions({ powerQualityDataSummary });
    } catch (aiError) {
      const errMsg = aiError instanceof Error ? aiError.message : String(aiError);
      console.error(`[processAnalysisFile] Error from identifyAEEEResolutions for ${analysisId} (path: ${analysisDocPath}):`, errMsg);
      await updateDoc(analysisRef, { status: 'error', errorMessage: `Falha na identificação de resoluções pela IA: ${errMsg.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`, progress: 40 });
      throw new Error(errMsg);
    }

    const identifiedRegulations = resolutionsOutput.relevantResolutions;
    const identifiedRegulationsString = identifiedRegulations.join(', ');
    console.log(`[processAnalysisFile] Regulations identified for ${analysisId}: ${identifiedRegulationsString}. Updating status to 'assessing_compliance'.`);

    await updateDoc(analysisRef, {
      status: 'assessing_compliance',
      identifiedRegulations,
      progress: 70
    });

    console.log(`[processAnalysisFile] Calling analyzeComplianceReport for analysis ${analysisId} using summary.`);
    let reportOutput;
    try {
      reportOutput = await analyzeComplianceReport({
        powerQualityDataSummary,
        identifiedRegulations: identifiedRegulationsString
      });
    } catch (aiError) {
      const errMsg = aiError instanceof Error ? aiError.message : String(aiError);
      console.error(`[processAnalysisFile] Error from analyzeComplianceReport for ${analysisId} (path: ${analysisDocPath}):`, errMsg);
      await updateDoc(analysisRef, { status: 'error', errorMessage: `Falha na análise de conformidade pela IA: ${errMsg.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`, progress: 70 });
      throw new Error(errMsg);
    }

    console.log(`[processAnalysisFile] Compliance report generated for ${analysisId}. Updating status to 'completed'.`);

    await updateDoc(analysisRef, {
      status: 'completed',
      summary: reportOutput.summary,
      complianceReport: reportOutput.complianceReport,
      progress: 100,
      completedAt: serverTimestamp(),
    });
    console.log(`[processAnalysisFile] Analysis ${analysisId} completed successfully for user ${userId} (path: ${analysisDocPath}).`);

  } catch (error) {
    const originalErrorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[processAnalysisFile] Overall error processing analysis ${analysisId} for user ${userId} (path: ${analysisDocPath}):`, originalErrorMessage, error);

    let detailedErrorMessageForFirestore = 'Erro desconhecido durante o processamento.';
    if (error instanceof Error) {
        detailedErrorMessageForFirestore = `Error: ${error.message}`;
        if (error.stack) {
            detailedErrorMessageForFirestore += ` Stack: ${error.stack.substring(0, 500)}`;
        }
    } else {
        detailedErrorMessageForFirestore = String(error);
    }
    const finalErrorMessageForFirestore = detailedErrorMessageForFirestore.substring(0, MAX_ERROR_MESSAGE_LENGTH);

    let firestoreUpdateFailed = false;
    try {
      const currentSnap = await getDoc(analysisRef);
      if (currentSnap.exists()) {
        const existingData = currentSnap.data() as Analysis;
        const errorProgress = existingData.progress > 0 && existingData.progress < 100 ? existingData.progress : 0;
        await updateDoc(analysisRef, { status: 'error', errorMessage: finalErrorMessageForFirestore, progress: errorProgress });
        console.log(`[processAnalysisFile] Firestore updated with error status for analysis ${analysisId} (path: ${analysisDocPath}).`);
      } else {
         console.error(`[processAnalysisFile] CRITICAL: Analysis document ${analysisId} (path ${analysisDocPath}) not found when trying to update with overall error status.`);
      }
    } catch (firestoreError) {
      const fsErrorMsg = firestoreError instanceof Error ? firestoreError.message : String(firestoreError);
      console.error(`[processAnalysisFile] CRITICAL: Failed to update Firestore with overall error status for analysis ${analysisId} (path: ${analysisDocPath}) (Original error: ${finalErrorMessageForFirestore.substring(0,200)}...):`, fsErrorMsg);
      firestoreUpdateFailed = true;
    }

    let clientSafeErrorMessage = `Erro no processamento da análise (ID: ${analysisId}). Consulte os logs do servidor para detalhes.`;
    if (firestoreUpdateFailed) {
      clientSafeErrorMessage = `Erro crítico no processamento da análise (ID: ${analysisId}). Falha ao registrar o erro detalhado. Consulte os logs do servidor.`;
    }
    throw new Error(clientSafeErrorMessage);
  }
}


export async function getPastAnalysesAction(userIdInput: string): Promise<Analysis[]> {
  const userId = userIdInput ? userIdInput.trim() : '';
  console.log(`[getPastAnalysesAction] Fetching for trimmed userId: ${userId}`);

  if (!userId || typeof userId !== 'string' || userId.trim() === "") { // Redundant check after trim
    const errorMsg = `[getPastAnalysesAction] CRITICAL: userId is invalid (null, empty, or whitespace after trim): '${userIdInput}' -> '${userId}'. Aborting.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const analysesCollectionPath = `users/${userId}/analyses`;
  const analysesCol = collection(db, analysesCollectionPath);
  const q = query(analysesCol, orderBy('createdAt', 'desc'));

  console.log(`[getPastAnalysesAction] Attempting to query Firestore collection at path: '${analysesCollectionPath}' for userId: '${userId}' (Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV VAR NOT SET'})`);

  try {
    const snapshot = await getDocs(q);
    console.log(`[getPastAnalysesAction] Found ${snapshot.docs.length} analyses for userId: ${userId} at path ${analysesCollectionPath}`);

    const mapTimestampToISO = (timestampFieldValue: any): string | undefined => {
      if (timestampFieldValue && typeof timestampFieldValue.toDate === 'function') {
        return (timestampFieldValue as Timestamp).toDate().toISOString();
      }
      if (typeof timestampFieldValue === 'string') {
        if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(timestampFieldValue)) {
            return timestampFieldValue;
        }
      }
      return undefined;
    };

    return snapshot.docs.map(docSnap => {
      const data = docSnap.data();

      const analysisResult: Partial<Analysis> = {
        id: docSnap.id,
        userId: data.userId as string,
        fileName: data.fileName as string,
        status: data.status as Analysis['status'],
        progress: data.progress as number,
        uploadProgress: data.uploadProgress as number | undefined,
        powerQualityDataUrl: data.powerQualityDataUrl as string | undefined,
        powerQualityDataSummary: data.powerQualityDataSummary as string | undefined,
        isDataTruncated: data.isDataTruncated as boolean | undefined,
        identifiedRegulations: data.identifiedRegulations as string[] | undefined,
        summary: data.summary as string | undefined,
        complianceReport: data.complianceReport as string | undefined,
        errorMessage: data.errorMessage as string | undefined,
        tags: (data.tags || []) as string[],
      };

      const createdAt = mapTimestampToISO(data.createdAt);
      if (createdAt) {
        analysisResult.createdAt = createdAt;
      } else {
        console.warn(`[getPastAnalysesAction] Analysis ${docSnap.id} for user ${userId} has missing or invalid 'createdAt'. Using epoch as fallback.`);
        analysisResult.createdAt = new Date(0).toISOString();
      }

      const completedAt = mapTimestampToISO(data.completedAt);
      if (completedAt) {
        analysisResult.completedAt = completedAt;
      }

      return analysisResult as Analysis;
    });
  } catch (error) {
    const originalErrorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[getPastAnalysesAction] Error fetching analyses for userId ${userId} from path ${analysesCollectionPath}:`, originalErrorMessage, error);
    if (error instanceof FirestoreError && (error.code === 'permission-denied' || error.code === 7)) {
        console.error(`[getPastAnalysesAction] PERMISSION_DENIED while querying path '${analysesCollectionPath}' for userId '${userId}'. Check Firestore rules against active project '${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV VAR NOT SET'}'. Auth state in rules might be incorrect or userId mismatch. Firestore error code: ${error.code}, message: ${error.message}`);
    }
    throw new Error(`Falha ao buscar análises anteriores: ${originalErrorMessage}`);
  }
}

export async function addTagToAction(userIdInput: string, analysisIdInput: string, tag: string): Promise<void> {
  const userId = userIdInput ? userIdInput.trim() : '';
  const analysisId = analysisIdInput ? analysisIdInput.trim() : '';
  const trimmedTag = tag ? tag.trim() : '';

  if (!userId || typeof userId !== 'string' || userId.trim() === "" || !analysisId || typeof analysisId !== 'string' || analysisId.trim() === "" || !trimmedTag) {
    const errorMsg = `[addTagToAction] CRITICAL: Invalid parameters. userId: '${userIdInput}' -> '${userId}', analysisId: '${analysisIdInput}' -> '${analysisId}', tag: '${tag}' -> '${trimmedTag}'. Aborting.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
  const analysisRef = doc(db, analysisDocPath);
  console.log(`[addTagToAction] Attempting to add tag '${trimmedTag}' to analysis '${analysisId}' for user '${userId}' at path '${analysisDocPath}'. Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV VAR NOT SET'}`);
  try {
    const analysisSnap = await getDoc(analysisRef);
    if (!analysisSnap.exists()) {
      const errorMsg = `[addTagToAction] Analysis not found: ${analysisId} (path: ${analysisDocPath}) for user ${userId}`;
      console.error(errorMsg);
      throw new Error("Análise não encontrada.");
    }
    const currentTags = analysisSnap.data().tags || [];
    if (!currentTags.includes(trimmedTag)) {
      await updateDoc(analysisRef, { tags: [...currentTags, trimmedTag] });
      console.log(`[addTagToAction] Tag "${trimmedTag}" added to analysis ${analysisId} (path: ${analysisDocPath})`);
    }
  } catch (error) {
    const originalErrorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[addTagToAction] Error adding tag to analysis ${analysisId} (path: ${analysisDocPath}) for user ${userId}:`, originalErrorMessage);
    throw new Error(originalErrorMessage);
  }
}

export async function removeTagAction(userIdInput: string, analysisIdInput: string, tagToRemove: string): Promise<void> {
  const userId = userIdInput ? userIdInput.trim() : '';
  const analysisId = analysisIdInput ? analysisIdInput.trim() : '';
  const trimmedTagToRemove = tagToRemove ? tagToRemove.trim() : '';

  if (!userId || typeof userId !== 'string' || userId.trim() === "" || !analysisId || typeof analysisId !== 'string' || analysisId.trim() === "" || !trimmedTagToRemove) {
    const errorMsg = `[removeTagAction] CRITICAL: Invalid parameters. userId: '${userIdInput}' -> '${userId}', analysisId: '${analysisIdInput}' -> '${analysisId}', tagToRemove: '${tagToRemove}' -> '${trimmedTagToRemove}'. Aborting.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
  const analysisRef = doc(db, analysisDocPath);
  console.log(`[removeTagAction] Attempting to remove tag '${trimmedTagToRemove}' from analysis '${analysisId}' for user '${userId}' at path '${analysisDocPath}'. Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV VAR NOT SET'}`);
  try {
    const analysisSnap = await getDoc(analysisRef);
    if (!analysisSnap.exists()) {
      const errorMsg = `[removeTagAction] Analysis not found: ${analysisId} (path: ${analysisDocPath}) for user ${userId}`;
      console.error(errorMsg);
      throw new Error("Análise não encontrada.");
    }
    const currentTags = analysisSnap.data().tags || [];
    await updateDoc(analysisRef, { tags: currentTags.filter((t: string) => t !== trimmedTagToRemove) });
    console.log(`[removeTagAction] Tag "${trimmedTagToRemove}" removed from analysis ${analysisId} (path: ${analysisDocPath})`);
  } catch (error) {
    const originalErrorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[removeTagAction] Error removing tag from analysis ${analysisId} (path: ${analysisDocPath}) for user ${userId}:`, originalErrorMessage);
    throw new Error(originalErrorMessage);
  }
}

export async function deleteAnalysisAction(userIdInput: string, analysisIdInput: string): Promise<void> {
  const userId = userIdInput ? userIdInput.trim() : '';
  const analysisId = analysisIdInput ? analysisIdInput.trim() : '';
  console.log(`[deleteAnalysisAction] Soft deleting analysisId: ${analysisId} for userId: ${userId}`);

  if (!userId || typeof userId !== 'string' || userId.trim() === "" || !analysisId || typeof analysisId !== 'string' || analysisId.trim() === "") {
    const errorMsg = `[deleteAnalysisAction] CRITICAL: userId ('${userIdInput}' -> '${userId}') or analysisId ('${analysisIdInput}' -> '${analysisId}') is invalid. Aborting.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
  const analysisRef = doc(db, analysisDocPath);
  console.log(`[deleteAnalysisAction] Attempting to mark analysis '${analysisId}' as 'deleted' for user '${userId}' at path '${analysisDocPath}'. Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV VAR NOT SET'}`);
  try {
    const analysisSnap = await getDoc(analysisRef);
    if (!analysisSnap.exists()) {
        const errorMsg = `[deleteAnalysisAction] Analysis not found: ${analysisId} (path: ${analysisDocPath}) for user ${userId}. Cannot mark as deleted.`;
        console.error(errorMsg);
        throw new Error("Análise não encontrada para exclusão.");
    }
    await updateDoc(analysisRef, { status: 'deleted', summary: null, complianceReport: null, identifiedRegulations: null, powerQualityDataSummary: null, errorMessage: 'Análise excluída pelo usuário.' });
    console.log(`[deleteAnalysisAction] Analysis ${analysisId} (path: ${analysisDocPath}) marked as deleted for user ${userId}.`);
  } catch (error) {
    const originalErrorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[deleteAnalysisAction] Error soft deleting analysis ${analysisId} (path: ${analysisDocPath}) for user ${userId}:`, originalErrorMessage);
    throw new Error(originalErrorMessage);
  }
}
