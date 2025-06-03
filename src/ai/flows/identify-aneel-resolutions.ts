
'use server';
/**
 * @fileOverview Identifies relevant ANEEL Normative Resolutions based on a summary of power quality data.
 *
 * - identifyAEEEResolutions - A function that identifies the relevant ANEEL Normative Resolutions.
 * - IdentifyAEEEResolutionsInput - The input type for the identifyAEEEResolutions function.
 * - IdentifyAEEEResolutionsOutput - The return type for the identifyAEEEResolutions function.
 */

import {ai} from '@/ai/genkit';
import { 
  identifyAEEEResolutionsPromptConfig,
  type IdentifyAEEEResolutionsInput,
  type IdentifyAEEEResolutionsOutput,
  IdentifyAEEEResolutionsInputSchema, // Import schema for flow definition
  IdentifyAEEEResolutionsOutputSchema // Import schema for flow definition
} from '@/ai/prompt-configs/identify-aneel-resolutions-prompt-config';

export type { IdentifyAEEEResolutionsInput, IdentifyAEEEResolutionsOutput }; // Re-export types

export async function identifyAEEEResolutions(
  input: IdentifyAEEEResolutionsInput
): Promise<IdentifyAEEEResolutionsOutput> {
  return identifyAEEEResolutionsFlow(input);
}

// Define the prompt using the imported configuration and the local 'ai' instance
const identifyResolutionsPrompt = ai.definePrompt(identifyAEEEResolutionsPromptConfig);

const identifyAEEEResolutionsFlow = ai.defineFlow(
  {
    name: 'identifyAEEEResolutionsFlow',
    inputSchema: IdentifyAEEEResolutionsInputSchema, // Use imported schema
    outputSchema: IdentifyAEEEResolutionsOutputSchema, // Use imported schema
  },
  async (input: IdentifyAEEEResolutionsInput) => {
    // Call the prompt defined with the local 'ai' instance
    const {output} = await identifyResolutionsPrompt(input);
    if (!output) {
      throw new Error('AI failed to identify ANEEL resolutions.');
    }
    return output;
  }
);
