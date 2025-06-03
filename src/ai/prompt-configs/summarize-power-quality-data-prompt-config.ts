
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
      'A comprehensive textual analysis of THIS SPECIFIC power quality data CHUNK, acting as a Senior Data Analyst. This output should be in the specified language and include: 1. Key metrics, statistics (min, max, avg), and significant anomalies/deviations. 2. Suggestions for data transformations or enrichments that would aid a detailed regulatory compliance review by an electrical engineer. 3. Preliminary ideas for graphics/visualizations based on this chunk. The summary must be factual, significantly smaller than the input, and ready for aggregation and further processing by specialized engineering agents.'
    ),
});
export type SummarizePowerQualityDataOutput = z.infer<typeof SummarizePowerQualityDataOutputSchema>;

export const summarizePowerQualityDataPromptConfig = {
  name: 'summarizePowerQualityDataChunkShared', // Name can remain for compatibility
  input: { schema: SummarizePowerQualityDataInputSchema },
  output: { schema: SummarizePowerQualityDataOutputSchema },
  prompt: `You are a Senior Data Analyst specializing in electrical power quality data from devices like PowerNET PQ-600 G4. You will be provided with a CHUNK of power quality data in CSV format. This is one segment of a potentially larger dataset.
Your task is to meticulously analyze THIS CHUNK and generate a comprehensive textual preparation report in the language specified by '{{languageCode}}' (default to Brazilian Portuguese if not specified or if the language is not well-supported for this technical domain).

This preparation report for THIS CHUNK must include:
1.  **Initial Data Analysis & Key Metrics:**
    *   Identify and list key voltage, current, power factor, and frequency statistics (e.g., min, max, average, significant deviations, outliers) *observed in this chunk*.
    *   Note the presence of any notable events or anomalies (e.g., sags, swells, interruptions, harmonic distortions exceeding typical thresholds, rapid changes) *visible in this chunk*.
    *   Describe general stability and quality trends *observed in this chunk*.
2.  **Data Preparation Suggestions for Subsequent Engineering Analysis:**
    *   Based on your analysis of this chunk, suggest any data transformations (e.g., "Consider calculating THD for current if not present") or data enrichments (e.g., "If external temperature data is available for this period, correlating it with load might be insightful") that would be beneficial for a detailed ANEEL regulatory compliance assessment by an Electrical Engineer.
    *   If the data in this chunk appears incomplete or has quality issues, note them.
3.  **Preliminary Graphic/Visualization Ideas (for this chunk):**
    *   Suggest 1-2 types of simple graphics or visualizations (e.g., "a time-series plot of voltage for this period", "a histogram of frequency deviations") that could effectively represent the key characteristics or anomalies found *specifically in this data chunk*. These are preliminary ideas for this segment only.

**Formatting and Constraints:**
*   DO NOT add any introductory or concluding phrases like "This chunk covers..." or "In summary, this segment shows...". Provide only the direct, structured analytical output.
*   The output summary for THIS CHUNK MUST be significantly smaller than the input data to be suitable for aggregation and further processing. Focus on information density and relevance for subsequent regulatory checks and engineering review. Do not include raw data rows.
*   Ensure the output is a single string, clearly delineating the three sections (Initial Analysis, Preparation Suggestions, Graphic Ideas).

Power Quality CSV Data CHUNK:
{{powerQualityDataCsv}}

Output Language: {{languageCode}}
`,
};

