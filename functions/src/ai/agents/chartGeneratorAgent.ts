/**
 * @fileoverview
 * This module defines an AI tool for generating charts using Genkit.
 * The `chartGeneratorAgent` is a structured tool that receives chart data,
 * configuration, and annotation details, then calls the `generateChart`
 * utility to produce and upload the chart image. This decouples the AI logic
 * from the chart rendering implementation.
 */

'use strict';

import { defineAITool } from '@genkit-ai/ai';
import { z } from 'zod';

import { generateChart } from '../tools/chartGeneratorTool';

/**
 * An AI tool for generating charts.
 *
 * This tool is defined using Genkit's `defineAITool` and provides a structured
 * interface for an AI model to request chart generation. It specifies the
 * expected input and output schemas, making the interaction predictable and robust.
 *
 * @param {object} input - The input object for the chart generation tool.
 * @param {string} input.chartType - The type of chart to generate (e.g., 'bar', 'line').
 * @param {any} input.data - The data object for the chart, conforming to Chart.js structure.
 * @param {any} input.options - The options object for the chart, conforming to Chart.js structure.
 * @param {string} input.filePath - The destination path for the chart in Firebase Storage.
 * @param {any} [input.annotations] - Optional annotations to be added to the chart, conforming to the `chartjs-plugin-annotation` structure.
 * @returns {Promise<string>} A promise that resolves with the public URL of the generated chart.
 */
export const chartGeneratorAgent = defineAITool(
  {
    name: 'chartGenerator',
    description: 'Generates a chart from the provided data and uploads it to a public URL.',
    inputSchema: z.object({
      chartType: z.string().describe("The type of chart to generate (e.g., 'bar', 'line')."),
      data: z
        .record(z.string(), z.unknown())
        .describe('The data object for the chart, conforming to Chart.js structure.'),
      options: z
        .record(z.string(), z.unknown())
        .describe('The options object for the chart, conforming to Chart.js structure.'),
      filePath: z.string().describe('The destination path for the chart in Firebase Storage.'),
      annotations: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('Optional annotations for the chart.'),
    }),
    outputSchema: z.string().url().describe('The public URL of the generated chart.'),
  },
  async (input) => {
    const chartConfig = {
      type: input.chartType,
      data: input.data,
      options: {
        ...input.options,
        plugins: {
          annotation: {
            annotations: input.annotations,
          },
        },
      },
    };
    return await generateChart(chartConfig, input.filePath);
  }
);
