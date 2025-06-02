
'use server';

/**
 * @fileOverview Analyzes a summary of power quality data against ANEEL regulations and generates a compliance report.
 *
 * - analyzeComplianceReport - A function that analyzes power quality data summary and generates a compliance report.
 * - AnalyzeComplianceReportInput - The input type for the analyzeComplianceReport function.
 * - AnalyzeComplianceReportOutput - The return type for the analyzeComplianceReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeComplianceReportInputSchema = z.object({
  powerQualityDataSummary: z
    .string()
    .describe("A summary of the power quality data, highlighting key metrics and anomalies."),
  identifiedRegulations: z
    .string()
    .describe("The identified ANEEL regulations relevant to the data (comma-separated string)."),
});
export type AnalyzeComplianceReportInput = z.infer<typeof AnalyzeComplianceReportInputSchema>;

const AnalyzeComplianceReportOutputSchema = z.object({
  complianceReport: z
    .string()
    .describe("A detailed report summarizing the compliance status, specific violations, and recommendations, based on the data summary."),
  summary: z
    .string()
    .describe("A concise summary of the compliance assessment results with clear indicators of compliance and non-compliance, based on the data summary."),
});
export type AnalyzeComplianceReportOutput = z.infer<typeof AnalyzeComplianceReportOutputSchema>;

export async function analyzeComplianceReport(
  input: AnalyzeComplianceReportInput
): Promise<AnalyzeComplianceReportOutput> {
  return analyzeComplianceReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeComplianceReportPrompt',
  input: {schema: AnalyzeComplianceReportInputSchema},
  output: {schema: AnalyzeComplianceReportOutputSchema},
  prompt: `You are an expert in Brazilian power quality regulations (ANEEL Normative Resolutions).

You will analyze the provided summary of power quality data against the identified ANEEL regulations and generate a compliance report.
The report should include a summary of the compliance status, specific violations, and recommendations based on the information present in the data summary.

Power Quality Data Summary:
{{powerQualityDataSummary}}

Identified ANEEL Regulations:
{{identifiedRegulations}}

Based on the data summary and regulations, generate a comprehensive compliance report and a concise summary of the findings.
`,
});

const analyzeComplianceReportFlow = ai.defineFlow(
  {
    name: 'analyzeComplianceReportFlow',
    inputSchema: AnalyzeComplianceReportInputSchema,
    outputSchema: AnalyzeComplianceReportOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
     if (!output) {
      throw new Error('AI failed to generate compliance report.');
    }
    return output;
  }
);
