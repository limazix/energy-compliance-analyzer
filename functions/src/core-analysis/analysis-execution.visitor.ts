/**
 * @fileoverview
 * This module defines the `AnalysisExecutionVisitor` class, which is a concrete
 * implementation of the `AnalysisVisitor` interface. This class is responsible for
 * executing the core logic for each step of the analysis process.
 */

import { chartGeneratorAgent } from '@/ai/agents/chartGeneratorAgent';
import { analyzeReportFlow } from '@/ai/agents/complianceAnalyzerAgent';
import { identifyResolutionsFlow } from '@/ai/agents/regulationIdentifierAgent';
import { reviewReportFlow } from '@/ai/agents/reportReviewerAgent';
import { summarizeDataChunkFlow } from '@/ai/agents/summarizerAgent';
import type {
  SummarizePowerQualityDataInput,
  SummarizePowerQualityDataOutput,
  IdentifyAEEEResolutionsInput,
  IdentifyAEEEResolutionsOutput,
  AnalyzeComplianceReportInput,
  AnalyzeComplianceReportOutput,
  ReviewComplianceReportInput,
  ReviewComplianceReportOutput,
} from '@/ai/prompt-configs';
import { APP_CONFIG } from '@/config/appConfig';
import { getAdminFileContentFromStorage } from '@/utils/storage';

import type { AnalysisVisitor } from './analysis-visitor';
import type { AssessingComplianceState } from './states/assessing-compliance.state';
import type { GeneratingChartsState } from './states/generating-charts.state';
import type { IdentifyingRegulationsState } from './states/identifying-regulations.state';
import type { ReviewingReportState } from './states/reviewing-report.state';
import type { SummarizingState } from './states/summarizing.state';

const CHUNK_SIZE = APP_CONFIG.ANALYSIS_CSV_CHUNK_SIZE_BYTES;
const OVERLAP_SIZE = APP_CONFIG.ANALYSIS_CSV_OVERLAP_SIZE_BYTES;

/**
 * A concrete implementation of the `AnalysisVisitor` that executes the main logic
 * for each analysis state.
 */
export class AnalysisExecutionVisitor implements AnalysisVisitor {
  /**
   * Executes the data summarization logic.
   *
   * This method retrieves the power quality data, splits it into chunks, and then
   * uses an AI agent to summarize each chunk. The aggregated summary is then
   * stored in the analysis data.
   *
   * @param {SummarizingState} state - The current `SummarizingState` of the analysis.
   * @returns {Promise<void>} A promise that resolves when summarization is complete.
   */
  public async visitSummarizingState(state: SummarizingState): Promise<void> {
    const { analysisData } = state.context;
    const { powerQualityDataUrl, languageCode } = analysisData;
    const powerQualityDataCsv = await getAdminFileContentFromStorage(powerQualityDataUrl);

    const chunks: string[] = [];
    if (powerQualityDataCsv.length > CHUNK_SIZE) {
      for (let i = 0; i < powerQualityDataCsv.length; i += CHUNK_SIZE - OVERLAP_SIZE) {
        chunks.push(
          powerQualityDataCsv.substring(i, Math.min(i + CHUNK_SIZE, powerQualityDataCsv.length))
        );
      }
    } else {
      chunks.push(powerQualityDataCsv);
    }

    let aggregatedSummary = '';
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk.trim() === '') {
        continue;
      }

      const summarizeInput: SummarizePowerQualityDataInput = {
        powerQualityDataCsv: chunk,
        languageCode,
      };
      const result = await summarizeDataChunkFlow.call(summarizeInput);
      const output: SummarizePowerQualityDataOutput | undefined = (
        result as { output?: SummarizePowerQualityDataOutput }
      ).output;

