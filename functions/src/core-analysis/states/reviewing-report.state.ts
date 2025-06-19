// functions/src/core-analysis/states/reviewing-report.state.ts
import { AnalysisState } from './analysis.state';
import { AnalysisVisitor } from '../analysis-visitor';

export class ReviewingReportState extends AnalysisState {
  public async accept(visitor: AnalysisVisitor): Promise<void> {
    await visitor.visitReviewingReportState(this);
  }

  public async transition(): Promise<void> {
    // The transition logic from ReviewingReportState depends on the outcome
    // of the review, which is handled by the visitor.
    // This state itself does not transition autonomously based on internal logic.
  }
}
