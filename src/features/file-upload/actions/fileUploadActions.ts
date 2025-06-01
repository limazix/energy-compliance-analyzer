// src/features/file-upload/actions/fileUploadActions.ts
'use server';

import { addDoc, collection, doc, serverTimestamp, updateDoc, Timestamp, getDoc, FirestoreError } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Analysis } from '@/types/analysis';

const MAX_ERROR_MESSAGE_LENGTH = 1500;

export async function createInitialAnalysisRecordAction(
  userId: string,
  fileName: string
): Promise<{ analysisId?: string; error?: string }> {
  console.log(`[createInitialAnalysisRecordAction] Called for userId: ${userId}, fileName: ${fileName}`);
  if (!userId || userId.trim() === "") {
    const msg = "[createInitialAnalysisRecordAction] User ID é obrigatório e não pode ser vazio.";
    console.error(msg);
    return { error: msg };
  }
  if (!fileName || fileName.trim() === "") {
    const msg = "[createInitialAnalysisRecordAction] Nome do arquivo é obrigatório e não pode ser vazio.";
    console.error(msg);
    return { error: msg };
  }

  try {
    // Objeto para Firestore: campos opcionais devem ser null se não tiverem valor inicial.
    const analysisDataForFirestore: Omit<Analysis, 'id' | 'createdAt' | 'tags'> & { createdAt: Timestamp; tags: string[]; powerQualityDataUrl: null; powerQualityDataPreview: null; identifiedRegulations: null; summary: null; complianceReport: null; errorMessage: null; completedAt: null; uploadProgress: number; } = {
      userId,
      fileName,
      status: 'uploading',
      progress: 0, // Progresso geral da análise
      uploadProgress: 0, // Progresso específico do upload do arquivo
      tags: [], // Tags são obrigatórias, mas podem começar vazias
      createdAt: serverTimestamp() as Timestamp, // Firestore preencherá isso
      
      // Campos opcionais inicializados como null
      powerQualityDataUrl: null,
      powerQualityDataPreview: null,
      identifiedRegulations: null,
      summary: null,
      complianceReport: null,
      errorMessage: null,
      completedAt: null,
    };
    
    console.log('[createInitialAnalysisRecordAction] Data to be added to Firestore:', JSON.stringify(analysisDataForFirestore, null, 2));

    const analysisCollectionRef = collection(db, 'users', userId, 'analyses');
    const docRef = await addDoc(analysisCollectionRef, analysisDataForFirestore);
    console.log(`[createInitialAnalysisRecordAction] Document created with ID: ${docRef.id} for user ${userId}`);
    return { analysisId: docRef.id };
  } catch (error) {
    let errorMessage = 'Falha ao criar registro inicial da análise.';
    if (error instanceof FirestoreError) {
      errorMessage = `Falha ao criar registro inicial da análise: ${error.message} (Code: ${error.code})`;
    } else if (error instanceof Error) {
      errorMessage = `Falha ao criar registro inicial da análise: ${error.message}`;
    }
    console.error(`[createInitialAnalysisRecordAction] ${errorMessage}`, error);
    return { error: errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH) };
  }
}

export async function updateAnalysisUploadProgressAction(
  userId: string,
  analysisId: string,
  uploadProgress: number
): Promise<{ success: boolean; error?: string }> {
  console.log(`[updateAnalysisUploadProgressAction] userId: ${userId}, analysisId: ${analysisId}, uploadProgress: ${uploadProgress}`);
   if (!userId || userId.trim() === "" || !analysisId) {
    const msg = "[updateAnalysisUploadProgressAction] User ID e Analysis ID são obrigatórios.";
    console.error(msg);
    return { success: false, error: msg };
  }
  try {
    const analysisRef = doc(db, 'users', userId, 'analyses', analysisId);
    await updateDoc(analysisRef, { uploadProgress: Math.round(uploadProgress), progress: Math.round(uploadProgress * 0.1) }); // Upload é ~10% do processo total
    return { success: true };
  } catch (error) {
    const firestoreError = error as FirestoreError;
    const errorMessage = `Falha ao atualizar progresso do upload: ${firestoreError.message}`;
    console.error(`[updateAnalysisUploadProgressAction] ${errorMessage}`, error);
    return { success: false, error: errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH) };
  }
}

export async function finalizeFileUploadRecordAction(
  userId: string,
  analysisId: string,
  downloadURL: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[finalizeFileUploadRecordAction] userId: ${userId}, analysisId: ${analysisId}, downloadURL: ${downloadURL}`);
  if (!userId || userId.trim() === "" || !analysisId || !downloadURL) {
    const msg = "[finalizeFileUploadRecordAction] User ID, Analysis ID, e Download URL são obrigatórios.";
    console.error(msg);
    return { success: false, error: msg };
  }
  try {
    const analysisRef = doc(db, 'users', userId, 'analyses', analysisId);
    await updateDoc(analysisRef, {
      powerQualityDataUrl: downloadURL,
      status: 'identifying_regulations', 
      progress: 10, 
      uploadProgress: 100,
    });
    console.log(`[finalizeFileUploadRecordAction] Document ${analysisId} updated with download URL and status 'identifying_regulations'.`);
    return { success: true };
  } catch (error) {
    const firestoreError = error as FirestoreError;
    const errorMessage = `Falha ao finalizar registro do upload: ${firestoreError.message}`;
    console.error(`[finalizeFileUploadRecordAction] ${errorMessage}`, error);
    return { success: false, error: errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH) };
  }
}

export async function markUploadAsFailedAction(
  userId: string,
  analysisId: string,
  uploadErrorMessage: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[markUploadAsFailedAction] userId: ${userId}, analysisId: ${analysisId}, uploadErrorMessage: ${uploadErrorMessage}`);
  if (!userId || userId.trim() === "" || !analysisId) {
    const msg = "[markUploadAsFailedAction] User ID e Analysis ID são obrigatórios.";
    console.error(msg);
    return { success: false, error: msg };
  }
  try {
    const analysisRef = doc(db, 'users', userId, 'analyses', analysisId);
    await updateDoc(analysisRef, {
      status: 'error',
      errorMessage: `Falha no upload: ${uploadErrorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH - 20)}`,
      progress: 0,
      uploadProgress: 0,
    });
    console.log(`[markUploadAsFailedAction] Document ${analysisId} marked as error due to upload failure.`);
    return { success: true };
  } catch (error) {
    const firestoreError = error as FirestoreError;
    const errorMessage = `Falha ao marcar upload como falho: ${firestoreError.message}`;
    console.error(`[markUploadAsFailedAction] ${errorMessage}`, error);
    return { success: false, error: errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH) };
  }
}
