// functions/src/core-analysis/analysis-context.ts
import { AnalysisData } from '../types';
import { AnalysisState } from './states/analysis.state';
import { InitialState } from './states/initial.state';

export class AnalysisContext {
  private state: AnalysisState;
  public analysisData: AnalysisData;

  constructor(analysisData: AnalysisData) {
    this.analysisData = analysisData;
    this.state = new InitialState(this);
  }

  public setState(state: AnalysisState) {
    this.state = state;
  }

  public getState(): AnalysisState {
    return this.state;
  }

  public async request(): Promise<void> {
    await this.state.transition();
  }
}
