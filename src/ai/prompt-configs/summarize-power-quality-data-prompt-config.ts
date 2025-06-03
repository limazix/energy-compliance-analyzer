
import { z } from 'genkit/zod';

export const SummarizePowerQualityDataInputSchema = z.object({
  powerQualityDataCsv: z
    .string()
    .describe('A CHUNK of power quality data in CSV format. This is one segment of a potentially larger dataset.'),
  languageCode: z.string().optional().default('pt-BR')
    .describe('The BCP-47 language code for the desired output language (e.g., "en-US", "pt-BR"). Defaults to "pt-BR" if not provided.'),
});
export type SummarizePowerQualityDataInput = z.infer<typeof SummarizePowerQualityDataInputSchema>;

export const SummarizePowerQualityDataOutputSchema = z.object({
  dataSummary: z
    .string()
    .describe(
      'A concise textual summary of the key aspects, anomalies, and overall characteristics of THIS SPECIFIC power quality data CHUNK, relevant for compliance analysis, in the specified language. The summary should be significantly smaller than the input CSV chunk and contain only factual information from the chunk.'
    ),
});
export type SummarizePowerQualityDataOutput = z.infer<typeof SummarizePowerQualityDataOutputSchema>;

export const summarizePowerQualityDataPromptConfig = {
  name: 'summarizePowerQualityDataChunkShared',
  input: { schema: SummarizePowerQualityDataInputSchema },
  output: { schema: SummarizePowerQualityDataOutputSchema },
  prompt: `You are an expert power systems analyst. You will be provided with a CHUNK of power quality data in CSV format from a PowerNET PQ-600 G4 device. This is one segment of a potentially larger dataset. Your task is to:
1. Analyze THIS CHUNK of data.
2. Generate a CONCISE TEXTUAL SUMMARY in the language specified by '{{languageCode}}' (default to Brazilian Portuguese if no language code is specified or if the specified language is not well-supported for this technical domain) that captures the most critical information *within this chunk* relevant for a subsequent ANEEL regulatory compliance assessment.
3. The summary for THIS CHUNK should highlight:
    - Key voltage, current, power factor, and frequency statistics (e.g., min, max, average, significant deviations) *observed in this chunk*.
    - Presence of any notable events or anomalies (e.g., sags, swells, interruptions, harmonic distortions exceeding typical thresholds) *visible in this chunk*.
    - General stability and quality trends *observed in this chunk*.
4. DO NOT add any introductory or concluding phrases like "This chunk covers..." or "In summary, this segment shows...". Provide only the direct factual summary of the data in this specific chunk.
5. The output summary for THIS CHUNK MUST be significantly smaller than the input data to be suitable for aggregation and further processing. Focus on information density and relevance for regulatory checks. Do not include raw data rows.

Power Quality CSV Data CHUNK:
{{powerQualityDataCsv}}

Output Language: {{languageCode}}
`,
};
