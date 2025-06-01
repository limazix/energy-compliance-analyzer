
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
    throw new Error(`Failed to get download URL: ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log(`[getFileContentFromStorage] Got download URL: ${downloadURL}`);
  
  let response;
  try {
    response = await fetch(downloadURL);
  } catch (error) {
    console.error(`[getFileContentFromStorage] Network error fetching ${downloadURL}:`, error);
    throw new Error(`Network error fetching file: ${error instanceof Error ? error.message : String(error)}`);
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
     throw new Error(`Error reading file content: ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log(`[getFileContentFromStorage] File content fetched. Length: ${textContent.length}`);
  return textContent;
}

export async function processAnalysisFile(analysisId: string, userId: string): Promise<void> {
  console.log(`[processAnalysisFile] Starting for analysisId: ${analysisId}, userId: ${userId}`);
  
  if (!userId || userId.trim() === "") {
    const criticalMsg = `[processAnalysisFile] CRITICAL: userId is null, empty, or whitespace ('${userId}') for analysisId: ${analysisId}. Aborting.`;
    console.error(criticalMsg);
    // Attempt to update Firestore, but this might be problematic if analysisId doesn't exist or userId was needed for path
    try {
        // Try to update if a valid analysisId was somehow created with a bad userId path component
        // This path might be incorrect if userId was part of the path to this doc and was bad initially.
        // Assuming a generic 'analyses_errors' collection or a specific doc if it exists.
        // For simplicity, we'll just log and rely on client to show initial error if doc creation failed.
        // If the doc *was* created but userId is bad *now*, we might try updating it.
        const tempAnalysisRef = doc(db, 'users', 'UNKNOWN_USER_ID_ERROR', 'analyses', analysisId); // Fallback path idea
        // A better approach would be to ensure this function is never called with an invalid userId.
        // The client-side `useAnalysisManager` should prevent this.
        // If a document *does* exist at `users/${userId}/analyses/${analysisId}` despite bad `userId`,
        // then the Firestore rules would prevent this update if the `userId` parameter doesn't match auth.
        // This situation is complex; primary validation should be client-side before calling this.
    } catch (e) {
        console.error(`[processAnalysisFile] Error trying to handle invalid userId scenario for ${analysisId}:`, e);
    }
    // throw new Error(criticalMsg); // Optionally throw to indicate failure to the caller
    return; // Stop processing
  }

  const analysisRef = doc(db, 'users', userId, 'analyses', analysisId);
  const MAX_ERROR_MESSAGE_LENGTH = 1500; 

  let analysisSnap;
  try {
    analysisSnap = await getDoc(analysisRef);
    if (!analysisSnap.exists()) {
      console.error(`[processAnalysisFile] Analysis document ${analysisId} not found at path users/${userId}/analyses/${analysisId}. Aborting.`);
      return; 
    }
  } catch (error) {
    console.error(`[processAnalysisFile] Failed to get analysis document ${analysisId} (path users/${userId}/analyses/${analysisId}):`, error);
    return;
  }

  const analysisData = analysisSnap.data() as Analysis;
  const filePath = analysisData.powerQualityDataUrl;

  if (!filePath) {
    console.error(`[processAnalysisFile] File path (powerQualityDataUrl) not found for analysisId: ${analysisId}.`);
    await updateDoc(analysisRef, { status: 'error', errorMessage: 'URL do arquivo de dados não encontrada no registro da análise.', progress: 0 });
    return;
  }
  
  try {
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
      return;
    }
    
    console.log(`[processAnalysisFile] Calling identifyAEEEResolutions. Data length: ${powerQualityData.length}`);
    let resolutionsOutput;
    try {
      resolutionsOutput = await identifyAEEEResolutions({ powerQualityData });
    } catch (aiError) {
      console.error(`[processAnalysisFile] Error from identifyAEEEResolutions for ${analysisId}:`, aiError);
      const errMsg = aiError instanceof Error ? aiError.message : String(aiError);
      await updateDoc(analysisRef, { status: 'error', errorMessage: `Falha na identificação de resoluções pela IA: ${errMsg.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`, progress: 25 });
      return;
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
      return;
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
            detailedErrorMessage += ` Stack: ${error.stack.substring(0, 500)}`; // Limit stack length
        }
    } else {
        detailedErrorMessage = String(error);
    }
    const finalErrorMessage = detailedErrorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH);

    try {
      const currentSnap = await getDoc(analysisRef); // Re-fetch, ensure it exists
      if (currentSnap.exists()) {
        console.log(`[processAnalysisFile] Attempting to update Firestore with error status for analysis ${analysisId}. Error: ${finalErrorMessage.substring(0, 200)}...`);
        await updateDoc(analysisRef, { status: 'error', errorMessage: finalErrorMessage, progress: 0 });
        console.log(`[processAnalysisFile] Firestore updated with error status for analysis ${analysisId}.`);
      } else {
         console.error(`[processAnalysisFile] CRITICAL: Analysis document ${analysisId} (path users/${userId}/analyses/${analysisId}) not found when trying to update with overall error status.`);
      }
    } catch (firestoreError) {
      console.error(`[processAnalysisFile] CRITICAL: Failed to update Firestore with overall error status for analysis ${analysisId} (Original error: ${finalErrorMessage.substring(0,200)}...):`, firestoreError);
    }
  }
}


