// functions/src/core-analysis/states/assessing-compliance.state.ts
import { AnalysisState } from './analysis.state';
import { AnalysisVisitor } from '../analysis-visitor';
import { ReviewingReportState } from './reviewing-report.state';

export class AssessingComplianceState extends AnalysisState {
  public async accept(visitor: AnalysisVisitor): Promise<void> {
    await visitor.visitAssessingComplianceState(this);
  }

  public async transition(): Promise<void> {
    this.context.setState(new ReviewingReportState(this.context));
  }
}
