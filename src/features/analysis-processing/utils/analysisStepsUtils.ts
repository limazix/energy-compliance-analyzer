
import type { Analysis, AnalysisStep } from '@/types/analysis';

const BASE_ANALYSIS_STEPS: Omit<AnalysisStep, 'status' | 'progress' | 'details'>[] = [
  { name: 'Upload do Arquivo e Preparação' },
  { name: 'Sumarizando Dados da Qualidade de Energia' },
  { name: 'Identificando Resoluções ANEEL' },
  { name: 'Analisando Conformidade' },
  { name: 'Gerando Relatório Estruturado' },
];

export function calculateDisplayedAnalysisSteps(currentAnalysis: Analysis | null): AnalysisStep[] {
  let steps: AnalysisStep[] = BASE_ANALYSIS_STEPS.map(s => ({ ...s, status: 'pending', progress: 0 }));

  if (!currentAnalysis || currentAnalysis.id.startsWith('error-')) {
    const errorMsg = currentAnalysis?.errorMessage || 'Aguardando início da análise ou configuração inicial.';
    const uploadProg = Math.max(0, Math.min(100, currentAnalysis?.uploadProgress ?? 0));
    steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: currentAnalysis?.errorMessage ? 'error': 'pending', details: errorMsg, progress: uploadProg};
    for (let i = 1; i < steps.length; i++) {
        steps[i] = { ...BASE_ANALYSIS_STEPS[i], status: 'pending', progress: 0 };
    }
    return steps;
  }

  const { status, progress, errorMessage, powerQualityDataUrl, powerQualityDataSummary, identifiedRegulations, structuredReport, uploadProgress } = currentAnalysis;
  const overallProgress = typeof progress === 'number' ? Math.min(100, Math.max(0, progress)) : 0;
  
  const markPreviousStepsCompleted = (currentIndex: number) => {
      for (let i = 0; i < currentIndex; i++) {
          steps[i] = { ...steps[i], status: 'completed', progress: 100 };
      }
  };
  const markFollowingStepsPending = (currentIndex: number) => {
      for (let i = currentIndex + 1; i < steps.length; i++) {
          steps[i] = { ...steps[i], status: 'pending', progress: 0 };
      }
  };
  
  const markAllStepsCancelled = (details?: string) => {
    steps.forEach((step, i) => {
      if (steps[i].status === 'completed') return; 
      steps[i] = { ...steps[i], status: 'cancelled', details: i === 0 ? details : undefined, progress: steps[i].progress ?? 0 };
    });
  }

  if (status === 'cancelled') {
    markAllStepsCancelled(errorMessage || 'Análise cancelada.');
    return steps;
  }
  if (status === 'cancelling') {
    steps.forEach((step, i) => {
       if (steps[i].status === 'completed') return;
       steps[i] = { ...steps[i], status: 'pending', details: 'Cancelamento em andamento...', progress: steps[i].progress ?? 0 };
    });
    if (steps[0].status !== 'completed' && (currentAnalysis.status === 'uploading' || (powerQualityDataUrl && currentAnalysis.status === 'summarizing_data')) ) steps[0].details = 'Cancelando...';
    else if (steps[1].status !== 'completed' && currentAnalysis.status === 'summarizing_data') steps[1].details = 'Cancelando...';
    else if (steps[2].status !== 'completed' && currentAnalysis.status === 'identifying_regulations') steps[2].details = 'Cancelando...';
    else if (steps[3].status !== 'completed' && currentAnalysis.status === 'assessing_compliance') steps[3].details = 'Cancelando...'; 
    else if (steps[4].status !== 'completed' && currentAnalysis.status === 'assessing_compliance') steps[4].details = 'Cancelando...';
    return steps;
  }

  switch (status) {
      case 'uploading':
          steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'in_progress', progress: Math.max(0, Math.min(100, uploadProgress ?? 0)) };
          markFollowingStepsPending(0);
          break;
      case 'summarizing_data':
          markPreviousStepsCompleted(1);
          steps[1] = { ...BASE_ANALYSIS_STEPS[1], status: 'in_progress', progress: Math.max(0, Math.min(100, overallProgress -10)) };
          markFollowingStepsPending(1);
          break;
      case 'identifying_regulations':
          markPreviousStepsCompleted(2);
          steps[2] = { ...BASE_ANALYSIS_STEPS[2], status: 'in_progress', progress: Math.max(0, Math.min(100, overallProgress - 40)) };
          markFollowingStepsPending(2);
          break;
      case 'assessing_compliance': 
          markPreviousStepsCompleted(3); 
          steps[3] = { ...BASE_ANALYSIS_STEPS[3], status: 'completed', progress: 100 }; 
          steps[4] = { ...BASE_ANALYSIS_STEPS[4], status: 'in_progress', progress: Math.max(0, Math.min(100, overallProgress - 70)) }; 
          markFollowingStepsPending(4);
          break;
      case 'completed':
          steps = BASE_ANALYSIS_STEPS.map(s => ({ ...s, status: 'completed', progress: 100 }));
          break;
      case 'error':
          if (!powerQualityDataUrl && overallProgress < 10) { 
              steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'error', details: errorMessage, progress: Math.max(0, Math.min(100, uploadProgress ?? 0))};
              markFollowingStepsPending(0);
          } else if (!powerQualityDataSummary && overallProgress < 40) { 
              markPreviousStepsCompleted(1);
              steps[1] = { ...BASE_ANALYSIS_STEPS[1], status: 'error', details: errorMessage, progress: Math.max(0, Math.min(100, overallProgress -10)) };
              markFollowingStepsPending(1);
          } else if (!identifiedRegulations && overallProgress < 70) { 
              markPreviousStepsCompleted(2);
              steps[2] = { ...BASE_ANALYSIS_STEPS[2], status: 'error', details: errorMessage, progress: Math.max(0, Math.min(100, overallProgress - 40)) };
              markFollowingStepsPending(2);
          } else if (!structuredReport && overallProgress < 100) { 
              markPreviousStepsCompleted(3);
               steps[3] = { ...BASE_ANALYSIS_STEPS[3], status: 'completed', progress: 100 }; 
              steps[4] = { ...BASE_ANALYSIS_STEPS[4], status: 'error', details: errorMessage, progress: Math.max(0, Math.min(100, overallProgress - 70)) };
              markFollowingStepsPending(4);
          } else { 
              let errorAssigned = false;
              for (let i = steps.length - 1; i >= 0; i--) {
                   if (steps[i].status === 'in_progress' || (steps[i].status === 'pending' && (steps[i-1]?.status === 'completed' || i === 0 ))) {
                      steps[i] = { ...steps[i], status: 'error', details: errorMessage, progress: steps[i].progress ?? 0};
                      errorAssigned = true;
                      break;
                  }
              }
               if (!errorAssigned && steps.length > 0) steps[steps.length -1] = { ...steps[steps.length-1], status: 'error', details: errorMessage, progress: steps[steps.length-1].progress ?? 0};
          }
          break;
      default:
           steps = BASE_ANALYSIS_STEPS.map(s => ({ ...s, status: 'pending', progress: 0, details: 'Status desconhecido' }));
  }
  return steps;
}
