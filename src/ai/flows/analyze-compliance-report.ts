/**
 * @fileOverview Analyzes a summary of power quality data against ANEEL regulations
 * and generates a structured compliance report suitable for eventual PDF generation.
 *
 * - analyzeComplianceReport - A function that analyzes power quality data summary and generates a structured compliance report.
 * - AnalyzeComplianceReportInput - The input type for the analyzeComplianceReport function.
 * - AnalyzeComplianceReportOutput - The return type for the analyzeComplianceReport function.
 */
'use server';

import { ai } from '@/ai/genkit';
import {
  AnalyzeComplianceReportInputSchema,
  AnalyzeComplianceReportOutputSchema,
  analyzeComplianceReportPromptConfig,
  type AnalyzeComplianceReportInput,
  type AnalyzeComplianceReportOutput,
} from '@/ai/prompt-configs/analyze-compliance-report-prompt-config';

export type { AnalyzeComplianceReportInput, AnalyzeComplianceReportOutput }; // Re-export types

export async function analyzeComplianceReport(
  input: AnalyzeComplianceReportInput
): Promise<AnalyzeComplianceReportOutput> {
  return analyzeComplianceReportFlow(input);
}

// Define the prompt using the imported configuration and the local 'ai' instance
const generateReportPrompt = ai.definePrompt(analyzeComplianceReportPromptConfig);

const analyzeComplianceReportFlow = ai.defineFlow(
  {
    name: 'analyzeComplianceReportFlow',
    inputSchema: AnalyzeComplianceReportInputSchema, // Use imported schema
    outputSchema: AnalyzeComplianceReportOutputSchema, // Use imported schema
  },
  async (input: AnalyzeComplianceReportInput) => {
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Call the prompt defined with the local 'ai' instance
    // The prompt configuration itself should handle languageCode,
    // but we pass all input fields.
    const { output } = await generateReportPrompt({ ...input, generatedDate: currentDate });
    if (!output) {
      throw new Error('AI failed to generate the structured compliance report.');
    }

    // Ensure generatedDate is in the output, even if the prompt fails to add it (improbable with schema)
    if (!output.reportMetadata.generatedDate) {
      output.reportMetadata.generatedDate = currentDate;
    }
    // If the author is not defined by the IA, set a default.
    if (!output.reportMetadata.author) {
      output.reportMetadata.author = 'Energy Compliance Analyzer';
    }
    // Populate subtitle if not provided by AI
    if (!output.reportMetadata.subtitle && input.fileName) {
      output.reportMetadata.subtitle = `Análise referente ao arquivo '${input.fileName}'`;
    }

    return output;
  }
);
