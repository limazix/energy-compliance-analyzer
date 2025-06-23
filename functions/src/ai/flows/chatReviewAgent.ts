'use strict';

/**
 * @fileOverview Defines the Genkit flow for reviewing a compliance report,
 * specifically for use within the chat interaction context in Firebase Functions.
 */

import {
  ReviewComplianceReportInputSchema,
  AnalyzeComplianceReportOutputSchema, // Output is the revised full report
  reviewComplianceReportPromptConfig,
  type ReviewComplianceReportInput,
  type AnalyzeComplianceReportOutput,
} from '@/ai/prompt-configs/review-compliance-report-prompt-config'; // Path from functions/src to functions/lib/shared
import { ai } from '../genkit-instance'; // Shared AI instance for functions

/**
 * Genkit flow that reviews and refines a structured compliance report.
 * This flow uses the shared prompt configuration for report reviewing.
 * @param {ReviewComplianceReportInput} input - The report and language code.
 * @returns {Promise<AnalyzeComplianceReportOutput>} The revised structured report.
 */
export const reviewComplianceReportFlow_Chat = ai.defineFlow<
  ReviewComplianceReportInput,
  AnalyzeComplianceReportOutput
>(
  {
    name: 'reviewComplianceReportFlow_ChatInternal', // Unique name for this context
    inputSchema: ReviewComplianceReportInputSchema,
    outputSchema: AnalyzeComplianceReportOutputSchema,
  },
  async (input) => {
    // Define the prompt using the imported config and the shared 'ai' instance
    const reviewPrompt = ai.definePrompt<
      ReviewComplianceReportInput,
      AnalyzeComplianceReportOutput
    >(reviewComplianceReportPromptConfig);
    const { output } = await reviewPrompt(input);
    if (!output) {
      throw new Error('AI failed to review and refine the compliance report (Chat Review Agent).');
    }
    return output;
  }
);
