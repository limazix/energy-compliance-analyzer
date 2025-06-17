'use strict';

/**
 * @fileOverview Centralized Genkit AI instance initialization for Firebase Functions.
 * This ensures that all agent modules use the same configured Genkit instance.
 */
import { GenkitPlugin, onFlow } from '@genkit-ai/core';
import { firebase, firebaseAuth } from '@genkit-ai/firebase';
import { googleAI } from '@genkit-ai/googleai';
import * as admin from 'firebase-admin';
import { getApps, initializeApp } from 'firebase-admin/app';
import * as functions from 'firebase-functions';
import { genkit } from 'genkit';

// Retrieve Firebase runtime configuration for Gemini API Key.
const firebaseRuntimeConfig = functions.config();
const geminiApiKeyFromConfig: string | undefined =
  firebaseRuntimeConfig && firebaseRuntimeConfig.gemini
    ? firebaseRuntimeConfig.gemini.api_key
    : undefined;

// Determine Gemini API Key
const geminiApiKey: string | undefined =
  process.env.GEMINI_API_KEY || geminiApiKeyFromConfig || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

if (!geminiApiKey) {
  // eslint-disable-next-line no-console
  console.error('[GenkitInstance] CRITICAL: GEMINI_API_KEY not found. Genkit AI calls WILL FAIL.');
}

export const ai = genkit({
  plugins: [googleAI({ apiKey: geminiApiKey })],
});

export function initFirebaseAdmin(): void {
  if (!getApps().length) {
    initializeApp();
  }
}

export function initGenkit(): void {
  const plugins: GenkitPlugin[] = [firebaseAuth()];

  onFlow(
    {
      name: 'orchestratorFlow',
      plugins: plugins,
      firebase: {
        app: admin.app(),
      },
    },
    async (_input: unknown) => {
      // Changed input type from any to unknown
      // return await generate('text-bison', input);
      return 'TODO: Implement orchestratorFlow';
    }
  );

  firebase({
    // The Firebase Admin SDK app. This must be initialized already.
    app: admin.app(),
    // The region to deploy Genkit functions.
    region: 'us-central1',
    // Whether to use Firebase Auth. Defaults to true.
    useAuth: true,
  });
}
