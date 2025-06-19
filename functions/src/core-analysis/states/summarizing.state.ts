/**
 * @fileoverview
 * This module defines the `SummarizingState` class, which represents the state
 * in the analysis process where the power quality data is being summarized.
 */

import { GeneratingChartsState } from './generating-charts.state';

import type { AnalysisContext } from '../analysis-context';
import type { AnalysisState } from './analysis.state';
import type { AnalysisVisitor } from '../analysis-visitor';

/**
 * Represents the state where the system summarizes the power quality data.
 *
 * This class is part of the state machine for the analysis process. It accepts a
 * visitor to perform the summarization work and then transitions to the
 * `GeneratingChartsState`.
 */
export class SummarizingState implements AnalysisState {
  /**
   * The context of the analysis process.
   * @type {AnalysisContext}
   */
  public context: AnalysisContext;

  /**
   * Creates a new `SummarizingState` object.
   * @param {AnalysisContext} context - The context of the analysis process.
   */
  constructor(context: AnalysisContext) {
    this.context = context;
  }

  /**
   * Accepts a visitor to perform the work associated with this state.
   * @param {AnalysisVisitor} visitor - The visitor that will perform the summarization.
   * @returns {Promise<void>} A promise that resolves when the visitor has completed its work.
   */
  public async accept(visitor: AnalysisVisitor): Promise<void> {
    await visitor.visitSummarizingState(this);
  }

  /**
   * Transitions the state machine to the next state.
   * After summarization, the process moves to generating charts.
   * @returns {Promise<void>} A promise that resolves when the state transition is complete.
   */
  public async transition(): Promise<void> {
    this.context.setState(new GeneratingChartsState(this.context));
  }
}
