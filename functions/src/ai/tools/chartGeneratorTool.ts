/**
 * @fileoverview
 * This module provides a tool for generating charts using Chart.js in a Node.js environment.
 * It uses `chartjs-node-canvas` to render charts to a buffer and `chartjs-plugin-annotation`
 * to draw annotations on the chart. The generated chart image is then uploaded to a
 * Firebase Cloud Storage bucket, and its public URL is returned.
 */

import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import * as ChartJsPluginAnnotation from 'chartjs-plugin-annotation';
import { storage } from 'firebase-admin';

import type { ChartConfiguration } from 'chart.js';

/**
 * Generates a chart with optional annotations and uploads it to Firebase Cloud Storage.
 *
 * This function takes a standard Chart.js configuration, renders it into a PNG image buffer,
 * and uploads it to the specified path in the default Firebase Storage bucket. It also registers
 * the `chartjs-plugin-annotation` to allow for rich annotations.
 *
 * @param {ChartConfiguration} configuration - The Chart.js configuration object that defines the chart's appearance, data, and options. This configuration can include annotation options under `options.plugins.annotation`.
 * @param {string} filePath - The destination path in the Firebase Cloud Storage bucket for the generated chart image (e.g., 'charts/analysis-123/voltage_chart.png').
 * @returns {Promise<string>} A promise that resolves with the public URL of the uploaded chart image.
 * @throws {Error} Throws an error if the chart rendering or file upload fails.
 */
async function generateChart(configuration: ChartConfiguration, filePath: string): Promise<string> {
  const width = 800;
  const height = 600;

  /**
   * @type {ChartJSNodeCanvas}
   * An instance of ChartJSNodeCanvas configured for PNG output.
   * It's initialized with a callback to register the annotation plugin with Chart.js.
   */
  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width,
    height,
    chartCallback: (ChartJS) => {
      ChartJS.register(ChartJsPluginAnnotation);
    },
  });

  const image = await chartJSNodeCanvas.renderToBuffer(configuration);

  const bucket = storage().bucket();
  const file = bucket.file(filePath);
  await file.save(image, {
    metadata: {
      contentType: 'image/png',
    },
  });

  return file.publicUrl();
}

export { generateChart };
