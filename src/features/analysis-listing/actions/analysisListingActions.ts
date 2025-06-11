// src/features/analysis-listing/actions/analysisListingActions.ts
'use server';
/**
 * @fileOverview Server Action for fetching a user's past analyses.
 * This action now calls an HTTPS Callable Firebase Function to retrieve the data.
 */

import { httpsCallable } from 'firebase/functions';

import { functionsInstance } from '@/lib/firebase';
import type { Analysis } from '@/types/analysis';

import type { HttpsCallableResult } from 'firebase/functions';

const MAX_CLIENT_ERROR_MESSAGE_LENGTH = 250;

interface HttpsCallableGetPastAnalysesResponse {
  analyses: Analysis[];
}

interface HttpsCallableGetPastAnalysesRequest {
  userId: string;
}

/**
 * Server Action to fetch past analyses for the authenticated user.
 * It calls the `httpsCallableGetPastAnalyses` Firebase Function.
 * @param {string} userId - The ID of the user whose analyses are to be fetched.
 *                         This is passed to the Callable Function.
 * @returns {Promise<Analysis[]>} A promise that resolves with an array of analysis objects.
 * @throws {Error} If the function call fails or returns an error.
 */
export async function getPastAnalysesAction(userId: string): Promise<Analysis[]> {
  console.debug(
    `[SA_getPastAnalyses] User: ${userId}. Calling 'httpsCallableGetPastAnalyses'. Project: ${
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV_VAR_NOT_SET'
    }`
  );

  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    const errorMsg = `[SA_getPastAnalyses] CRITICAL: userId is invalid (input: '${userId}'). Aborting.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  try {
    const callableFunction = httpsCallable<
      HttpsCallableGetPastAnalysesRequest,
      HttpsCallableGetPastAnalysesResponse
    >(functionsInstance, 'httpsCallableGetPastAnalyses');

    // Pass userId in the data payload to the callable function
    const result: HttpsCallableResult<HttpsCallableGetPastAnalysesResponse> =
      await callableFunction({ userId });

    if (result.data && Array.isArray(result.data.analyses)) {
      console.info(
        `[SA_getPastAnalyses] Successfully fetched ${result.data.analyses.length} analyses for user ${userId} via HTTPS Function.`
      );
      return result.data.analyses;
    } else {
      const errorMsg =
        '[SA_getPastAnalyses] HTTPS Function returned invalid data structure or no analyses array.';
      console.error(errorMsg, result.data);
      throw new Error(errorMsg);
    }
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string; details?: unknown };
    const code = firebaseError.code || 'unknown';
    const message =
      firebaseError.message || 'Erro desconhecido ao buscar análises via HTTPS Function.';
    console.error(
      `[SA_getPastAnalyses] Error calling 'httpsCallableGetPastAnalyses' for user ${userId}: Code: ${code}, Message: ${message}`,
      error
    );
    const clientErrorMessage = `Código: ${code} - ${message}`;
    throw new Error(
      `Falha ao buscar análises (SA): ${clientErrorMessage.substring(0, MAX_CLIENT_ERROR_MESSAGE_LENGTH)}`
    );
  }
}
