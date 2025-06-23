'use strict';

/**
 * @fileOverview Defines the summarizer agent using Genkit.
 * This agent summarizes chunks of power quality data.
 */

import {
  summarizePowerQualityDataPromptConfig,
  type SummarizePowerQualityDataInput,
  type SummarizePowerQualityDataOutput,
} from '@/ai/prompt-configs/summarize-power-quality-data-prompt-config'; // Adjusted path
import { ai } from '../genkit-instance';

export const summarizeDataChunkFlow = ai.definePrompt<
  SummarizePowerQualityDataInput,
  SummarizePowerQualityDataOutput
>(summarizePowerQualityDataPromptConfig);
