
// src/features/file-upload/actions/fileUploadActions.ts
'use server';

import { addDoc, collection, doc, serverTimestamp, updateDoc, Timestamp, getDoc, FirestoreError } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const MAX_ERROR_MESSAGE_LENGTH = 1500;
const UPLOAD_COMPLETED_OVERALL_PROGRESS = 10; // Represents 10% overall progress

export async function createInitialAnalysisRecordAction(
  userIdInput: string,
  fileName: string,
  title?: string, 
  description?: string,
  languageCode?: string
): Promise<{ analysisId?: string; error?: string }> {
  const userId = userIdInput?.trim() ?? '';
  const trimmedFileName = fileName?.trim() ?? '';
  const finalTitle = title?.trim() || trimmedFileName;
  const finalDescription = description?.trim() || '';
  const finalLanguageCode = languageCode?.trim() || 'pt-BR';


  console.log(`[Action_createInitialAnalysisRecord] Received: userId='${userId}', fileName='${trimmedFileName}', title='${finalTitle}', description='${finalDescription}', lang='${finalLanguageCode}'`);

  if (!userId) {
    const msg = `[Action_createInitialAnalysisRecord] CRITICAL: userId is invalid. Input: '${userIdInput}'. Aborting.`;
    console.error(msg);
    return { error: msg };
  }
  if (!trimmedFileName) {
    const msg = "[Action_createInitialAnalysisRecord] Nome do arquivo é obrigatório e não pode ser vazio.";
    console.error(msg);
    return { error: msg };
  }

  const analysisDataForFirestore = {
    userId: userId,
    fileName: trimmedFileName,
    title: finalTitle,
    description: finalDescription,
    languageCode: finalLanguageCode,
    status: 'uploading', 
    progress: 0, 
    uploadProgress: 0, 
    isDataChunked: false, 
    tags: [],
    createdAt: serverTimestamp() as Timestamp,
    powerQualityDataUrl: null,
    powerQualityDataSummary: null,
    identifiedRegulations: null,
    structuredReport: null,
    mdxReportStoragePath: null,
    errorMessage: null,
    completedAt: null,
  };

  const analysisCollectionPath = `users/${userId}/analyses`;
  const currentProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV_VAR_NOT_SET_OR_EMPTY';
  console.log(`[Action_createInitialAnalysisRecord] Adding doc to Firestore. Path: '${analysisCollectionPath}'. Project: '${currentProjectId}'`);

  try {
    const analysisCollectionRef = collection(db, 'users', userId, 'analyses');
    const docRef = await addDoc(analysisCollectionRef, analysisDataForFirestore);
    console.log(`[Action_createInitialAnalysisRecord] Document created: ${docRef.id} for user ${userId}`);
    return { analysisId: docRef.id };
  } catch (error) {
    let errorMessage = 'Falha ao criar registro inicial da análise.';
    if (error instanceof FirestoreError) {
      errorMessage = `Falha Firestore (criar registro): ${error.code} ${error.message}`;
      if (error.code === 'permission-denied' || error.code === 7) {
        console.error(`[Action_createInitialAnalysisRecord] PERMISSION_DENIED. Path '${analysisCollectionPath}'. Project '${currentProjectId}'. Err: ${error.message}`);
      }
    } else if (error instanceof Error) {
      errorMessage = `Falha (criar registro): ${error.message}`;
    }
    console.error(`[Action_createInitialAnalysisRecord] Catch for userId '${userId}': ${errorMessage}`, error);
    return { error: errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH) };
  }
}

