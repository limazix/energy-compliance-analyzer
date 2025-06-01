
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
    console.error(`[getFileContentFromStorage] Failed to get download URL for ${filePath}:`, error);
    if (error instanceof Error) throw error;
    throw new Error(`Failed to get download URL: ${String(error)}`);
  }
  console.log(`[getFileContentFromStorage] Got download URL: ${downloadURL}`);

  let response;
  try {
    response = await fetch(downloadURL);
  } catch (error) {
    console.error(`[getFileContentFromStorage] Network error fetching ${downloadURL}:`, error);
    if (error instanceof Error) throw error;
    throw new Error(`Network error fetching file: ${String(error)}`);
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
     console.error(`[getFileContentFromStorage] Error reading response text:`, error);
     if (error instanceof Error) throw error;
     throw new Error(`Error reading file content: ${String(error)}`);
  }
  console.log(`[getFileContentFromStorage] File content fetched. Length: ${textContent.length}`);
  return textContent;
}

export async function processAnalysisFile(analysisId: string, userId: string): Promise<void> {
  console.log(`[processAnalysisFile] Starting for analysisId: ${analysisId}, userId: ${userId}`);

  if (!userId || userId.trim() === "") {
    const criticalMsg = `[processAnalysisFile] CRITICAL: userId is null, empty, or whitespace ('${userId}') for analysisId: ${analysisId}. Aborting.`;
    console.error(criticalMsg);
    throw new Error(criticalMsg);
  }

  const analysisRef = doc(db, 'users', userId, 'analyses', analysisId);
  const MAX_ERROR_MESSAGE_LENGTH = 1500;

  try {
    let analysisSnap = await getDoc(analysisRef);
    if (!analysisSnap.exists()) {
      const notFoundMsg = `[processAnalysisFile] Analysis document ${analysisId} not found at path users/${userId}/analyses/${analysisId}. Aborting.`;
      console.error(notFoundMsg);
      throw new Error(notFoundMsg);
    }

    const analysisData = analysisSnap.data() as Analysis;
    const filePath = analysisData.powerQualityDataUrl;

    if (!filePath) {
      const noFilePathMsg = `[processAnalysisFile] File path (powerQualityDataUrl) not found for analysisId: ${analysisId}.`;
      console.error(noFilePathMsg);
      await updateDoc(analysisRef, { status: 'error', errorMessage: 'URL do arquivo de dados não encontrada no registro da análise.', progress: 0 });
      throw new Error(noFilePathMsg); // Throw error to signal failure
    }

    console.log(`[processAnalysisFile] File path: ${filePath}. Current status: ${analysisData.status}. Updating to 'identifying_regulations'.`);
    if (analysisData.status === 'uploading' || analysisData.status === 'identifying_regulations' || !analysisData.status) {
       await updateDoc(analysisRef, { status: 'identifying_regulations', progress: 10 });
    }

    let powerQualityData;
    try {
      powerQualityData = await getFileContentFromStorage(filePath);
      console.log(`[processAnalysisFile] File content read. Length: ${powerQualityData.length}.`);
    } catch (fileError) {
      console.error(`[processAnalysisFile] Error getting file content for ${analysisId}:`, fileError);
      const errMsg = fileError instanceof Error ? fileError.message : String(fileError);
      await updateDoc(analysisRef, { status: 'error', errorMessage: `Falha ao ler arquivo: ${errMsg.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`, progress: 0 });
      if (fileError instanceof Error) throw fileError;
      throw new Error(String(fileError));
    }

    console.log(`[processAnalysisFile] Calling identifyAEEEResolutions. Data length: ${powerQualityData.length}`);
    let resolutionsOutput;
    try {
      resolutionsOutput = await identifyAEEEResolutions({ powerQualityData });
    } catch (aiError) {
      console.error(`[processAnalysisFile] Error from identifyAEEEResolutions for ${analysisId}:`, aiError);
      const errMsg = aiError instanceof Error ? aiError.message : String(aiError);
      await updateDoc(analysisRef, { status: 'error', errorMessage: `Falha na identificação de resoluções pela IA: ${errMsg.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`, progress: 25 });
      if (aiError instanceof Error) throw aiError;
      throw new Error(String(aiError));
    }

    const identifiedRegulations = resolutionsOutput.relevantResolutions;
    const identifiedRegulationsString = identifiedRegulations.join(', ');
    console.log(`[processAnalysisFile] Regulations identified: ${identifiedRegulationsString}. Updating status to 'assessing_compliance'.`);

    await updateDoc(analysisRef, {
      status: 'assessing_compliance',
      identifiedRegulations,
      progress: 50
    });

    console.log(`[processAnalysisFile] Calling analyzeComplianceReport. Data length: ${powerQualityData.length}, Regulations: ${identifiedRegulationsString}`);
    let reportOutput;
    try {
      reportOutput = await analyzeComplianceReport({
        powerQualityData,
        identifiedRegulations: identifiedRegulationsString
      });
    } catch (aiError) {
      console.error(`[processAnalysisFile] Error from analyzeComplianceReport for ${analysisId}:`, aiError);
      const errMsg = aiError instanceof Error ? aiError.message : String(aiError);
      await updateDoc(analysisRef, { status: 'error', errorMessage: `Falha na análise de conformidade pela IA: ${errMsg.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`, progress: 50 });
      if (aiError instanceof Error) throw aiError;
      throw new Error(String(aiError));
    }

    console.log(`[processAnalysisFile] Compliance report generated. Summary (first 100 chars): ${reportOutput.summary.substring(0, 100)}... Updating status to 'completed'.`);

    await updateDoc(analysisRef, {
      status: 'completed',
      summary: reportOutput.summary,
      complianceReport: reportOutput.complianceReport,
      progress: 100,
      completedAt: serverTimestamp(),
    });
    console.log(`[processAnalysisFile] Analysis ${analysisId} completed successfully for user ${userId}.`);

  } catch (error) {
    console.error(`[processAnalysisFile] Overall error processing analysis ${analysisId} for user ${userId}:`, error);
    let detailedErrorMessage = 'Erro desconhecido durante o processamento.';
    if (error instanceof Error) {
        detailedErrorMessage = `Error: ${error.message}`;
        if (error.stack) {
            detailedErrorMessage += ` Stack: ${error.stack.substring(0, 500)}`;
        }
    } else {
        detailedErrorMessage = String(error);
    }
    const finalErrorMessage = detailedErrorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH);

    try {
      // Attempt to update Firestore with the error status as a best effort
      const currentSnap = await getDoc(analysisRef);
      if (currentSnap.exists()) {
        await updateDoc(analysisRef, { status: 'error', errorMessage: finalErrorMessage, progress: 0 });
        console.log(`[processAnalysisFile] Firestore updated with error status for analysis ${analysisId}.`);
      } else {
         console.error(`[processAnalysisFile] CRITICAL: Analysis document ${analysisId} (path users/${userId}/analyses/${analysisId}) not found when trying to update with overall error status.`);
      }
    } catch (firestoreError) {
      // Log this secondary error, but the primary goal is to throw the original error
      console.error(`[processAnalysisFile] CRITICAL: Failed to update Firestore with overall error status for analysis ${analysisId} (Original error: ${finalErrorMessage.substring(0,200)}...):`, firestoreError);
    }
    // ALWAYS re-throw the original error (or a wrapped version) to the client
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(String(error));
  }
}


