
'use server';
/**
 * @fileOverview Summarizes a chunk of power quality data to reduce token load for subsequent AI analysis.
 *
 * - summarizePowerQualityData - A function that generates a concise summary of a power quality data chunk.
 * - SummarizePowerQualityDataInput - The input type for the summarizePowerQualityData function.
 * - SummarizePowerQualityDataOutput - The return type for the summarizePowerQualityData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizePowerQualityDataInputSchema = z.object({
  powerQualityDataCsv: z
    .string()
    .describe('A CHUNK of power quality data in CSV format. This is one segment of a potentially larger dataset.'),
});
export type SummarizePowerQualityDataInput = z.infer<typeof SummarizePowerQualityDataInputSchema>;

const SummarizePowerQualityDataOutputSchema = z.object({
  dataSummary: z
    .string()
    .describe(
      'A concise textual summary of the key aspects, anomalies, and overall characteristics of THIS SPECIFIC power quality data CHUNK, relevant for compliance analysis. The summary should be significantly smaller than the input CSV chunk and contain only factual information from the chunk.'
    ),
});
export type SummarizePowerQualityDataOutput = z.infer<typeof SummarizePowerQualityDataOutputSchema>;

export async function summarizePowerQualityData(
  input: SummarizePowerQualityDataInput
): Promise<SummarizePowerQualityDataOutput> {
  return summarizePowerQualityDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizePowerQualityDataChunkPrompt', // Renamed for clarity
  input: {schema: SummarizePowerQualityDataInputSchema},
  output: {schema: SummarizePowerQualityDataOutputSchema},
  prompt: `You are an expert power systems analyst. You will be provided with a CHUNK of power quality data in CSV format from a PowerNET PQ-600 G4 device. This is one segment of a potentially larger dataset. Your task is to:
1. Analyze THIS CHUNK of data.
2. Generate a CONCISE TEXTUAL SUMMARY that captures the most critical information *within this chunk* relevant for a subsequent ANEEL regulatory compliance assessment.
3. The summary for THIS CHUNK should highlight:
    - Key voltage, current, power factor, and frequency statistics (e.g., min, max, average, significant deviations) *observed in this chunk*.
    - Presence of any notable events or anomalies (e.g., sags, swells, interruptions, harmonic distortions exceeding typical thresholds) *visible in this chunk*.
    - General stability and quality trends *observed in this chunk*.
4. DO NOT add any introductory or concluding phrases like "This chunk covers..." or "In summary, this segment shows...". Provide only the direct factual summary of the data in this specific chunk.
5. The output summary for THIS CHUNK MUST be significantly smaller than the input data to be suitable for aggregation and further processing. Focus on information density and relevance for regulatory checks. Do not include raw data rows.

Power Quality CSV Data CHUNK:
{{powerQualityDataCsv}}
`,
});

const summarizePowerQualityDataFlow = ai.defineFlow(
  {
    name: 'summarizePowerQualityDataChunkFlow', // Renamed for clarity
    inputSchema: SummarizePowerQualityDataInputSchema,
    outputSchema: SummarizePowerQualityDataOutputSchema,
  },
  async input => {
    if (!input.powerQualityDataCsv || input.powerQualityDataCsv.trim() === "") {
      console.warn('[summarizePowerQualityDataFlow] Received empty or whitespace-only CSV data chunk. Returning empty summary for this chunk.');
      // Return an empty summary, which will be handled during aggregation.
      // Or, consider throwing an error if an empty chunk is unexpected.
      return { dataSummary: "" }; 
    }
    const {output} = await prompt(input);
    if (!output) {
      console.error('[summarizePowerQualityDataFlow] AI failed to generate a summary for the provided chunk.');
      throw new Error('AI failed to generate a summary for the data chunk.');
    }
    return output;
  }
);
