// src/ai/flows/identify-aneel-resolutions.ts
'use server';
/**
 * @fileOverview Identifies relevant ANEEL Normative Resolutions based on uploaded power quality data.
 *
 * - identifyAEEEResolutions - A function that identifies the relevant ANEEL Normative Resolutions.
 * - IdentifyAEEEResolutionsInput - The input type for the identifyAEEEResolutions function.
 * - IdentifyAEEEResolutionsOutput - The return type for the identifyAEEEResolutions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const IdentifyAEEEResolutionsInputSchema = z.object({
  powerQualityData: z
    .string()
    .describe('The power quality data uploaded by the user in CSV format.'),
});
export type IdentifyAEEEResolutionsInput = z.infer<
  typeof IdentifyAEEEResolutionsInputSchema
>;

const IdentifyAEEEResolutionsOutputSchema = z.object({
  relevantResolutions: z
    .array(z.string())
    .describe('The list of relevant ANEEL Normative Resolutions.'),
});
export type IdentifyAEEEResolutionsOutput = z.infer<
  typeof IdentifyAEEEResolutionsOutputSchema
>;

export async function identifyAEEEResolutions(
  input: IdentifyAEEEResolutionsInput
): Promise<IdentifyAEEEResolutionsOutput> {
  return identifyAEEEResolutionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'identifyAEEEResolutionsPrompt',
  input: {schema: IdentifyAEEEResolutionsInputSchema},
  output: {schema: IdentifyAEEEResolutionsOutputSchema},
  prompt: `You are an expert in Brazilian electrical regulations, specifically ANEEL Normative Resolutions.
  Based on the provided power quality data, identify the relevant ANEEL Normative Resolutions that apply.
  Return a list of the relevant resolutions. 

  Power Quality Data:
  {{powerQualityData}}`,
});

const identifyAEEEResolutionsFlow = ai.defineFlow(
  {
    name: 'identifyAEEEResolutionsFlow',
    inputSchema: IdentifyAEEEResolutionsInputSchema,
    outputSchema: IdentifyAEEEResolutionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
