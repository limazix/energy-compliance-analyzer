// src/features/file-upload/actions/fileUploadActions.ts
'use server';
/**
 * @fileOverview Server Actions for managing the file upload process.
 * createInitialAnalysisRecordAction: Calls an HTTPS Function to create the Firestore doc.
 * updateAnalysisUploadProgressAction: Calls an HTTPS Function to update upload progress.
 * notifyFileUploadCompleteAction: Publishes a Pub/Sub event when file upload is complete.
 * markUploadAsFailedAction: Calls an HTTPS Function to mark an upload as failed.
 */

import { httpsCallable, type HttpsCallableResult } from 'firebase/functions';

import { functionsInstance } from '@/lib/firebase'; // Firebase Functions instance for client SDK
import { adminPubSub } from '@/lib/firebase-admin'; // For Pub/Sub

const MAX_CLIENT_ERROR_MESSAGE_LENGTH = 250;
const FILE_UPLOAD_COMPLETED_TOPIC = 'file-upload-completed-topic';

/**
 * Helper to call an HTTPS Firebase Function and handle its result or error.
 * @template RequestData - The type of the data sent to the function.
 * @template ResponseData - The type of the data expected in the function's response.
 * @param {string} functionName - The name of the HTTPS Callable Firebase Function.
 * @param {RequestData} data - The data to send to the function.
 * @returns {Promise<HttpsCallableResult<ResponseData>>} A promise that resolves with the function's result.
 * @throws {Error} If the function call fails, re-throws a structured error.
 */
async function callFirebaseFunction<RequestData, ResponseData>(
  functionName: string,
  data: RequestData
): Promise<HttpsCallableResult<ResponseData>> {
  const callableFunction = httpsCallable<RequestData, ResponseData>(
    functionsInstance,
    functionName
  );
  try {
    // eslint-disable-next-line no-console
    console.debug(`[Action_${functionName}] Calling HTTPS function with data:`, data);
    const result = await callableFunction(data);
    // eslint-disable-next-line no-console
    console.info(
      `[Action_${functionName}] HTTPS function call successful. Result data:`,
      result.data
    );
    return result;
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string; details?: unknown };
    const code = firebaseError.code || 'unknown';
    const message = firebaseError.message || 'Erro desconhecido ao chamar a função.';
    const details = firebaseError.details || undefined;
    // eslint-disable-next-line no-console
    console.error(
      `[Action_${functionName}] Error calling HTTPS function: Code: ${code}, Message: ${message}, Details:`,
      details,
      error
    );
    throw new Error(
      `Function Call Error (${functionName} - ${code}): ${message}${
        details ? ` Details: ${JSON.stringify(details)}` : ''
      }`
    );
  }
}

// --- Server Action Types (Request/Response for client-side) ---
interface CreateInitialRecordRequestData {
  fileName: string;
  title?: string;
  description?: string;
  languageCode?: string;
}
interface CreateInitialRecordActionResponse {
  analysisId?: string;
  error?: string;
}

/**
 * Server Action to create an initial analysis record by calling an HTTPS Firebase Function.
 * The user's authentication is handled by the Firebase Function via `context.auth`.
 * @param {string} _userId - User ID from the client (used for logging/validation, not passed to callable if context.auth is primary).
 * @param {string} fileName - The name of the file being uploaded.
 * @param {string} [title] - Optional title for the analysis.
 * @param {string} [description] - Optional description for the analysis.
 * @param {string} [languageCode] - Optional BCP-47 language code.
 * @returns {Promise<CreateInitialRecordActionResponse>} The analysis ID or an error message.
 */
export async function createInitialAnalysisRecordAction(
  _userId: string,
  fileName: string,
  title?: string,
  description?: string,
  languageCode?: string
): Promise<CreateInitialRecordActionResponse> {
  const requestData: CreateInitialRecordRequestData = {
    fileName,
    title,
    description,
    languageCode,
  };
  try {
    const result = await callFirebaseFunction<
      CreateInitialRecordRequestData,
      { analysisId: string }
    >('httpsCreateInitialAnalysisRecord', requestData);
    return { analysisId: result.data.analysisId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { error: errorMessage.substring(0, MAX_CLIENT_ERROR_MESSAGE_LENGTH) };
  }
}

interface UpdateProgressRequestData {
  analysisId: string;
  uploadProgress: number;
}
interface UpdateProgressActionResponse {
  success: boolean;
  error?: string;
}
/**
 * Server Action to update the upload progress of an analysis via an HTTPS Firebase Function.
 * @param {string} _userId - User ID (for logging/validation).
 * @param {string} analysisId - The ID of the analysis to update.
 * @param {number} uploadProgress - The current upload progress percentage (0-100).
 * @returns {Promise<UpdateProgressActionResponse>} Success status or an error message.
 */
export async function updateAnalysisUploadProgressAction(
  _userId: string,
  analysisId: string,
  uploadProgress: number
): Promise<UpdateProgressActionResponse> {
  const requestData: UpdateProgressRequestData = { analysisId, uploadProgress };
  try {
    await callFirebaseFunction<UpdateProgressRequestData, { success: boolean }>(
      'httpsUpdateAnalysisUploadProgress',
      requestData
    );
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage.substring(0, MAX_CLIENT_ERROR_MESSAGE_LENGTH) };
  }
}

