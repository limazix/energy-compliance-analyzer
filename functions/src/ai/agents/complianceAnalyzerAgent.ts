'use strict';

/**
 * @fileOverview Defines the compliance analyzer agent using Genkit.
 * This agent generates an initial structured compliance report.
 */

import {
  analyzeComplianceReportPromptConfig,
  type AnalyzeComplianceReportInput,
  type AnalyzeComplianceReportOutput,
} from '@/ai/prompt-configs/analyze-compliance-report-prompt-config'; // Adjusted path
import { ai } from '../genkit-instance';

export const analyzeReportFlow = ai.definePrompt<
  AnalyzeComplianceReportInput,
  AnalyzeComplianceReportOutput
>(analyzeComplianceReportPromptConfig);
