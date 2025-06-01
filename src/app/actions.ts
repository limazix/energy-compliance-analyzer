
'use server';

import { Timestamp, addDoc, collection, doc, getDocs, orderBy, query, updateDoc, where, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { identifyAEEEResolutions } from '@/ai/flows/identify-aneel-resolutions';
import { analyzeComplianceReport } from '@/ai/flows/analyze-compliance-report';
import type { Analysis } from '@/types/analysis';

// Helper function to read file content from Firebase Storage
async function getFileContentFromStorage(filePath: string): Promise<string> {
  console.log(`[getFileContentFromStorage] Attempting to download: ${filePath}`);
  const fileRef = storageRef(storage, filePath);
  const downloadURL = await getDownloadURL(fileRef);
  console.log(`[getFileContentFromStorage] Got download URL: ${downloadURL}`);
  const response = await fetch(downloadURL);
  if (!response.ok) {
    console.error(`[getFileContentFromStorage] Failed to download. Status: ${response.status} ${response.statusText}`);
    throw new Error(`Failed to download file from GCS: ${response.statusText}`);
  }
  const textContent = await response.text();
  console.log(`[getFileContentFromStorage] File content fetched. Length: ${textContent.length}`);
  return textContent;
}

export async function processAnalysisFile(analysisId: string, userId: string): Promise<void> {
  console.log(`[processAnalysisFile] Starting for analysisId: ${analysisId}, userId: ${userId}`);
  const analysisRef = doc(db, 'users', userId, 'analyses', analysisId);

  try {
    const analysisSnap = await getDoc(analysisRef);
    if (!analysisSnap.exists()) {
      console.error(`[processAnalysisFile] Analysis document ${analysisId} not found.`);
      // Não há muito o que fazer aqui se o documento não existe, pois não podemos atualizar seu status.
      // Considerar se um erro deve ser lançado ou se deve retornar silenciosamente.
      // Lançar um erro parece mais apropriado para o chamador lidar.
      throw new Error('Analysis document not found.');
    }
    const analysisData = analysisSnap.data() as Analysis;
    const filePath = analysisData.powerQualityDataUrl;

    if (!filePath) {
      console.error(`[processAnalysisFile] File path not found for analysisId: ${analysisId}.`);
      await updateDoc(analysisRef, { status: 'error', errorMessage: 'File path not found.', progress: 0 });
      return;
    }
    
    console.log(`[processAnalysisFile] File path: ${filePath}. Updating status to 'identifying_regulations'.`);
    await updateDoc(analysisRef, { status: 'identifying_regulations', progress: 25 });
    
    const powerQualityData = await getFileContentFromStorage(filePath);
    console.log(`[processAnalysisFile] File content read. Length: ${powerQualityData.length}. Calling identifyAEEEResolutions.`);

    const resolutionsOutput = await identifyAEEEResolutions({ powerQualityData });
    const identifiedRegulations = resolutionsOutput.relevantResolutions;
    console.log(`[processAnalysisFile] Regulations identified: ${identifiedRegulations.join(', ')}. Updating status to 'assessing_compliance'.`);

    await updateDoc(analysisRef, { 
      status: 'assessing_compliance', 
      identifiedRegulations,
      progress: 50 
    });
    
    console.log(`[processAnalysisFile] Calling analyzeComplianceReport.`);
    const reportOutput = await analyzeComplianceReport({ 
      powerQualityData, 
      identifiedRegulations: identifiedRegulations.join(', ') 
    });
    console.log(`[processAnalysisFile] Compliance report generated. Summary (first 100 chars): ${reportOutput.summary.substring(0, 100)}... Updating status to 'completed'.`);

    await updateDoc(analysisRef, {
      status: 'completed',
      summary: reportOutput.summary,
      complianceReport: reportOutput.complianceReport,
      progress: 100,
      completedAt: serverTimestamp(),
    });
    console.log(`[processAnalysisFile] Analysis ${analysisId} completed successfully.`);

  } catch (error) {
    console.error(`[processAnalysisFile] Error processing analysis ${analysisId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during processing.';
    try {
      // Verifica se analysisRef foi inicializado antes de tentar usá-lo
      const analysisSnap = await getDoc(analysisRef); // Tenta buscar novamente para garantir que existe
      if (analysisSnap.exists()) {
        await updateDoc(analysisRef, { status: 'error', errorMessage, progress: 0 });
        console.log(`[processAnalysisFile] Firestore updated with error status for analysis ${analysisId}.`);
      } else {
         console.error(`[processAnalysisFile] CRITICAL: Analysis document ${analysisId} not found when trying to update error status.`);
      }
    } catch (firestoreError) {
      console.error(`[processAnalysisFile] CRITICAL: Failed to update Firestore with error status for analysis ${analysisId}:`, firestoreError);
    }
  }
}


export async function getPastAnalysesAction(userId: string): Promise<Analysis[]> {
  if (!userId) {
    throw new Error("User ID is required.");
  }
  const analysesCol = collection(db, 'users', userId, 'analyses');
  const q = query(analysesCol, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: (data.createdAt as Timestamp)?.toDate().toISOString(),
      completedAt: (data.completedAt as Timestamp)?.toDate().toISOString(),
    } as Analysis;
  });
}

export async function addTagToAction(userId: string, analysisId: string, tag: string): Promise<void> {
  if (!userId || !analysisId || !tag) {
    throw new Error("User ID, Analysis ID, and Tag are required.");
  }
  const analysisRef = doc(db, 'users', userId, 'analyses', analysisId);
  const analysisSnap = await getDoc(analysisRef);
  if (!analysisSnap.exists()) {
    throw new Error("Analysis not found.");
  }
  const currentTags = analysisSnap.data().tags || [];
  if (!currentTags.includes(tag)) {
    await updateDoc(analysisRef, { tags: [...currentTags, tag] });
  }
}

export async function removeTagAction(userId: string, analysisId: string, tagToRemove: string): Promise<void> {
  if (!userId || !analysisId || !tagToRemove) {
    throw new Error("User ID, Analysis ID, and Tag are required.");
  }
  const analysisRef = doc(db, 'users', userId, 'analyses', analysisId);
  const analysisSnap = await getDoc(analysisRef);
  if (!analysisSnap.exists()) {
    throw new Error("Analysis not found.");
  }
  const currentTags = analysisSnap.data().tags || [];
  await updateDoc(analysisRef, { tags: currentTags.filter((tag: string) => tag !== tagToRemove) });
}

export async function deleteAnalysisAction(userId: string, analysisId: string): Promise<void> {
   if (!userId || !analysisId) {
    throw new Error("User ID and Analysis ID are required.");
  }
  // Note: Deleting files from Firebase Storage should also be handled here if needed.
  // For simplicity, this action only deletes the Firestore document.
  const analysisRef = doc(db, 'users', userId, 'analyses', analysisId);
  await updateDoc(analysisRef, { status: 'deleted' }); // Soft delete or use deleteDoc(analysisRef) for hard delete
}

