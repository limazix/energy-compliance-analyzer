
'use client';

import type { AnalysisStep } from '@/types/analysis';
import { AnalysisStepItem } from './AnalysisStepItem';

type AnalysisProgressDisplayProps = {
  analysisSteps: AnalysisStep[];
};

export function AnalysisProgressDisplay({ analysisSteps }: AnalysisProgressDisplayProps) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-3">Progresso da Análise:</h3>
      <ul className="space-y-3">
        {analysisSteps.map((step, index) => (
          <AnalysisStepItem key={index} step={step} />
        ))}
      </ul>
    </div>
  );
}

    