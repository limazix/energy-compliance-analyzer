// @ts-check
'use strict';

/**
 * @fileOverview Centralized Genkit AI instance initialization for Firebase Functions.
 * This ensures that all agent modules use the same configured Genkit instance.
 */

const { genkit } = require('genkit');
const { googleAI } = require('@genkit-ai/googleai');
const functions = require('firebase-functions');

// Retrieve Firebase runtime configuration for Gemini API Key.
const firebaseRuntimeConfig = functions.config();
const geminiApiKeyFromConfig =
  firebaseRuntimeConfig && firebaseRuntimeConfig.gemini
    ? firebaseRuntimeConfig.gemini.api_key
    : undefined;

// Determine Gemini API Key
const geminiApiKey =
  process.env.GEMINI_API_KEY || geminiApiKeyFromConfig || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

if (!geminiApiKey) {
  // eslint-disable-next-line no-console
  console.error('[GenkitInstance] CRITICAL: GEMINI_API_KEY not found. Genkit AI calls WILL FAIL.');
}

const ai = genkit({
  plugins: [googleAI({ apiKey: geminiApiKey })],
});

module.exports = { ai };
