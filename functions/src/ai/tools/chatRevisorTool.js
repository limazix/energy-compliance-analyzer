// @ts-check
'use strict';

/**
 * @fileOverview Defines the Genkit tool for revising a compliance report,
 * used by the chat orchestrator agent in Firebase Functions.
 */

const { z } = require('zod');

const {
  AnalyzeComplianceReportOutputSchema, // Used by the Revisor tool and overall interaction output
  OrchestrateReportInteractionInputSchema, // To get languageCode schema
} = require('../../../lib/shared/ai/prompt-configs/orchestrate-report-interaction-prompt-config.js');
const { reviewComplianceReportFlow_Chat } = require('../flows/chatReviewAgent.js');
const { ai } = require('../genkit-instance'); // Shared AI instance for functions

/**
 * Genkit tool that invokes the chat-specific review flow to revise a structured report.
 */
const callRevisorTool_Chat = ai.defineTool(
  {
    name: 'callRevisorTool_ChatInternal',
    description:
      'Reviews and refines a given structured compliance report. Use this if the user asks for rephrasing, grammar checks, structural adjustments, or overall improvement of the report content. This tool will return the entire revised structured report.',
    inputSchema: z.object({
      structuredReportToReview: AnalyzeComplianceReportOutputSchema,
      languageCode: OrchestrateReportInteractionInputSchema.shape.languageCode,
    }),
    outputSchema: AnalyzeComplianceReportOutputSchema,
  },
  async (toolInput) => {
    if (!toolInput.structuredReportToReview) {
      throw new Error('Structured report is required for the Revisor tool (Chat Orchestrator).');
    }
    // The input for reviewComplianceReportFlow_Chat is ReviewComplianceReportInput,
    // which matches the toolInput's schema here.
    const revisedReport = await reviewComplianceReportFlow_Chat(toolInput);
    return revisedReport;
  }
);

module.exports = { callRevisorTool_Chat };
