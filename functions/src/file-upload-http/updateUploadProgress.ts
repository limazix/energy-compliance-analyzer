'use strict';

/**
 * @fileOverview HTTPS Callable Firebase Function for updating analysis upload progress.
 * Feature: File Upload (HTTPS Callable)
 * Component: UpdateUploadProgress
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

import { APP_CONFIG } from '@/config/appConfig'; // Adjusted path

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const MAX_ERROR_MESSAGE_LENGTH = APP_CONFIG.MAX_SERVER_ERROR_MESSAGE_LENGTH;
const UPLOAD_COMPLETED_OVERALL_PROGRESS = APP_CONFIG.PROGRESS_PERCENTAGE_UPLOAD_COMPLETE;

interface RequestData {
  analysisId: string;
  uploadProgress: number;
}

interface ResponseData {
  success: boolean;
}

/**
 * Updates the upload progress of an analysis in Firestore.
 * @param {RequestData} data - The data object sent from the client.
 * @param {functions.https.CallableContext} context - The context of the call.
 * @returns {Promise<ResponseData>} A promise that resolves with a success status.
 * @throws {functions.https.HttpsError} If unauthenticated, arguments invalid, document not found, or Firestore error.
 */
export const httpsUpdateAnalysisUploadProgress = functions.https.onCall(
  async (data: RequestData, context: functions.https.CallableContext): Promise<ResponseData> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'A função deve ser chamada por um usuário autenticado.'
      );
    }
    const userId = context.auth.uid;
    const { analysisId, uploadProgress } = data;

    if (!analysisId || typeof uploadProgress !== 'number') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'ID da análise e progresso do upload são obrigatórios.'
      );
    }
    const analysisRef = db.collection('users').doc(userId).collection('analyses').doc(analysisId);

    try {
      const docSnap = await analysisRef.get();
      if (!docSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Documento da análise não encontrado.');
      }
      const overallProgressBasedOnUpload = Math.min(
        UPLOAD_COMPLETED_OVERALL_PROGRESS - 1, // Ensure overall progress doesn't hit 10% just from upload
        Math.round(uploadProgress * (UPLOAD_COMPLETED_OVERALL_PROGRESS / 100))
      );
      await analysisRef.update({
        uploadProgress: Math.round(uploadProgress),
        progress: overallProgressBasedOnUpload,
        status: 'uploading', // Ensure status remains 'uploading' during progress updates
      });
      return { success: true };
    } catch (error: unknown) {
      // Changed from any to unknown
      const errorMessage = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(
        `[FileUpload_UpdateProgress] Firestore error for analysis ${analysisId}: ${errorMessage}`,
        error
      );
      throw new functions.https.HttpsError(
        'internal',
        `Falha ao atualizar progresso: ${errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`
      );
    }
  }
);
