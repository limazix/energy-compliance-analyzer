// functions/src/core-analysis/states/initial.state.ts
import { AnalysisState } from './analysis.state';
import { SummarizingState } from './summarizing.state';

export class InitialState extends AnalysisState {
  public async accept(_visitor?: unknown): Promise<void> {
    // InitialState does not interact with visitors in a typical accept pattern.
  }

  public async transition(): Promise<void> {
    this.context.setState(new SummarizingState(this.context));
  }
}
