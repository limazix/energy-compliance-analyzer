/**
 * @fileoverview
 * This module defines the `AnalysisVisitor` interface, which is a key component
 * of the Visitor design pattern used in the analysis state machine. This interface
 * declares a set of `visit` methods, one for each concrete state in the analysis process.
 */

import type { AssessingComplianceState } from './states/assessing-compliance.state';
import type { GeneratingChartsState } from './states/generating-charts.state';
import type { IdentifyingRegulationsState } from './states/identifying-regulations.state';
import type { ReviewingReportState } from './states/reviewing-report.state';
import type { SummarizingState } from './states/summarizing.state';

/**
 * Defines the contract for a visitor that can perform operations on the different
 * states of the analysis process.
 *
 * Implementing this interface allows a class to perform a specific set of actions
 * for each step of the analysis (e.g., executing the step, updating progress)
 * without coupling the state logic with the action logic.
 */
export interface AnalysisVisitor {
  /**
   * Performs an operation on the `SummarizingState`.
   * @param {SummarizingState} state - The `SummarizingState` object to visit.
   * @returns {Promise<void>} A promise that resolves when the operation is complete.
   */
  visitSummarizingState(state: SummarizingState): Promise<void>;

  /**
   * Performs an operation on the `IdentifyingRegulationsState`.
   * @param {IdentifyingRegulationsState} state - The `IdentifyingRegulationsState` object to visit.
   * @returns {Promise<void>} A promise that resolves when the operation is complete.
   */
  visitIdentifyingRegulationsState(state: IdentifyingRegulationsState): Promise<void>;

  /**
   * Performs an operation on the `AssessingComplianceState`.
   * @param {AssessingComplianceState} state - The `AssessingComplianceState` object to visit.
   * @returns {Promise<void>} A promise that resolves when the operation is complete.
   */
  visitAssessingComplianceState(state: AssessingComplianceState): Promise<void>;

  /**
   * Performs an operation on the `ReviewingReportState`.
   * @param {ReviewingReportState} state - The `ReviewingReportState` object to visit.
   * @returns {Promise<void>} A promise that resolves when the operation is complete.
   */
  visitReviewingReportState(state: ReviewingReportState): Promise<void>;

  /**
   * Performs an operation on the `GeneratingChartsState`.
   * @param {GeneratingChartsState} state - The `GeneratingChartsState` object to visit.
   * @returns {Promise<void>} A promise that resolves when the operation is complete.
   */
  visitGeneratingChartsState(state: GeneratingChartsState): Promise<void>;
}
