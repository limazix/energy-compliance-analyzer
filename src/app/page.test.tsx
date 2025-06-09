
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


  beforeEach(() => {
    mockRouterPush.mockClear();
    mockRouterReplace.mockClear();

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
    
    // Reset state part of the global mock
    act(() => {
      global.mockUseAnalysisManagerReturnValue.currentAnalysis = null;
      global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
      global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
      global.mockUseAnalysisManagerReturnValue.tagInput = '';
      global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps = [];
    });

    // Clear and set up global mock for useFileUploadManager function
    mockUploadFileAndCreateRecordGlobal = (global.mockUseFileUploadManagerReturnValue.uploadFileAndCreateRecord as jest.Mock).mockClear();
    (global.mockUseFileUploadManagerReturnValue.handleFileSelection as jest.Mock).mockClear();
    act(()=>{
      global.mockUseFileUploadManagerReturnValue.fileToUpload = null;
      global.mockUseFileUploadManagerReturnValue.isUploading = false;
      global.mockUseFileUploadManagerReturnValue.uploadProgress = 0;
      global.mockUseFileUploadManagerReturnValue.uploadError = null;
    });


    useAuth.mockReturnValue({ user: mockUser, loading: false });
    
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
    // Mock fetchPastAnalyses to return empty initially
    mockFetchPastAnalysesGlobal.mockImplementation(async () => {
      await act(async () => {
        global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
        global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
      });
      return Promise.resolve(undefined);
    });
    global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = true;


    await act(async () => {
      render(<HomePage />);
    });
    
    await waitFor(() => expect(mockFetchPastAnalysesGlobal).toHaveBeenCalled());

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
    
    // This promise will resolve when the mock fetch function has updated the state
    const fetchAnalysesPromise = new Promise<void>(resolve => {
      mockFetchPastAnalysesGlobal.mockImplementation(async () => {
        // Simulate the hook's behavior: set loading true, then update data and set loading false
        act(() => { // This act is for isLoadingPastAnalyses = true potentially
          global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = true;
        });
        await act(async () => { // This act is for the actual data update
          global.mockUseAnalysisManagerReturnValue.pastAnalyses = mockPastAnalysesFromSeed;
          global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
        });
        resolve(); // Signal that data is "loaded"
        return Promise.resolve(undefined);
      });
    });

    // Set initial state for the hook before HomePage mounts
    act(() => {
        global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
        global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = true; // Start in loading state
    });
    
    render(<HomePage />); // HomePage mounts and its useEffect calls fetchPastAnalyses

    await act(async () => { // Wait for the fetch and subsequent state updates to complete
      await fetchAnalysesPromise;
    });

    expect(await screen.findByText(mockAnalysisItemCompleted.title!)).toBeInTheDocument();
    expect(await screen.findByText(mockAnalysisItemInProgress.title!)).toBeInTheDocument();

    const completedAnalysisAccordionTrigger = await screen.findByText(mockAnalysisItemCompleted.title!);
    await userEvent.click(completedAnalysisAccordionTrigger);

    await waitFor(() => {
      expect(mockSetCurrentAnalysisGlobal).toHaveBeenCalledWith(mockAnalysisItemCompleted);
    });
    
    // Update the global mock to reflect setCurrentAnalysis call for subsequent assertions
    act(() => {
        global.mockUseAnalysisManagerReturnValue.currentAnalysis = mockAnalysisItemCompleted;
        // Recalculate displayedSteps based on the new currentAnalysis
        global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps = calculateDisplayedAnalysisSteps(mockAnalysisItemCompleted);
    });
    
    await waitFor(() => {
        const analysisViewTitle = screen.getByText(new RegExp(mockAnalysisItemCompleted.title!, 'i'));
        expect(analysisViewTitle).toBeInTheDocument();
        expect(screen.getByText(/Análise Concluída com Sucesso!/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Visualizar Relatório Detalhado/i})).toBeInTheDocument();
    }, { timeout: 5000 });
  });


  test('navigates to ReportPage when "Visualizar Relatório Detalhado" is clicked', async () => {
    // Setup: Current analysis is the completed one, and it's in past analyses
    act(() => {
      global.mockUseAnalysisManagerReturnValue.currentAnalysis = mockAnalysisItemCompleted;
      global.mockUseAnalysisManagerReturnValue.pastAnalyses = [mockAnalysisItemCompleted];
      global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
      global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps = calculateDisplayedAnalysisSteps(mockAnalysisItemCompleted);
    });

    // Mock fetchPastAnalyses to do nothing further for this specific test, data is already set
    mockFetchPastAnalysesGlobal.mockResolvedValue(undefined);

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
    
    mockUploadFileAndCreateRecordGlobal.mockResolvedValue({
      analysisId: newAnalysisId,
      fileName: newFileName,
      title: newAnalysisTitle,
      error: null,
    });

    // Mock startAiProcessing, as it's called after upload
    mockStartAiProcessingGlobal.mockResolvedValue(undefined);
    
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
    (global.mockUseFileUploadManagerReturnValue.handleFileSelection as jest.Mock).mockImplementation(handleFileSelectionMock);


    await act(async () => {
      render(<HomePage />);
    });

    await userEvent.click(screen.getByRole('button', { name: /Nova Análise/i }));
    const newAnalysisFormTitle = await screen.findByText('Nova Análise de Conformidade');
    expect(newAnalysisFormTitle).toBeInTheDocument();
    
    const fileInput = screen.getByLabelText(/Arquivo CSV de Dados/i);
    // Simulate file selection by calling the mocked handler after userEvent.upload
    // as userEvent.upload itself might not trigger the exact react state change pathway
    // with the multiple layers of mocks.
    await userEvent.upload(fileInput, mockFile);
    handleFileSelectionMock({ target: { files: [mockFile] } } as any);

    await waitFor(() => {
      expect(screen.getByLabelText(/Título da Análise/i)).toHaveValue(newFileName);
    });
    
    const titleInput = screen.getByLabelText(/Título da Análise/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, newAnalysisTitle);

    const submitButton = screen.getByRole('button', { name: /Enviar e Iniciar Análise/i });
    
    await userEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockUploadFileAndCreateRecordGlobal).toHaveBeenCalledWith(
        mockUser, 
        newAnalysisTitle, 
        '', 
        expect.any(String) 
      );
    });
    
    // After upload, HomePage's handleUploadResult fetches the new analysis doc
    // and calls setCurrentAnalysis. We need to simulate this.
    const uploadedAnalysisData: Partial<Analysis> = {
        id: newAnalysisId,
        userId: mockUser.uid,
        fileName: newFileName,
        title: newAnalysisTitle,
        status: 'summarizing_data', // Initial status after successful upload record finalization
        progress: 10, // From UPLOAD_COMPLETED_OVERALL_PROGRESS
        uploadProgress: 100,
        createdAt: new Date().toISOString(),
        tags: []
    };

    // Mock that setCurrentAnalysis gets called with the new data
    // And that startAiProcessing is called
    await waitFor(() => {
        expect(mockSetCurrentAnalysisGlobal).toHaveBeenCalledWith(expect.objectContaining({ id: newAnalysisId }));
    });
    
    // Simulate the effect of setCurrentAnalysis and startAiProcessing for the UI
    act(() => {
        global.mockUseAnalysisManagerReturnValue.currentAnalysis = uploadedAnalysisData as Analysis;
        global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps = calculateDisplayedAnalysisSteps(uploadedAnalysisData as Analysis);
    });
    
    await waitFor(() => {
        expect(mockStartAiProcessingGlobal).toHaveBeenCalledWith(newAnalysisId, mockUser.uid);
    });
    
    await waitFor(async () => {
      const analysisViewForNew = await screen.findByText(new RegExp(newAnalysisTitle, "i"));
      expect(analysisViewForNew).toBeInTheDocument();
      // Check for steps based on 'summarizing_data' status
      expect(screen.getByText(/Upload do Arquivo e Preparação/i)).toBeInTheDocument();
      expect(screen.getByText(/Sumarizando Dados da Qualidade de Energia/i)).toBeInTheDocument(); 
    }, {timeout: 7000});
  });

  test('can delete an analysis from the AnalysisView', async () => {
    act(() => {
        global.mockUseAnalysisManagerReturnValue.currentAnalysis = mockAnalysisItemCompleted;
        global.mockUseAnalysisManagerReturnValue.pastAnalyses = [mockAnalysisItemCompleted];
        global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
        global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps = calculateDisplayedAnalysisSteps(mockAnalysisItemCompleted);
    });
    
    mockFetchPastAnalysesGlobal.mockImplementation(async () => {
      await act(async () => {
        global.mockUseAnalysisManagerReturnValue.pastAnalyses = []; // Simulate removal from list
        global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
      });
      return Promise.resolve(undefined);
    });
    mockHandleDeleteAnalysisGlobal.mockImplementation(async (id, cb) => { cb?.(); return Promise.resolve(); });


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
    
    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockHandleDeleteAnalysisGlobal).toHaveBeenCalledWith(mockAnalysisItemCompleted.id, expect.any(Function));
    });
    await waitFor(() => {
        expect(mockFetchPastAnalysesGlobal).toHaveBeenCalled(); // Ensure list is refetched
    });
    await waitFor(() => {
        expect(screen.getByText(/Nenhuma análise anterior encontrada./i)).toBeInTheDocument();
    });
  });
});

    
