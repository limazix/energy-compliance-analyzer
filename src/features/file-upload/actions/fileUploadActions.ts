// src/features/file-upload/actions/fileUploadActions.ts
'use server';
/**
 * @fileOverview Server Actions for managing the file upload process.
 * These actions act as a bridge between the client (Next.js frontend) and
 * HTTPS Callable Firebase Functions, which handle the core backend logic
 * like Firestore interactions. This aligns with an API Gateway pattern.
 */

import { httpsCallable, type HttpsCallableResult } from 'firebase/functions';

import { functionsInstance } from '@/lib/firebase'; // Firebase Functions instance for client SDK

const MAX_CLIENT_ERROR_MESSAGE_LENGTH = 250;

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
    // Type 'error' as 'any' to access properties like 'code', 'message', 'details'
    // which are common in Firebase HttpsError but not on generic 'Error' or 'unknown'.
    // A more robust approach might involve type guards if specific error structures are expected.
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
  _userId: string, // Kept for signature consistency with hook, but auth comes from context in Function
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
    // User ID is implicitly handled by the authenticated context of the callable function
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

interface FinalizeUploadRequestData {
  analysisId: string;
  downloadURL: string;
}
interface FinalizeUploadActionResponse {
  success: boolean;
  error?: string;
}
/**
 * Server Action to finalize the file upload record via an HTTPS Firebase Function.
 * This sets the file URL and transitions the status to trigger background processing.
 * @param {string} _userId - User ID (for logging/validation).
 * @param {string} analysisId - The ID of the analysis to finalize.
 * @param {string} downloadURL - The Firebase Storage download URL of the uploaded file.
 * @returns {Promise<FinalizeUploadActionResponse>} Success status or an error message.
 */
export async function finalizeFileUploadRecordAction(
  _userId: string,
  analysisId: string,
  downloadURL: string
): Promise<FinalizeUploadActionResponse> {
  const requestData: FinalizeUploadRequestData = { analysisId, downloadURL };
  try {
    await callFirebaseFunction<FinalizeUploadRequestData, { success: boolean }>(
      'httpsFinalizeFileUploadRecord',
      requestData
    );
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage.substring(0, MAX_CLIENT_ERROR_MESSAGE_LENGTH) };
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
 * @param {string | null} analysisId - The ID of the analysis. Can be null if record creation failed.
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
