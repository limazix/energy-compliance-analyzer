
// src/features/file-upload/actions/fileUploadActions.ts
'use server';

import { addDoc, collection, doc, serverTimestamp, updateDoc, Timestamp, getDoc, FirestoreError } from 'firebase/firestore';
import { db } from '@/lib/firebase';
// A interface Analysis é importada para referência, mas não completamente usada para o objeto inicial.
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
    // Objeto inicial contém apenas os campos essenciais.
    // Outros campos (powerQualityDataUrl, summary, etc.) serão adicionados/atualizados por outras actions.
    const initialAnalysisData = {
      userId,
      fileName,
      status: 'uploading' as Analysis['status'], // Status inicial
      progress: 0,
      uploadProgress: 0,
      tags: [] as string[],
      createdAt: serverTimestamp() as Timestamp,
      // Campos explicitamente NÃO incluídos aqui:
      // powerQualityDataUrl, powerQualityDataPreview, identifiedRegulations,
      // summary, complianceReport, errorMessage, completedAt
    };
    
    console.log('[createInitialAnalysisRecordAction] Data to be added to Firestore:', JSON.stringify(initialAnalysisData, null, 2));

    const analysisCollectionRef = collection(db, 'users', userId, 'analyses');
    const docRef = await addDoc(analysisCollectionRef, initialAnalysisData);
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
  const analysisRef = doc(db, 'users', userId, 'analyses', analysisId);
  try {
    const docSnap = await getDoc(analysisRef);
    if (!docSnap.exists()) {
      const notFoundMsg = `[updateAnalysisUploadProgressAction] Document ${analysisId} not found for user ${userId}. Cannot update progress.`;
      console.error(notFoundMsg);
      return { success: false, error: "Documento da análise não encontrado para atualizar progresso." };
    }
    // Upload é aproximadamente 10% do processo total visualizado na barra de progresso geral.
    // uploadProgress é o progresso real do componente de upload de arquivo.
    const overallProgressBasedOnUpload = Math.min(10, Math.round(uploadProgress * 0.1)); 
    await updateDoc(analysisRef, { 
        uploadProgress: Math.round(uploadProgress), 
        progress: overallProgressBasedOnUpload 
    });
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
  const analysisRef = doc(db, 'users', userId, 'analyses', analysisId);
  try {
    const docSnap = await getDoc(analysisRef);
    if (!docSnap.exists()) {
      const notFoundMsg = `[finalizeFileUploadRecordAction] Document ${analysisId} not found for user ${userId}. Cannot finalize record.`;
      console.error(notFoundMsg);
      return { success: false, error: "Documento da análise não encontrado para finalizar registro." };
    }
    await updateDoc(analysisRef, {
      powerQualityDataUrl: downloadURL, // Adiciona a URL do arquivo
      status: 'identifying_regulations', // Próximo status
      progress: 10, // Progresso indicando que o upload foi concluído e a próxima etapa começou
      uploadProgress: 100, // Upload do arquivo está 100%
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
  analysisId: string, // analysisId pode ser null se a criação do registro falhar antes
  uploadErrorMessage: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[markUploadAsFailedAction] userId: ${userId}, analysisId: ${analysisId}, uploadErrorMessage: ${uploadErrorMessage}`);
  if (!userId || userId.trim() === "") {
    const msg = "[markUploadAsFailedAction] User ID é obrigatório.";
    console.error(msg);
    return { success: false, error: msg };
  }
  // Se analysisId não foi fornecido (porque a criação do registro falhou), não há documento para atualizar.
  if (!analysisId) {
    const noIdMsg = `[markUploadAsFailedAction] Analysis ID não fornecido. Provável falha na criação do registro. Erro original do upload: ${uploadErrorMessage}`;
    console.warn(noIdMsg);
    return { success: true, error: "ID da análise não disponível para marcar falha (criação pode ter falhado)." };
  }

  const analysisRef = doc(db, 'users', userId, 'analyses', analysisId);
  try {
    const docSnap = await getDoc(analysisRef);
    if (!docSnap.exists()) {
      const notFoundMsg = `[markUploadAsFailedAction] Document ${analysisId} not found for user ${userId}. Cannot mark as failed. Error was: ${uploadErrorMessage}`;
      console.warn(notFoundMsg); 
      return { success: true, error: "Documento da análise não encontrado para marcar como falha." };
    }
    await updateDoc(analysisRef, {
      status: 'error',
      errorMessage: `Falha no upload: ${uploadErrorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH - 20)}`, // Adiciona o campo errorMessage
      progress: 0,
      uploadProgress: 0, // Reseta o progresso do upload
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
