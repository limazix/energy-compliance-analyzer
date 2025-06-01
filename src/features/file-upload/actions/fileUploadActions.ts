
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
  console.log(`[Action_createInitialAnalysisRecord] Received userId: '${userId}', fileName: '${fileName}'`);
  if (!userId || userId.trim() === "") {
    const msg = "[Action_createInitialAnalysisRecord] User ID é obrigatório e não pode ser vazio.";
    console.error(msg);
    return { error: msg };
  }
  if (!fileName || fileName.trim() === "") {
    const msg = "[Action_createInitialAnalysisRecord] Nome do arquivo é obrigatório e não pode ser vazio.";
    console.error(msg);
    return { error: msg };
  }

  try {
    // Objeto inicial contém apenas os campos essenciais.
    const analysisDataForFirestore: Omit<Analysis, 'id' | 'completedAt' | 'powerQualityDataUrl' | 'powerQualityDataPreview' | 'identifiedRegulations' | 'summary' | 'complianceReport' | 'errorMessage'> & { createdAt: Timestamp } = {
      userId,
      fileName,
      status: 'uploading',
      progress: 0,
      uploadProgress: 0,
      tags: [],
      createdAt: serverTimestamp() as Timestamp,
    };
    
    console.log('[Action_createInitialAnalysisRecord] Data to be added to Firestore:', JSON.stringify(analysisDataForFirestore, null, 2));

    const analysisCollectionRef = collection(db, 'users', userId, 'analyses');
    const docRef = await addDoc(analysisCollectionRef, analysisDataForFirestore);
    console.log(`[Action_createInitialAnalysisRecord] Document created with ID: ${docRef.id} for user ${userId}`);
    return { analysisId: docRef.id };
  } catch (error) {
    let errorMessage = 'Falha ao criar registro inicial da análise.';
    if (error instanceof FirestoreError) {
      errorMessage = `Falha ao criar registro inicial da análise: ${error.code} ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = `Falha ao criar registro inicial da análise: ${error.message}`;
    }
    console.error(`[Action_createInitialAnalysisRecord] ${errorMessage}`, error);
    return { error: errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH) };
  }
}

export async function updateAnalysisUploadProgressAction(
  userId: string,
  analysisId: string,
  uploadProgress: number
): Promise<{ success: boolean; error?: string }> {
  console.log(`[Action_updateAnalysisUploadProgress] userId: ${userId}, analysisId: ${analysisId}, uploadProgress: ${uploadProgress}`);
  if (!userId || userId.trim() === "" || !analysisId) {
    const msg = "[Action_updateAnalysisUploadProgress] User ID e Analysis ID são obrigatórios.";
    console.error(msg);
    return { success: false, error: msg };
  }
  const analysisRef = doc(db, 'users', userId, 'analyses', analysisId);
  try {
    const docSnap = await getDoc(analysisRef);
    if (!docSnap.exists()) {
      const notFoundMsg = `[Action_updateAnalysisUploadProgress] Document ${analysisId} not found for user ${userId}. Cannot update progress.`;
      console.error(notFoundMsg);
      return { success: false, error: "Documento da análise não encontrado para atualizar progresso." };
    }
    
    const overallProgressBasedOnUpload = Math.min(10, Math.round(uploadProgress * 0.1)); 
    await updateDoc(analysisRef, { 
        uploadProgress: Math.round(uploadProgress), 
        progress: overallProgressBasedOnUpload 
    });
    console.log(`[Action_updateAnalysisUploadProgress] Document ${analysisId} progress updated.`);
    return { success: true };
  } catch (error) {
    let errorMessage = 'Falha ao atualizar progresso do upload.';
    if (error instanceof FirestoreError) {
      errorMessage = `Falha ao atualizar progresso do upload: ${error.code} ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = `Falha ao atualizar progresso do upload: ${error.message}`;
    }
    console.error(`[Action_updateAnalysisUploadProgress] ${errorMessage}`, error);
    return { success: false, error: errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH) };
  }
}

