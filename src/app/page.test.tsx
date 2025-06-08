
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from './page';
import { useAuth as originalUseAuth } from '@/contexts/auth-context';
import { useAnalysisManager as originalUseAnalysisManagerHook } from '@/hooks/useAnalysisManager';
import { useFileUploadManager as originalUseFileUploadManager } from '@/features/file-upload/hooks/useFileUploadManager';
import type { Analysis, AnalysisStep } from '@/types/analysis';
import { Timestamp } from 'firebase/firestore';

// Mocks
jest.mock('@/contexts/auth-context', () => ({
  __esModule: true,
  ...jest.requireActual('@/contexts/auth-context'),
  useAuth: jest.fn(),
}));
const useAuth = originalUseAuth as jest.Mock;

const useAnalysisManager = originalUseAnalysisManagerHook as jest.Mock;

jest.mock('@/features/file-upload/hooks/useFileUploadManager');
const useFileUploadManager = originalUseFileUploadManager as jest.Mock;

const mockRouterReplace = jest.requireMock('next/navigation').useRouter().replace;
const mockRouterPush = jest.requireMock('next/navigation').useRouter().push;

const mockUser = {
  uid: 'test-user-001',
  displayName: 'Test User One',
  email: 'test@example.com',
  photoURL: 'https://placehold.co/100x100.png?text=TU1'
};

const mockAnalysisItemCompleted: Analysis = {
  id: 'analysis-id-completed-01',
  userId: mockUser.uid,
  fileName: 'aneel_data_report_alpha.csv',
  title: 'Relatório de Conformidade Alpha',
  description: 'Análise detalhada dos dados de qualidade de energia para o cliente Alpha.',
  languageCode: 'pt-BR',
  status: 'completed',
  progress: 100,
  uploadProgress: 100,
  powerQualityDataUrl: `user_uploads/${mockUser.uid}/analysis-id-completed-01/aneel_data_report_alpha.csv`,
  powerQualityDataSummary: 'Sumário dos dados para Alpha: Tensão estável, algumas flutuações de frequência.',
  isDataChunked: false,
  identifiedRegulations: ['REN 414/2010', 'PRODIST Módulo 8'],
  summary: 'Conformidade geral atingida com pequenas observações.',
  structuredReport: {
    reportMetadata: {
      title: 'Relatório de Conformidade da Qualidade de Energia Elétrica - Alpha',
      subtitle: 'Análise referente ao arquivo aneel_data_report_alpha.csv',
      author: 'Energy Compliance Analyzer',
      generatedDate: '2023-10-26',
    },
    tableOfContents: ["Introdução", "Análise de Tensão", "Conclusões"],
    introduction: {
      objective: 'Analisar a conformidade dos dados de qualidade de energia do arquivo aneel_data_report_alpha.csv.',
      overallResultsSummary: 'A análise indica conformidade geral com as normas ANEEL, com algumas variações de frequência necessitando monitoramento.',
      usedNormsOverview: 'REN 414/2010, PRODIST Módulo 8',
    },
    analysisSections: [
      {
        title: "Análise de Tensão",
        content: "Os níveis de tensão mantiveram-se dentro dos limites adequados na maior parte do tempo.",
        insights: ["Tensão predominantemente estável."],
        relevantNormsCited: ["PRODIST Módulo 8, Seção 3.2"],
        chartOrImageSuggestion: "Gráfico de linha da tensão ao longo do tempo."
      }
    ],
    finalConsiderations: 'Recomenda-se o monitoramento contínuo da frequência.',
    bibliography: [{ text: 'ANEEL. PRODIST Módulo 8 - Qualidade da Energia Elétrica.', link: 'https://www.aneel.gov.br' }],
  },
  mdxReportStoragePath: `user_reports/${mockUser.uid}/analysis-id-completed-01/report.mdx`,
  errorMessage: undefined,
  tags: ['cliente_alpha', 'prioridade_alta'],
  createdAt: new Date('2023-10-25T10:00:00Z').toISOString(),
  completedAt: new Date('2023-10-26T14:30:00Z').toISOString(),
};

