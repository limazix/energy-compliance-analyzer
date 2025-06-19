// functions/src/core-analysis/states/identifying-regulations.state.ts
import { AnalysisState } from './analysis.state';
import { AssessingComplianceState } from './assessing-compliance.state';

export class IdentifyingRegulationsState extends AnalysisState {
  public async accept(visitor: AnalysisVisitor): Promise<void> {
    await visitor.visitIdentifyingRegulationsState(this);
  }

  public async transition(): Promise<void> {
    this.context.setState(new AssessingComplianceState(this.context));
  }
}
