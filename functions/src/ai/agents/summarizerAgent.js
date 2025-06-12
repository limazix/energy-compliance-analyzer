// @ts-check
'use strict';

/**
 * @fileOverview Defines the summarizer agent using Genkit.
 * This agent summarizes chunks of power quality data.
 */

const { ai } = require('../genkit-instance');
const {
  summarizePowerQualityDataPromptConfig,
} = require('../../../lib/shared/ai/prompt-configs/summarize-power-quality-data-prompt-config.js');

const summarizeDataChunkFlow = ai.definePrompt(summarizePowerQualityDataPromptConfig);

module.exports = { summarizeDataChunkFlow };
