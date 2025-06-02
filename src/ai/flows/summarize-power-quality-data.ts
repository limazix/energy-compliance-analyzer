
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
    .describe('The power quality data in CSV format. This may be an initial segment of a larger dataset if the original file is very large.'),
});
export type SummarizePowerQualityDataInput = z.infer<typeof SummarizePowerQualityDataInputSchema>;

const SummarizePowerQualityDataOutputSchema = z.object({
  dataSummary: z
    .string()
    .describe(
      'A concise textual summary of the key aspects, anomalies, and overall characteristics of the provided power quality data segment, relevant for compliance analysis and significantly smaller than the input CSV. If the data appears truncated, focus the summary on the trends and events visible in the provided segment.'
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
  prompt: `You are an expert power systems analyst. You will be provided with power quality data in CSV format from a PowerNET PQ-600 G4 device. This data may be an initial segment of a larger dataset if the original file is very large. Your task is to:
1. Thoroughly analyze this provided data segment.
2. Generate a concise textual summary that captures the most critical information relevant for a subsequent ANEEL regulatory compliance assessment.
3. The summary should highlight:
    - Overall data period and recording duration *within the provided segment*.
    - Key voltage, current, power factor, and frequency statistics (e.g., min, max, average, significant deviations) *observed in the segment*.
    - Presence of any notable events or anomalies (e.g., sags, swells, interruptions, harmonic distortions exceeding typical thresholds) *visible in the segment*.
    - General stability and quality trends *observed in the segment*.
4. If the data appears truncated, clearly state this in your summary and focus your analysis on the trends and events visible in the provided segment.
5. The output summary MUST be significantly smaller than the input data to be suitable for further processing by another AI model with token limits. Focus on information density and relevance for regulatory checks. Do not include raw data rows in your summary.
Output only the textual summary.

Power Quality CSV Data (Segment):
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
    if (!input.powerQualityDataCsv || input.powerQualityDataCsv.trim() === "") {
      console.warn('[summarizePowerQualityDataFlow] Received empty or whitespace-only CSV data. Returning empty summary.');
      return { dataSummary: "Nenhum dado CSV fornecido para sumarização." };
    }
    const {output} = await prompt(input);
    if (!output) {
      // Consider if an empty summary is acceptable or if it should always throw.
      // For now, let's assume an empty output from the AI is an issue if input was provided.
      console.error('[summarizePowerQualityDataFlow] AI failed to generate a summary despite valid input.');
      throw new Error('AI failed to generate a summary.');
    }
    return output;
  }
);
