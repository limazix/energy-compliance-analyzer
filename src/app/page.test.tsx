
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from './page';
import { useAuth as originalUseAuth } from '@/contexts/auth-context';
import { useAnalysisManager as originalUseAnalysisManagerHook } from '@/hooks/useAnalysisManager';
import { useFileUploadManager as originalUseFileUploadManager } from '@/features/file-upload/hooks/useFileUploadManager';
import type { Analysis, AnalysisStep } from '@/types/analysis';
import { Timestamp } from 'firebase/firestore';
import { calculateDisplayedAnalysisSteps } from '@/features/analysis-processing/utils/analysisStepsUtils';

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

describe('HomePage - Navigation and Views', () => {
  let mockFetchPastAnalysesInTest: jest.Mock;
  let mockStartAiProcessingInTest: jest.Mock;
  let mockHandleDeleteAnalysisInTest: jest.Mock;
  let mockHandleCancelAnalysisInTest: jest.Mock;
  let mockUploadFileAndCreateRecordInTest: jest.Mock;
  let currentPastAnalysesState: Analysis[] = []; // To hold the state for the mock

  beforeEach(() => {
    mockRouterPush.mockClear();
    mockRouterReplace.mockClear();

    currentPastAnalysesState = [];

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

    mockFetchPastAnalysesInTest = jest.fn().mockImplementation(async (seedData?: Analysis[]) => {
      await act(async () => {
        currentPastAnalysesState = seedData || [];
        global.mockUseAnalysisManagerReturnValue.pastAnalyses = currentPastAnalysesState;
        global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
      });
      return Promise.resolve(undefined);
    });
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
        pastAnalyses: currentPastAnalysesState,
        fetchPastAnalyses: (dataToSeed?: Analysis[]) => mockFetchPastAnalysesInTest(dataToSeed),
        startAiProcessing: mockStartAiProcessingInTest,
        handleDeleteAnalysis: mockHandleDeleteAnalysisInTest,
        handleCancelAnalysis: mockHandleCancelAnalysisInTest,
        currentAnalysis: currentGlobalAnalysis,
        displayedAnalysisSteps: calculateDisplayedAnalysisSteps(currentGlobalAnalysis),
      };
    });

    useAuth.mockReturnValue({ user: mockUser, loading: false });
    
    // Default mock for useFileUploadManager, can be overridden per test
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
    await act(async () => {
      render(<HomePage />);
    });
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/login');
    });
  });

  test('renders default view (Past Analyses Accordion) for authenticated user, including AppHeader with "Nova Análise" button', async () => {
    await act(async () => {
      render(<HomePage />);
    });
    
    await waitFor(() => expect(mockFetchPastAnalysesInTest).toHaveBeenCalled());

    expect(screen.getByRole('button', { name: /Nova Análise/i })).toBeInTheDocument(); 
    expect(screen.getByText(`Suas Análises Anteriores`)).toBeInTheDocument();
    expect(await screen.findByText(/Nenhuma análise anterior encontrada./i)).toBeInTheDocument();
  });

  test('navigates to NewAnalysisForm when "Nova Análise" is clicked and back to Dashboard on cancel', async () => {
    await act(async () => {
      render(<HomePage />);
    });
    await userEvent.click(screen.getByRole('button', { name: /Nova Análise/i }));
    expect(screen.getByText('Nova Análise de Conformidade')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar e Iniciar Análise/i})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(screen.getByText('Suas Análises Anteriores')).toBeInTheDocument();
  });

  test('displays past analyses from seed data in accordion and expands to show AnalysisView', async () => {
    const mockPastAnalysesFromSeed = [mockAnalysisItemCompleted, mockAnalysisItemInProgress];
    
    await act(async () => {
      render(<HomePage />);
    });

    await act(async () => {
        await mockFetchPastAnalysesInTest(mockPastAnalysesFromSeed);
    });
    
    expect(await screen.findByText(mockAnalysisItemCompleted.title!)).toBeInTheDocument();
    expect(await screen.findByText(mockAnalysisItemInProgress.title!)).toBeInTheDocument();

    const completedAnalysisAccordionTrigger = await screen.findByText(mockAnalysisItemCompleted.title!);
    await userEvent.click(completedAnalysisAccordionTrigger);

    await waitFor(() => {
      expect(global.mockUseAnalysisManagerReturnValue.setCurrentAnalysis as jest.Mock).toHaveBeenCalledWith(mockAnalysisItemCompleted);
      expect(global.mockUseAnalysisManagerReturnValue.currentAnalysis).toEqual(mockAnalysisItemCompleted);
    });
    
    await waitFor(() => {
        const analysisViewTitle = screen.getByText(new RegExp(mockAnalysisItemCompleted.title!, 'i'));
        expect(analysisViewTitle).toBeInTheDocument();
        expect(screen.getByText(/Análise Concluída com Sucesso!/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Visualizar Relatório Detalhado/i})).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  test('navigates to ReportPage when "Visualizar Relatório Detalhado" is clicked', async () => {
    await act(async () => {
      global.mockUseAnalysisManagerReturnValue.currentAnalysis = mockAnalysisItemCompleted;
      currentPastAnalysesState = [mockAnalysisItemCompleted];
      global.mockUseAnalysisManagerReturnValue.pastAnalyses = [mockAnalysisItemCompleted];
    });

    await act(async () => {
      render(<HomePage />);
    });
    
    const completedAnalysisAccordionTrigger = await screen.findByText(mockAnalysisItemCompleted.title!);
    await userEvent.click(completedAnalysisAccordionTrigger);

    await waitFor(() => {
        expect(screen.getByText(/Análise Concluída com Sucesso!/i)).toBeInTheDocument();
    });

    const viewReportLink = screen.getByRole('link', { name: /Visualizar Relatório Detalhado/i });
    await userEvent.click(viewReportLink);

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith(`/report/${mockAnalysisItemCompleted.id}`);
    });
  });

  test('simulates file upload and navigates to AnalysisView for the new analysis', async () => {
    const newFileName = 'uploaded-test-file.csv';
    const newAnalysisId = `mock-analysis-id-for-${newFileName}`;
    const newAnalysisTitle = 'Freshly Uploaded Analysis';
    const mockFile = new File(['col1,col2\nval1,val2'], newFileName, { type: 'text/csv' });
    
    mockUploadFileAndCreateRecordInTest.mockResolvedValue({
      analysisId: newAnalysisId,
      fileName: newFileName,
      title: newAnalysisTitle, // Assuming uploadFileAndCreateRecord might return this
      error: null,
    });
    
    // This mock setup is key for the test
    const handleFileSelectionMock = jest.fn((eventOrFile) => {
      let fileToSet: File | null = null;
      if (eventOrFile instanceof File) { // Direct file object
        fileToSet = eventOrFile;
      } else if (eventOrFile && eventOrFile.target && eventOrFile.target.files && eventOrFile.target.files[0]) { // Event object
        fileToSet = eventOrFile.target.files[0];
      }
      act(() => {
          (global.mockUseFileUploadManagerReturnValue as any).fileToUpload = fileToSet;
      });
    });

    useFileUploadManager.mockImplementationOnce(() => ({
        ...global.mockUseFileUploadManagerReturnValue,
        fileToUpload: null, // Start with no file
        handleFileSelection: handleFileSelectionMock,
        uploadFileAndCreateRecord: mockUploadFileAndCreateRecordInTest,
    }));

    await act(async () => {
      render(<HomePage />);
    });

    await userEvent.click(screen.getByRole('button', { name: /Nova Análise/i }));
    const newAnalysisFormTitle = await screen.findByText('Nova Análise de Conformidade');
    expect(newAnalysisFormTitle).toBeInTheDocument();
    
    // Simulate file selection
    const fileInput = screen.getByLabelText(/Arquivo CSV de Dados/i);
    await act(async () => {
      await userEvent.upload(fileInput, mockFile);
      // Call the mock handleFileSelection if userEvent.upload doesn't trigger the hook's one
      // This depends on how userEvent.upload interacts with the Input component's onChange
      // Forcing the call to ensure the hook's state is updated:
      handleFileSelectionMock({ target: { files: [mockFile] } } as any); 
    });

    // Wait for the title to be auto-populated from filename
    await waitFor(() => {
      expect(screen.getByLabelText(/Título da Análise/i)).toHaveValue(newFileName);
    });
    
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
        '', // description
        expect.any(String) // languageCode
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
    
    await waitFor(async () => {
      const analysisViewForNew = await screen.findByText(new RegExp(newAnalysisTitle, "i"));
      expect(analysisViewForNew).toBeInTheDocument();
      expect(screen.getByText(/Upload do Arquivo e Preparação/i)).toBeInTheDocument();
      expect(screen.getByText(/Sumarizando Dados da Qualidade de Energia/i)).toBeInTheDocument(); 
    });
  });

  test('can delete an analysis from the AnalysisView', async () => {
     await act(async () => {
        global.mockUseAnalysisManagerReturnValue.currentAnalysis = mockAnalysisItemCompleted;
        currentPastAnalysesState = [mockAnalysisItemCompleted];
        global.mockUseAnalysisManagerReturnValue.pastAnalyses = [mockAnalysisItemCompleted];
     });
    
    mockFetchPastAnalysesInTest.mockImplementation(async () => {
      await act(async () => {
        currentPastAnalysesState = [];
        global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
      });
      return Promise.resolve(undefined);
    });

    await act(async () => {
      render(<HomePage />);
    });

    const accordionTrigger = await screen.findByText(mockAnalysisItemCompleted.title!);
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
        expect(screen.getByText(/Nenhuma análise anterior encontrada./i)).toBeInTheDocument();
    });
  });
});

    