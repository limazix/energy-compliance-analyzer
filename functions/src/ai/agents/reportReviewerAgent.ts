'use strict';

/**
 * @fileOverview Defines the report reviewer agent using Genkit.
 * This agent reviews and refines a structured compliance report.
 */

import {
  reviewComplianceReportPromptConfig, // Assuming shared prompt configs are here now
  type ReviewComplianceReportInput,
  type ReviewComplianceReportOutput,
} from '../../../../lib/shared/ai/prompt-configs/review-compliance-report-prompt-config'; // Path from functions/src to functions/lib/shared
import { ai } from '../genkit-instance';

export const reviewReportFlow = ai.definePrompt<
  ReviewComplianceReportInput,
  ReviewComplianceReportOutput
>(reviewComplianceReportPromptConfig);
