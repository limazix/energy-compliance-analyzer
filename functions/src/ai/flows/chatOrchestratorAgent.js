// @ts-check
'use strict';

/**
 * @fileOverview Defines the Genkit prompt/flow for orchestrating user interaction
 * with a compliance report via chat, specifically for Firebase Functions.
 */

const { ai } = require('../genkit-instance'); // Shared AI instance for functions
const { callRevisorTool_Chat } = require('../tools/chatRevisorTool.js');
const {
  orchestrateReportInteractionPromptConfig, // Base prompt config
  // OrchestrateReportInteractionInputSchema, // Not needed here if promptConfig has it
  // OrchestrateReportInteractionOutputSchema, // Not needed here if promptConfig has it
} = require('../../../lib/shared/ai/prompt-configs/orchestrate-report-interaction-prompt-config.js');

/**
 * Genkit prompt that orchestrates the chat interaction, capable of using the revisor tool.
 * This is the primary "agent" called by the HTTPS chat function.
 */
const chatOrchestratorAgentPrompt = ai.definePrompt({
  ...orchestrateReportInteractionPromptConfig, // Spread the shared config
  name: 'chatOrchestratorAgentPrompt_Functions', // Unique name for functions context
  tools: [callRevisorTool_Chat], // Make the function-specific tool available
});

module.exports = { chatOrchestratorAgentPrompt };
