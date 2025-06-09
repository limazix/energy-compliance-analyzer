
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
  ...jest.requireActual('@/contexts/auth-context'), // Important to get the actual AuthProvider
  useAuth: jest.fn(), // This is what tests will override for components consuming the context
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

  // Firebase auth mock helper from jest.setup.js
  let setMockUserForAuthStateChangedListener: (user: any) => void;


  beforeEach(async () => {
    mockRouterPush.mockClear();
    mockRouterReplace.mockClear();

    // Ensure the mock for firebase/auth is imported for __setMockUserForAuthStateChangedListener
    const authMockModule = require('firebase/auth');
    setMockUserForAuthStateChangedListener = authMockModule.__setMockUserForAuthStateChangedListener;

    // Set up auth state for AuthProvider: User is logged in
    // This will make onAuthStateChanged in AuthProvider receive mockUser
    await act(async () => {
      if (setMockUserForAuthStateChangedListener) {
        setMockUserForAuthStateChangedListener(mockUser);
      } else {
        // Fallback or error if the helper isn't found, though it should be.
        console.error("ERROR IN TEST SETUP: __setMockUserForAuthStateChangedListener is not available on auth mock.");
      }
    });

    // This mock is for components consuming useAuth directly
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
      global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false; // Default to false, tests can override if they start loading
      global.mockUseAnalysisManagerReturnValue.tagInput = '';
      global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps = [];
    });

    // Clear and set up global mock for useFileUploadManager functions
    mockUploadFileAndCreateRecordGlobal = (global.mockUseFileUploadManagerReturnValue.uploadFileAndCreateRecord as jest.Mock).mockClear();
    mockHandleFileSelectionGlobal = (global.mockUseAnalysisManagerReturnValue.handleFileSelection as jest.Mock).mockClear();

    act(() => {
      global.mockUseFileUploadManagerReturnValue.fileToUpload = null;
      global.mockUseFileUploadManagerReturnValue.isUploading = false;
      global.mockUseFileUploadManagerReturnValue.uploadProgress = 0;
      global.mockUseFileUploadManagerReturnValue.uploadError = null;
    });

    // Default mock implementation for fetchPastAnalyses if not overridden by specific tests
    mockFetchPastAnalysesGlobal.mockImplementation(async () => {
      await act(async () => { // Ensure state updates are wrapped
        global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
        // IMPORTANT: Ensure pastAnalyses is initialized for default cases
        if (!global.mockUseAnalysisManagerReturnValue.pastAnalyses) {
            global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
        }
      });
      return Promise.resolve(undefined);
    });

    const { getAnalysisReportAction } = jest.requireMock('@/features/report-viewing/actions/reportViewingActions');
    getAnalysisReportAction.mockResolvedValue({
        mdxContent: `# Test Report for an analysis`,
        fileName: "default_mock_file.csv",
        analysisId: "default_mock_id",
        error: null,
    });
  });

  test('redirects to /login if user is not authenticated', async () => {
    // Set AuthProvider to report no user
    await act(async () => {
      setMockUserForAuthStateChangedListener(null);
    });
    // And useAuth hook to reflect no user and not loading
    useAuth.mockReturnValue({ user: null, loading: false });

    await act(async () => {
        render(<HomePage />);
    });
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/login');
    });
  });

  test('renders default view (Past Analyses Accordion) for authenticated user, including AppHeader with "Nova Análise" button', async () => {
    // Mock fetchPastAnalyses to ensure it sets isLoading to false and pastAnalyses to []
    let initialFetchCompletedPromiseResolve: () => void;
    const initialFetchCompletedPromise = new Promise<void>(resolve => { initialFetchCompletedPromiseResolve = resolve; });

    mockFetchPastAnalysesGlobal.mockImplementation(async () => {
      await act(async () => {
        global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
        global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
      });
      initialFetchCompletedPromiseResolve();
    });
    
    await act(async () => {
      render(<HomePage />);
    });
    
    await act(async () => {
      await initialFetchCompletedPromise; // Wait for the mock fetch to "complete"
    });

    expect(screen.getByRole('button', { name: /Nova Análise/i })).toBeInTheDocument();
    expect(screen.getByText(`Suas Análises Anteriores`)).toBeInTheDocument();
    expect(await screen.findByText(/Nenhuma análise anterior encontrada./i)).toBeInTheDocument();
  });

  test('navigates to NewAnalysisForm when "Nova Análise" is clicked and back to Dashboard on cancel', async () => {
    let initialFetchCompletedPromiseResolve: () => void;
    const initialFetchCompletedPromise = new Promise<void>(resolve => { initialFetchCompletedPromiseResolve = resolve; });
    mockFetchPastAnalysesGlobal.mockImplementation(async () => {
      await act(async () => {
        global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
        global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
      });
      initialFetchCompletedPromiseResolve();
    });

    await act(async () => {
      render(<HomePage />);
    });
    await act(async () => { await initialFetchCompletedPromise; });


    await userEvent.click(screen.getByRole('button', { name: /Nova Análise/i }));
    expect(screen.getByText('Nova Análise de Conformidade')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar e Iniciar Análise/i})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(screen.getByText('Suas Análises Anteriores')).toBeInTheDocument();
  });

  test('displays past analyses from seed data in accordion and expands to show AnalysisView', async () => {
    let fetchAnalysesPromiseResolve: () => void;
    const fetchAnalysesPromise = new Promise<void>(resolve => { fetchAnalysesPromiseResolve = resolve; });

    mockFetchPastAnalysesGlobal.mockImplementation(async () => {
        await act(async () => { // Wrap state updates in act
            global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = true;
        });
        await new Promise(r => setTimeout(r, 10));
        await act(async () => { // Wrap state updates in act
            global.mockUseAnalysisManagerReturnValue.pastAnalyses = [mockAnalysisItemCompleted, mockAnalysisItemInProgress];
            global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
        });
        if (fetchAnalysesPromiseResolve) fetchAnalysesPromiseResolve();
    });

    await act(async () => {
      render(<HomePage />);
    });

    await act(async () => { // Wait for the fetchAnalysesPromise to resolve
      await fetchAnalysesPromise;
    });

    expect(await screen.findByText(mockAnalysisItemCompleted.title!)).toBeInTheDocument();
    expect(await screen.findByText(mockAnalysisItemInProgress.title!)).toBeInTheDocument();

    const completedAnalysisAccordionTrigger = await screen.findByText(mockAnalysisItemCompleted.title!);

    await act(async () => {
      await userEvent.click(completedAnalysisAccordionTrigger);
      // Simulate what useAnalysisManager would do on accordion change and what HomePage does
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
    let fetchAnalysesPromiseResolve: () => void;
    const fetchAnalysesPromise = new Promise<void>(resolve => { fetchAnalysesPromiseResolve = resolve; });

    mockFetchPastAnalysesGlobal.mockImplementation(async () => {
        await act(async () => { global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = true; });
        await new Promise(r => setTimeout(r, 10));
        await act(async () => {
          global.mockUseAnalysisManagerReturnValue.pastAnalyses = [mockAnalysisItemCompleted];
          global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
        });
        if (fetchAnalysesPromiseResolve) fetchAnalysesPromiseResolve();
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

    let initialFetchAnalysesPromiseResolve: () => void;
    const initialFetchAnalysesPromise = new Promise<void>(resolve => { initialFetchAnalysesPromiseResolve = resolve; });

    mockFetchPastAnalysesGlobal.mockImplementation(async () => {
      await act(async () => { // Ensure state updates are wrapped
        global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
        global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
      });
      if (initialFetchAnalysesPromiseResolve) initialFetchAnalysesPromiseResolve();
      return Promise.resolve(undefined);
    });

    const handleFileSelectionMockImpl = (eventOrFile: any) => {
      let fileToSet: File | null = null;
      if (eventOrFile instanceof File) {
        fileToSet = eventOrFile;
      } else if (eventOrFile && eventOrFile.target && eventOrFile.target.files && eventOrFile.target.files[0]) {
        fileToSet = eventOrFile.target.files[0];
      }
      act(() => {
          (global.mockUseFileUploadManagerReturnValue as any).fileToUpload = fileToSet;
      });
    };
    (global.mockUseFileUploadManagerReturnValue.handleFileSelection as jest.Mock).mockImplementation(handleFileSelectionMockImpl);


    await act(async () => {
      render(<HomePage />);
    });
    // Wait for the initial fetchPastAnalyses to complete its effects and HomePage to render fully
    await act(async () => {
      await initialFetchAnalysesPromise;
    });

    // Use findByRole to wait for the button to appear if needed, though getByRole should work if page is stable
    const novaAnaliseButton = await screen.findByRole('button', { name: /Nova Análise/i });
    await userEvent.click(novaAnaliseButton);

    const newAnalysisFormTitle = await screen.findByText('Nova Análise de Conformidade');
    expect(newAnalysisFormTitle).toBeInTheDocument();

    const fileInput = screen.getByLabelText(/Arquivo CSV de Dados/i);
    await userEvent.upload(fileInput, mockFile);
    // The mock for handleFileSelection needs to be called as it would by the component
    // This might require direct invocation if userEvent.upload doesn't trigger it as expected with the mock setup.
    // For now, assume it's called or call it directly based on how NewAnalysisForm works.
    handleFileSelectionMockImpl({ target: { files: [mockFile] } } as any); // Simulate the event NewAnalysisForm would receive


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
    });

    act(() => { // Ensure this state update for currentAnalysis is also wrapped
        global.mockUseAnalysisManagerReturnValue.currentAnalysis = uploadedAnalysisData as Analysis;
        global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps = calculateDisplayedAnalysisSteps(uploadedAnalysisData as Analysis);
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
    let firstFetchCompletedPromiseResolve: () => void;
    const firstFetchCompletedPromise = new Promise<void>(resolve => { firstFetchCompletedPromiseResolve = resolve; });

    let secondFetchCompletedPromiseResolve: () => void;
    const secondFetchCompletedPromise = new Promise<void>(resolve => { secondFetchCompletedPromiseResolve = resolve; });

    mockFetchPastAnalysesGlobal
      .mockImplementationOnce(async () => {
        await act(async () => {
          global.mockUseAnalysisManagerReturnValue.pastAnalyses = [mockAnalysisItemCompleted];
          global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
        });
        if (firstFetchCompletedPromiseResolve) firstFetchCompletedPromiseResolve();
        return Promise.resolve(undefined);
      })
      .mockImplementationOnce(async () => { // For the fetch after deletion
        await act(async () => {
          global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
          global.mockUseAnalysisManagerReturnValue.currentAnalysis = null;
          global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
        });
        if (secondFetchCompletedPromiseResolve) secondFetchCompletedPromiseResolve();
        return Promise.resolve(undefined);
      });

    mockHandleDeleteAnalysisGlobal.mockImplementation(async (id, cb) => {
      cb?.();
      return Promise.resolve();
    });

    await act(async () => {
      render(<HomePage />);
    });

    // Wait for the first fetch to complete and component to update
    await act(async () => {
      await firstFetchCompletedPromise;
    });

    const accordionTrigger = await screen.findByText(mockAnalysisItemCompleted.title!);
    await act(async () => {
      await userEvent.click(accordionTrigger);
      // Simulate what useAnalysisManager would do on accordion change
      global.mockUseAnalysisManagerReturnValue.currentAnalysis = mockAnalysisItemCompleted;
      global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps = calculateDisplayedAnalysisSteps(mockAnalysisItemCompleted);
    });

    await waitFor(() => { // Wait for AnalysisView to render with the button
      expect(screen.getByRole('button', { name: /Excluir Análise/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /Excluir Análise/i }));

    const confirmDialogTitle = await screen.findByText('Confirmar Exclusão');
    expect(confirmDialogTitle).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: 'Confirmar Exclusão' });

    await act(async () => {
      await userEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(mockHandleDeleteAnalysisGlobal).toHaveBeenCalledWith(mockAnalysisItemCompleted.id, expect.any(Function));
    });

    // Wait for the second fetch (after delete) to complete and component to update
    await act(async () => {
      await secondFetchCompletedPromise;
    });

    expect(await screen.findByText(/Nenhuma análise anterior encontrada./i)).toBeInTheDocument();
    expect(global.mockUseAnalysisManagerReturnValue.currentAnalysis).toBeNull();
  });
});

