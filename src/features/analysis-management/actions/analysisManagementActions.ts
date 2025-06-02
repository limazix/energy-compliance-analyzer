
'use server';

import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { deleteObject, ref as storageRef } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';

const CLIENT_ERROR_MESSAGE_MAX_LENGTH = 250;

export async function deleteAnalysisAction(userIdInput: string, analysisIdInput: string): Promise<void> {
  const userId = userIdInput?.trim() ?? '';
  const analysisId = analysisIdInput?.trim() ?? '';
  console.log(`[deleteAnalysisAction] Effective userId: '${userId}', analysisId: '${analysisId}' (Inputs: '${userIdInput}', '${analysisIdInput}')`);

  if (!userId || !analysisId) {
    const errorMsg = `[deleteAnalysisAction] CRITICAL: userId ('${userIdInput}') or analysisId ('${analysisIdInput}') invalid.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
  console.log(`[deleteAnalysisAction] Marking ${analysisDocPath} as 'deleted'. Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV_VAR_NOT_SET'}`);
  const analysisRef = doc(db, analysisDocPath);
  try {
    const analysisSnap = await getDoc(analysisRef);
    if (!analysisSnap.exists()) throw new Error("Análise não encontrada para exclusão.");

    await updateDoc(analysisRef, {
        status: 'deleted',
        summary: null, 
        structuredReport: null,
        mdxReportStoragePath: null, 
        powerQualityDataUrl: null, 
        identifiedRegulations: null,
        powerQualityDataSummary: null,
        errorMessage: 'Análise excluída pelo usuário.'
    });

    const dataToDelete = analysisSnap.data();
    if (dataToDelete.powerQualityDataUrl) {
        try {
            await deleteObject(storageRef(storage, dataToDelete.powerQualityDataUrl));
            console.log(`[deleteAnalysisAction] Original data file ${dataToDelete.powerQualityDataUrl} deleted.`);
        } catch (e) { console.warn(`[deleteAnalysisAction] Failed to delete original data file ${dataToDelete.powerQualityDataUrl}:`, e); }
    }
    if (dataToDelete.mdxReportStoragePath) {
        try {
            await deleteObject(storageRef(storage, dataToDelete.mdxReportStoragePath));
            console.log(`[deleteAnalysisAction] MDX report ${dataToDelete.mdxReportStoragePath} deleted.`);
        } catch (e) { console.warn(`[deleteAnalysisAction] Failed to delete MDX ${dataToDelete.mdxReportStoragePath}:`, e); }
    }
  } catch (error) {
    const originalErrorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[deleteAnalysisAction] Error for ${analysisDocPath}:`, originalErrorMessage);
    throw new Error(originalErrorMessage);
  }
}

export async function cancelAnalysisAction(
  userIdInput: string,
  analysisIdInput: string
): Promise<{ success: boolean; error?: string }> {
  const userId = userIdInput?.trim() ?? '';
  const analysisId = analysisIdInput?.trim() ?? '';
  console.log(`[cancelAnalysisAction] Effective userId: '${userId}', analysisId: '${analysisId}' (Inputs: '${userIdInput}', '${analysisIdInput}')`);

  if (!userId || !analysisId) {
    const msg = `[cancelAnalysisAction] CRITICAL: userId ('${userIdInput}' -> '${userId}') or analysisId ('${analysisIdInput}' -> '${analysisId}') is invalid. Aborting.`;
    console.error(msg);
    return { success: false, error: msg };
  }

  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
  const analysisRef = doc(db, analysisDocPath);
  console.log(`[cancelAnalysisAction] Requesting cancellation for ${analysisDocPath}. Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV_VAR_NOT_SET'}`);

  try {
    const docSnap = await getDoc(analysisRef);
    if (!docSnap.exists()) {
      const notFoundMsg = `Análise ${analysisId} não encontrada para cancelamento.`;
      console.warn(`[cancelAnalysisAction] ${notFoundMsg} Path: ${analysisDocPath}`);
      return { success: false, error: notFoundMsg };
    }

    const currentStatus = docSnap.data().status;
    if (currentStatus === 'completed' || currentStatus === 'error' || currentStatus === 'cancelled' || currentStatus === 'deleted') {
      const msg = `Análise ${analysisId} já está em um estado final (${currentStatus}) e não pode ser cancelada.`;
      console.warn(`[cancelAnalysisAction] ${msg}`);
      return { success: false, error: msg };
    }

    await updateDoc(analysisRef, {
      status: 'cancelling',
      errorMessage: 'Cancelamento solicitado pelo usuário...', 
    });
    console.log(`[cancelAnalysisAction] Analysis ${analysisId} status set to 'cancelling'.`);
    return { success: true };
  } catch (error) {
    const originalErrorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[cancelAnalysisAction] Error for ${analysisDocPath}:`, originalErrorMessage);
    return { success: false, error: `Falha ao solicitar cancelamento: ${originalErrorMessage.substring(0, CLIENT_ERROR_MESSAGE_MAX_LENGTH)}` };
  }
}
