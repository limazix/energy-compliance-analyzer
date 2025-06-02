
'use server';
/**
 * @fileOverview Summarizes power quality data to reduce token load for subsequent AI analysis.
 *
 * - summarizePowerQualityData - A function that generates a concise summary of power quality data.
 * - SummarizePowerQualityDataInput - The input type for the summarizePowerQualityData function.
 * - SummarizePowerQualityDataOutput - The return type for the summarizePowerQualityData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizePowerQualityDataInputSchema = z.object({
  powerQualityDataCsv: z
    .string()
    .describe('The power quality data in CSV format, potentially very large.'),
});
export type SummarizePowerQualityDataInput = z.infer<typeof SummarizePowerQualityDataInputSchema>;

const SummarizePowerQualityDataOutputSchema = z.object({
  dataSummary: z
    .string()
    .describe(
      'A concise textual summary of the key aspects, anomalies, and overall characteristics of the power quality data, relevant for compliance analysis and significantly smaller than the input CSV.'
    ),
});
export type SummarizePowerQualityDataOutput = z.infer<typeof SummarizePowerQualityDataOutputSchema>;

export async function summarizePowerQualityData(
  input: SummarizePowerQualityDataInput
): Promise<SummarizePowerQualityDataOutput> {
  return summarizePowerQualityDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizePowerQualityDataPrompt',
  input: {schema: SummarizePowerQualityDataInputSchema},
  output: {schema: SummarizePowerQualityDataOutputSchema},
  prompt: `You are an expert power systems analyst. You will be provided with power quality data in CSV format from a PowerNET PQ-600 G4 device. Your task is to:
1. Thoroughly analyze this data.
2. Generate a concise textual summary that captures the most critical information relevant for a subsequent ANEEL regulatory compliance assessment.
3. The summary should highlight:
    - Overall data period and recording duration.
    - Key voltage, current, power factor, and frequency statistics (e.g., min, max, average, significant deviations).
    - Presence of any notable events or anomalies (e.g., sags, swells, interruptions, harmonic distortions exceeding typical thresholds).
    - General stability and quality trends observed.
4. The output summary MUST be significantly smaller than the input data to be suitable for further processing by another AI model with token limits. Focus on information density and relevance for regulatory checks. Do not include raw data rows in your summary.
Output only the textual summary.

Power Quality CSV Data:
{{powerQualityDataCsv}}
`,
});

const summarizePowerQualityDataFlow = ai.defineFlow(
  {
    name: 'summarizePowerQualityDataFlow',
    inputSchema: SummarizePowerQualityDataInputSchema,
    outputSchema: SummarizePowerQualityDataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('AI failed to generate a summary.');
    }
    return output;
  }
);
