
'use server';

import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Analysis } from '@/types/analysis';

const CLIENT_ERROR_MESSAGE_MAX_LENGTH = 250;
const UPLOAD_COMPLETED_OVERALL_PROGRESS = 10; // Represents 10% overall progress once upload finishes

export async function processAnalysisFile(
  analysisIdInput: string,
  userIdInput: string
): Promise<{ success: boolean; analysisId: string; error?: string }> {
  const userId = userIdInput?.trim() ?? '';
  const analysisId = analysisIdInput?.trim() ?? '';

  console.log(`[Action_processAnalysisFile] Triggered for analysisId: ${analysisId} (input: ${analysisIdInput}), userId: ${userId} (input: ${userIdInput})`);

  if (!userId) {
    const criticalMsg = `[Action_processAnalysisFile] CRITICAL: userId is invalid ('${userIdInput}' -> '${userId}') for analysisId: ${analysisId || 'N/A'}. Aborting.`;
    console.error(criticalMsg);
    return { success: false, analysisId: analysisId || 'unknown_id', error: criticalMsg.substring(0, CLIENT_ERROR_MESSAGE_MAX_LENGTH) };
  }
  if (!analysisId) {
    const criticalMsg = `[Action_processAnalysisFile] CRITICAL: analysisId is invalid ('${analysisIdInput}' -> '${analysisId}') for userId: ${userId}. Aborting.`;
    console.error(criticalMsg);
    return { success: false, analysisId: analysisIdInput || 'unknown_id', error: criticalMsg.substring(0, CLIENT_ERROR_MESSAGE_MAX_LENGTH) };
  }

  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
  const analysisRef = doc(db, analysisDocPath);

  try {
    const analysisSnap = await getDoc(analysisRef);
    if (!analysisSnap.exists()) {
      const notFoundMsg = `Analysis document ${analysisId} not found at path ${analysisDocPath}. Aborting.`;
      console.error(`[Action_processAnalysisFile] ${notFoundMsg}`);
      return { success: false, analysisId, error: notFoundMsg.substring(0, CLIENT_ERROR_MESSAGE_MAX_LENGTH) };
    }

    const analysisData = analysisSnap.data() as Analysis;

    if (!analysisData.powerQualityDataUrl) {
      const noFilePathMsg = `File path (powerQualityDataUrl) not found for analysisId: ${analysisId}. Cannot queue for processing.`;
      console.error(`[Action_processAnalysisFile] ${noFilePathMsg}`);
      await updateDoc(analysisRef, { 
        status: 'error', 
        errorMessage: 'URL do arquivo de dados não encontrada. Reenvie o arquivo.', 
        progress: 0 
      });
      return { success: false, analysisId, error: noFilePathMsg.substring(0, CLIENT_ERROR_MESSAGE_MAX_LENGTH) };
    }

    // If the analysis was in an error state, or uploading, reset to 'summarizing_data' to allow the Firebase Function to pick it up.
    // If it's already completed, or being cancelled, don't re-trigger.
    if (analysisData.status === 'completed' || analysisData.status === 'cancelling' || analysisData.status === 'cancelled' || analysisData.status === 'deleted') {
      console.log(`[Action_processAnalysisFile] Analysis ${analysisId} is in status '${analysisData.status}'. No re-processing triggered by this action.`);
      return { success: true, analysisId }; // Indicate success as no action needed from client perspective
    }

    // This action's main job is now to ensure the analysis is in the correct state
    // for the Firebase Function to pick up.
    // The Firebase Function will be triggered by the 'summarizing_data' status or if it was 'uploading'.
    // If it was 'error', changing to 'summarizing_data' will re-trigger.
    // If it's already 'summarizing_data' or other in-progress states, the function might already be running or will pick up.
    
    console.log(`[Action_processAnalysisFile] Setting analysis ${analysisId} to 'summarizing_data' (or ensuring it is) to be picked up by Firebase Function.`);
    await updateDoc(analysisRef, {
      status: 'summarizing_data', // This status will trigger the Firebase Function
      progress: analysisData.progress < UPLOAD_COMPLETED_OVERALL_PROGRESS ? UPLOAD_COMPLETED_OVERALL_PROGRESS : analysisData.progress, // Ensure at least 10%
      errorMessage: null, // Clear previous errors if retrying
      // Do not reset completedAt if it existed from a previous 'error' state that is being retried.
      // completedAt will be set by the function upon successful completion.
      // Fields like structuredReport, summary, etc., will be populated by the Function.
    });

    console.log(`[Action_processAnalysisFile] Analysis ${analysisId} queued/confirmed for background processing.`);
    return { success: true, analysisId };

  } catch (error) {
    const originalErrorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Action_processAnalysisFile] Error preparing analysis ${analysisId} for background processing:`, originalErrorMessage, error);
    
    // Attempt to update Firestore with an error state, but be mindful not to overwrite a cancellation.
    try {
        const currentSnap = await getDoc(analysisRef);
        if (currentSnap.exists()) {
            const currentData = currentSnap.data();
            if (currentData?.status !== 'cancelling' && currentData?.status !== 'cancelled') {
                 await updateDoc(analysisRef, { 
                    status: 'error', 
                    errorMessage: `Erro ao enfileirar para processamento: ${originalErrorMessage.substring(0, 200)}`
                });
            }
        }
    } catch (fsError) {
        console.error(`[Action_processAnalysisFile] CRITICAL: Failed to update Firestore error state for ${analysisId} after queueing error:`, fsError);
    }

    return { success: false, analysisId, error: `Erro ao enfileirar para processamento: ${originalErrorMessage.substring(0, CLIENT_ERROR_MESSAGE_MAX_LENGTH)}` };
  }
}
