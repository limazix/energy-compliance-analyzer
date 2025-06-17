'use strict';

/**
 * @fileOverview HTTPS Callable Firebase Functions for tag management operations.
 * These functions handle adding and removing tags from analysis documents in Firestore.
 * Feature: Tag Management (HTTPS Callable)
 * Component: ManageTags
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

import { APP_CONFIG } from '@/config/appConfig'; // Corrected path

// Initialize Firebase Admin SDK if not already initialized.
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const MAX_ERROR_MESSAGE_LENGTH = APP_CONFIG.MAX_SERVER_ERROR_MESSAGE_LENGTH;

interface TagOperationData {
  analysisId: string;
  tag: string;
}

interface TagOperationResponse {
  success: boolean;
  message?: string;
}

/**
 * Adds a tag to an analysis document in Firestore.
 * @param {TagOperationData} data - The data object sent from the client.
 * @param {functions.https.CallableContext} context - The context of the call, containing auth information.
 * @returns {Promise<TagOperationResponse>} A promise that resolves with a success status and optional message.
 * @throws {functions.https.HttpsError} If unauthenticated, arguments invalid, document not found, or Firestore error.
 */
export const httpsCallableAddTag = functions.https.onCall(
  async (
    data: TagOperationData,
    context: functions.https.CallableContext
  ): Promise<TagOperationResponse> => {
    if (!context.auth || !context.auth.uid) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'A função deve ser chamada por um usuário autenticado.'
      );
    }
    const userId = context.auth.uid;
    const { analysisId, tag } = data;
    const trimmedTag = tag?.trim();

    if (!analysisId || !trimmedTag) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'ID da análise e tag são obrigatórios.'
      );
    }

    const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
    const analysisRef = db.doc(analysisDocPath);
    // eslint-disable-next-line no-console
    console.info(`[TagManagement_AddTag] Adding tag '${trimmedTag}' to ${analysisDocPath}.`);

    try {
      const analysisSnap = await analysisRef.get();
      if (!analysisSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Análise não encontrada.');
      }
      const currentTags = (analysisSnap.data()?.tags as string[] | undefined) || [];
      if (!currentTags.includes(trimmedTag)) {
        await analysisRef.update({ tags: admin.firestore.FieldValue.arrayUnion(trimmedTag) });
        // eslint-disable-next-line no-console
        console.info(`[TagManagement_AddTag] Tag '${trimmedTag}' added to ${analysisId}.`);
        return { success: true, message: `Tag "${trimmedTag}" adicionada.` };
      }
      // eslint-disable-next-line no-console
      console.info(`[TagManagement_AddTag] Tag '${trimmedTag}' already exists on ${analysisId}.`);
      return { success: true, message: `Tag "${trimmedTag}" já existe.` };
    } catch (error: unknown) {
      // Changed from any to unknown
      const errorMessage = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(
        `[TagManagement_AddTag] Firestore error for ${analysisDocPath}: ${errorMessage}`,
        error
      );
      if (error instanceof functions.https.HttpsError) throw error; // Re-throw HttpsError
      throw new functions.https.HttpsError(
        'internal',
        `Falha ao adicionar tag: ${errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`
      );
    }
  }
);

/**
 * Removes a tag from an analysis document in Firestore.
 * @param {TagOperationData} data - The data object sent from the client.
 * @param {functions.https.CallableContext} context - The context of the call.
 * @returns {Promise<TagOperationResponse>} A promise that resolves with a success status and optional message.
 * @throws {functions.https.HttpsError} If unauthenticated, arguments invalid, document not found, or Firestore error.
 */
export const httpsCallableRemoveTag = functions.https.onCall(
  async (
    data: TagOperationData,
    context: functions.https.CallableContext
  ): Promise<TagOperationResponse> => {
    if (!context.auth || !context.auth.uid) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'A função deve ser chamada por um usuário autenticado.'
      );
    }
    const userId = context.auth.uid;
    const { analysisId, tag } = data;
    const trimmedTagToRemove = tag?.trim();

    if (!analysisId || !trimmedTagToRemove) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'ID da análise e tag são obrigatórios.'
      );
    }

    const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
    const analysisRef = db.doc(analysisDocPath);
    // eslint-disable-next-line no-console
    console.info(
      `[TagManagement_RemoveTag] Removing tag '${trimmedTagToRemove}' from ${analysisDocPath}.`
    );

    try {
      const analysisSnap = await analysisRef.get();
      if (!analysisSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Análise não encontrada.');
      }
      await analysisRef.update({
        tags: admin.firestore.FieldValue.arrayRemove(trimmedTagToRemove),
      });
      // eslint-disable-next-line no-console
      console.info(
        `[TagManagement_RemoveTag] Tag '${trimmedTagToRemove}' removed from ${analysisId}.`
      );
      return { success: true, message: `Tag "${trimmedTagToRemove}" removida.` };
    } catch (error: unknown) {
      // Changed from any to unknown
      const errorMessage = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(
        `[TagManagement_RemoveTag] Firestore error for ${analysisDocPath}: ${errorMessage}`,
        error
      );
      if (error instanceof functions.https.HttpsError) throw error; // Re-throw HttpsError
      throw new functions.https.HttpsError(
        'internal',
        `Falha ao remover tag: ${errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`
      );
    }
  }
);