const mockAnalysisItemInProgress: Analysis = {
  id: 'analysis-id-inprogress-02',
  userId: mockUser.uid,
  fileName: 'power_quality_beta_set.csv',
  title: 'Análise Beta em Andamento',
  description: 'Processamento em tempo real dos dados do cliente Beta.',
  languageCode: 'pt-BR',
  status: 'summarizing_data',
  progress: 30,
  uploadProgress: 100,
  powerQualityDataUrl: `user_uploads/${mockUser.uid}/analysis-id-inprogress-02/power_quality_beta_set.csv`,
  powerQualityDataSummary: undefined,
  isDataChunked: true,
  identifiedRegulations: undefined,
  summary: undefined,
  structuredReport: undefined,
  mdxReportStoragePath: undefined,
  errorMessage: undefined,
  tags: ['cliente_beta', 'realtime'],
  createdAt: new Date('2023-10-27T09:00:00Z').toISOString(),
  completedAt: undefined,
};

function calculateDisplayedAnalysisSteps(currentAnalysis: Analysis | null): AnalysisStep[] {
  const BASE_ANALYSIS_STEPS: Omit<AnalysisStep, 'status' | 'progress' | 'details'>[] = [
    { name: 'Upload do Arquivo e Preparação' },
    { name: 'Sumarizando Dados da Qualidade de Energia' },
    { name: 'Identificando Resoluções ANEEL' },
    { name: 'Analisando Conformidade Inicial' },
    { name: 'Revisando e Refinando Relatório' },
    { name: 'Gerando Arquivos Finais do Relatório' },
  ];
  let steps: AnalysisStep[] = BASE_ANALYSIS_STEPS.map(s => ({ ...s, status: 'pending', progress: 0 }));

  if (!currentAnalysis || currentAnalysis.id.startsWith('error-')) {
    const errorMsg = currentAnalysis?.errorMessage || 'Aguardando início da análise ou configuração inicial.';
    const uploadProg = Math.max(0, Math.min(100, currentAnalysis?.uploadProgress ?? 0));
    
    steps[0] = { 
        ...BASE_ANALYSIS_STEPS[0], 
        status: currentAnalysis?.status === 'error' && !currentAnalysis?.powerQualityDataUrl ? 'error' : (uploadProg === 100 ? 'completed' : (uploadProg > 0 ? 'in_progress' : 'pending')), 
        details: currentAnalysis?.status === 'error' ? errorMsg : (uploadProg < 100 && uploadProg > 0 ? 'Enviando...' : undefined), 
        progress: uploadProg
    };
    
    for (let i = 1; i < steps.length; i++) {
        if (steps[0].status === 'error' || steps[0].status === 'pending' || steps[0].status === 'in_progress') {
            steps[i] = { ...BASE_ANALYSIS_STEPS[i], status: 'pending', progress: 0 };
        }
    }
     if (currentAnalysis?.status === 'error' && currentAnalysis?.errorMessage && steps[0].status !== 'error') {
        const errorStepIndex = steps.findIndex(s => s.status === 'in_progress' || s.status === 'pending');
        if (errorStepIndex !== -1) {
            steps[errorStepIndex] = { ...steps[errorStepIndex], status: 'error', details: errorMsg };
        } else { 
            steps[steps.length-1] = {...steps[steps.length-1], status: 'error', details: errorMsg }
        }
    }
    return steps;
  }

  const { status, progress, errorMessage, powerQualityDataUrl, powerQualityDataSummary, identifiedRegulations, structuredReport, uploadProgress } = currentAnalysis;
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
  
  const markAllStepsCancelled = (details?: string) => {
    let cancellationPointReached = false;
    steps.forEach((step, i) => {
      if (steps[i].status === 'completed' && !cancellationPointReached) return; 
      cancellationPointReached = true;
      steps[i] = { ...steps[i], status: 'cancelled', details: i === steps.findIndex(s => s.status !== 'completed') ? details : undefined, progress: steps[i].progress ?? 0 };
    });
  }

  if (status === 'uploading' || (status !== 'completed' && !powerQualityDataUrl && status !== 'error' && status !== 'cancelled' && status !== 'cancelling')) {
     steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'in_progress', progress: Math.max(0, Math.min(100, uploadProgress ?? 0)) };
     markFollowingStepsPending(0);
     return steps;
  } else if (powerQualityDataUrl || overallProgress >= UPLOAD_COMPLETE_PROGRESS) {
      steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'completed', progress: 100 };
  }

  if (status === 'cancelled') {
    markAllStepsCancelled(errorMessage || 'Análise cancelada.');
    if(powerQualityDataUrl) steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'completed', progress: 100 };
    return steps;
  }
  if (status === 'cancelling') {
    steps.forEach((step, i) => {
       if (steps[i].status === 'completed') return;
       steps[i] = { ...steps[i], status: 'pending', details: 'Cancelamento em andamento...', progress: steps[i].progress ?? 0 };
    });
    const currentActiveStepIndex = steps.findIndex(s => s.status !== 'completed' && s.status !== 'cancelled');
    if (currentActiveStepIndex !== -1) {
        steps[currentActiveStepIndex].details = 'Cancelamento solicitado durante esta etapa...';
    }
    return steps;
  }

  switch (status) {
      case 'summarizing_data':
          markPreviousStepsCompleted(1);
          steps[1] = { ...BASE_ANALYSIS_STEPS[1], status: 'in_progress', progress: Math.max(0, Math.min(100, ((overallProgress - UPLOAD_COMPLETE_PROGRESS) / (SUMMARIZATION_COMPLETE_PROGRESS - UPLOAD_COMPLETE_PROGRESS)) * 100 )) };
          markFollowingStepsPending(1);
          break;
      case 'identifying_regulations':
          markPreviousStepsCompleted(2);
          steps[2] = { ...BASE_ANALYSIS_STEPS[2], status: 'in_progress', progress: Math.max(0, Math.min(100, ((overallProgress - SUMMARIZATION_COMPLETE_PROGRESS) / (IDENTIFY_REG_COMPLETE_PROGRESS - SUMMARIZATION_COMPLETE_PROGRESS)) * 100)) };
          markFollowingStepsPending(2);
          break;
      case 'assessing_compliance': 
          markPreviousStepsCompleted(3); 
          steps[3] = { ...BASE_ANALYSIS_STEPS[3], status: 'in_progress', progress: Math.max(0, Math.min(100, ((overallProgress - IDENTIFY_REG_COMPLETE_PROGRESS) / (ANALYZE_COMPLIANCE_COMPLETE_PROGRESS - IDENTIFY_REG_COMPLETE_PROGRESS)) * 100)) };
          markFollowingStepsPending(3);
          break;
      case 'reviewing_report':
          markPreviousStepsCompleted(4);
          steps[4] = { ...BASE_ANALYSIS_STEPS[4], status: 'in_progress', progress: Math.max(0, Math.min(100, ((overallProgress - ANALYZE_COMPLIANCE_COMPLETE_PROGRESS) / (REVIEW_REPORT_COMPLETE_PROGRESS - ANALYZE_COMPLIANCE_COMPLETE_PROGRESS)) * 100)) };
          steps[5] = { ...BASE_ANALYSIS_STEPS[5], status: 'pending', progress: 0 }; 
          break;
      case 'completed':
          steps = BASE_ANALYSIS_STEPS.map(s => ({ ...s, status: 'completed', progress: 100 }));
          break;
      case 'error':
          if (overallProgress < UPLOAD_COMPLETE_PROGRESS || !powerQualityDataUrl) { 
              steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'error', details: errorMessage, progress: Math.max(0, Math.min(100, uploadProgress ?? 0))};
              markFollowingStepsPending(0);
          } else if (overallProgress < SUMMARIZATION_COMPLETE_PROGRESS || !powerQualityDataSummary) { 
              markPreviousStepsCompleted(1);
              steps[1] = { ...BASE_ANALYSIS_STEPS[1], status: 'error', details: errorMessage, progress: Math.max(0, Math.min(100, ((overallProgress - UPLOAD_COMPLETE_PROGRESS) / (SUMMARIZATION_COMPLETE_PROGRESS - UPLOAD_COMPLETE_PROGRESS)) * 100 )) };
              markFollowingStepsPending(1);
          } else if (overallProgress < IDENTIFY_REG_COMPLETE_PROGRESS || !identifiedRegulations) { 
              markPreviousStepsCompleted(2);
              steps[2] = { ...BASE_ANALYSIS_STEPS[2], status: 'error', details: errorMessage, progress: Math.max(0, Math.min(100, ((overallProgress - SUMMARIZATION_COMPLETE_PROGRESS) / (IDENTIFY_REG_COMPLETE_PROGRESS - SUMMARIZATION_COMPLETE_PROGRESS)) * 100)) };
              markFollowingStepsPending(2);
          } else if (overallProgress < ANALYZE_COMPLIANCE_COMPLETE_PROGRESS) { 
              markPreviousStepsCompleted(3);
              steps[3] = { ...BASE_ANALYSIS_STEPS[3], status: 'error', details: errorMessage, progress: Math.max(0, Math.min(100, ((overallProgress - IDENTIFY_REG_COMPLETE_PROGRESS) / (ANALYZE_COMPLIANCE_COMPLETE_PROGRESS - IDENTIFY_REG_COMPLETE_PROGRESS)) * 100)) };
              markFollowingStepsPending(3);
          } else if (overallProgress < REVIEW_REPORT_COMPLETE_PROGRESS || !structuredReport) { 
              markPreviousStepsCompleted(4);
              steps[4] = { ...BASE_ANALYSIS_STEPS[4], status: 'error', details: errorMessage, progress: Math.max(0, Math.min(100, ((overallProgress - ANALYZE_COMPLIANCE_COMPLETE_PROGRESS) / (REVIEW_REPORT_COMPLETE_PROGRESS - ANALYZE_COMPLIANCE_COMPLETE_PROGRESS)) * 100)) };
              markFollowingStepsPending(4);
          } else { 
              markPreviousStepsCompleted(5);
              steps[5] = { ...BASE_ANALYSIS_STEPS[5], status: 'error', details: errorMessage, progress: Math.max(0, Math.min(100, ((overallProgress - REVIEW_REPORT_COMPLETE_PROGRESS) / (FINAL_GENERATION_COMPLETE_PROGRESS - REVIEW_REPORT_COMPLETE_PROGRESS)) * 100)) };
          }
          break;
      default:
           steps = BASE_ANALYSIS_STEPS.map(s => ({ ...s, status: 'pending', progress: 0, details: `Status desconhecido: ${status}` }));
  }
  if (steps.slice(1).some(s => s.status === 'completed' || s.status === 'in_progress') && steps[0].status !== 'error') {
    steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'completed', progress: 100 };
  }
  return steps;
}