export async function getPastAnalysesAction(userId: string): Promise<Analysis[]> {
  console.log(`[getPastAnalysesAction] Fetching for userId: ${userId}`);
  if (!userId || userId.trim() === "") {
    console.error("[getPastAnalysesAction] User ID is required and cannot be empty.");
    throw new Error("User ID é obrigatório e não pode ser vazio.");
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
    throw error; 
  }
}

export async function addTagToAction(userId: string, analysisId: string, tag: string): Promise<void> {
  console.log(`[addTagToAction] userId: ${userId}, analysisId: ${analysisId}, tag: ${tag}`);
  if (!userId || userId.trim() === "" || !analysisId || !tag) {
    console.error("[addTagToAction] User ID, Analysis ID, and Tag are required and cannot be empty.");
    throw new Error("User ID, Analysis ID e Tag são obrigatórios e não podem ser vazios.");
  }
  const analysisRef = doc(db, 'users', userId, 'analyses', analysisId);
  try {
    const analysisSnap = await getDoc(analysisRef);
    if (!analysisSnap.exists()) {
      console.error(`[addTagToAction] Analysis not found: ${analysisId} for user ${userId}`);
      throw new Error("Análise não encontrada.");
    }
    const currentTags = analysisSnap.data().tags || [];
    if (!currentTags.includes(tag)) {
      await updateDoc(analysisRef, { tags: [...currentTags, tag] });
      console.log(`[addTagToAction] Tag "${tag}" added to analysis ${analysisId}`);
    } else {
      console.log(`[addTagToAction] Tag "${tag}" already exists on analysis ${analysisId}`);
    }
  } catch (error) {
    console.error(`[addTagToAction] Error adding tag to analysis ${analysisId} for user ${userId}:`, error);
    throw error;
  }
}

export async function removeTagAction(userId: string, analysisId: string, tagToRemove: string): Promise<void> {
  console.log(`[removeTagAction] userId: ${userId}, analysisId: ${analysisId}, tagToRemove: ${tagToRemove}`);
  if (!userId || userId.trim() === "" || !analysisId || !tagToRemove) {
    console.error("[removeTagAction] User ID, Analysis ID, and Tag are required and cannot be empty.");
    throw new Error("User ID, Analysis ID e Tag são obrigatórios e não podem ser vazios.");
  }
  const analysisRef = doc(db, 'users', userId, 'analyses', analysisId);
  try {
    const analysisSnap = await getDoc(analysisRef);
    if (!analysisSnap.exists()) {
      console.error(`[removeTagAction] Analysis not found: ${analysisId} for user ${userId}`);
      throw new Error("Análise não encontrada.");
    }
    const currentTags = analysisSnap.data().tags || [];
    await updateDoc(analysisRef, { tags: currentTags.filter((t: string) => t !== tagToRemove) });
    console.log(`[removeTagAction] Tag "${tagToRemove}" removed from analysis ${analysisId}`);
  } catch (error) {
    console.error(`[removeTagAction] Error removing tag from analysis ${analysisId} for user ${userId}:`, error);
    throw error;
  }
}

export async function deleteAnalysisAction(userId: string, analysisId: string): Promise<void> {
  console.log(`[deleteAnalysisAction] Soft deleting analysisId: ${analysisId} for userId: ${userId}`);
  if (!userId || userId.trim() === "" || !analysisId) {
    console.error("[deleteAnalysisAction] User ID and Analysis ID are required and cannot be empty.");
    throw new Error("User ID e Analysis ID são obrigatórios e não podem ser vazios.");
  }
  const analysisRef = doc(db, 'users', userId, 'analyses', analysisId);
  try {
    await updateDoc(analysisRef, { status: 'deleted', summary: null, complianceReport: null, identifiedRegulations: null, errorMessage: 'Análise excluída pelo usuário.' });
    console.log(`[deleteAnalysisAction] Analysis ${analysisId} marked as deleted for user ${userId}.`);
  } catch (error) {
    console.error(`[deleteAnalysisAction] Error soft deleting analysis ${analysisId} for user ${userId}:`, error);
    throw error;
  }
}
