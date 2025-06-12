// @ts-check
'use strict';

/**
 * @fileOverview Defines the regulation identifier agent using Genkit.
 * This agent identifies relevant ANEEL regulations based on data summaries.
 */

const { ai } = require('../genkit-instance');
const {
  identifyAEEEResolutionsPromptConfig,
} = require('../../../lib/shared/ai/prompt-configs/identify-aneel-resolutions-prompt-config.js');

const identifyResolutionsFlow = ai.definePrompt(identifyAEEEResolutionsPromptConfig);

module.exports = { identifyResolutionsFlow };
