
// src/features/file-upload/actions/fileUploadActions.ts
'use server';

import { addDoc, collection, doc, serverTimestamp, updateDoc, Timestamp, getDoc, FirestoreError } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const MAX_ERROR_MESSAGE_LENGTH = 1500;

export async function createInitialAnalysisRecordAction(
  userIdInput: string,
  fileName: string
): Promise<{ analysisId?: string; error?: string }> {
  const userId = userIdInput ? userIdInput.trim() : '';
  console.log(`[Action_createInitialAnalysisRecord] Received trimmed userId: '${userId}', fileName: '${fileName}'`);

  if (!userId || typeof userId !== 'string' || userId.trim() === "") { // Double check after trim, though first check should catch it
    const msg = `[Action_createInitialAnalysisRecord] CRITICAL: userId is invalid (null, empty, or whitespace after trim): '${userIdInput}' -> '${userId}'. Aborting.`;
    console.error(msg);
    return { error: msg };
  }
  if (!fileName || fileName.trim() === "") {
    const msg = "[Action_createInitialAnalysisRecord] Nome do arquivo é obrigatório e não pode ser vazio.";
    console.error(msg);
    return { error: msg };
  }

  const analysisDataForFirestore = {
    userId, // Use trimmed userId
    fileName,
    status: 'uploading',
    progress: 0,
    uploadProgress: 0,
    tags: [],
    createdAt: serverTimestamp() as Timestamp,
  };
  
  const analysisCollectionPath = `users/${userId}/analyses`; // Use trimmed userId
  console.log(`[Action_createInitialAnalysisRecord] Attempting to add document to Firestore. Path: '${analysisCollectionPath}'. Data for user '${userId}'. Project: '${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV VAR NOT SET'}'`);

  try {
    const analysisCollectionRef = collection(db, 'users', userId, 'analyses'); // Use trimmed userId
    const docRef = await addDoc(analysisCollectionRef, analysisDataForFirestore);
    console.log(`[Action_createInitialAnalysisRecord] Document created with ID: ${docRef.id} for user ${userId} at path ${analysisCollectionPath}/${docRef.id}`);
    return { analysisId: docRef.id };
  } catch (error) {
    let errorMessage = 'Falha ao criar registro inicial da análise.';
    if (error instanceof FirestoreError) {
      errorMessage = `Falha ao criar registro inicial da análise: ${error.code} ${error.message}`;
      if (error.code === 'permission-denied' || error.code === 7) {
        console.error(`[Action_createInitialAnalysisRecord] PERMISSION_DENIED ao tentar criar documento para userId: '${userId}' no caminho '${analysisCollectionPath}'. Verifique as regras do Firestore e se elas foram implantadas no projeto Firebase CORRETO (${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV VAR NOT SET'}). Erro original: ${error.message}`);
      }
    } else if (error instanceof Error) {
      errorMessage = `Falha ao criar registro inicial da análise: ${error.message}`;
    }
    console.error(`[Action_createInitialAnalysisRecord] Catch block for userId '${userId}': ${errorMessage}`, error);
    return { error: errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH) };
  }
}

