
'use server';
/**
 * @fileOverview Orchestrates interaction with a compliance report, answering user queries.
 *
 * - orchestrateReportInteraction - A function that handles user queries about a report.
 * - OrchestrateReportInteractionInput - The input type for the function.
 * - OrchestrateReportInteractionOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {
  orchestrateReportInteractionPromptConfig,
  type OrchestrateReportInteractionInput,
  type OrchestrateReportInteractionOutput,
  OrchestrateReportInteractionInputSchema,
  OrchestrateReportInteractionOutputSchema,
} from '@/ai/prompt-configs/orchestrate-report-interaction-prompt-config';

export type { OrchestrateReportInteractionInput, OrchestrateReportInteractionOutput };

export async function orchestrateReportInteraction(
  input: OrchestrateReportInteractionInput
): Promise<OrchestrateReportInteractionOutput> {
  return orchestrateReportInteractionFlow(input);
}

const interactionPrompt = ai.definePrompt(orchestrateReportInteractionPromptConfig);

const orchestrateReportInteractionFlow = ai.defineFlow(
  {
    name: 'orchestrateReportInteractionFlow',
    inputSchema: OrchestrateReportInteractionInputSchema,
    outputSchema: OrchestrateReportInteractionOutputSchema,
  },
  async (input: OrchestrateReportInteractionInput) => {
    const { output } = await interactionPrompt(input);
    if (!output) {
      throw new Error('AI Orchestrator failed to generate a response.');
    }
    return output;
  }
);
