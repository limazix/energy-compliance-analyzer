/**
 * @fileOverview HTTPS Callable Firebase Functions for CRUD-like analysis operations.
 * (Get List, Cancel)
 * Delete operation is now handled by an event-triggered function.
 * Feature: Analysis Management
 * Component: CrudHttp (HTTPS Callable)
 */

import * as admin from 'firebase-admin/app';
import * as firestore from 'firebase-admin/firestore';
import * as functions from 'firebase-functions';

import { APP_CONFIG } from '@/config/appConfig'; // Adjusted path
import type { Analysis } from '@/types/analysis'; // Adjusted path

// Initialize Firebase Admin SDK if not already initialized.
if (admin.apps.length === 0) {
  admin.initializeApp(); // No options needed if project ID is set via env vars
}
const db = admin.firestore();
const MAX_ERROR_MESSAGE_LENGTH = APP_CONFIG.MAX_SERVER_ERROR_MESSAGE_LENGTH;

/**
 * Validates if a given status string is a valid Analysis status.
 * @param {unknown} status - The status to validate. // Changed from any to unknown
 * @returns {status is Analysis['status']} True if valid, false otherwise.
 */
function statusIsValid(status: unknown): status is Analysis['status'] {
  const validStatuses: Analysis['status'][] = [
    'uploading',
    'summarizing_data',
    'identifying_regulations',
    'assessing_compliance',
    'completed',
    'error',
    'deleted',
    'cancelling',
    'cancelled',
    'reviewing_report',
    'pending_deletion',
  ];
  return typeof status === 'string' && validStatuses.includes(status as Analysis['status']);
}

/**
 * Interface for the request payload for fetching past analyses.
 */
interface HttpsCallableGetPastAnalysesRequest {
  /**
   * The ID of the user whose analyses are being fetched.
   * Note: This function explicitly uses the userId from the data payload,
   * NOT the context.auth.uid. This is intended for internal server-to-server
   * communication or trusted clients. Use with caution in untrusted environments.
   */
  userId: string;
  /**
   * Optional: The maximum number of analyses to return per page.
   */
  limit?: number;
  /**
   * Optional: The ID of the last document from the previous page.
   * Used for fetching the next page of results.
   */
  startAfterDocId?: string;
}

/**
 * Fetches past analyses for a user. Note: This function explicitly uses the userId from the data payload,
 * NOT the context.auth.uid. This is intended for internal server-to-server communication or trusted clients.
 * Use with caution in untrusted environments.
 *
 *          A promise that resolves with an array of analysis objects.
 * @throws {functions.https.HttpsError} If userId is missing or a Firestore error occurs.
 */
export const httpsCallableGetPastAnalyses = functions.https.onCall(
  async (data: { userId: string }, _context) => {
    const { userId } = data;

    if (!userId || typeof userId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'O ID do usuário (userId) é obrigatório no payload da solicitação.'
      );
    }

    // eslint-disable-next-line no-console
    console.info(
      `[AnalysisMgmt_GetPast] Fetching for explicit userId: ${userId}${data.limit ? `, limit: ${data.limit}` : ''}${data.startAfterDocId ? `, startAfterDocId: ${data.startAfterDocId}` : ''}, Project: ${process.env.GCLOUD_PROJECT || 'PROJECT_ID_NOT_SET_IN_FUNC_ENV'}`
    );

    // Start query
    let q: firestore.Query = db
      .collection('users')
      .doc(userId)
      .collection('analyses')
      .orderBy('createdAt', 'desc');

    // Apply limit if provided
    if (data.limit !== undefined) {
      q = q.limit(data.limit + 1); // Fetch one extra to check if there are more pages
    }

    // Apply startAfter if provided
    if (data.startAfterDocId !== undefined) {
      try {
        const startAfterDoc = await db
          .collection('users')
          .doc(userId)
          .collection('analyses')
          .doc(data.startAfterDocId)
          .get();
        if (startAfterDoc.exists) {
          q = q.startAfter(startAfterDoc);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(
          `[AnalysisMgmt_GetPast] Failed to get startAfterDoc ${data.startAfterDocId}:`,
          error
        );
      }
    }
    const analysesCol = db.collection('users').doc(userId).collection('analyses');
    const q = analysesCol.orderBy('createdAt', 'desc');

    try {
      const snapshot = await q.get();
      // eslint-disable-next-line no-console
      console.info(
        `[AnalysisMgmt_GetPast] Found ${snapshot.docs.length} analyses for userId: ${userId}`
      );

      const mapTimestampToISO = (
        timestampFieldValue: admin.firestore.Timestamp | string | undefined
      ): string | undefined => {
        if (timestampFieldValue instanceof firestore.Timestamp) {
          return (timestampFieldValue as admin.firestore.Timestamp).toDate().toISOString();
        }
        if (
          // Allow ISO strings for backward compatibility or manual entry, though not standard Firestore behavior
          typeof timestampFieldValue === 'string' &&
          /\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}.\\d{3}Z/.test(timestampFieldValue)
        ) {
          return timestampFieldValue;
        }
        return undefined;
      };

      const analyses = snapshot.docs
        .map((docSnap) => {
          const docData = docSnap.data();
          const analysisResult: Partial<Analysis> = {
            // Use Partial<Analysis> for type safety during construction
            id: docSnap.id,
            userId: docData.userId,
            fileName: docData.fileName,
            title: docData.title,
            description: docData.description,
            languageCode: docData.languageCode,
            status: docData.status,
            progress: docData.progress,
            uploadProgress: docData.uploadProgress,
            powerQualityDataUrl: docData.powerQualityDataUrl,
            powerQualityDataSummary: docData.powerQualityDataSummary,
            isDataChunked: docData.isDataChunked,
            identifiedRegulations: docData.identifiedRegulations,
            summary: docData.summary,
            structuredReport: docData.structuredReport,
            mdxReportStoragePath: docData.mdxReportStoragePath,
            errorMessage: docData.errorMessage,
            tags: docData.tags || [],
            createdAt: mapTimestampToISO(docData.createdAt) || new Date(0).toISOString(),
            completedAt: mapTimestampToISO(docData.completedAt),
            reportLastModifiedAt: mapTimestampToISO(docData.reportLastModifiedAt),
            deletionRequestedAt: mapTimestampToISO(docData.deletionRequestedAt),
          };

          if (!statusIsValid(analysisResult.status)) {
            // eslint-disable-next-line no-console
            console.warn(
              `[AnalysisMgmt_GetPast] Analysis ${
                docSnap.id
              } has invalid status: ${analysisResult.status}. Defaulting to 'error'.`
            );
            analysisResult.status = 'error';
            analysisResult.errorMessage =
              analysisResult.errorMessage ||
              `Status inválido (${String(docData.status)}) recebido do Firestore.`;
          }
          return analysisResult as Analysis; // Cast to Analysis after validation
        })
        .filter((a) => a.status !== 'deleted' && a.status !== 'pending_deletion');

      const hasNextPage = data.limit !== undefined && snapshot.docs.length > data.limit;
      const analysesToReturn = hasNextPage ? analyses.slice(0, data.limit) : analyses;
      const lastDocId =
        analysesToReturn.length > 0 ? analysesToReturn[analysesToReturn.length - 1].id : undefined;

      return {
        analyses: analysesToReturn,
        lastDocId: hasNextPage ? lastDocId : undefined, // Return lastDocId only if there's a next page
      };
    } catch (error: unknown) {
      // Changed from any to unknown
      const errorMessage = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(
        `[AnalysisMgmt_GetPast] Firestore error for userId ${userId}: ${errorMessage}`,
        error
      );
      throw new functions.https.HttpsError(
        'internal',
        `Falha ao buscar análises: ${errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`
      );
    }
  }
);

