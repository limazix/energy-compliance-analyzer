'use server';

/**
 * @fileOverview Analyzes power quality data against ANEEL regulations and generates a compliance report.
 *
 * - analyzeComplianceReport - A function that analyzes power quality data and generates a compliance report.
 * - AnalyzeComplianceReportInput - The input type for the analyzeComplianceReport function.
 * - AnalyzeComplianceReportOutput - The return type for the analyzeComplianceReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeComplianceReportInputSchema = z.object({
  powerQualityData: z
    .string()
    .describe("The power quality data in CSV format."),
  identifiedRegulations: z
    .string()
    .describe("The identified ANEEL regulations relevant to the data."),
});
export type AnalyzeComplianceReportInput = z.infer<typeof AnalyzeComplianceReportInputSchema>;

const AnalyzeComplianceReportOutputSchema = z.object({
  complianceReport: z
    .string()
    .describe("A detailed report summarizing the compliance status, specific violations, and recommendations."),
  summary: z
    .string()
    .describe("A summary of the compliance assessment results with clear indicators of compliance and non-compliance."),
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

You will analyze the provided power quality data against the identified ANEEL regulations and generate a compliance report.
The report should include a summary of the compliance status, specific violations, and recommendations.

Power Quality Data:
{{powerQualityData}}

Identified ANEEL Regulations:
{{identifiedRegulations}}

Based on the data and regulations, generate a comprehensive compliance report and a concise summary of the findings.
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
    return output!;
  }
);
