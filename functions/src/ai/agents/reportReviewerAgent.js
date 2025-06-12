// @ts-check
'use strict';

/**
 * @fileOverview Defines the report reviewer agent using Genkit.
 * This agent reviews and refines a structured compliance report.
 */

const { ai } = require('../genkit-instance');
const {
  reviewComplianceReportPromptConfig,
} = require('../../../lib/shared/ai/prompt-configs/review-compliance-report-prompt-config.js');

const reviewReportFlow = ai.definePrompt(reviewComplianceReportPromptConfig);

module.exports = { reviewReportFlow };