      if (!output?.dataSummary) throw new Error(`AI failed to summarize chunk ${i + 1}.`);
      aggregatedSummary += (output.dataSummary || '') + '';
    }

    analysisData.powerQualityDataSummary = aggregatedSummary.trim();
  }

  /**
   * Executes the regulation identification logic.
   *
   * This method uses an AI agent to identify relevant ANEEL regulations based on
   * the summarized power quality data. The identified regulations are then stored
   * in the analysis data.
   *
   * @param {IdentifyingRegulationsState} state - The current `IdentifyingRegulationsState` of the analysis.
   * @returns {Promise<void>} A promise that resolves when regulation identification is complete.
   */
  public async visitIdentifyingRegulationsState(state: IdentifyingRegulationsState): Promise<void> {
    const { analysisData } = state.context;
    const { powerQualityDataSummary, languageCode } = analysisData;
    const identifyInput: IdentifyAEEEResolutionsInput = {
      powerQualityDataSummary,
      languageCode,
    };
    const resolutionsResult = await identifyResolutionsFlow.call(identifyInput);
    const resolutionsOutput: IdentifyAEEEResolutionsOutput | undefined = (
      resolutionsResult as { output?: IdentifyAEEEResolutionsOutput }
    ).output;

    if (!resolutionsOutput?.relevantResolutions)
      throw new Error('AI failed to identify resolutions.');

    analysisData.identifiedRegulations = resolutionsOutput.relevantResolutions;
  }

  /**
   * Executes the compliance assessment logic.
   *
   * This method uses an AI agent to generate an initial compliance report based on
   * the summarized data and identified regulations. The generated report is stored
   * in the analysis data.
   *
   * @param {AssessingComplianceState} state - The current `AssessingComplianceState` of the analysis.
   * @returns {Promise<void>} A promise that resolves when compliance assessment is complete.
   */
  public async visitAssessingComplianceState(state: AssessingComplianceState): Promise<void> {
    const { analysisData } = state.context;
    const { powerQualityDataSummary, identifiedRegulations, fileName, languageCode } = analysisData;
    const reportInput: AnalyzeComplianceReportInput = {
      powerQualityDataSummary,
      identifiedRegulations: (identifiedRegulations || []).join(', '),
      fileName,
      languageCode,
    };
    const analyzeResult = await analyzeReportFlow.call(reportInput);
    const initialStructuredReport: AnalyzeComplianceReportOutput | undefined = (
      analyzeResult as { output?: AnalyzeComplianceReportOutput }
    ).output;

    if (!initialStructuredReport)
      throw new Error('AI failed to generate initial compliance report.');

    analysisData.structuredReport = initialStructuredReport;
  }

  /**
   * Executes the report reviewing logic.
   *
   * This method uses an AI agent to review and refine the generated compliance report.
   * The reviewed report is then stored in the analysis data.
   *
   * @param {ReviewingReportState} state - The current `ReviewingReportState` of the analysis.
   * @returns {Promise<void>} A promise that resolves when the report review is complete.
   */
  public async visitReviewingReportState(state: ReviewingReportState): Promise<void> {
    const { analysisData } = state.context;
    const { structuredReport, languageCode } = analysisData;
    const reviewInput: ReviewComplianceReportInput = {
      structuredReportToReview: structuredReport,
      languageCode: languageCode,
    };
    const reviewResult = await reviewReportFlow.call(reviewInput);
    const reviewedStructuredReport: ReviewComplianceReportOutput | undefined = (
      reviewResult as { output?: ReviewComplianceReportOutput }
    ).output;

    if (!reviewedStructuredReport) {
      console.warn(
        `[CoreAnalysis_OnUpdate] AI review failed. Using pre-review report for ${analysisData.analysisId}.`
      );
    } else {
      analysisData.structuredReport = reviewedStructuredReport;
    }
  }

  /**
   * Executes the chart generation logic.
   *
   * This method iterates through the sections of the structured report and, if a
   * chart suggestion exists, it calls the `chartGeneratorAgent` to create and
   * upload a chart. The URL of the generated chart is then stored back in the
   * report section.
   *
   * @param {GeneratingChartsState} state - The current `GeneratingChartsState` of the analysis.
   * @returns {Promise<void>} A promise that resolves when chart generation is complete.
   */
  public async visitGeneratingChartsState(state: GeneratingChartsState): Promise<void> {
    const { analysisData } = state.context;
    const { structuredReport, analysisId } = analysisData;

    if (!structuredReport) {
      return;
    }

    for (const section of structuredReport.analysisSections) {
      if (section.chartOrImageSuggestion) {
        // This is a simplified example. In a real-world scenario, you would
        // likely have a more sophisticated way of extracting chart data from the summary.
        const chartData = {
          labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
          datasets: [
            {
              label: section.title,
              backgroundColor: 'rgb(255, 99, 132)',
              borderColor: 'rgb(255, 99, 132)',
              data: [0, 10, 5, 2, 20, 30, 45],
            },
          ],
        };

        const annotations = [
          {
            type: 'line' as const,
            mode: 'horizontal',
            scaleID: 'y',
            value: 25,
            borderColor: 'red',
            borderWidth: 2,
            label: {
              content: 'Threshold',
              enabled: true,
              position: 'right' as const,
            },
          },
        ];

        const chartUrl = await chartGeneratorAgent.call({
          chartType: 'bar',
          data: chartData,
          options: {},
          filePath: `charts/${analysisId}/${section.title.replace(/\\s/g, '_')}.png`,
          annotations: annotations,
        });

        section.chartUrl = chartUrl;
      }
    }
  }
}
