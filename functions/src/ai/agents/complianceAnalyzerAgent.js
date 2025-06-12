// @ts-check
'use strict';

/**
 * @fileOverview Defines the compliance analyzer agent using Genkit.
 * This agent generates an initial structured compliance report.
 */

const { ai } = require('../genkit-instance');
const {
  analyzeComplianceReportPromptConfig,
} = require('../../../lib/shared/ai/prompt-configs/analyze-compliance-report-prompt-config.js');

const analyzeReportFlow = ai.definePrompt(analyzeComplianceReportPromptConfig);

module.exports = { analyzeReportFlow };
