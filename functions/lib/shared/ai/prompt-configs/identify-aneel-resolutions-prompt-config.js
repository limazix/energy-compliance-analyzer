'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.identifyAEEEResolutionsPromptConfig =
  exports.IdentifyAEEEResolutionsOutputSchema =
  exports.IdentifyAEEEResolutionsInputSchema =
    void 0;
const zod_1 = require('zod');
exports.IdentifyAEEEResolutionsInputSchema = zod_1.z.object({
  powerQualityDataSummary: zod_1.z
    .string()
    .describe('A summary of the power quality data, highlighting key metrics and anomalies.'),
  languageCode: zod_1.z
    .string()
    .optional()
    .default('pt-BR')
    .describe(
      'The BCP-47 language code for the desired output language (e.g., "en-US", "pt-BR"). Defaults to "pt-BR" if not provided.'
    ),
});
exports.IdentifyAEEEResolutionsOutputSchema = zod_1.z.object({
  relevantResolutions: zod_1.z
    .array(zod_1.z.string())
    .describe(
      'The list of relevant ANEEL Normative Resolutions, with names/numbers in their original Portuguese form, but the surrounding explanation/list description in the specified languageCode.'
    ),
});
exports.identifyAEEEResolutionsPromptConfig = {
  name: 'identifyAEEEResolutionsShared',
  input: { schema: exports.IdentifyAEEEResolutionsInputSchema },
  output: { schema: exports.IdentifyAEEEResolutionsOutputSchema },
  prompt: `You are an expert in Brazilian electrical regulations, specifically ANEEL Normative Resolutions.
  Based on the provided summary of power quality data, identify the relevant ANEEL Normative Resolutions that apply.
  The names/numbers of the resolutions themselves should remain in their original Portuguese.
  Return a list of the relevant resolutions. The surrounding text and list description should be in the language specified by '{{languageCode}}' (default to Brazilian Portuguese if no language code is specified or if the language is not well-supported for this technical task).

  Power Quality Data Summary:
  {{powerQualityDataSummary}}

  Output Language for descriptive text: {{languageCode}}
  `,
};
