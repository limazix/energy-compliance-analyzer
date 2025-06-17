// src/features/tag-management/actions/tagActions.ts
'use server';
/**
 * @fileOverview Server Actions for managing tags on analysis documents.
 * These actions invoke HTTPS Callable Firebase Functions to handle Firestore interactions.
 */

import { httpsCallable } from 'firebase/functions';

import { APP_CONFIG } from '@/config/appConfig';
import { functionsInstance } from '@/lib/firebase';

import type { HttpsCallableResult } from 'firebase/functions';

const MAX_CLIENT_ERROR_MESSAGE_LENGTH = APP_CONFIG.MAX_CLIENT_SERVER_ACTION_ERROR_MESSAGE_LENGTH;

interface TagOperationData {
  // userId is not sent here, as the Function uses context.auth.uid
  analysisId: string;
  tag: string;
}

interface TagOperationResponse {
  success: boolean;
  message?: string;
  error?: string; // Added for consistency with other action responses
}

/**
 * Server Action to add a tag to an analysis by calling an HTTPS Firebase Function.
 * @param {string} _userId - User ID from the client (for logging/validation on client, not directly passed to callable data if context.auth is primary).
 * @param {string} analysisIdInput - The ID of the analysis document.
 * @param {string} tag - The tag string to add.
 * @returns {Promise<TagOperationResponse>} An object indicating success or failure, with an optional message or error.
 */
export async function addTagToAction(
  _userId: string, // Kept for consistency with hook, auth handled by Function context
  analysisIdInput: string,
  tag: string
): Promise<TagOperationResponse> {
  const analysisId = analysisIdInput?.trim();
  const trimmedTag = tag?.trim();

  // eslint-disable-next-line no-console
  console.debug(
    `[SA_addTag] User: ${_userId}, AnalysisID: ${analysisId}, Tag: ${trimmedTag} (Raw inputs: analysisId='${analysisIdInput}', tag='${tag}')`
  );

  if (!analysisId || !trimmedTag) {
    const errorMsg = '[SA_addTag] ID da análise e tag são obrigatórios.';
    // eslint-disable-next-line no-console
    console.error(`${errorMsg} AnalysisID: ${analysisId}, Tag: ${trimmedTag}`);
    return { success: false, error: errorMsg };
  }

  const requestData: TagOperationData = { analysisId, tag: trimmedTag };

  try {
    // eslint-disable-next-line no-console
    console.info(
      `[SA_addTag] Calling HTTPS function 'httpsCallableAddTag' for analysis ${analysisId}, tag '${trimmedTag}'.`
    );
    const callableFunction = httpsCallable<TagOperationData, TagOperationResponse>(
      functionsInstance,
      'httpsCallableAddTag'
    );
    const result: HttpsCallableResult<TagOperationResponse> = await callableFunction(requestData);
    // eslint-disable-next-line no-console
    console.info(
      `[SA_addTag] HTTPS function 'httpsCallableAddTag' returned for analysis ${analysisId}. Success: ${result.data.success}`
    );
    return { success: result.data.success, message: result.data.message };
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string; details?: unknown };
    const code = firebaseError.code || 'unknown';
    const message = firebaseError.message || 'Erro desconhecido ao adicionar tag.';
    // eslint-disable-next-line no-console
    console.error(
      `[SA_addTag] Error calling 'httpsCallableAddTag' for analysis ${analysisId}: Code: ${code}, Message: ${message}`,
      error
    );
    return {
      success: false,
      error: `Erro ao adicionar tag: ${message.substring(0, MAX_CLIENT_ERROR_MESSAGE_LENGTH)}`,
    };
  }
}

/**
 * Server Action to remove a tag from an analysis by calling an HTTPS Firebase Function.
 * @param {string} _userId - User ID from the client.
 * @param {string} analysisIdInput - The ID of the analysis document.
 * @param {string} tagToRemove - The tag string to remove.
 * @returns {Promise<TagOperationResponse>} An object indicating success or failure, with an optional message or error.
 */
export async function removeTagAction(
  _userId: string,
  analysisIdInput: string,
  tagToRemove: string
): Promise<TagOperationResponse> {
  const analysisId = analysisIdInput?.trim();
  const trimmedTagToRemove = tagToRemove?.trim();

  // eslint-disable-next-line no-console
  console.debug(
    `[SA_removeTag] User: ${_userId}, AnalysisID: ${analysisId}, TagToRemove: ${trimmedTagToRemove} (Raw inputs: analysisId='${analysisIdInput}', tagToRemove='${tagToRemove}')`
  );

  if (!analysisId || !trimmedTagToRemove) {
    const errorMsg = '[SA_removeTag] ID da análise e tag para remover são obrigatórios.';
    // eslint-disable-next-line no-console
    console.error(`${errorMsg} AnalysisID: ${analysisId}, TagToRemove: ${trimmedTagToRemove}`);
    return { success: false, error: errorMsg };
  }

  const requestData: TagOperationData = { analysisId, tag: trimmedTagToRemove };

  try {
    // eslint-disable-next-line no-console
    console.info(
      `[SA_removeTag] Calling HTTPS function 'httpsCallableRemoveTag' for analysis ${analysisId}, tag '${trimmedTagToRemove}'.`
    );
    const callableFunction = httpsCallable<TagOperationData, TagOperationResponse>(
      functionsInstance,
      'httpsCallableRemoveTag'
    );
    const result: HttpsCallableResult<TagOperationResponse> = await callableFunction(requestData);
    // eslint-disable-next-line no-console
    console.info(
      `[SA_removeTag] HTTPS function 'httpsCallableRemoveTag' returned for analysis ${analysisId}. Success: ${result.data.success}`
    );
    return { success: result.data.success, message: result.data.message };
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string; details?: unknown };
    const code = firebaseError.code || 'unknown';
    const message = firebaseError.message || 'Erro desconhecido ao remover tag.';
    // eslint-disable-next-line no-console
    console.error(
      `[SA_removeTag] Error calling 'httpsCallableRemoveTag' for analysis ${analysisId}: Code: ${code}, Message: ${message}`,
      error
    );
    return {
      success: false,
      error: `Erro ao remover tag: ${message.substring(0, MAX_CLIENT_ERROR_MESSAGE_LENGTH)}`,
    };
  }
}
