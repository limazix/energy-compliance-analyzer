'use strict';

/**
 * @fileOverview Defines the Genkit prompt/flow for orchestrating user interaction
 * with a compliance report via chat, specifically for Firebase Functions.
 */

import {
  orchestrateReportInteractionPromptConfig,
  type OrchestrateReportInteractionInput,
  type OrchestrateReportInteractionOutput,
} from '../../../../src/ai/prompt-configs/orchestrate-report-interaction-prompt-config'; // Adjusted path
import { ai } from '../genkit-instance'; // Shared AI instance for functions
import { callRevisorTool_Chat } from '../tools/chatRevisorTool';

/**
 * Genkit prompt that orchestrates the chat interaction, capable of using the revisor tool.
 * This is the primary "agent" called by the HTTPS chat function.
 */
export const chatOrchestratorAgentPrompt = ai.definePrompt<
  OrchestrateReportInteractionInput,
  OrchestrateReportInteractionOutput
>({
  ...orchestrateReportInteractionPromptConfig, // Spread the shared config
  name: 'chatOrchestratorAgentPrompt_Functions', // Unique name for functions context
  tools: [callRevisorTool_Chat], // Make the function-specific tool available
});
