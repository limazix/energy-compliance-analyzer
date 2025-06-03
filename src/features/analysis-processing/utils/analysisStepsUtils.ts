
import type { Analysis, AnalysisStep } from '@/types/analysis';

const BASE_ANALYSIS_STEPS: Omit<AnalysisStep, 'status' | 'progress' | 'details'>[] = [
  { name: 'Upload do Arquivo e Preparação' },
  { name: 'Sumarizando Dados da Qualidade de Energia' },
  { name: 'Identificando Resoluções ANEEL' },
  { name: 'Analisando Conformidade Inicial' },
  { name: 'Revisando e Refinando Relatório' },
  { name: 'Gerando Arquivos Finais do Relatório' },
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
  
  // Progress milestones (approximate, adjust if Firebase Function progress constants change)
  // Based on: FILE_READ=10, SUM_BASE=15, SUM_SPAN=30, IDENTIFY_REG=60, ANALYZE_COMP=75, REVIEW_REP=90, FINAL=100
  const UPLOAD_COMPLETE_PROGRESS = 10;
  const SUMMARIZATION_COMPLETE_PROGRESS = 15 + 30; // 45
  const IDENTIFY_REG_COMPLETE_PROGRESS = 60;
  const ANALYZE_COMPLIANCE_COMPLETE_PROGRESS = 75;
  const REVIEW_REPORT_COMPLETE_PROGRESS = 90;


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
    // Crude attempt to show where cancellation might be happening based on status
    if (steps[0].status !== 'completed' && (currentAnalysis.status === 'uploading' || (powerQualityDataUrl && (currentAnalysis.status === 'summarizing_data' || currentAnalysis.status === 'identifying_regulations' || currentAnalysis.status === 'assessing_compliance' || currentAnalysis.status === 'reviewing_report')) )) steps[0].details = 'Cancelando...';
    else if (steps[1].status !== 'completed' && currentAnalysis.status === 'summarizing_data') steps[1].details = 'Cancelando...';
    else if (steps[2].status !== 'completed' && currentAnalysis.status === 'identifying_regulations') steps[2].details = 'Cancelando...';
    else if (steps[3].status !== 'completed' && currentAnalysis.status === 'assessing_compliance') steps[3].details = 'Cancelando...'; 
    else if (steps[4].status !== 'completed' && currentAnalysis.status === 'reviewing_report') steps[4].details = 'Cancelando...';
    else if (steps[5].status !== 'completed' && currentAnalysis.status === 'reviewing_report') steps[5].details = 'Cancelando...'; // Or last step
    return steps;
  }

  switch (status) {
      case 'uploading':
          steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'in_progress', progress: Math.max(0, Math.min(100, uploadProgress ?? 0)) };
          markFollowingStepsPending(0);
          break;
      case 'summarizing_data':
          markPreviousStepsCompleted(1);
          steps[1] = { ...BASE_ANALYSIS_STEPS[1], status: 'in_progress', progress: Math.max(0, Math.min(100, (overallProgress - UPLOAD_COMPLETE_PROGRESS) / (SUMMARIZATION_COMPLETE_PROGRESS - UPLOAD_COMPLETE_PROGRESS) * 100 )) };
          markFollowingStepsPending(1);
          break;
      case 'identifying_regulations':
          markPreviousStepsCompleted(2);
          steps[2] = { ...BASE_ANALYSIS_STEPS[2], status: 'in_progress', progress: Math.max(0, Math.min(100, (overallProgress - SUMMARIZATION_COMPLETE_PROGRESS) / (IDENTIFY_REG_COMPLETE_PROGRESS - SUMMARIZATION_COMPLETE_PROGRESS) * 100)) };
          markFollowingStepsPending(2);
          break;
      case 'assessing_compliance': 
          markPreviousStepsCompleted(3); 
          steps[3] = { ...BASE_ANALYSIS_STEPS[3], status: 'in_progress', progress: Math.max(0, Math.min(100, (overallProgress - IDENTIFY_REG_COMPLETE_PROGRESS) / (ANALYZE_COMPLIANCE_COMPLETE_PROGRESS - IDENTIFY_REG_COMPLETE_PROGRESS) * 100)) };
          markFollowingStepsPending(3);
          break;
      case 'reviewing_report':
          markPreviousStepsCompleted(4);
          steps[4] = { ...BASE_ANALYSIS_STEPS[4], status: 'in_progress', progress: Math.max(0, Math.min(100, (overallProgress - ANALYZE_COMPLIANCE_COMPLETE_PROGRESS) / (REVIEW_REPORT_COMPLETE_PROGRESS - ANALYZE_COMPLIANCE_COMPLETE_PROGRESS) * 100)) };
          steps[5] = { ...BASE_ANALYSIS_STEPS[5], status: 'pending' }; // Final report generation pending
          break;
      case 'completed':
          steps = BASE_ANALYSIS_STEPS.map(s => ({ ...s, status: 'completed', progress: 100 }));
          break;
      case 'error':
          // Determine which step failed based on progress and existing data
          if (overallProgress < UPLOAD_COMPLETE_PROGRESS || !powerQualityDataUrl) { 
              steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'error', details: errorMessage, progress: Math.max(0, Math.min(100, uploadProgress ?? 0))};
              markFollowingStepsPending(0);
          } else if (overallProgress < SUMMARIZATION_COMPLETE_PROGRESS || !powerQualityDataSummary) { 
              markPreviousStepsCompleted(1);
              steps[1] = { ...BASE_ANALYSIS_STEPS[1], status: 'error', details: errorMessage, progress: Math.max(0, Math.min(100, (overallProgress - UPLOAD_COMPLETE_PROGRESS) / (SUMMARIZATION_COMPLETE_PROGRESS - UPLOAD_COMPLETE_PROGRESS) * 100 )) };
              markFollowingStepsPending(1);
          } else if (overallProgress < IDENTIFY_REG_COMPLETE_PROGRESS || !identifiedRegulations) { 
              markPreviousStepsCompleted(2);
              steps[2] = { ...BASE_ANALYSIS_STEPS[2], status: 'error', details: errorMessage, progress: Math.max(0, Math.min(100, (overallProgress - SUMMARIZATION_COMPLETE_PROGRESS) / (IDENTIFY_REG_COMPLETE_PROGRESS - SUMMARIZATION_COMPLETE_PROGRESS) * 100)) };
              markFollowingStepsPending(2);
          } else if (overallProgress < ANALYZE_COMPLIANCE_COMPLETE_PROGRESS) { // Error during initial analysis
              markPreviousStepsCompleted(3);
              steps[3] = { ...BASE_ANALYSIS_STEPS[3], status: 'error', details: errorMessage, progress: Math.max(0, Math.min(100, (overallProgress - IDENTIFY_REG_COMPLETE_PROGRESS) / (ANALYZE_COMPLIANCE_COMPLETE_PROGRESS - IDENTIFY_REG_COMPLETE_PROGRESS) * 100)) };
              markFollowingStepsPending(3);
          } else if (overallProgress < REVIEW_REPORT_COMPLETE_PROGRESS || !structuredReport) { // Error during review or structured report missing
              markPreviousStepsCompleted(4);
              steps[4] = { ...BASE_ANALYSIS_STEPS[4], status: 'error', details: errorMessage, progress: Math.max(0, Math.min(100, (overallProgress - ANALYZE_COMPLIANCE_COMPLETE_PROGRESS) / (REVIEW_REPORT_COMPLETE_PROGRESS - ANALYZE_COMPLIANCE_COMPLETE_PROGRESS) * 100)) };
              markFollowingStepsPending(4);
          } else { // Error during final report generation or unknown
              markPreviousStepsCompleted(5);
              steps[5] = { ...BASE_ANALYSIS_STEPS[5], status: 'error', details: errorMessage, progress: Math.max(0, Math.min(100, (overallProgress - REVIEW_REPORT_COMPLETE_PROGRESS) / (100 - REVIEW_REPORT_COMPLETE_PROGRESS) * 100)) };
              markFollowingStepsPending(5);
          }
          break;
      default:
           steps = BASE_ANALYSIS_STEPS.map(s => ({ ...s, status: 'pending', progress: 0, details: 'Status desconhecido' }));
  }
  return steps;
}