export async function getPastAnalysesAction(userId: string): Promise<Analysis[]> {
  console.log(`[getPastAnalysesAction] Fetching for userId: ${userId}`);
  if (!userId || userId.trim() === "") {
    const errorMsg = "[getPastAnalysesAction] User ID é obrigatório e não pode ser vazio.";
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const analysesCol = collection(db, 'users', userId, 'analyses');
  const q = query(analysesCol, orderBy('createdAt', 'desc'));

  try {
    const snapshot = await getDocs(q);
    console.log(`[getPastAnalysesAction] Found ${snapshot.docs.length} analyses for userId: ${userId}`);
    return snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: (data.createdAt as Timestamp)?.toDate().toISOString(),
        completedAt: (data.completedAt as Timestamp)?.toDate().toISOString(),
      } as Analysis;
    });
  } catch (error) {
    console.error(`[getPastAnalysesAction] Error fetching analyses for userId ${userId}:`, error);
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }
}

export async function addTagToAction(userId: string, analysisId: string, tag: string): Promise<void> {
  console.log(`[addTagToAction] userId: ${userId}, analysisId: ${analysisId}, tag: ${tag}`);
  if (!userId || userId.trim() === "" || !analysisId || !tag || tag.trim() === "") {
    const errorMsg = "[addTagToAction] User ID, Analysis ID e Tag (não vazia) são obrigatórios.";
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const analysisRef = doc(db, 'users', userId, 'analyses', analysisId);
  try {
    const analysisSnap = await getDoc(analysisRef);
    if (!analysisSnap.exists()) {
      const errorMsg = `[addTagToAction] Analysis not found: ${analysisId} for user ${userId}`;
      console.error(errorMsg);
      throw new Error("Análise não encontrada.");
    }
    const currentTags = analysisSnap.data().tags || [];
    if (!currentTags.includes(tag.trim())) {
      await updateDoc(analysisRef, { tags: [...currentTags, tag.trim()] });
      console.log(`[addTagToAction] Tag "${tag.trim()}" added to analysis ${analysisId}`);
    } else {
      console.log(`[addTagToAction] Tag "${tag.trim()}" already exists on analysis ${analysisId}`);
    }
  } catch (error) {
    console.error(`[addTagToAction] Error adding tag to analysis ${analysisId} for user ${userId}:`, error);
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }
}

export async function removeTagAction(userId: string, analysisId: string, tagToRemove: string): Promise<void> {
  console.log(`[removeTagAction] userId: ${userId}, analysisId: ${analysisId}, tagToRemove: ${tagToRemove}`);
  if (!userId || userId.trim() === "" || !analysisId || !tagToRemove || tagToRemove.trim() === "") {
    const errorMsg = "[removeTagAction] User ID, Analysis ID e Tag (não vazia) são obrigatórios.";
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const analysisRef = doc(db, 'users', userId, 'analyses', analysisId);
  try {
    const analysisSnap = await getDoc(analysisRef);
    if (!analysisSnap.exists()) {
      const errorMsg = `[removeTagAction] Analysis not found: ${analysisId} for user ${userId}`;
      console.error(errorMsg);
      throw new Error("Análise não encontrada.");
    }
    const currentTags = analysisSnap.data().tags || [];
    await updateDoc(analysisRef, { tags: currentTags.filter((t: string) => t !== tagToRemove.trim()) });
    console.log(`[removeTagAction] Tag "${tagToRemove.trim()}" removed from analysis ${analysisId}`);
  } catch (error) {
    console.error(`[removeTagAction] Error removing tag from analysis ${analysisId} for user ${userId}:`, error);
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }
}

export async function deleteAnalysisAction(userId: string, analysisId: string): Promise<void> {
  console.log(`[deleteAnalysisAction] Soft deleting analysisId: ${analysisId} for userId: ${userId}`);
  if (!userId || userId.trim() === "" || !analysisId) {
    const errorMsg = "[deleteAnalysisAction] User ID e Analysis ID são obrigatórios e não podem ser vazios.";
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const analysisRef = doc(db, 'users', userId, 'analyses', analysisId);
  try {
    // Ensure the document exists before attempting to update it to 'deleted'
    const analysisSnap = await getDoc(analysisRef);
    if (!analysisSnap.exists()) {
        const errorMsg = `[deleteAnalysisAction] Analysis not found: ${analysisId} for user ${userId}. Cannot mark as deleted.`;
        console.error(errorMsg);
        throw new Error("Análise não encontrada para exclusão.");
    }
    await updateDoc(analysisRef, { status: 'deleted', summary: null, complianceReport: null, identifiedRegulations: null, errorMessage: 'Análise excluída pelo usuário.' });
    console.log(`[deleteAnalysisAction] Analysis ${analysisId} marked as deleted for user ${userId}.`);
  } catch (error) {
    console.error(`[deleteAnalysisAction] Error soft deleting analysis ${analysisId} for user ${userId}:`, error);
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }
}


    