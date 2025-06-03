
'use server';
/**
 * @fileOverview Defines the Genkit prompt and schemas for orchestrating user interaction with a compliance report.
 *
 * Exports:
 * - OrchestrateReportInteractionInputSchema, OrchestrateReportInteractionInput
 * - OrchestrateReportInteractionOutputSchema, OrchestrateReportInteractionOutput
 * - interactionPrompt: The Genkit prompt object for report interaction.
 * - callRevisorTool: A Genkit tool that can be used by the orchestrator.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit/zod';
import {
  orchestrateReportInteractionPromptConfig,
  OrchestrateReportInteractionInputSchema,
  type OrchestrateReportInteractionInput,
  OrchestrateReportInteractionOutputSchema,
  type OrchestrateReportInteractionOutput,
} from '@/ai/prompt-configs/orchestrate-report-interaction-prompt-config';
import { reviewComplianceReport } from '@/ai/flows/review-compliance-report';
import type { AnalyzeComplianceReportOutput } from '@/ai/prompt-configs/analyze-compliance-report-prompt-config';


export type { OrchestrateReportInteractionInput, OrchestrateReportInteractionOutput };

// Define the tool for the Revisor
export const callRevisorTool = ai.defineTool(
  {
    name: 'callRevisorTool',
    description:
      'Reviews and refines a given structured compliance report. Use this if the user asks for rephrasing, grammar checks, structural adjustments, or overall improvement of the report content. This tool will return the entire revised structured report.',
    inputSchema: z.object({
      structuredReportToReview: OrchestrateReportInteractionInputSchema.shape.currentStructuredReport,
      languageCode: OrchestrateReportInteractionInputSchema.shape.languageCode,
    }),
    // The outputSchema for the tool should match what `reviewComplianceReport` returns,
    // which is AnalyzeComplianceReportOutputSchema (the full structured report)
    outputSchema: AnalyzeComplianceReportOutputSchema,
  },
  async (input) => {
    if (!input.structuredReportToReview) {
        throw new Error("Structured report is required for the Revisor tool.");
    }
    // reviewComplianceReport expects ReviewComplianceReportInput which has:
    // { structuredReportToReview: AnalyzeComplianceReportOutput, languageCode: string }
    // The tool's inputSchema matches this.
    // reviewComplianceReport returns Promise<AnalyzeComplianceReportOutput>
    const revisedReport: AnalyzeComplianceReportOutput = await reviewComplianceReport(input);
    return revisedReport;
  }
);

// Define the main interaction prompt, making the tool available
export const interactionPrompt = ai.definePrompt({
  ...orchestrateReportInteractionPromptConfig, // Spread the existing config (name, prompt text, base input/output schemas)
  tools: [callRevisorTool], // Make the tool available to this prompt
  // The output schema for the *prompt call itself* remains OrchestrateReportInteractionOutputSchema.
  // If the tool is used, the LLM should incorporate the tool's output into its final response,
  // potentially populating the `revisedStructuredReport` field in the OrchestrateReportInteractionOutput.
});
