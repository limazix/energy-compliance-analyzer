import type { AnalyzeComplianceReportOutput } from '@/ai/prompt-configs/analyze-compliance-report-prompt-config';
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
  let steps: AnalysisStep[] = BASE_ANALYSIS_STEPS.map((s) => ({
    ...s,
    status: 'pending',
    progress: 0,
  }));

  if (!currentAnalysis || currentAnalysis.id.startsWith('error-')) {
    const errorMsg =
      currentAnalysis?.errorMessage || 'Aguardando início da análise ou configuração inicial.';
    const uploadProg = Math.max(0, Math.min(100, currentAnalysis?.uploadProgress ?? 0));

    steps[0] = {
      ...BASE_ANALYSIS_STEPS[0],
      status:
        currentAnalysis?.status === 'error' && !currentAnalysis?.powerQualityDataUrl
          ? 'error'
          : uploadProg === 100
            ? 'completed'
            : uploadProg > 0
              ? 'in_progress'
              : 'pending',
      details:
        currentAnalysis?.status === 'error'
          ? errorMsg
          : uploadProg < 100 && uploadProg > 0
            ? 'Enviando...'
            : undefined,
      progress: uploadProg,
    };

    for (let i = 1; i < steps.length; i++) {
      if (
        steps[0].status === 'error' ||
        steps[0].status === 'pending' ||
        steps[0].status === 'in_progress'
      ) {
        steps[i] = { ...BASE_ANALYSIS_STEPS[i], status: 'pending', progress: 0 };
      }
    }
    if (
      currentAnalysis?.status === 'error' &&
      currentAnalysis?.errorMessage &&
      steps[0].status !== 'error'
    ) {
      const errorStepIndex = steps.findIndex(
        (s) => s.status === 'in_progress' || s.status === 'pending'
      );
      if (errorStepIndex !== -1) {
        steps[errorStepIndex] = { ...steps[errorStepIndex], status: 'error', details: errorMsg };
      } else {
        steps[steps.length - 1] = {
          ...steps[steps.length - 1],
          status: 'error',
          details: errorMsg,
        };
      }
    }
    return steps;
  }

  const {
    status,
    progress,
    errorMessage,
    powerQualityDataUrl,
    powerQualityDataSummary,
    identifiedRegulations,
    structuredReport,
    uploadProgress,
  } = currentAnalysis;
  const overallProgress = typeof progress === 'number' ? Math.min(100, Math.max(0, progress)) : 0;

  const UPLOAD_COMPLETE_PROGRESS = 10;
  const SUMMARIZATION_COMPLETE_PROGRESS = 45;
  const IDENTIFY_REG_COMPLETE_PROGRESS = 60;
  const ANALYZE_COMPLIANCE_COMPLETE_PROGRESS = 75;
  const REVIEW_REPORT_COMPLETE_PROGRESS = 90;
  const FINAL_GENERATION_COMPLETE_PROGRESS = 100;

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

  const markAllStepsTerminal = (
    terminalStatus: 'cancelled' | 'deleted' | 'pending_deletion',
    details?: string
  ) => {
    let pointReached = false;
    steps.forEach((step, i) => {
      if (steps[i].status === 'completed' && !pointReached) return;
      pointReached = true;
      steps[i] = {
        ...steps[i],
        status: terminalStatus,
        details:
          i === steps.findIndex((s) => s.status !== 'completed' && s.status !== terminalStatus)
            ? details
            : undefined,
        progress: steps[i].progress ?? 0,
      };
    });
  };

  if (powerQualityDataUrl || overallProgress >= UPLOAD_COMPLETE_PROGRESS) {
    steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'completed', progress: 100 };
  } else if (status === 'uploading') {
    steps[0] = {
      ...BASE_ANALYSIS_STEPS[0],
      status: 'in_progress',
      progress: Math.max(0, Math.min(100, uploadProgress ?? 0)),
    };
    markFollowingStepsPending(0);
    return steps;
  }

  if (status === 'cancelled') {
    markAllStepsTerminal('cancelled', errorMessage || 'Análise cancelada.');
    if (powerQualityDataUrl)
      steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'completed', progress: 100 };
    return steps;
  }
  if (status === 'pending_deletion') {
    markAllStepsTerminal('pending_deletion', 'Exclusão da análise pendente...');
    if (powerQualityDataUrl)
      steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'completed', progress: 100 };
    return steps;
  }
  if (status === 'deleted') {
    markAllStepsTerminal('deleted', 'Análise excluída.');
    return steps;
  }

  if (status === 'cancelling') {
    steps.forEach((step, i) => {
      if (steps[i].status === 'completed') return;
      steps[i] = {
        ...steps[i],
        status: 'pending', // Or 'cancelled' if we want to reflect it immediately
        details: 'Cancelamento em andamento...',
        progress: steps[i].progress ?? 0,
      };
    });
    const currentActiveStepIndex = steps.findIndex(
      (s) => s.status !== 'completed' && s.status !== 'cancelled'
    );
    if (currentActiveStepIndex !== -1) {
      steps[currentActiveStepIndex].details = 'Cancelamento solicitado durante esta etapa...';
      steps[currentActiveStepIndex].status = 'cancelled'; // More accurately reflect intent
    }
    return steps;
  }

  switch (status) {
    case 'summarizing_data':
      markPreviousStepsCompleted(1);
      steps[1] = {
        ...BASE_ANALYSIS_STEPS[1],
        status: 'in_progress',
        progress: Math.max(
          0,
          Math.min(
            100,
            ((overallProgress - UPLOAD_COMPLETE_PROGRESS) /
              (SUMMARIZATION_COMPLETE_PROGRESS - UPLOAD_COMPLETE_PROGRESS)) *
              100
          )
        ),
      };
      markFollowingStepsPending(1);
      break;
    case 'identifying_regulations':
      markPreviousStepsCompleted(2);
      steps[2] = {
        ...BASE_ANALYSIS_STEPS[2],
        status: 'in_progress',
        progress: Math.max(
          0,
          Math.min(
            100,
            ((overallProgress - SUMMARIZATION_COMPLETE_PROGRESS) /
              (IDENTIFY_REG_COMPLETE_PROGRESS - SUMMARIZATION_COMPLETE_PROGRESS)) *
              100
          )
        ),
      };
      markFollowingStepsPending(2);
      break;
    case 'assessing_compliance':
      markPreviousStepsCompleted(3);
      steps[3] = {
        ...BASE_ANALYSIS_STEPS[3],
        status: 'in_progress',
        progress: Math.max(
          0,
          Math.min(
            100,
            ((overallProgress - IDENTIFY_REG_COMPLETE_PROGRESS) /
              (ANALYZE_COMPLIANCE_COMPLETE_PROGRESS - IDENTIFY_REG_COMPLETE_PROGRESS)) *
              100
          )
        ),
      };
      markFollowingStepsPending(3);
      break;
    case 'reviewing_report':
      markPreviousStepsCompleted(4);
      steps[4] = {
        ...BASE_ANALYSIS_STEPS[4],
        status: 'in_progress',
        progress: Math.max(
          0,
          Math.min(
            100,
            ((overallProgress - ANALYZE_COMPLIANCE_COMPLETE_PROGRESS) /
              (REVIEW_REPORT_COMPLETE_PROGRESS - ANALYZE_COMPLIANCE_COMPLETE_PROGRESS)) *
              100
          )
        ),
      };
      markFollowingStepsPending(4);
      break;
    case 'completed':
      steps = BASE_ANALYSIS_STEPS.map((s) => ({ ...s, status: 'completed', progress: 100 }));
      break;
    case 'error':
      if (overallProgress < UPLOAD_COMPLETE_PROGRESS || !powerQualityDataUrl) {
        steps[0] = {
          ...BASE_ANALYSIS_STEPS[0],
          status: 'error',
          details: errorMessage,
          progress: Math.max(0, Math.min(100, uploadProgress ?? 0)),
        };
        markFollowingStepsPending(0);
      } else if (overallProgress < SUMMARIZATION_COMPLETE_PROGRESS || !powerQualityDataSummary) {
        markPreviousStepsCompleted(1);
        steps[1] = {
          ...BASE_ANALYSIS_STEPS[1],
          status: 'error',
          details: errorMessage,
          progress: Math.max(
            0,
            Math.min(
              100,
              ((overallProgress - UPLOAD_COMPLETE_PROGRESS) /
                (SUMMARIZATION_COMPLETE_PROGRESS - UPLOAD_COMPLETE_PROGRESS)) *
                100
            )
          ),
        };
        markFollowingStepsPending(1);
      } else if (overallProgress < IDENTIFY_REG_COMPLETE_PROGRESS || !identifiedRegulations) {
        markPreviousStepsCompleted(2);
        steps[2] = {
          ...BASE_ANALYSIS_STEPS[2],
          status: 'error',
          details: errorMessage,
          progress: Math.max(
            0,
            Math.min(
              100,
              ((overallProgress - SUMMARIZATION_COMPLETE_PROGRESS) /
                (IDENTIFY_REG_COMPLETE_PROGRESS - SUMMARIZATION_COMPLETE_PROGRESS)) *
                100
            )
          ),
        };
        markFollowingStepsPending(2);
      } else if (overallProgress < ANALYZE_COMPLIANCE_COMPLETE_PROGRESS) {
        markPreviousStepsCompleted(3);
        steps[3] = {
          ...BASE_ANALYSIS_STEPS[3],
          status: 'error',
          details: errorMessage,
          progress: Math.max(
            0,
            Math.min(
              100,
              ((overallProgress - IDENTIFY_REG_COMPLETE_PROGRESS) /
                (ANALYZE_COMPLIANCE_COMPLETE_PROGRESS - IDENTIFY_REG_COMPLETE_PROGRESS)) *
                100
            )
          ),
        };
        markFollowingStepsPending(3);
      } else if (overallProgress < REVIEW_REPORT_COMPLETE_PROGRESS || !structuredReport) {
        markPreviousStepsCompleted(4);
        steps[4] = {
          ...BASE_ANALYSIS_STEPS[4],
          status: 'error',
          details: errorMessage,
          progress: Math.max(
            0,
            Math.min(
              100,
              ((overallProgress - ANALYZE_COMPLIANCE_COMPLETE_PROGRESS) /
                (REVIEW_REPORT_COMPLETE_PROGRESS - ANALYZE_COMPLIANCE_COMPLETE_PROGRESS)) *
                100
            )
          ),
        };
        markFollowingStepsPending(4);
      } else {
        markPreviousStepsCompleted(5);
        steps[5] = {
          ...BASE_ANALYSIS_STEPS[5],
          status: 'error',
          details: errorMessage,
          progress: Math.max(
            0,
            Math.min(
              100,
              ((overallProgress - REVIEW_REPORT_COMPLETE_PROGRESS) /
                (FINAL_GENERATION_COMPLETE_PROGRESS - REVIEW_REPORT_COMPLETE_PROGRESS)) *
                100
            )
          ),
        };
      }
      break;
    default:
      steps = BASE_ANALYSIS_STEPS.map((s) => ({
        ...s,
        status: 'pending',
        progress: 0,
        details: `Status desconhecido: ${status}`,
      }));
  }
  if (
    steps.slice(1).some((s) => s.status === 'completed' || s.status === 'in_progress') &&
    steps[0].status !== 'error'
  ) {
    steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'completed', progress: 100 };
  }
  return steps;
}
