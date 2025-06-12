/**
 * @fileOverview Reviews and refines a structured compliance report.
 *
 * - reviewComplianceReport - A function that takes a structured report and returns a refined version.
 * - ReviewComplianceReportInput - The input type for the reviewComplianceReport function.
 * - ReviewComplianceReportOutput - The return type for the reviewComplianceReport function.
 */
'use server';

import { ai } from '@/ai/genkit';
import {
  ReviewComplianceReportInputSchema,
  ReviewComplianceReportOutputSchema,
  reviewComplianceReportPromptConfig,
  type ReviewComplianceReportInput,
  type ReviewComplianceReportOutput,
} from '@/ai/prompt-configs/review-compliance-report-prompt-config';

export type { ReviewComplianceReportInput, ReviewComplianceReportOutput };

export async function reviewComplianceReport(
  input: ReviewComplianceReportInput
): Promise<ReviewComplianceReportOutput> {
  return reviewComplianceReportFlow(input);
}

const reviewReportPrompt = ai.definePrompt(reviewComplianceReportPromptConfig);

const reviewComplianceReportFlow = ai.defineFlow(
  {
    name: 'reviewComplianceReportFlow',
    inputSchema: ReviewComplianceReportInputSchema,
    outputSchema: ReviewComplianceReportOutputSchema,
  },
  async (input: ReviewComplianceReportInput) => {
    // The languageCode is part of the input for the prompt itself.
    const { output } = await reviewReportPrompt(input);
    if (!output) {
      throw new Error('AI failed to review and refine the compliance report.');
    }
    return output;
  }
);
