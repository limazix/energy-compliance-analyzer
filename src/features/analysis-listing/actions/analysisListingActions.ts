// src/features/analysis-listing/actions/analysisListingActions.ts
'use server';
/**
 * @fileOverview Server Action for fetching a user's past analyses.
 * This action now calls an HTTPS Callable Firebase Function to retrieve the data.
 */

import { httpsCallable, type HttpsCallableResult } from 'firebase/functions';

import { APP_CONFIG } from '@/config/appConfig';
import { functionsInstance } from '@/lib/firebase';
import type { Analysis } from '@/types/analysis';

const MAX_CLIENT_ERROR_MESSAGE_LENGTH = APP_CONFIG.MAX_CLIENT_SERVER_ACTION_ERROR_MESSAGE_LENGTH;

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
  // eslint-disable-next-line no-console
  console.debug(
    `[SA_getPastAnalyses] User: ${userId}. Calling 'httpsCallableGetPastAnalyses'. Project: ${
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV_VAR_NOT_SET'
    }`
  );

  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    const errorMsg = `[SA_getPastAnalyses] CRITICAL: userId is invalid (input: '${userId}'). Aborting.`;
    // eslint-disable-next-line no-console
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
      // eslint-disable-next-line no-console
      console.info(
        `[SA_getPastAnalyses] Successfully fetched ${result.data.analyses.length} analyses for user ${userId} via HTTPS Function.`
      );
      return result.data.analyses;
    } else {
      const errorMsg =
        '[SA_getPastAnalyses] HTTPS Function returned invalid data structure or no analyses array.';
      // eslint-disable-next-line no-console
      console.error(errorMsg, result.data);
      throw new Error(errorMsg);
    }
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string; details?: unknown };
    const code = firebaseError.code || 'unknown';
    const message =
      firebaseError.message || 'Erro desconhecido ao buscar análises via HTTPS Function.';
    // eslint-disable-next-line no-console
    console.error(
      `[SA_getPastAnalyses] Error calling 'httpsCallableGetPastAnalyses' for user ${userId}: Code: ${code}, Message: ${message}`,
      firebaseError.details || error
    );
    const clientErrorMessage = `Código: ${code} - ${message}`;

    let detailedErrorMessage = `Falha ao buscar análises (SA): ${clientErrorMessage}`;
    if (code === 'functions/permission-denied') {
      detailedErrorMessage +=
        ' Verifique as permissões IAM: a identidade que chama esta função (ex: Service Account do App Hosting) precisa da role "Cloud Functions Invoker" para a função de destino.';
    }

    throw new Error(detailedErrorMessage.substring(0, MAX_CLIENT_ERROR_MESSAGE_LENGTH));
  }
}