interface NotifyUploadCompleteRequestData {
  userId: string;
  analysisId: string;
  downloadURL: string;
}
interface NotifyUploadCompleteActionResponse {
  success: boolean;
  error?: string;
}

/**
 * Server Action to notify that a file upload is complete by publishing a Pub/Sub message.
 * @param {string} userId - User ID.
 * @param {string} analysisId - The ID of the analysis.
 * @param {string} downloadURL - The Firebase Storage download URL of the uploaded file.
 * @returns {Promise<NotifyUploadCompleteActionResponse>} Success status or an error message.
 */
export async function notifyFileUploadCompleteAction(
  userId: string,
  analysisId: string,
  downloadURL: string
): Promise<NotifyUploadCompleteActionResponse> {
  // eslint-disable-next-line no-console
  console.debug(
    `[SA_notifyFileUploadComplete] User: ${userId}, AnalysisID: ${analysisId}. Publishing to Pub/Sub topic '${FILE_UPLOAD_COMPLETED_TOPIC}'. URL: ${downloadURL.substring(0, 50)}...`
  );

  if (!userId || !analysisId || !downloadURL) {
    const errorMsg = `[SA_notifyFileUploadComplete] CRITICAL: userId ('${userId}'), analysisId ('${analysisId}'), or downloadURL is invalid.`;
    // eslint-disable-next-line no-console
    console.error(errorMsg);
    return { success: false, error: errorMsg.substring(0, MAX_CLIENT_ERROR_MESSAGE_LENGTH) };
  }
  if (!adminPubSub) {
    const errorMsg = `[SA_notifyFileUploadComplete] CRITICAL: adminPubSub is not initialized. Cannot publish event.`;
    // eslint-disable-next-line no-console
    console.error(errorMsg);
    return { success: false, error: errorMsg.substring(0, MAX_CLIENT_ERROR_MESSAGE_LENGTH) };
  }

  const messagePayload: NotifyUploadCompleteRequestData = {
    userId,
    analysisId,
    downloadURL,
  };

  try {
    const topic = adminPubSub.topic(FILE_UPLOAD_COMPLETED_TOPIC);
    const messageId = await topic.publishMessage({ json: messagePayload }); // Send as JSON

    // eslint-disable-next-line no-console
    console.info(
      `[SA_notifyFileUploadComplete] Message ${messageId} published to ${FILE_UPLOAD_COMPLETED_TOPIC} for analysis ${analysisId}.`
    );
    return { success: true };
  } catch (error: unknown) {
    const message =
      (error instanceof Error ? error.message : String(error)) ||
      'Erro desconhecido ao notificar conclusão do upload via Pub/Sub.';
    // eslint-disable-next-line no-console
    console.error(
      `[SA_notifyFileUploadComplete] Error publishing to Pub/Sub for ${analysisId}: ${message}`,
      error
    );
    return {
      success: false,
      error: `Falha ao notificar conclusão do upload (SA Pub/Sub): ${message.substring(
        0,
        MAX_CLIENT_ERROR_MESSAGE_LENGTH
      )}`,
    };
  }
}

interface MarkFailedRequestData {
  analysisId: string | null;
  uploadErrorMessage: string;
}
interface MarkFailedActionResponse {
  success: boolean;
  error?: string;
  message?: string;
}
/**
 * Server Action to mark an analysis upload as failed via an HTTPS Firebase Function.
 * @param {string} _userId - User ID (for logging/validation).
 * @param {string | null} analysisId - The ID of the analysis. Can be null if record creation itself failed.
 * @param {string} uploadErrorMessage - The error message describing the failure.
 * @returns {Promise<MarkFailedActionResponse>} Success status, an optional message, or an error.
 */
export async function markUploadAsFailedAction(
  _userId: string,
  analysisId: string | null,
  uploadErrorMessage: string
): Promise<MarkFailedActionResponse> {
  const requestData: MarkFailedRequestData = { analysisId, uploadErrorMessage };
  try {
    const result = await callFirebaseFunction<MarkFailedRequestData, MarkFailedActionResponse>(
      'httpsMarkUploadAsFailed',
      requestData
    );
    return { success: result.data.success, message: result.data.message };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage.substring(0, MAX_CLIENT_ERROR_MESSAGE_LENGTH) };
  }
}
