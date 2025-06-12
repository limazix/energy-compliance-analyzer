// @ts-check
'use strict';

/**
 * @fileOverview Defines the Genkit flow for reviewing a compliance report,
 * specifically for use within the chat interaction context in Firebase Functions.
 */

const { ai } = require('../genkit-instance'); // Shared AI instance for functions
const {
  ReviewComplianceReportInputSchema,
  AnalyzeComplianceReportOutputSchema, // Output is the revised full report
  reviewComplianceReportPromptConfig,
} = require('../../../lib/shared/ai/prompt-configs/review-compliance-report-prompt-config.js');

/**
 * Genkit flow that reviews and refines a structured compliance report.
 * This flow uses the shared prompt configuration for report reviewing.
 * @param {import('../../../lib/shared/ai/prompt-configs/review-compliance-report-prompt-config.js').ReviewComplianceReportInput} input - The report and language code.
 * @returns {Promise<import('../../../lib/shared/ai/prompt-configs/analyze-compliance-report-prompt-config.js').AnalyzeComplianceReportOutput>} The revised structured report.
 */
const reviewComplianceReportFlow_Chat = ai.defineFlow(
  {
    name: 'reviewComplianceReportFlow_ChatInternal', // Unique name for this context
    inputSchema: ReviewComplianceReportInputSchema,
    outputSchema: AnalyzeComplianceReportOutputSchema,
  },
  async (input) => {
    // Define the prompt using the imported config and the shared 'ai' instance
    const reviewPrompt = ai.definePrompt(reviewComplianceReportPromptConfig);
    const { output } = await reviewPrompt(input);
    if (!output) {
      throw new Error('AI failed to review and refine the compliance report (Chat Review Agent).');
    }
    return output;
  }
);

module.exports = { reviewComplianceReportFlow_Chat };
