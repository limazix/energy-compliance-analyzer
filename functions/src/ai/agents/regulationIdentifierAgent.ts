'use strict';

/**
 * @fileOverview Defines the regulation identifier agent using Genkit.
 * This agent identifies relevant ANEEL regulations based on data summaries.
 */

import {
  identifyAEEEResolutionsPromptConfig, // Assuming correct export name
  type IdentifyAEEEResolutionsInput,
  type IdentifyAEEEResolutionsOutput,
} from '../../../../src/ai/prompt-configs/identify-aneel-resolutions-prompt-config'; // Adjusted path
import { ai } from '../genkit-instance';

export const identifyResolutionsFlow = ai.definePrompt<
  IdentifyAEEEResolutionsInput,
  IdentifyAEEEResolutionsOutput
>(identifyAEEEResolutionsPromptConfig);
