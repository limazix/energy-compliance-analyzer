import { googleAI } from '@genkit-ai/googleai';
import { genkit } from 'genkit';

export const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY })],
  model: 'googleai/gemini-2.5-pro-preview-05-06',
});
