'use client';

import { AlertTriangle, CheckCircle2, FileText, Loader2 } from 'lucide-react';

import { Progress } from '@/components/ui/progress';
import type { AnalysisStep } from '@/types/analysis';

type AnalysisStepItemProps = {
  step: AnalysisStep;
};

const renderStepIcon = (status: AnalysisStep['status']) => {
  if (status === 'in_progress') return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  if (status === 'completed') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  if (status === 'error') return <AlertTriangle className="h-5 w-5 text-destructive" />;
  return <FileText className="h-5 w-5 text-muted-foreground" />;
};

export function AnalysisStepItem({ step }: AnalysisStepItemProps) {
  return (
    <li className="flex items-center p-3 bg-muted/50 rounded-md shadow-sm">
      {renderStepIcon(step.status)}
      <span className="ml-3 flex-1 text-md">{step.name}</span>
      {step.status === 'in_progress' && typeof step.progress === 'number' && (
        <div className="w-32 ml-auto flex items-center">
          <Progress value={step.progress} className="h-4 mr-2" /> {/* Default height */}
          <span className="text-xs text-muted-foreground">{Math.round(step.progress)}%</span>
        </div>
      )}
      {step.status === 'error' && step.details && (
        <p className="ml-3 text-xs text-destructive">{step.details}</p>
      )}
    </li>
  );
}
