
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from './page';
import { useAuth as originalUseAuth } from '@/contexts/auth-context';
// Import the actual calculateDisplayedAnalysisSteps function
import { calculateDisplayedAnalysisSteps } from '@/features/analysis-processing/utils/analysisStepsUtils';
import type { Analysis } from '@/types/analysis';
// Import Timestamp if it's needed for creating mock data, otherwise remove
// import { Timestamp } from 'firebase/firestore';

// Mocks
jest.mock('@/contexts/auth-context', () => ({
  __esModule: true,
  ...jest.requireActual('@/contexts/auth-context'),
  useAuth: jest.fn(),
}));
const useAuth = originalUseAuth as jest.Mock;

// useAnalysisManager and useFileUploadManager are globally mocked in jest.setup.js
// We will access their return values via global.mockUseAnalysisManagerReturnValue etc.
// and customize their specific function mocks (like fetchPastAnalyses) per test.

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
  // Mocks for functions returned by useAnalysisManager, accessed via global mock
  let mockFetchPastAnalysesGlobal: jest.Mock;
  let mockStartAiProcessingGlobal: jest.Mock;
  let mockHandleDeleteAnalysisGlobal: jest.Mock;
  let mockHandleCancelAnalysisGlobal: jest.Mock;
  let mockSetCurrentAnalysisGlobal: jest.Mock;

  // Mock for function returned by useFileUploadManager
  let mockUploadFileAndCreateRecordGlobal: jest.Mock;
  let mockHandleFileSelectionGlobal: jest.Mock;


  beforeEach(() => {
    mockRouterPush.mockClear();
    mockRouterReplace.mockClear();

    useAuth.mockReturnValue({ user: mockUser, loading: false });

    // Clear and set up global mocks for useAnalysisManager functions
    mockFetchPastAnalysesGlobal = (global.mockUseAnalysisManagerReturnValue.fetchPastAnalyses as jest.Mock).mockClear();
    mockStartAiProcessingGlobal = (global.mockUseAnalysisManagerReturnValue.startAiProcessing as jest.Mock).mockClear();
    mockHandleDeleteAnalysisGlobal = (global.mockUseAnalysisManagerReturnValue.handleDeleteAnalysis as jest.Mock).mockClear();
    mockHandleCancelAnalysisGlobal = (global.mockUseAnalysisManagerReturnValue.handleCancelAnalysis as jest.Mock).mockClear();
    mockSetCurrentAnalysisGlobal = (global.mockUseAnalysisManagerReturnValue.setCurrentAnalysis as jest.Mock).mockClear();
    (global.mockUseAnalysisManagerReturnValue.setTagInput as jest.Mock).mockClear();
    (global.mockUseAnalysisManagerReturnValue.handleAddTag as jest.Mock).mockClear();
    (global.mockUseAnalysisManagerReturnValue.handleRemoveTag as jest.Mock).mockClear();
    (global.mockUseAnalysisManagerReturnValue.downloadReportAsTxt as jest.Mock).mockClear();
    
    // Reset state part of the global mock for useAnalysisManager
    act(() => {
      global.mockUseAnalysisManagerReturnValue.currentAnalysis = null;
      global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
      global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
      global.mockUseAnalysisManagerReturnValue.tagInput = '';
      global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps = [];
    });

    // Clear and set up global mock for useFileUploadManager functions
    mockUploadFileAndCreateRecordGlobal = (global.mockUseFileUploadManagerReturnValue.uploadFileAndCreateRecord as jest.Mock).mockClear();
    mockHandleFileSelectionGlobal = (global.mockUseFileUploadManagerReturnValue.handleFileSelection as jest.Mock).mockClear();

    act(()=>{
      global.mockUseFileUploadManagerReturnValue.fileToUpload = null;
      global.mockUseFileUploadManagerReturnValue.isUploading = false;
      global.mockUseFileUploadManagerReturnValue.uploadProgress = 0;
      global.mockUseFileUploadManagerReturnValue.uploadError = null;
    });
    
    // Default mock for getAnalysisReportAction (can be overridden in specific tests)
    const { getAnalysisReportAction } = jest.requireMock('@/features/report-viewing/actions/reportViewingActions');
    getAnalysisReportAction.mockResolvedValue({
        mdxContent: `# Test Report for an analysis`,
        fileName: "default_mock_file.csv",
        analysisId: "default_mock_id",
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
    const fetchAnalysesPromise = new Promise<void>(resolve => {
        mockFetchPastAnalysesGlobal.mockImplementation(async () => {
            act(() => { // Use act for state updates inside the mock
                global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = true;
            });
            // Simulate async data fetching
            await new Promise(r => setTimeout(r, 0)); // Short delay to simulate async
            act(() => { // Use act for state updates inside the mock
                global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
                global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
            });
            resolve();
        });
    });
    
    await act(async () => {
      render(<HomePage />); 
    });
    
    await act(async () => { 
      await fetchAnalysesPromise;
    });

    expect(screen.getByRole('button', { name: /Nova Análise/i })).toBeInTheDocument(); 
    expect(screen.getByText(`Suas Análises Anteriores`)).toBeInTheDocument();
    expect(await screen.findByText(/Nenhuma análise anterior encontrada./i)).toBeInTheDocument();
  });

  test('navigates to NewAnalysisForm when "Nova Análise" is clicked and back to Dashboard on cancel', async () => {
    mockFetchPastAnalysesGlobal.mockImplementation(async () => { // Ensure fetchPastAnalyses is mocked for initial render
      act(() => {
        global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
        global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
      });
      return Promise.resolve(undefined);
    });

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
    
    const fetchAnalysesPromise = new Promise<void>(resolve => {
      mockFetchPastAnalysesGlobal.mockImplementation(async () => {
        act(() => {
          global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = true;
        });
        await new Promise(r => setTimeout(r, 0));
        act(() => { 
          global.mockUseAnalysisManagerReturnValue.pastAnalyses = mockPastAnalysesFromSeed;
          global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
        });
        resolve(); 
      });
    });
    
    await act(async () => {
      render(<HomePage />); 
    });

    await act(async () => { 
      await fetchAnalysesPromise;
    });
    
    expect(await screen.findByText(mockAnalysisItemCompleted.title!)).toBeInTheDocument();
    expect(await screen.findByText(mockAnalysisItemInProgress.title!)).toBeInTheDocument();

    const completedAnalysisAccordionTrigger = await screen.findByText(mockAnalysisItemCompleted.title!);
    
    await act(async () => {
      await userEvent.click(completedAnalysisAccordionTrigger);
    });
    
    await act(async () => {
        global.mockUseAnalysisManagerReturnValue.currentAnalysis = mockAnalysisItemCompleted;
        global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps = calculateDisplayedAnalysisSteps(mockAnalysisItemCompleted);
    });
    
    await waitFor(() => {
        const analysisViewTitle = screen.getByText(new RegExp(mockAnalysisItemCompleted.title!, 'i'));
        expect(analysisViewTitle).toBeInTheDocument(); 
        expect(screen.getByText(/Análise Concluída com Sucesso!/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Visualizar Relatório Detalhado/i})).toBeInTheDocument();
    });
  });


  test('navigates to ReportPage when "Visualizar Relatório Detalhado" is clicked', async () => {
    const fetchAnalysesPromise = new Promise<void>(resolve => {
      mockFetchPastAnalysesGlobal.mockImplementation(async () => {
        act(() => {
          global.mockUseAnalysisManagerReturnValue.pastAnalyses = [mockAnalysisItemCompleted];
          global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
        });
        resolve();
        return Promise.resolve(undefined);
      });
    });

    await act(async () => {
      render(<HomePage />);
    });
    
    await act(async () => {
      await fetchAnalysesPromise;
    });
    
    const completedAnalysisAccordionTrigger = await screen.findByText(mockAnalysisItemCompleted.title!);
    await act(async () => {
      await userEvent.click(completedAnalysisAccordionTrigger);
    });

    await act(async () => {
      global.mockUseAnalysisManagerReturnValue.currentAnalysis = mockAnalysisItemCompleted;
      global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps = calculateDisplayedAnalysisSteps(mockAnalysisItemCompleted);
    });

    await waitFor(() => {
        expect(screen.getByText(/Análise Concluída com Sucesso!/i)).toBeInTheDocument();
    });

    const viewReportButton = screen.getByRole('link', { name: /Visualizar Relatório Detalhado/i });
    await userEvent.click(viewReportButton);

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith(`/report/${mockAnalysisItemCompleted.id}`);
    });
  });

  test('simulates file upload and navigates to AnalysisView for the new analysis', async () => {
    const newFileName = 'uploaded-test-file.csv';
    const newAnalysisId = `mock-analysis-id-for-${newFileName}`;
    const newAnalysisTitle = 'Freshly Uploaded Analysis';
    const mockFile = new File(['col1,col2\nval1,val2'], newFileName, { type: 'text/csv' });
    
    mockUploadFileAndCreateRecordGlobal.mockResolvedValue({
      analysisId: newAnalysisId,
      fileName: newFileName,
      title: newAnalysisTitle,
      error: null,
    });

    mockStartAiProcessingGlobal.mockResolvedValue(undefined);
    
    // Ensure fetchPastAnalyses is mocked for the initial render of HomePage
    mockFetchPastAnalysesGlobal.mockImplementation(async () => {
      act(() => {
        global.mockUseAnalysisManagerReturnValue.pastAnalyses = []; // Start with no past analyses
        global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
      });
      return Promise.resolve(undefined);
    });
    
    const handleFileSelectionMock = jest.fn((eventOrFile) => {
      let fileToSet: File | null = null;
      if (eventOrFile instanceof File) {
        fileToSet = eventOrFile;
      } else if (eventOrFile && eventOrFile.target && eventOrFile.target.files && eventOrFile.target.files[0]) {
        fileToSet = eventOrFile.target.files[0];
      }
      act(() => {
          (global.mockUseFileUploadManagerReturnValue as any).fileToUpload = fileToSet;
      });
    });
    // Correctly assign to useFileUploadManager's handleFileSelection
    (global.mockUseFileUploadManagerReturnValue.handleFileSelection as jest.Mock).mockImplementation(handleFileSelectionMock);


    await act(async () => {
      render(<HomePage />);
    });

    await userEvent.click(screen.getByRole('button', { name: /Nova Análise/i }));
    const newAnalysisFormTitle = await screen.findByText('Nova Análise de Conformidade');
    expect(newAnalysisFormTitle).toBeInTheDocument();
    
    const fileInput = screen.getByLabelText(/Arquivo CSV de Dados/i);
    await userEvent.upload(fileInput, mockFile);
    // Directly call the mocked function to ensure state update in the hook
    handleFileSelectionMock({ target: { files: [mockFile] } } as any);

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
      expect(mockUploadFileAndCreateRecordGlobal).toHaveBeenCalledWith(
        mockUser, 
        newAnalysisTitle, 
        '', 
        expect.any(String) 
      );
    });
    
    const uploadedAnalysisData: Partial<Analysis> = {
        id: newAnalysisId,
        userId: mockUser.uid,
        fileName: newFileName,
        title: newAnalysisTitle,
        status: 'summarizing_data', 
        progress: 10, 
        uploadProgress: 100,
        createdAt: new Date().toISOString(),
        tags: []
    };

    await waitFor(() => {
        expect(mockSetCurrentAnalysisGlobal).toHaveBeenCalledWith(expect.objectContaining({ id: newAnalysisId }));
        act(() => {
            global.mockUseAnalysisManagerReturnValue.currentAnalysis = uploadedAnalysisData as Analysis;
            global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps = calculateDisplayedAnalysisSteps(uploadedAnalysisData as Analysis);
        });
    });
    
    await waitFor(() => {
        expect(mockStartAiProcessingGlobal).toHaveBeenCalledWith(newAnalysisId, mockUser.uid);
    });
    
    await waitFor(async () => {
      const analysisViewForNew = await screen.findByText(new RegExp(newAnalysisTitle, "i"));
      expect(analysisViewForNew).toBeInTheDocument();
      expect(screen.getByText(/Upload do Arquivo e Preparação/i)).toBeInTheDocument();
      expect(screen.getByText(/Sumarizando Dados da Qualidade de Energia/i)).toBeInTheDocument(); 
    });
  });

  test('can delete an analysis from the AnalysisView', async () => {
    let resolveFetchAnalysesFirstCall: () => void;
    const fetchAnalysesFirstCallPromise = new Promise<void>(resolve => {
      resolveFetchAnalysesFirstCall = resolve;
    });

    let resolveFetchAnalysesSecondCall: () => void;
    const fetchAnalysesSecondCallPromise = new Promise<void>(resolve => {
      resolveFetchAnalysesSecondCall = resolve;
    });
    
    mockFetchPastAnalysesGlobal
      .mockImplementationOnce(async () => {
        act(() => {
          global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = true;
        });
        await new Promise(r => setTimeout(r,0)); // simulate async
        act(() => {
          global.mockUseAnalysisManagerReturnValue.pastAnalyses = [mockAnalysisItemCompleted];
          global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
        });
        resolveFetchAnalysesFirstCall();
        return Promise.resolve(undefined);
      })
      .mockImplementationOnce(async () => {
        act(() => {
          global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = true;
        });
        await new Promise(r => setTimeout(r,0)); // simulate async
        act(() => {
          global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
          global.mockUseAnalysisManagerReturnValue.currentAnalysis = null;
          global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
        });
        resolveFetchAnalysesSecondCall();
        return Promise.resolve(undefined);
      });
  
    mockHandleDeleteAnalysisGlobal.mockImplementation(async (id, cb) => {
      cb?.(); // This will call fetchPastAnalyses (which uses the second mock)
      return Promise.resolve();
    });
  
    await act(async () => {
      render(<HomePage />);
    });

    await act(async () => {
      await fetchAnalysesFirstCallPromise;
    });
    
    const accordionTrigger = await screen.findByText(mockAnalysisItemCompleted.title!);
    await act(async () => {
      await userEvent.click(accordionTrigger);
    });
  
    await act(async () => {
        global.mockUseAnalysisManagerReturnValue.currentAnalysis = mockAnalysisItemCompleted;
        global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps = calculateDisplayedAnalysisSteps(mockAnalysisItemCompleted);
    });
  
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
      expect(mockHandleDeleteAnalysisGlobal).toHaveBeenCalledWith(mockAnalysisItemCompleted.id, expect.any(Function));
    });

    await act(async () => {
      await fetchAnalysesSecondCallPromise;
    });

    await waitFor(() => {
      expect(screen.getByText(/Nenhuma análise anterior encontrada./i)).toBeInTheDocument();
    });
    expect(global.mockUseAnalysisManagerReturnValue.currentAnalysis).toBeNull();
  });
});

    