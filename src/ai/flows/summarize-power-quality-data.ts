/**
 * @fileOverview Summarizes a chunk of power quality data to reduce token load for subsequent AI analysis.
 *
 * - summarizePowerQualityData - A function that generates a concise summary of a power quality data chunk.
 * - SummarizePowerQualityDataInput - The input type for the summarizePowerQualityData function.
 * - SummarizePowerQualityDataOutput - The return type for the summarizePowerQualityData function.
 */
'use server';

import { ai } from '@/ai/genkit';
import {
  SummarizePowerQualityDataInputSchema,
  SummarizePowerQualityDataOutputSchema,
  summarizePowerQualityDataPromptConfig,
  type SummarizePowerQualityDataInput,
  type SummarizePowerQualityDataOutput,
} from '@/ai/prompt-configs/summarize-power-quality-data-prompt-config';

export type { SummarizePowerQualityDataInput, SummarizePowerQualityDataOutput }; // Re-export types for external use

export async function summarizePowerQualityData(
  input: SummarizePowerQualityDataInput
): Promise<SummarizePowerQualityDataOutput> {
  return summarizePowerQualityDataFlow(input);
}

// Define the prompt using the imported configuration and the local 'ai' instance
const summarizeDataChunkPrompt = ai.definePrompt(summarizePowerQualityDataPromptConfig);

const summarizePowerQualityDataFlow = ai.defineFlow(
  {
    name: 'summarizePowerQualityDataChunkFlow', // Name can remain as it was
    inputSchema: SummarizePowerQualityDataInputSchema, // Use imported schema
    outputSchema: SummarizePowerQualityDataOutputSchema, // Use imported schema
  },
  async (input: SummarizePowerQualityDataInput) => {
    if (!input.powerQualityDataCsv || input.powerQualityDataCsv.trim() === '') {
      // eslint-disable-next-line no-console
      console.warn(
        '[summarizePowerQualityDataFlow] Received empty or whitespace-only CSV data chunk. Returning empty summary for this chunk.'
      );
      return { dataSummary: '' };
    }
    // Call the prompt defined with the local 'ai' instance
    const { output } = await summarizeDataChunkPrompt(input);
    if (!output) {
      // eslint-disable-next-line no-console
      console.error(
        '[summarizePowerQualityDataFlow] AI failed to generate a summary for the provided chunk.'
      );
      throw new Error('AI failed to generate a summary for the data chunk.');
    }
    return output;
  }
);