export async function finalizeFileUploadRecordAction(
  userId: string,
  analysisId: string,
  downloadURL: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[Action_finalizeFileUploadRecord] userId: ${userId}, analysisId: ${analysisId}, downloadURL present: ${!!downloadURL}`);
  if (!userId || userId.trim() === "" || !analysisId || !downloadURL) {
    const msg = "[Action_finalizeFileUploadRecord] User ID, Analysis ID, e Download URL são obrigatórios.";
    console.error(msg);
    return { success: false, error: msg };
  }
  const analysisRef = doc(db, 'users', userId, 'analyses', analysisId);
  try {
    const docSnap = await getDoc(analysisRef);
    if (!docSnap.exists()) {
      const notFoundMsg = `[Action_finalizeFileUploadRecord] Document ${analysisId} not found for user ${userId}. Cannot finalize record.`;
      console.error(notFoundMsg);
      return { success: false, error: "Documento da análise não encontrado para finalizar registro." };
    }
    await updateDoc(analysisRef, {
      powerQualityDataUrl: downloadURL,
      status: 'identifying_regulations', 
      progress: 10, 
      uploadProgress: 100,
    });
    console.log(`[Action_finalizeFileUploadRecord] Document ${analysisId} updated with download URL and status 'identifying_regulations'.`);
    return { success: true };
  } catch (error) {
    let errorMessage = 'Falha ao finalizar registro do upload.';
     if (error instanceof FirestoreError) {
      errorMessage = `Falha ao finalizar registro do upload: ${error.code} ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = `Falha ao finalizar registro do upload: ${error.message}`;
    }
    console.error(`[Action_finalizeFileUploadRecord] ${errorMessage}`, error);
    return { success: false, error: errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH) };
  }
}

export async function markUploadAsFailedAction(
  userId: string,
  analysisId: string | null, 
  uploadErrorMessage: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[Action_markUploadAsFailed] userId: ${userId}, analysisId: ${analysisId}, uploadErrorMessage: ${uploadErrorMessage}`);
  if (!userId || userId.trim() === "") {
    const msg = "[Action_markUploadAsFailed] User ID é obrigatório.";
    console.error(msg);
    return { success: false, error: msg };
  }
  
  if (!analysisId) {
    const noIdMsg = `[Action_markUploadAsFailed] Analysis ID não fornecido. Provável falha na criação do registro. Erro original do upload: ${uploadErrorMessage}`;
    console.warn(noIdMsg);
    // Ainda retorna sucesso porque a ação em si não falhou, mas não pôde fazer nada.
    return { success: true, error: "ID da análise não disponível para marcar falha (criação pode ter falhado)." };
  }

  const analysisRef = doc(db, 'users', userId, 'analyses', analysisId);
  try {
    const docSnap = await getDoc(analysisRef);
    if (!docSnap.exists()) {
      const notFoundMsg = `[Action_markUploadAsFailed] Document ${analysisId} not found for user ${userId}. Cannot mark as failed. Error was: ${uploadErrorMessage}`;
      console.warn(notFoundMsg); 
      return { success: true, error: "Documento da análise não encontrado para marcar como falha." };
    }
    await updateDoc(analysisRef, {
      status: 'error',
      errorMessage: `Falha no upload: ${uploadErrorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH - 20)}`,
      progress: 0,
      uploadProgress: 0,
    });
    console.log(`[Action_markUploadAsFailed] Document ${analysisId} marked as error due to upload failure.`);
    return { success: true };
  } catch (error) {
     let errorMessage = 'Falha ao marcar upload como falho.';
     if (error instanceof FirestoreError) {
      errorMessage = `Falha ao marcar upload como falho: ${error.code} ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = `Falha ao marcar upload como falho: ${error.message}`;
    }
    console.error(`[Action_markUploadAsFailed] ${errorMessage}`, error);
    return { success: false, error: errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH) };
  }
}

