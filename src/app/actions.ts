'use server';

import { Timestamp, addDoc, collection, doc, getDocs, orderBy, query, updateDoc, where, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { identifyAEEEResolutions } from '@/ai/flows/identify-aneel-resolutions';
import { analyzeComplianceReport } from '@/ai/flows/analyze-compliance-report';
import type { Analysis } from '@/types/analysis';

// Helper function to read file content from Firebase Storage
async function getFileContentFromStorage(filePath: string): Promise<string> {
  const fileRef = storageRef(storage, filePath);
  const downloadURL = await getDownloadURL(fileRef);
  const response = await fetch(downloadURL);
  if (!response.ok) {
    throw new Error(`Failed to download file from GCS: ${response.statusText}`);
  }
  return response.text();
}

export async function processAnalysisFile(analysisId: string, userId: string): Promise<void> {
  const analysisRef = doc(db, 'users', userId, 'analyses', analysisId);

  try {
    const analysisSnap = await getDoc(analysisRef);
    if (!analysisSnap.exists()) {
      throw new Error('Analysis document not found.');
    }
    const analysisData = analysisSnap.data() as Analysis;
    const filePath = analysisData.powerQualityDataUrl;

    if (!filePath) {
      await updateDoc(analysisRef, { status: 'error', errorMessage: 'File path not found.' });
      return;
    }
    
    await updateDoc(analysisRef, { status: 'identifying_regulations', progress: 25 });
    const powerQualityData = await getFileContentFromStorage(filePath);

    const resolutionsOutput = await identifyAEEEResolutions({ powerQualityData });
    const identifiedRegulations = resolutionsOutput.relevantResolutions;
    await updateDoc(analysisRef, { 
      status: 'assessing_compliance', 
      identifiedRegulations,
      progress: 50 
    });
    
    const reportOutput = await analyzeComplianceReport({ 
      powerQualityData, 
      identifiedRegulations: identifiedRegulations.join(', ') 
    });
    await updateDoc(analysisRef, {
      status: 'completed',
      summary: reportOutput.summary,
      complianceReport: reportOutput.complianceReport,
      progress: 100,
      completedAt: serverTimestamp(),
    });

  } catch (error) {
    console.error('Error processing analysis:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during processing.';
    await updateDoc(analysisRef, { status: 'error', errorMessage, progress: 0 });
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
