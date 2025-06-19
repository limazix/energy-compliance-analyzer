// functions/src/core-analysis/states/analysis.state.ts
import { AnalysisContext } from '../analysis-context';
import { AnalysisVisitor } from '../analysis-visitor';

export abstract class AnalysisState {
  protected context: AnalysisContext;

  constructor(context: AnalysisContext) {
    this.context = context;
  }

  public abstract accept(visitor: AnalysisVisitor): Promise<void>;
  public abstract transition(): Promise<void>;
}