export async function updateAnalysisUploadProgressAction(
  userIdInput: string,
  analysisIdInput: string,
  uploadProgress: number
): Promise<{ success: boolean; error?: string }> {
  const userId = userIdInput?.trim() ?? '';
  const analysisId = analysisIdInput?.trim() ?? '';

  if (!userId || !analysisId) {
    const msg = `[Action_updateUploadProgress] CRITICAL: userId ('${userId}') or analysisId ('${analysisId}') invalid. Aborting.`;
    console.error(msg);
    return { success: false, error: msg };
  }
  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
  const analysisRef = doc(db, analysisDocPath);

  try {
    const docSnap = await getDoc(analysisRef);
    if (!docSnap.exists()) {
      console.warn(`[Action_updateUploadProgress] Doc ${analysisId} not found at ${analysisDocPath}. Cannot update progress.`);
      return { success: false, error: "Doc da análise não encontrado." };
    }

    const overallProgressBasedOnUpload = Math.min(UPLOAD_COMPLETED_OVERALL_PROGRESS -1, Math.round(uploadProgress * (UPLOAD_COMPLETED_OVERALL_PROGRESS / 100) ));
    await updateDoc(analysisRef, {
        uploadProgress: Math.round(uploadProgress),
        progress: overallProgressBasedOnUpload,
        status: 'uploading' // Ensure status remains 'uploading'
    });
    return { success: true };
  } catch (error) {
    // ... (error handling as before)
    let errorMessage = 'Falha ao atualizar progresso do upload.';
     if (error instanceof FirestoreError) {
      errorMessage = `Falha Firestore (progresso upload): ${error.code} ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = `Falha (progresso upload): ${error.message}`;
    }
    console.error(`[Action_updateUploadProgress] Error for ${analysisDocPath}: ${errorMessage}`, error);
    return { success: false, error: errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH) };
  }
}

export async function finalizeFileUploadRecordAction(
  userIdInput: string,
  analysisIdInput: string,
  downloadURL: string
): Promise<{ success: boolean; error?: string }> {
  const userId = userIdInput?.trim() ?? '';
  const analysisId = analysisIdInput?.trim() ?? '';

  if (!userId || !analysisId || !downloadURL) {
    const msg = `[Action_finalizeUpload] CRITICAL: userId ('${userId}'), analysisId ('${analysisId}'), or downloadURL invalid. Aborting.`;
    console.error(msg);
    return { success: false, error: msg };
  }
  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
  const analysisRef = doc(db, analysisDocPath);

  try {
    const docSnap = await getDoc(analysisRef);
    if (!docSnap.exists()) {
      console.warn(`[Action_finalizeUpload] Doc ${analysisId} not found at ${analysisDocPath}. Cannot finalize.`);
      return { success: false, error: "Doc da análise não encontrado." };
    }
    
    // This status will trigger the Firebase Function to start processing
    await updateDoc(analysisRef, {
      powerQualityDataUrl: downloadURL,
      status: 'summarizing_data', 
      progress: UPLOAD_COMPLETED_OVERALL_PROGRESS, 
      uploadProgress: 100,
      errorMessage: null, // Clear any previous errors
      // Reset fields that will be populated by the Firebase Function
      powerQualityDataSummary: null,
      identifiedRegulations: null,
      structuredReport: null,
      mdxReportStoragePath: null,
      summary: null, 
      completedAt: null,
    });
    console.log(`[Action_finalizeUpload] Doc ${analysisId} updated. Status 'summarizing_data', ready for Function.`);
    return { success: true };
  } catch (error) {
    // ... (error handling as before)
    let errorMessage = 'Falha ao finalizar registro do upload.';
     if (error instanceof FirestoreError) {
      errorMessage = `Falha Firestore (finalizar upload): ${error.code} ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = `Falha (finalizar upload): ${error.message}`;
    }
    console.error(`[Action_finalizeUpload] Error for ${analysisDocPath}: ${errorMessage}`, error);
    return { success: false, error: errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH) };
  }
}

export async function markUploadAsFailedAction(
  userIdInput: string,
  analysisIdInput: string | null, // analysisId can be null if createRecord failed
  uploadErrorMessage: string
): Promise<{ success: boolean; error?: string }> {
  const userId = userIdInput?.trim() ?? '';
  const analysisId = analysisIdInput?.trim() ?? ''; // Will be empty if null

  if (!userId) {
    const msg = `[Action_markUploadFailed] CRITICAL: userId is invalid ('${userIdInput}'). Aborting.`;
    console.error(msg);
    return { success: false, error: msg };
  }

  if (!analysisId) { // analysisId was null or empty
    console.warn(`[Action_markUploadFailed] No valid analysisId ('${analysisIdInput}'). Error was: ${uploadErrorMessage}. Cannot update Firestore.`);
    // Still return success as there's no specific record to update if creation failed.
    return { success: true, error: "ID da análise inválido/não criado, falha no upload não registrada no DB." };
  }

  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
  const analysisRef = doc(db, analysisDocPath);
  try {
    const docSnap = await getDoc(analysisRef);
    if (!docSnap.exists()) {
      console.warn(`[Action_markUploadFailed] Doc ${analysisId} not found at ${analysisDocPath}. Error was: ${uploadErrorMessage}.`);
      return { success: true, error: "Doc da análise não encontrado para marcar falha." };
    }
    await updateDoc(analysisRef, {
      status: 'error',
      errorMessage: `Falha no upload: ${uploadErrorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH - 25)}`,
      progress: 0,
      uploadProgress: 0,
    });
    console.log(`[Action_markUploadFailed] Doc ${analysisId} marked as error due to upload failure.`);
    return { success: true };
  } catch (error) {
    // ... (error handling as before)
    let errorMessage = 'Falha ao marcar upload como falho.';
     if (error instanceof FirestoreError) {
      errorMessage = `Falha Firestore (marcar falha upload): ${error.code} ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = `Falha (marcar falha upload): ${error.message}`;
    }
    console.error(`[Action_markUploadFailed] Error for ${analysisDocPath}: ${errorMessage}`, error);
    return { success: false, error: errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH) };
  }
}