/**
 * Interface for the response payload when fetching past analyses.
 */
interface HttpsCallableGetPastAnalysesResponse {
  /**
   * An array of Analysis objects for the current page.
   */
  analyses: Analysis[];
  /**
   * The ID of the last document in the current page.
   * This should be used as `startAfterDocId` for the next request to get the subsequent page.
   * Undefined if there are no more pages.
   */
  lastDocId?: string;
}

/**
 * Requests cancellation of an analysis.
 * Requires `context.auth` for user identification.
 * @param {{analysisId: string}} data - The data object containing the analysis ID.
 * @param {functions.https.CallableContext} context - The context of the call.
 * @returns {Promise<{success: boolean, message?: string}>} Success status.
 * @throws {functions.https.HttpsError} If unauthenticated, arguments invalid, or an error occurs.
 */
export const httpsCallableCancelAnalysis = functions.https.onCall(
  async (data: { analysisId: string }, context) => {
    if (!context.auth || !context.auth.uid) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'A função deve ser chamada por um usuário autenticado.'
      );
    }
    const userId = context.auth.uid;
    const { analysisId } = data;

    if (!analysisId || typeof analysisId !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'ID da análise é obrigatório.');
    }

    const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
    const analysisRef = db.doc(analysisDocPath);
    // eslint-disable-next-line no-console
    console.info(
      `[AnalysisMgmt_Cancel] Requesting cancellation for ${analysisDocPath}. Project: ${
        process.env.GCLOUD_PROJECT || 'PROJECT_ID_NOT_SET_IN_FUNC_ENV'
      }`
    );

    try {
      const docSnap = await analysisRef.get();
      if (!docSnap.exists()) {
        // Check exists as a boolean property
        throw new functions.https.HttpsError(
          'not-found',
          `Análise ${analysisId} não encontrada para cancelamento.`
        );
      }

      const currentStatus = docSnap.data()?.status as Analysis['status'];
      if (
        currentStatus === 'completed' ||
        currentStatus === 'error' ||
        currentStatus === 'cancelled' ||
        currentStatus === 'deleted' ||
        currentStatus === 'pending_deletion'
      ) {
        const msg = `Análise ${analysisId} já está em um estado final (${currentStatus}) e não pode ser cancelada.`;
        // eslint-disable-next-line no-console
        console.warn(`[AnalysisMgmt_Cancel] ${msg}`);
        return { success: false, message: msg };
      }
      if (currentStatus === 'cancelling') {
        const msg = `Análise ${analysisId} já está sendo cancelada.`;
        // eslint-disable-next-line no-console
        console.info(`[AnalysisMgmt_Cancel] ${msg}`);
        return { success: true, message: msg };
      }

      await analysisRef.update({
        status: 'cancelling',
        errorMessage: 'Cancelamento solicitado pelo usuário...',
      });
      // eslint-disable-next-line no-console
      console.info(`[AnalysisMgmt_Cancel] Analysis ${analysisId} status set to 'cancelling'.`);
      return { success: true, message: 'Solicitação de cancelamento enviada.' };
    } catch (error: unknown) {
      // Changed from any to unknown
      const errorMessage = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(
        `[AnalysisMgmt_Cancel] Error for ${analysisDocPath}:`,
        errorMessage,
        JSON.stringify(error, Object.getOwnPropertyNames(error as object)) // Added as object type
      );

      if (error instanceof functions.https.HttpsError) {
        throw error; // It's already an HttpsError, re-throw it
      }
      // Otherwise, wrap it as an 'internal' HttpsError
      throw new functions.https.HttpsError(
        'internal',
        `Falha ao solicitar cancelamento: ${errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`
      );
    }
  }
);
