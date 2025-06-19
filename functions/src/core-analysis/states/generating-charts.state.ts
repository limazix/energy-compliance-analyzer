/**
 * @fileoverview
 * This module defines the `GeneratingChartsState` class, which represents a specific
 * state in the analysis state machine. This state is responsible for orchestrating
 * the generation of charts based on the analysis data.
 */

import { IdentifyingRegulationsState } from './identifying-regulations.state';

import type { AnalysisContext } from '../analysis-context';
import type { AnalysisState } from './analysis.state';
import type { AnalysisVisitor } from '../analysis-visitor';

/**
 * Represents the state where the system generates charts for the analysis report.
 *
 * This class implements the `AnalysisState` interface and provides the logic for
 * handling the chart generation step of the analysis process. It accepts a visitor
 * to perform the actual work and then transitions to the next state, which is
 * `IdentifyingRegulationsState`.
 */
export class GeneratingChartsState implements AnalysisState {
  /**
   * The context of the analysis process, which holds the current analysis data
   * and the state machine itself.
   * @type {AnalysisContext}
   */
  public context: AnalysisContext;

  /**
   * Creates a new `GeneratingChartsState` object.
   * @param {AnalysisContext} context - The context of the analysis process.
   */
  constructor(context: AnalysisContext) {
    this.context = context;
  }

  /**
   * Accepts a visitor to perform the work associated with this state.
   *
   * This method delegates the chart generation logic to the provided visitor,
   * following the Visitor design pattern.
   *
   * @param {AnalysisVisitor} visitor - The visitor that will perform the chart generation.
   * @returns {Promise<void>} A promise that resolves when the visitor has completed its work.
   */
  public async accept(visitor: AnalysisVisitor): Promise<void> {
    await visitor.visitGeneratingChartsState(this);
  }

  /**
   * Transitions the state machine to the next state.
   *
   * After the charts are generated, the state machine moves to the
   * `IdentifyingRegulationsState` to continue the analysis process.
   *
   * @returns {Promise<void>} A promise that resolves when the state transition is complete.
   */
  public async transition(): Promise<void> {
    this.context.setState(new IdentifyingRegulationsState(this.context));
  }
}
