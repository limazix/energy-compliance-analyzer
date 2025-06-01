
'use server';

import { Timestamp, addDoc, collection, doc, getDocs, orderBy, query, updateDoc, where, writeBatch, serverTimestamp, getDoc, FirestoreError } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { identifyAEEEResolutions } from '@/ai/flows/identify-aneel-resolutions';
import { analyzeComplianceReport } from '@/ai/flows/analyze-compliance-report';
import type { Analysis } from '@/types/analysis';

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

export async function processAnalysisFile(analysisId: string, userId: string): Promise<void> {
  console.log(`[processAnalysisFile] Starting for analysisId: ${analysisId}, userId: ${userId}`);

  if (!userId || typeof userId !== 'string' || userId.trim() === "") {
    const criticalMsg = `[processAnalysisFile] CRITICAL: userId is invalid (null, empty, or whitespace): '${userId}' for analysisId: ${analysisId}. Aborting.`;
    console.error(criticalMsg);
    throw new Error(criticalMsg);
  }
  if (!analysisId || typeof analysisId !== 'string' || analysisId.trim() === "") {
    const criticalMsg = `[processAnalysisFile] CRITICAL: analysisId is invalid (null, empty, or whitespace): '${analysisId}' for userId: ${userId}. Aborting.`;
    console.error(criticalMsg);
    throw new Error(criticalMsg);
  }

  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
  const analysisRef = doc(db, analysisDocPath);
  const MAX_ERROR_MESSAGE_LENGTH = 1500;

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

    console.log(`[processAnalysisFile] File path: ${filePath}. Current status: ${analysisData.status}. Updating to 'identifying_regulations'.`);
    if (analysisData.status === 'uploading' || analysisData.status === 'identifying_regulations' || !analysisData.status) {
       await updateDoc(analysisRef, { status: 'identifying_regulations', progress: 10 });
    }

    let powerQualityData;
    try {
      powerQualityData = await getFileContentFromStorage(filePath);
      console.log(`[processAnalysisFile] File content read for analysis ${analysisId}.`);
    } catch (fileError) {
      const errMsg = fileError instanceof Error ? fileError.message : String(fileError);
      console.error(`[processAnalysisFile] Error getting file content for ${analysisId} (path: ${analysisDocPath}):`, errMsg);
      await updateDoc(analysisRef, { status: 'error', errorMessage: `Falha ao ler arquivo: ${errMsg.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`, progress: 0 });
      throw new Error(errMsg);
    }

    console.log(`[processAnalysisFile] Calling identifyAEEEResolutions for analysis ${analysisId}.`);
    let resolutionsOutput;
    try {
      resolutionsOutput = await identifyAEEEResolutions({ powerQualityData });
    } catch (aiError) {
      const errMsg = aiError instanceof Error ? aiError.message : String(aiError);
      console.error(`[processAnalysisFile] Error from identifyAEEEResolutions for ${analysisId} (path: ${analysisDocPath}):`, errMsg);
      await updateDoc(analysisRef, { status: 'error', errorMessage: `Falha na identificação de resoluções pela IA: ${errMsg.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`, progress: 25 });
      throw new Error(errMsg);
    }

    const identifiedRegulations = resolutionsOutput.relevantResolutions;
    const identifiedRegulationsString = identifiedRegulations.join(', ');
    console.log(`[processAnalysisFile] Regulations identified for ${analysisId}: ${identifiedRegulationsString}. Updating status to 'assessing_compliance'.`);

    await updateDoc(analysisRef, {
      status: 'assessing_compliance',
      identifiedRegulations,
      progress: 50
    });

    console.log(`[processAnalysisFile] Calling analyzeComplianceReport for analysis ${analysisId}.`);
    let reportOutput;
    try {
      reportOutput = await analyzeComplianceReport({
        powerQualityData,
        identifiedRegulations: identifiedRegulationsString
      });
    } catch (aiError) {
      const errMsg = aiError instanceof Error ? aiError.message : String(aiError);
      console.error(`[processAnalysisFile] Error from analyzeComplianceReport for ${analysisId} (path: ${analysisDocPath}):`, errMsg);
      await updateDoc(analysisRef, { status: 'error', errorMessage: `Falha na análise de conformidade pela IA: ${errMsg.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`, progress: 50 });
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

    try {
      const currentSnap = await getDoc(analysisRef);
      if (currentSnap.exists()) {
        await updateDoc(analysisRef, { status: 'error', errorMessage: finalErrorMessageForFirestore, progress: 0 });
        console.log(`[processAnalysisFile] Firestore updated with error status for analysis ${analysisId} (path: ${analysisDocPath}).`);
      } else {
         console.error(`[processAnalysisFile] CRITICAL: Analysis document ${analysisId} (path ${analysisDocPath}) not found when trying to update with overall error status.`);
      }
    } catch (firestoreError) {
      const fsErrorMsg = firestoreError instanceof Error ? firestoreError.message : String(firestoreError);
      console.error(`[processAnalysisFile] CRITICAL: Failed to update Firestore with overall error status for analysis ${analysisId} (path: ${analysisDocPath}) (Original error: ${finalErrorMessageForFirestore.substring(0,200)}...):`, fsErrorMsg);
    }
    const clientSafeErrorMessage = `Erro no processamento da análise (ID: ${analysisId}). Consulte os logs do servidor para detalhes.`;
    throw new Error(clientSafeErrorMessage);
  }
}