describe('HomePage - Navigation and Views', () => {
  let mockFetchPastAnalysesInTest: jest.Mock;
  let mockStartAiProcessingInTest: jest.Mock;
  let mockHandleDeleteAnalysisInTest: jest.Mock;
  let mockHandleCancelAnalysisInTest: jest.Mock;
  let mockUploadFileAndCreateRecordInTest: jest.Mock;

  beforeEach(() => {
    mockRouterPush.mockClear();
    mockRouterReplace.mockClear();

    global.mockUseAnalysisManagerReturnValue.currentAnalysis = null;
    global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
    global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
    global.mockUseAnalysisManagerReturnValue.tagInput = '';
    (global.mockUseAnalysisManagerReturnValue.setCurrentAnalysis as jest.Mock).mockClear();
    (global.mockUseAnalysisManagerReturnValue.setTagInput as jest.Mock).mockClear();
    (global.mockUseAnalysisManagerReturnValue.fetchPastAnalyses as jest.Mock).mockClear();
    (global.mockUseAnalysisManagerReturnValue.startAiProcessing as jest.Mock).mockClear();
    (global.mockUseAnalysisManagerReturnValue.handleAddTag as jest.Mock).mockClear();
    (global.mockUseAnalysisManagerReturnValue.handleRemoveTag as jest.Mock).mockClear();
    (global.mockUseAnalysisManagerReturnValue.handleDeleteAnalysis as jest.Mock).mockClear();
    (global.mockUseAnalysisManagerReturnValue.handleCancelAnalysis as jest.Mock).mockClear();
    (global.mockUseAnalysisManagerReturnValue.downloadReportAsTxt as jest.Mock).mockClear();
    global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps = [];

    mockFetchPastAnalysesInTest = jest.fn().mockResolvedValue(undefined);
    mockStartAiProcessingInTest = jest.fn().mockResolvedValue(undefined);
    mockHandleDeleteAnalysisInTest = jest.fn((id, cb) => { cb?.(); return Promise.resolve(); });
    mockHandleCancelAnalysisInTest = jest.fn().mockResolvedValue(undefined);
    mockUploadFileAndCreateRecordInTest = jest.fn().mockResolvedValue({
      analysisId: 'new-analysis-id',
      fileName: 'new-file.csv',
      error: null,
    });

    useAnalysisManager.mockImplementation(() => {
      const currentGlobalAnalysis = global.mockUseAnalysisManagerReturnValue.currentAnalysis;
      return {
        ...global.mockUseAnalysisManagerReturnValue,
        currentAnalysis: currentGlobalAnalysis,
        fetchPastAnalyses: mockFetchPastAnalysesInTest,
        startAiProcessing: mockStartAiProcessingInTest,
        handleDeleteAnalysis: mockHandleDeleteAnalysisInTest,
        handleCancelAnalysis: mockHandleCancelAnalysisInTest,
        displayedAnalysisSteps: calculateDisplayedAnalysisSteps(currentGlobalAnalysis),
      };
    });

    useAuth.mockReturnValue({ user: mockUser, loading: false });
    
    useFileUploadManager.mockImplementation(() => ({
      ...global.mockUseFileUploadManagerReturnValue,
      uploadFileAndCreateRecord: mockUploadFileAndCreateRecordInTest,
    }));
    
    const { getAnalysisReportAction } = jest.requireMock('@/features/report-viewing/actions/reportViewingActions');
    getAnalysisReportAction.mockResolvedValue({
        mdxContent: `# Test Report for ${mockAnalysisItemCompleted.id}`,
        fileName: mockAnalysisItemCompleted.fileName,
        analysisId: mockAnalysisItemCompleted.id,
        error: null,
    });
  });

  test('redirects to /login if user is not authenticated', async () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    render(<HomePage />);
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/login');
    });
  });

  test('renders default view (Past Analyses Accordion) for authenticated user, including AppHeader with "Nova Análise" button', async () => {
    mockFetchPastAnalysesInTest.mockImplementation(async () => {
      global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
      return Promise.resolve(undefined);
    });
    
    render(<HomePage />);
    
    await waitFor(() => expect(mockFetchPastAnalysesInTest).toHaveBeenCalled());

    expect(screen.getByRole('button', { name: /Nova Análise/i })).toBeInTheDocument(); 
    expect(screen.getByText(`Suas Análises Anteriores`)).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma análise anterior encontrada./i)).toBeInTheDocument();
  });

  test('navigates to NewAnalysisForm when "Nova Análise" is clicked and back to Dashboard on cancel', async () => {
    render(<HomePage />);
    await userEvent.click(screen.getByRole('button', { name: /Nova Análise/i }));
    expect(screen.getByText('Nova Análise de Conformidade')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar e Iniciar Análise/i})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(screen.getByText('Suas Análises Anteriores')).toBeInTheDocument();
  });

  test('displays past analyses from seed data in accordion and expands to show AnalysisView', async () => {
    const mockPastAnalysesFromSeed = [mockAnalysisItemCompleted, mockAnalysisItemInProgress];
    
    mockFetchPastAnalysesInTest.mockImplementation(async () => {
      global.mockUseAnalysisManagerReturnValue.pastAnalyses = mockPastAnalysesFromSeed;
      return Promise.resolve(undefined);
    });

    render(<HomePage />);

    await waitFor(() => expect(mockFetchPastAnalysesInTest).toHaveBeenCalled());
    
    await waitFor(() => {
      expect(screen.getByText(mockAnalysisItemCompleted.title!)).toBeInTheDocument();
      expect(screen.getByText(mockAnalysisItemInProgress.title!)).toBeInTheDocument();
    });

    const completedAnalysisAccordionTrigger = screen.getByText(mockAnalysisItemCompleted.title!);
    await userEvent.click(completedAnalysisAccordionTrigger);

    await waitFor(() => {
      expect(global.mockUseAnalysisManagerReturnValue.setCurrentAnalysis as jest.Mock).toHaveBeenCalledWith(mockAnalysisItemCompleted);
      expect(global.mockUseAnalysisManagerReturnValue.currentAnalysis).toEqual(mockAnalysisItemCompleted);
    });
    
    await waitFor(() => {
        const analysisViewTitle = screen.getByText(new RegExp(mockAnalysisItemCompleted.title!, 'i'));
        expect(analysisViewTitle).toBeInTheDocument();
        expect(screen.getByText(/Análise Concluída com Sucesso!/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Visualizar Relatório Detalhado/i})).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  test('navigates to ReportPage when "Visualizar Relatório Detalhado" is clicked', async () => {
    global.mockUseAnalysisManagerReturnValue.currentAnalysis = mockAnalysisItemCompleted;
    global.mockUseAnalysisManagerReturnValue.pastAnalyses = [mockAnalysisItemCompleted];

    render(<HomePage />);
    
    const completedAnalysisAccordionTrigger = screen.getByText(mockAnalysisItemCompleted.title!);
    await userEvent.click(completedAnalysisAccordionTrigger);

    await waitFor(() => {
        expect(screen.getByText(/Análise Concluída com Sucesso!/i)).toBeInTheDocument();
    });

    const viewReportButton = screen.getByRole('button', { name: /Visualizar Relatório Detalhado/i });
    await userEvent.click(viewReportButton);

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith(`/report/${mockAnalysisItemCompleted.id}`);
    });
  });

  test('simulates file upload and navigates to AnalysisView for the new analysis', async () => {
    const newFileName = 'uploaded-test-file.csv';
    const newAnalysisId = `mock-analysis-id-for-${newFileName}`;
    const newAnalysisTitle = 'Freshly Uploaded Analysis';
    
    mockUploadFileAndCreateRecordInTest.mockResolvedValue({
      analysisId: newAnalysisId,
      fileName: newFileName,
      title: newAnalysisTitle,
      error: null,
    });
    
    const handleFileSelectionMock = jest.fn((event) => {
      if (event.target.files && event.target.files[0]) {
        (useFileUploadManager.mock.results[0].value as any).fileToUpload = event.target.files[0];
      }
    });
    useFileUploadManager.mockImplementationOnce(() => ({
        ...global.mockUseFileUploadManagerReturnValue,
        fileToUpload: new File(['col1,col2\nval1,val2'], newFileName, { type: 'text/csv' }),
        handleFileSelection: handleFileSelectionMock,
        uploadFileAndCreateRecord: mockUploadFileAndCreateRecordInTest,
    }));

    render(<HomePage />);

    await userEvent.click(screen.getByRole('button', { name: /Nova Análise/i }));
    await screen.findByText('Nova Análise de Conformidade');
    
    const titleInput = screen.getByLabelText(/Título da Análise/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, newAnalysisTitle);

    const submitButton = screen.getByRole('button', { name: /Enviar e Iniciar Análise/i });
    
    await act(async () => {
      await userEvent.click(submitButton);
    });
    
    await waitFor(() => {
      expect(mockUploadFileAndCreateRecordInTest).toHaveBeenCalledWith(
        mockUser, 
        newAnalysisTitle, 
        '', 
        expect.any(String) 
      );
    });
    
    await waitFor(() => {
      expect(global.mockUseAnalysisManagerReturnValue.setCurrentAnalysis as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: newAnalysisId,
          fileName: newFileName,
          title: newAnalysisTitle,
        })
      );
      expect(global.mockUseAnalysisManagerReturnValue.currentAnalysis?.id).toBe(newAnalysisId);
    });

    await waitFor(() => {
        expect(mockStartAiProcessingInTest).toHaveBeenCalledWith(newAnalysisId, mockUser.uid);
    });
    
    await waitFor(() => {
      const analysisViewForNew = screen.getByText(new RegExp(newAnalysisTitle, "i"));
      expect(analysisViewForNew).toBeInTheDocument();
      expect(screen.getByText(/Sumarizando Dados da Qualidade de Energia/i)).toBeInTheDocument(); 
    });
  });

  test('can delete an analysis from the AnalysisView', async () => {
    global.mockUseAnalysisManagerReturnValue.currentAnalysis = mockAnalysisItemCompleted;
    global.mockUseAnalysisManagerReturnValue.pastAnalyses = [mockAnalysisItemCompleted];
    
    mockFetchPastAnalysesInTest.mockImplementation(async () => {
        global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
        return Promise.resolve(undefined);
    });

    render(<HomePage />);

    const accordionTrigger = screen.getByText(mockAnalysisItemCompleted.title!);
    await userEvent.click(accordionTrigger);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Excluir Análise/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /Excluir Análise/i }));

    await waitFor(() => {
      expect(screen.getByText('Confirmar Exclusão')).toBeInTheDocument();
    });
    const confirmButton = screen.getByRole('button', { name: 'Confirmar Exclusão' });
    
    await act(async () => {
      await userEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(mockHandleDeleteAnalysisInTest).toHaveBeenCalledWith(mockAnalysisItemCompleted.id, expect.any(Function));
    });
    await waitFor(() => {
        expect(mockFetchPastAnalysesInTest).toHaveBeenCalled();
    });
    await waitFor(() => {
        expect(screen.queryByText(mockAnalysisItemCompleted.title!)).not.toBeInTheDocument();
    });
  });
});