export async function updateAnalysisUploadProgressAction(
  userIdInput: string,
  analysisId: string,
  uploadProgress: number
): Promise<{ success: boolean; error?: string }> {
  const userId = userIdInput ? userIdInput.trim() : '';
  if (!userId || typeof userId !== 'string' || userId.trim() === "" || !analysisId || typeof analysisId !== 'string' || analysisId.trim() === "") {
    const msg = `[Action_updateAnalysisUploadProgress] CRITICAL: userId ('${userIdInput}' -> '${userId}') or analysisId ('${analysisId}') is invalid. Aborting.`;
    console.error(msg);
    return { success: false, error: msg };
  }
  const analysisDocPath = `users/${userId}/analyses/${analysisId}`; // Use trimmed userId
  const analysisRef = doc(db, analysisDocPath);
  
  try {
    const docSnap = await getDoc(analysisRef);
    if (!docSnap.exists()) {
      const notFoundMsg = `[Action_updateAnalysisUploadProgress] Document ${analysisId} (path: ${analysisDocPath}) not found for user ${userId}. Cannot update progress.`;
      console.warn(notFoundMsg);
      return { success: false, error: "Documento da análise não encontrado para atualizar progresso." };
    }
    
    const overallProgressBasedOnUpload = Math.min(10, Math.round(uploadProgress * 0.1)); 
    await updateDoc(analysisRef, { 
        uploadProgress: Math.round(uploadProgress), 
        progress: overallProgressBasedOnUpload 
    });
    return { success: true };
  } catch (error) {
    let errorMessage = 'Falha ao atualizar progresso do upload.';
    if (error instanceof FirestoreError) {
      errorMessage = `Falha ao atualizar progresso do upload: ${error.code} ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = `Falha ao atualizar progresso do upload: ${error.message}`;
    }
    console.error(`[Action_updateAnalysisUploadProgress] Error for path ${analysisDocPath} (userId '${userId}'): ${errorMessage}`, error);
    return { success: false, error: errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH) };
  }
}

export async function finalizeFileUploadRecordAction(
  userIdInput: string,
  analysisId: string,
  downloadURL: string
): Promise<{ success: boolean; error?: string }> {
  const userId = userIdInput ? userIdInput.trim() : '';
  if (!userId || typeof userId !== 'string' || userId.trim() === "" || !analysisId || typeof analysisId !== 'string' || analysisId.trim() === "" || !downloadURL) {
    const msg = `[Action_finalizeFileUploadRecord] CRITICAL: userId ('${userIdInput}' -> '${userId}'), analysisId ('${analysisId}'), or downloadURL is invalid. Aborting.`;
    console.error(msg);
    return { success: false, error: msg };
  }
  const analysisDocPath = `users/${userId}/analyses/${analysisId}`; // Use trimmed userId
  const analysisRef = doc(db, analysisDocPath);

  try {
    const docSnap = await getDoc(analysisRef);
    if (!docSnap.exists()) {
      const notFoundMsg = `[Action_finalizeFileUploadRecord] Document ${analysisId} (path: ${analysisDocPath}) not found for user ${userId}. Cannot finalize record.`;
      console.warn(notFoundMsg);
      return { success: false, error: "Documento da análise não encontrado para finalizar registro." };
    }
    await updateDoc(analysisRef, {
      powerQualityDataUrl: downloadURL,
      status: 'identifying_regulations', 
      progress: 10, 
      uploadProgress: 100,
    });
    console.log(`[Action_finalizeFileUploadRecord] Document ${analysisId} (path: ${analysisDocPath}) updated with download URL and status 'identifying_regulations'.`);
    return { success: true };
  } catch (error) {
     let errorMessage = 'Falha ao finalizar registro do upload.';
     if (error instanceof FirestoreError) {
      errorMessage = `Falha ao finalizar registro do upload: ${error.code} ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = `Falha ao finalizar registro do upload: ${error.message}`;
    }
    console.error(`[Action_finalizeFileUploadRecord] Error for path ${analysisDocPath} (userId '${userId}'): ${errorMessage}`, error);
    return { success: false, error: errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH) };
  }
}

export async function markUploadAsFailedAction(
  userIdInput: string,
  analysisId: string | null, 
  uploadErrorMessage: string
): Promise<{ success: boolean; error?: string }> {
  const userId = userIdInput ? userIdInput.trim() : '';
  if (!userId || typeof userId !== 'string' || userId.trim() === "") {
    const msg = `[Action_markUploadAsFailed] CRITICAL: userId is invalid ('${userIdInput}' -> '${userId}'). Aborting.`;
    console.error(msg);
    return { success: false, error: msg };
  }
  
  if (!analysisId || typeof analysisId !== 'string' || analysisId.trim() === "") {
    const noIdMsg = `[Action_markUploadAsFailed] Analysis ID inválido ou não fornecido ('${analysisId}'). Provável falha na criação do registro. Erro original do upload: ${uploadErrorMessage}`;
    console.warn(noIdMsg);
    return { success: true, error: "ID da análise inválido para marcar falha (criação pode ter falhado)." };
  }
  
  const analysisDocPath = `users/${userId}/analyses/${analysisId}`; // Use trimmed userId
  const analysisRef = doc(db, analysisDocPath);
  try {
    const docSnap = await getDoc(analysisRef);
    if (!docSnap.exists()) {
      const notFoundMsg = `[Action_markUploadAsFailed] Document ${analysisId} (path: ${analysisDocPath}) not found for user ${userId}. Cannot mark as failed. Error was: ${uploadErrorMessage}`;
      console.warn(notFoundMsg); 
      return { success: true, error: "Documento da análise não encontrado para marcar como falha." };
    }
    await updateDoc(analysisRef, {
      status: 'error',
      errorMessage: `Falha no upload: ${uploadErrorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH - 20)}`,
      progress: 0,
      uploadProgress: 0,
    });
    console.log(`[Action_markUploadAsFailed] Document ${analysisId} (path: ${analysisDocPath}) marked as error due to upload failure.`);
    return { success: true };
  } catch (error) {
     let errorMessage = 'Falha ao marcar upload como falho.';
     if (error instanceof FirestoreError) {
      errorMessage = `Falha ao marcar upload como falho: ${error.code} ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = `Falha ao marcar upload como falho: ${error.message}`;
    }
    console.error(`[Action_markUploadAsFailed] Error for path ${analysisDocPath} (userId '${userId}'): ${errorMessage}`, error);
    return { success: false, error: errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH) };
  }
}
