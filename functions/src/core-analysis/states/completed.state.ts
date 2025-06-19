// functions/src/core-analysis/states/completed.state.ts
import { AnalysisState } from './analysis.state';

export class CompletedState extends AnalysisState {
  public async accept(): Promise<void> {
    // The completed state does not have a visitor
  }

  public async transition(): Promise<void> {
    // The completed state is a final state
  }
}