export async function getPastAnalysesAction(userId: string): Promise<Analysis[]> {
  console.log(`[getPastAnalysesAction] Fetching for userId: ${userId}`);
  if (!userId || typeof userId !== 'string' || userId.trim() === "") {
    const errorMsg = `[getPastAnalysesAction] CRITICAL: userId is invalid (null, empty, or whitespace): '${userId}'. Aborting.`;
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
        // Basic check if it might be an ISO string already
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
        // createdAt is mandatory in Analysis type. Fallback or log error.
        console.warn(`[getPastAnalysesAction] Analysis ${docSnap.id} for user ${userId} has missing or invalid 'createdAt'. Using epoch as fallback.`);
        analysisResult.createdAt = new Date(0).toISOString(); 
      }

      const completedAt = mapTimestampToISO(data.completedAt);
      if (completedAt) {
        analysisResult.completedAt = completedAt;
      }
      // completedAt is optional, so it's fine if it remains undefined

      return analysisResult as Analysis;
    });
  } catch (error) {
    const originalErrorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[getPastAnalysesAction] Error fetching analyses for userId ${userId} from path ${analysesCollectionPath}:`, originalErrorMessage, error);
    if (error instanceof FirestoreError && (error.code === 'permission-denied' || error.code === 7)) {
        console.error(`[getPastAnalysesAction] PERMISSION_DENIED while querying path '${analysesCollectionPath}' for userId '${userId}'. Check Firestore rules against active project '${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV VAR NOT SET'}'. Auth state in rules might be incorrect or userId mismatch.`);
    }
    // Re-throw a generic serializable error for the client
    throw new Error(`Falha ao buscar análises anteriores: ${originalErrorMessage}`);
  }
}

export async function addTagToAction(userId: string, analysisId: string, tag: string): Promise<void> {
  if (!userId || typeof userId !== 'string' || userId.trim() === "" || !analysisId || typeof analysisId !== 'string' || analysisId.trim() === "" || !tag || tag.trim() === "") {
    const errorMsg = `[addTagToAction] CRITICAL: Invalid parameters. userId: '${userId}', analysisId: '${analysisId}', tag: '${tag}'. Aborting.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
  const analysisRef = doc(db, analysisDocPath);
  console.log(`[addTagToAction] Attempting to add tag '${tag}' to analysis '${analysisId}' for user '${userId}' at path '${analysisDocPath}'. Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV VAR NOT SET'}`);
  try {
    const analysisSnap = await getDoc(analysisRef);
    if (!analysisSnap.exists()) {
      const errorMsg = `[addTagToAction] Analysis not found: ${analysisId} (path: ${analysisDocPath}) for user ${userId}`;
      console.error(errorMsg);
      throw new Error("Análise não encontrada.");
    }
    const currentTags = analysisSnap.data().tags || [];
    if (!currentTags.includes(tag.trim())) {
      await updateDoc(analysisRef, { tags: [...currentTags, tag.trim()] });
      console.log(`[addTagToAction] Tag "${tag.trim()}" added to analysis ${analysisId} (path: ${analysisDocPath})`);
    }
  } catch (error) {
    const originalErrorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[addTagToAction] Error adding tag to analysis ${analysisId} (path: ${analysisDocPath}) for user ${userId}:`, originalErrorMessage);
    throw new Error(originalErrorMessage);
  }
}

export async function removeTagAction(userId: string, analysisId: string, tagToRemove: string): Promise<void> {
  if (!userId || typeof userId !== 'string' || userId.trim() === "" || !analysisId || typeof analysisId !== 'string' || analysisId.trim() === "" || !tagToRemove || tagToRemove.trim() === "") {
    const errorMsg = `[removeTagAction] CRITICAL: Invalid parameters. userId: '${userId}', analysisId: '${analysisId}', tagToRemove: '${tagToRemove}'. Aborting.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
  const analysisRef = doc(db, analysisDocPath);
  console.log(`[removeTagAction] Attempting to remove tag '${tagToRemove}' from analysis '${analysisId}' for user '${userId}' at path '${analysisDocPath}'. Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV VAR NOT SET'}`);
  try {
    const analysisSnap = await getDoc(analysisRef);
    if (!analysisSnap.exists()) {
      const errorMsg = `[removeTagAction] Analysis not found: ${analysisId} (path: ${analysisDocPath}) for user ${userId}`;
      console.error(errorMsg);
      throw new Error("Análise não encontrada.");
    }
    const currentTags = analysisSnap.data().tags || [];
    await updateDoc(analysisRef, { tags: currentTags.filter((t: string) => t !== tagToRemove.trim()) });
    console.log(`[removeTagAction] Tag "${tagToRemove.trim()}" removed from analysis ${analysisId} (path: ${analysisDocPath})`);
  } catch (error) {
    const originalErrorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[removeTagAction] Error removing tag from analysis ${analysisId} (path: ${analysisDocPath}) for user ${userId}:`, originalErrorMessage);
    throw new Error(originalErrorMessage);
  }
}

export async function deleteAnalysisAction(userId: string, analysisId: string): Promise<void> {
  console.log(`[deleteAnalysisAction] Soft deleting analysisId: ${analysisId} for userId: ${userId}`);
  if (!userId || typeof userId !== 'string' || userId.trim() === "" || !analysisId || typeof analysisId !== 'string' || analysisId.trim() === "") {
    const errorMsg = `[deleteAnalysisAction] CRITICAL: userId ('${userId}') or analysisId ('${analysisId}') is invalid. Aborting.`;
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
    await updateDoc(analysisRef, { status: 'deleted', summary: null, complianceReport: null, identifiedRegulations: null, errorMessage: 'Análise excluída pelo usuário.' });
    console.log(`[deleteAnalysisAction] Analysis ${analysisId} (path: ${analysisDocPath}) marked as deleted for user ${userId}.`);
  } catch (error) {
    const originalErrorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[deleteAnalysisAction] Error soft deleting analysis ${analysisId} (path: ${analysisDocPath}) for user ${userId}:`, originalErrorMessage);
    throw new Error(originalErrorMessage);
  }
}


    