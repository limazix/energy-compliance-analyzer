
// src/features/file-upload/actions/fileUploadActions.ts
'use server';

import { addDoc, collection, doc, serverTimestamp, updateDoc, Timestamp, getDoc, FirestoreError } from 'firebase/firestore';
import { db } from '@/lib/firebase';
// Omit 'Analysis' type import if not strictly needed for the simplified initial object.
// import type { Analysis } from '@/types/analysis';

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

  const analysisDataForFirestore = {
    userId,
    fileName,
    status: 'uploading',
    progress: 0,
    uploadProgress: 0,
    tags: [],
    createdAt: serverTimestamp() as Timestamp,
    // Campos opcionais são omitidos e adicionados depois via updateDoc
    // powerQualityDataUrl: null, // Não incluir aqui
    // identifiedRegulations: null, // Não incluir aqui
    // summary: null, // Não incluir aqui
    // complianceReport: null, // Não incluir aqui
    // errorMessage: null, // Não incluir aqui
    // completedAt: null, // Não incluir aqui
  };
  
  const analysisCollectionPath = `users/${userId}/analyses`;
  console.log(`[Action_createInitialAnalysisRecord] Attempting to add document to Firestore. Path: '${analysisCollectionPath}'. Data:`, JSON.stringify(analysisDataForFirestore, null, 2));

  try {
    const analysisCollectionRef = collection(db, 'users', userId, 'analyses');
    const docRef = await addDoc(analysisCollectionRef, analysisDataForFirestore);
    console.log(`[Action_createInitialAnalysisRecord] Document created with ID: ${docRef.id} for user ${userId} at path ${analysisCollectionPath}/${docRef.id}`);
    return { analysisId: docRef.id };
  } catch (error) {
    let errorMessage = 'Falha ao criar registro inicial da análise.';
    if (error instanceof FirestoreError) {
      errorMessage = `Falha ao criar registro inicial da análise: ${error.code} ${error.message}`;
      if (error.code === 'permission-denied' || error.code === 7) { // 7 é o código gRPC para PERMISSION_DENIED
        console.error(`[Action_createInitialAnalysisRecord] PERMISSION_DENIED ao tentar criar documento para userId: '${userId}' no caminho '${analysisCollectionPath}'. Verifique as regras do Firestore e se elas foram implantadas no projeto Firebase CORRETO (${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV VAR NOT SET'}). Erro original: ${error.message}`);
      }
    } else if (error instanceof Error) {
      errorMessage = `Falha ao criar registro inicial da análise: ${error.message}`;
    }
    console.error(`[Action_createInitialAnalysisRecord] Catch block: ${errorMessage}`, error);
    return { error: errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH) };
  }
}

export async function updateAnalysisUploadProgressAction(
  userId: string,
  analysisId: string,
  uploadProgress: number
): Promise<{ success: boolean; error?: string }> {
  // console.log(`[Action_updateAnalysisUploadProgress] userId: ${userId}, analysisId: ${analysisId}, uploadProgress: ${uploadProgress}`);
  if (!userId || userId.trim() === "" || !analysisId) {
    const msg = "[Action_updateAnalysisUploadProgress] User ID e Analysis ID são obrigatórios.";
    console.error(msg);
    return { success: false, error: msg };
  }
  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
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
    // console.log(`[Action_updateAnalysisUploadProgress] Document ${analysisId} progress updated.`);
    return { success: true };
  } catch (error) {
    let errorMessage = 'Falha ao atualizar progresso do upload.';
    if (error instanceof FirestoreError) {
      errorMessage = `Falha ao atualizar progresso do upload: ${error.code} ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = `Falha ao atualizar progresso do upload: ${error.message}`;
    }
    console.error(`[Action_updateAnalysisUploadProgress] Error for path ${analysisDocPath}: ${errorMessage}`, error);
    return { success: false, error: errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH) };
  }
}

export async function finalizeFileUploadRecordAction(
  userId: string,
  analysisId: string,
  downloadURL: string
): Promise<{ success: boolean; error?: string }> {
  // console.log(`[Action_finalizeFileUploadRecord] userId: ${userId}, analysisId: ${analysisId}, downloadURL present: ${!!downloadURL}`);
  if (!userId || userId.trim() === "" || !analysisId || !downloadURL) {
    const msg = "[Action_finalizeFileUploadRecord] User ID, Analysis ID, e Download URL são obrigatórios.";
    console.error(msg);
    return { success: false, error: msg };
  }
  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
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
    console.error(`[Action_finalizeFileUploadRecord] Error for path ${analysisDocPath}: ${errorMessage}`, error);
    return { success: false, error: errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH) };
  }
}

export async function markUploadAsFailedAction(
  userId: string,
  analysisId: string | null, 
  uploadErrorMessage: string
): Promise<{ success: boolean; error?: string }> {
  // console.log(`[Action_markUploadAsFailed] userId: ${userId}, analysisId: ${analysisId}, uploadErrorMessage: ${uploadErrorMessage}`);
  if (!userId || userId.trim() === "") {
    const msg = "[Action_markUploadAsFailed] User ID é obrigatório.";
    console.error(msg);
    return { success: false, error: msg };
  }
  
  if (!analysisId) {
    const noIdMsg = `[Action_markUploadAsFailed] Analysis ID não fornecido. Provável falha na criação do registro. Erro original do upload: ${uploadErrorMessage}`;
    console.warn(noIdMsg);
    return { success: true, error: "ID da análise não disponível para marcar falha (criação pode ter falhado)." };
  }
  
  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
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
    console.error(`[Action_markUploadAsFailed] Error for path ${analysisDocPath}: ${errorMessage}`, error);
    return { success: false, error: errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH) };
  }
}

    