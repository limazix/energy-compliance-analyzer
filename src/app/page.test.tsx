/**
 * @fileoverview Test suite for the HomePage component.
 * This file contains integration tests for the main page of the application,
 * covering navigation, analysis listing, new analysis creation,
 * file upload simulation, and analysis management features like deletion, structured in BDD style.
 */
import { act, render, screen, waitFor } from '@testing-library/react'; // Correct import order
import userEvent from '@testing-library/user-event';

import { useAuth as originalUseAuth } from '@/contexts/auth-context';
// Import the actual calculateDisplayedAnalysisSteps function
import { calculateDisplayedAnalysisSteps } from '@/features/analysis-processing/utils/analysisStepsUtils';
import { getAnalysisReportAction as originalGetAnalysisReportAction } from '@/features/report-viewing/actions/reportViewingActions'; // Corrected: Moved to top-level group
import type { Analysis } from '@/types/analysis';

import HomePage from './page';

import type { User } from 'firebase/auth';

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

// Correctly mock and type next/navigation for App Router
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();

jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    back: jest.fn(),
    prefetch: jest.fn(),
    pathname: '/',
    route: '/',
    query: {},
    asPath: '/',
  }),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  useParams: jest.fn(() => ({})),
}));

// Mock server actions
jest.mock('@/features/report-viewing/actions/reportViewingActions');
const getAnalysisReportAction = originalGetAnalysisReportAction as jest.Mock;

const mockUser: User = {
  uid: 'test-user-001',
  displayName: 'Test User One',
  email: 'test@example.com',
  photoURL: 'https://placehold.co/100x100.png?text=TU1',
  emailVerified: true,
  isAnonymous: false,
  metadata: {},
  providerData: [],
  providerId: 'google.com',
  refreshToken: 'mock-refresh-token',
  delete: jest.fn(),
  getIdToken: jest.fn(),
  getIdTokenResult: jest.fn(),
  reload: jest.fn(),
  toJSON: jest.fn(),
  tenantId: null,
  phoneNumber: null,
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
  powerQualityDataSummary:
    'Sumário dos dados para Alpha: Tensão estável, algumas flutuações de frequência.',
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
    tableOfContents: ['Introdução', 'Análise de Tensão', 'Conclusões'],
    introduction: {
      objective:
        'Analisar a conformidade dos dados de qualidade de energia do arquivo aneel_data_report_alpha.csv.',
      overallResultsSummary:
        'A análise indica conformidade geral com as normas ANEEL, com algumas variações de frequência necessitando monitoramento.',
      usedNormsOverview: 'REN 414/2010, PRODIST Módulo 8',
    },
    analysisSections: [
      {
        title: 'Análise de Tensão',
        content:
          'Os níveis de tensão mantiveram-se dentro dos limites adequados na maior parte do tempo.',
        insights: ['Tensão predominantemente estável.'],
        relevantNormsCited: ['PRODIST Módulo 8, Seção 3.2'],
        chartOrImageSuggestion: 'Gráfico de linha da tensão ao longo do tempo.',
      },
    ],
    finalConsiderations: 'Recomenda-se o monitoramento contínuo da frequência.',
    bibliography: [
      {
        text: 'ANEEL. PRODIST Módulo 8 - Qualidade da Energia Elétrica.',
        link: 'https://www.aneel.gov.br',
      },
    ],
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

const mockAnalysisItemError: Analysis = {
  id: 'analysis-id-error-03',
  userId: mockUser.uid,
  fileName: 'data_gamma_error.csv',
  title: 'Análise Gamma com Erro',
  description: 'Tentativa de análise para Gamma que resultou em erro.',
  languageCode: 'pt-BR',
  status: 'error',
  progress: 45,
  uploadProgress: 100,
  powerQualityDataUrl: `user_uploads/${mockUser.uid}/analysis-id-error-03/data_gamma_error.csv`,
  errorMessage: 'Falha na identificação de resoluções ANEEL devido a dados insuficientes.',
  tags: ['gamma_setor', 'investigar'],
  createdAt: new Date('2023-10-28T11:00:00Z').toISOString(),
  powerQualityDataSummary: 'Dados iniciais do Setor Gamma indicam várias interrupções curtas.',
};

// Define a type for the global mock value for better type safety
interface MockFileUploadManagerReturnValue {
  fileToUpload: File | null;
  isUploading: boolean;
  uploadProgress: number;
  uploadError: string | null;
  handleFileSelection: jest.Mock<void, [React.ChangeEvent<HTMLInputElement> | File | null]>;
  uploadFileAndCreateRecord: jest.Mock<
    Promise<{
      analysisId: string | null;
      fileName: string | null;
      title?: string | null;
      description?: string | null;
      languageCode?: string | null;
      error?: string | null;
    }>,
    [User, string | undefined, string | undefined, string | undefined]
  >;
}

declare global {
  // eslint-disable-next-line no-var
  var mockUseFileUploadManagerReturnValue: MockFileUploadManagerReturnValue;
}

/**
 * @describe Test suite for the HomePage component, focusing on user navigation flows and data views.
 * This includes tests for authentication redirection, rendering of past analyses,
 * interaction with the new analysis form, and actions like viewing and deleting analyses.
 */
describe('HomePage', () => {
  // Mocks for functions returned by useAnalysisManager, accessed via global mock
  let mockFetchPastAnalysesGlobal: jest.Mock;
  let mockStartAiProcessingGlobal: jest.Mock;
  let mockHandleDeleteAnalysisGlobal: jest.Mock;
  let mockHandleCancelAnalysisGlobal: jest.Mock;
  let mockHandleRetryAnalysisGlobal: jest.Mock;

  // Firebase auth mock helper from jest.setup.js
  let setMockUserForAuthStateChangedListener: (user: User | null) => void;

  beforeEach(async () => {
    mockRouterPush.mockClear();
    mockRouterReplace.mockClear();

    const authMockModule = jest.requireMock('firebase/auth') as {
      __setMockUserForAuthStateChangedListener: (user: User | null) => void;
    };
    setMockUserForAuthStateChangedListener =
      authMockModule.__setMockUserForAuthStateChangedListener;

    // Set up auth state for AuthProvider: User is logged in
    await act(async () => {
      setMockUserForAuthStateChangedListener(mockUser);
    });

    useAuth.mockReturnValue({ user: mockUser, loading: false });

    mockFetchPastAnalysesGlobal = (
      global.mockUseAnalysisManagerReturnValue.fetchPastAnalyses as jest.Mock
    ).mockClear();
    mockStartAiProcessingGlobal = (
      global.mockUseAnalysisManagerReturnValue.startAiProcessing as jest.Mock
    ).mockClear();
    mockHandleDeleteAnalysisGlobal = (
      global.mockUseAnalysisManagerReturnValue.handleDeleteAnalysis as jest.Mock
    ).mockClear();
    mockHandleCancelAnalysisGlobal = (
      global.mockUseAnalysisManagerReturnValue.handleCancelAnalysis as jest.Mock
    ).mockClear();
    mockHandleRetryAnalysisGlobal = (
      global.mockUseAnalysisManagerReturnValue.handleRetryAnalysis as jest.Mock
    ).mockClear();

    (global.mockUseAnalysisManagerReturnValue.setCurrentAnalysis as jest.Mock).mockClear();
    (global.mockUseAnalysisManagerReturnValue.setTagInput as jest.Mock).mockClear();
    (global.mockUseAnalysisManagerReturnValue.handleAddTag as jest.Mock).mockClear();
    (global.mockUseAnalysisManagerReturnValue.handleRemoveTag as jest.Mock).mockClear();
    (global.mockUseAnalysisManagerReturnValue.downloadReportAsTxt as jest.Mock).mockClear();

    act(() => {
      global.mockUseAnalysisManagerReturnValue.currentAnalysis = null;
      global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
      global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
      global.mockUseAnalysisManagerReturnValue.tagInput = '';
      global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps = [];
    });

    if (!global.mockUseFileUploadManagerReturnValue) {
      global.mockUseFileUploadManagerReturnValue = {
        handleFileSelection: jest.fn(),
        uploadFileAndCreateRecord: jest.fn(),
        fileToUpload: null,
        isUploading: false,
        uploadProgress: 0,
        uploadError: null,
      };
    }
    (global.mockUseFileUploadManagerReturnValue.uploadFileAndCreateRecord as jest.Mock).mockClear();
    (global.mockUseFileUploadManagerReturnValue.handleFileSelection as jest.Mock).mockClear();

    act(() => {
      global.mockUseFileUploadManagerReturnValue.fileToUpload = null;
      global.mockUseFileUploadManagerReturnValue.isUploading = false;
      global.mockUseFileUploadManagerReturnValue.uploadProgress = 0;
      global.mockUseFileUploadManagerReturnValue.uploadError = null;
    });

    mockFetchPastAnalysesGlobal.mockImplementation(async () => {
      await act(async () => {
        global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
        if (!global.mockUseAnalysisManagerReturnValue.pastAnalyses) {
          global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
        }
      });
    });

    getAnalysisReportAction.mockResolvedValue({
      mdxContent: `# Test Report for an analysis`,
      fileName: 'default_mock_file.csv',
      analysisId: 'default_mock_id',
      error: null,
    });
  });

  /**
   * @describe Scenario: Given the user is not authenticated.
   */
  describe('given the user is not authenticated', () => {
    /**
     * @it It should redirect to the login page.
     */
    it('should redirect to the login page', async () => {
      await act(async () => {
        setMockUserForAuthStateChangedListener(null);
      });
      useAuth.mockReturnValue({ user: null, loading: false });

      await act(async () => {
        render(<HomePage />);
      });
      await waitFor(() => {
        expect(mockRouterReplace).toHaveBeenCalledWith('/login');
      });
    });
  });

  /**
   * @describe Scenario: Given the user is authenticated.
   */
  describe('given the user is authenticated', () => {
    /**
     * @describe Context: When visiting the page.
     */
    describe('when visiting the page', () => {
      beforeEach(async () => {
        const fetchPromise = (
          global.mockUseAnalysisManagerReturnValue.fetchPastAnalyses as jest.Mock
        ).mockImplementation(async () => {
          await act(async () => {
            global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
            global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
          });
        });

        render(<HomePage />);
        await act(async () => {
          await fetchPromise();
        });
      });

      /**
       * @it It should render the AppHeader with a "New Analysis" button.
       */
      it('should render the AppHeader with a "New Analysis" button', () => {
        expect(screen.getByRole('button', { name: /Nova Análise/i })).toBeInTheDocument();
      });

      /**
       * @it It should display the "Your Past Analyses" section.
       */
      it('should display the "Your Past Analyses" section', () => {
        expect(screen.getByText(`Suas Análises Anteriores`, { exact: false })).toBeInTheDocument();
      });

      /**
       * @it It should display "No past analyses found" if there are no analyses.
       */
      it('should display "No past analyses found" if there are no analyses', async () => {
        expect(
          await screen.findByText(/Nenhuma análise anterior encontrada./i)
        ).toBeInTheDocument();
      });
    });

    /**
     * @describe Context: When clicking the "New Analysis" button.
     */
    describe('when clicking the "New Analysis" button', () => {
      beforeEach(async () => {
        const fetchPromise = (
          global.mockUseAnalysisManagerReturnValue.fetchPastAnalyses as jest.Mock
        ).mockImplementation(async () => {
          await act(async () => {
            global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
            global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
          });
        });

        render(<HomePage />);
        await act(async () => {
          await fetchPromise();
        });
        await screen.findByText(/Nenhuma análise anterior encontrada./i);
        await userEvent.click(screen.getByRole('button', { name: /Nova Análise/i }));
      });

      /**
       * @it It should display the NewAnalysisForm.
       */
      it('should display the NewAnalysisForm', () => {
        expect(screen.getByText('Nova Análise de Conformidade')).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /Enviar e Iniciar Análise/i })
        ).toBeInTheDocument();
      });

      /**
       * @it It should return to the dashboard view when "Cancel" is clicked in the NewAnalysisForm.
       */
      it('should return to the dashboard view when "Cancel" is clicked in the NewAnalysisForm', async () => {
        await userEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
        expect(screen.getByText('Suas Análises Anteriores')).toBeInTheDocument();
      });
    });

    /**
     * @describe Context: When past analyses exist.
     */
    describe('when past analyses exist', () => {
      let fetchPromise: jest.Mock;
      beforeEach(async () => {
        fetchPromise = (
          global.mockUseAnalysisManagerReturnValue.fetchPastAnalyses as jest.Mock
        ).mockImplementation(async () => {
          await act(async () => {
            global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = true;
          });
          await new Promise((resolve) => setTimeout(resolve, 10)); // Simulate network delay
          await act(async () => {
            global.mockUseAnalysisManagerReturnValue.pastAnalyses = [
              mockAnalysisItemCompleted,
              mockAnalysisItemInProgress,
            ];
            global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
          });
        });

        render(<HomePage />);
        await act(async () => {
          await fetchPromise(); // Await the completion of the mock
        });

        // Wait for an element that *only* appears when pastAnalyses is populated.
        await screen.findByText(mockAnalysisItemCompleted.title!);
        await screen.findByText(mockAnalysisItemInProgress.title!);
      });

      /**
       * @it It should display each past analysis in an accordion.
       */
      it('should display each past analysis in an accordion', async () => {
        expect(screen.getByText(mockAnalysisItemCompleted.title!)).toBeInTheDocument();
        expect(screen.getByText(mockAnalysisItemInProgress.title!)).toBeInTheDocument();
      });

      /**
       * @it It should expand an accordion item to show the AnalysisView for the selected analysis.
       */
      it('should expand an accordion item to show the AnalysisView for the selected analysis', async () => {
        const completedAnalysisAccordionTrigger = screen.getByText(
          mockAnalysisItemCompleted.title!
        );
        await act(async () => {
          await userEvent.click(completedAnalysisAccordionTrigger);
          global.mockUseAnalysisManagerReturnValue.currentAnalysis = mockAnalysisItemCompleted;
          global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps =
            calculateDisplayedAnalysisSteps(mockAnalysisItemCompleted);
        });

        await waitFor(() => {
          const analysisViewTitle = screen.getByText(
            new RegExp(mockAnalysisItemCompleted.title!, 'i')
          );
          expect(analysisViewTitle).toBeInTheDocument();
          expect(screen.getByText(/Análise Concluída com Sucesso!/i)).toBeInTheDocument();
        });
      });

      /**
       * @it It should navigate to the ReportPage when "Visualizar Relatório Detalhado" is clicked for a completed analysis.
       */
      it('should navigate to the ReportPage when "Visualizar Relatório Detalhado" is clicked for a completed analysis', async () => {
        const completedAnalysisAccordionTrigger = screen.getByText(
          mockAnalysisItemCompleted.title!
        );
        await act(async () => {
          await userEvent.click(completedAnalysisAccordionTrigger);
          global.mockUseAnalysisManagerReturnValue.currentAnalysis = mockAnalysisItemCompleted;
          global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps =
            calculateDisplayedAnalysisSteps(mockAnalysisItemCompleted);
        });

        await waitFor(() => {
          expect(screen.getByText(/Análise Concluída com Sucesso!/i)).toBeInTheDocument();
        });

        const viewReportButton = screen.getByRole('link', {
          name: /Visualizar Relatório Detalhado/i,
        });
        await userEvent.click(viewReportButton);

        await waitFor(() => {
          expect(mockRouterPush).toHaveBeenCalledWith(`/report/${mockAnalysisItemCompleted.id}`);
        });
      });
    });

    /**
     * @describe Context: When uploading a new analysis file.
     */
    describe('when uploading a new analysis file', () => {
      const newFileName = 'uploaded-test-file.csv';
      const newAnalysisId = `mock-analysis-id-for-${newFileName}`;
      const newAnalysisTitle = 'Freshly Uploaded Analysis';
      const mockFile = new File(['col1,col2\nval1,val2'], newFileName, { type: 'text/csv' });

      beforeEach(async () => {
        (
          global.mockUseFileUploadManagerReturnValue.uploadFileAndCreateRecord as jest.Mock
        ).mockResolvedValue({
          analysisId: newAnalysisId,
          fileName: newFileName,
          title: newAnalysisTitle,
          error: null,
        });
        mockStartAiProcessingGlobal.mockResolvedValue(undefined as void);

        (
          global.mockUseAnalysisManagerReturnValue.fetchPastAnalyses as jest.Mock
        ).mockImplementation(async () => {
          await act(async () => {
            global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
            global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
          });
        });

        (
          global.mockUseFileUploadManagerReturnValue.handleFileSelection as jest.Mock
        ).mockImplementation((eventOrFile: File | React.ChangeEvent<HTMLInputElement> | null) => {
          let fileToSet: File | null = null;
          if (eventOrFile instanceof File) {
            fileToSet = eventOrFile;
          } else if (
            eventOrFile &&
            (eventOrFile as React.ChangeEvent<HTMLInputElement>).target?.files?.[0]
          ) {
            fileToSet = (eventOrFile as React.ChangeEvent<HTMLInputElement>).target.files![0];
          }
          act(() => {
            // Ensure state update for the mock is within act
            global.mockUseFileUploadManagerReturnValue.fileToUpload = fileToSet;
          });
        });

        render(<HomePage />);
        await act(async () => {
          await (global.mockUseAnalysisManagerReturnValue.fetchPastAnalyses as jest.Mock)();
        });
        await screen.findByText(/Nenhuma análise anterior encontrada./i);

        const novaAnaliseButton = screen.getByRole('button', { name: /Nova Análise/i });
        await userEvent.click(novaAnaliseButton);

        const fileInput = screen.getByLabelText(/Arquivo CSV de Dados/i);
        await userEvent.upload(fileInput, mockFile);

        // Wait for the title input to become enabled and its value to be set
        const titleInput = await screen.findByLabelText(/Título da Análise/i);
        await waitFor(() => {
          expect(titleInput).toBeEnabled();
          expect(titleInput).toHaveValue(newFileName);
        });

        await userEvent.clear(titleInput);
        await userEvent.type(titleInput, newAnalysisTitle);

        const submitButton = screen.getByRole('button', { name: /Enviar e Iniciar Análise/i });
        await act(async () => {
          await userEvent.click(submitButton);
        });
      });

      /**
       * @it It should call the upload and record creation process.
       */
      it('should call the upload and record creation process', async () => {
        await waitFor(() => {
          expect(
            global.mockUseFileUploadManagerReturnValue.uploadFileAndCreateRecord
          ).toHaveBeenCalledWith(mockUser, newAnalysisTitle, '', expect.any(String));
        });
      });

      /**
       * @it It should start AI processing for the new analysis.
       */
      it('should start AI processing for the new analysis', async () => {
        // Ensure the currentAnalysis is updated in the mock store before this assertion
        await act(async () => {
          global.mockUseAnalysisManagerReturnValue.currentAnalysis = {
            id: newAnalysisId,
            title: newAnalysisTitle,
            status: 'summarizing_data', // Or whatever status indicates processing can start
            progress: 10,
            fileName: newFileName,
            userId: mockUser.uid,
            createdAt: new Date().toISOString(),
            tags: [],
            // ... other necessary fields for Analysis type
          } as Analysis;
          global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps =
            calculateDisplayedAnalysisSteps(
              global.mockUseAnalysisManagerReturnValue.currentAnalysis!
            );
        });

        await waitFor(() => {
          expect(mockStartAiProcessingGlobal).toHaveBeenCalledWith(newAnalysisId, mockUser.uid);
        });
      });

      /**
       * @it It should display the AnalysisView for the newly uploaded and processing analysis.
       */
      it('should display the AnalysisView for the newly uploaded and processing analysis', async () => {
        await act(async () => {
          global.mockUseAnalysisManagerReturnValue.currentAnalysis = {
            id: newAnalysisId,
            title: newAnalysisTitle,
            status: 'summarizing_data',
            progress: 10,
            fileName: newFileName,
            userId: mockUser.uid,
            createdAt: new Date().toISOString(),
            tags: [],
          } as Analysis;
          global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps =
            calculateDisplayedAnalysisSteps(
              global.mockUseAnalysisManagerReturnValue.currentAnalysis!
            );
        });

        await waitFor(async () => {
          const analysisViewForNew = await screen.findByText(new RegExp(newAnalysisTitle, 'i'));
          expect(analysisViewForNew).toBeInTheDocument();
          expect(screen.getByText(/Upload do Arquivo e Preparação/i)).toBeInTheDocument();
          expect(
            screen.getByText(/Sumarizando Dados da Qualidade de Energia/i)
          ).toBeInTheDocument();
        });
      });
    });

    /**
     * @describe Context: When managing an existing analysis via AnalysisView.
     */
    describe('when managing an existing analysis via AnalysisView', () => {
      let fetchPromise: jest.Mock;
      beforeEach(async () => {
        fetchPromise = (
          global.mockUseAnalysisManagerReturnValue.fetchPastAnalyses as jest.Mock
        ).mockImplementation(async () => {
          await act(async () => {
            global.mockUseAnalysisManagerReturnValue.pastAnalyses = [mockAnalysisItemCompleted];
            global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
          });
        });

        (
          global.mockUseAnalysisManagerReturnValue.handleDeleteAnalysis as jest.Mock
        ).mockImplementation(async (_id, cb) => {
          cb?.();
        });

        render(<HomePage />);
        await act(async () => {
          await fetchPromise();
        });
        expect(await screen.findByText(mockAnalysisItemCompleted.title!)).toBeInTheDocument();

        const accordionTrigger = screen.getByText(mockAnalysisItemCompleted.title!);
        await act(async () => {
          await userEvent.click(accordionTrigger);
          global.mockUseAnalysisManagerReturnValue.currentAnalysis = mockAnalysisItemCompleted;
          global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps =
            calculateDisplayedAnalysisSteps(mockAnalysisItemCompleted);
        });
        await screen.findByText(/Análise Concluída com Sucesso!/i);
      });

      /**
       * @it It should allow deleting an analysis after confirmation.
       */
      it('should allow deleting an analysis after confirmation', async () => {
        await userEvent.click(screen.getByRole('button', { name: /Excluir Análise/i }));

        const confirmDialogTitle = await screen.findByText('Confirmar Exclusão');
        expect(confirmDialogTitle).toBeInTheDocument();

        const confirmButton = screen.getByRole('button', { name: 'Confirmar Exclusão' });
        await act(async () => {
          await userEvent.click(confirmButton);
        });

        await waitFor(() => {
          expect(mockHandleDeleteAnalysisGlobal).toHaveBeenCalledWith(
            mockAnalysisItemCompleted.id,
            expect.any(Function)
          );
        });
      });

      /**
       * @it It should update the list of past analyses after deletion.
       */
      it('should update the list of past analyses after deletion', async () => {
        const fetchAfterDeletePromise = (
          global.mockUseAnalysisManagerReturnValue.fetchPastAnalyses as jest.Mock
        ).mockImplementation(async () => {
          await act(async () => {
            global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
            global.mockUseAnalysisManagerReturnValue.currentAnalysis = null;
            global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
          });
        });

        await userEvent.click(screen.getByRole('button', { name: /Excluir Análise/i }));
        const confirmButton = await screen.findByRole('button', { name: 'Confirmar Exclusão' });

        await act(async () => {
          await userEvent.click(confirmButton);
        });

        await act(async () => {
          await fetchAfterDeletePromise();
        });

        expect(await screen.queryByText(mockAnalysisItemCompleted.title!)).not.toBeInTheDocument();
        expect(
          await screen.findByText(/Nenhuma análise anterior encontrada./i)
        ).toBeInTheDocument();
        expect(global.mockUseAnalysisManagerReturnValue.currentAnalysis).toBeNull();
      });
    });

    /**
     * @describe Context: When managing an in-progress analysis via AnalysisView.
     */
    describe('when managing an in-progress analysis via AnalysisView', () => {
      beforeEach(async () => {
        (
          global.mockUseAnalysisManagerReturnValue.fetchPastAnalyses as jest.Mock
        ).mockImplementation(async () => {
          await act(async () => {
            global.mockUseAnalysisManagerReturnValue.pastAnalyses = [mockAnalysisItemInProgress];
            global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
          });
        });
        render(<HomePage />);
        await act(async () => {
          await (global.mockUseAnalysisManagerReturnValue.fetchPastAnalyses as jest.Mock)();
        });
        expect(await screen.findByText(mockAnalysisItemInProgress.title!)).toBeInTheDocument();

        const accordionTrigger = screen.getByText(mockAnalysisItemInProgress.title!);
        await act(async () => {
          await userEvent.click(accordionTrigger);
          global.mockUseAnalysisManagerReturnValue.currentAnalysis = mockAnalysisItemInProgress;
          global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps =
            calculateDisplayedAnalysisSteps(mockAnalysisItemInProgress);
        });
        // Check for an element unique to the AnalysisProgressDisplay
        expect(await screen.findByText(/Progresso da Análise:/i)).toBeInTheDocument();
      });

      /**
       * @it It should allow cancelling an analysis after confirmation.
       */
      it('should allow cancelling an analysis after confirmation', async () => {
        await userEvent.click(screen.getByRole('button', { name: /Cancelar Análise/i }));

        const confirmDialogTitle = await screen.findByText('Confirmar Cancelamento');
        expect(confirmDialogTitle).toBeInTheDocument();

        const confirmButton = screen.getByRole('button', { name: 'Confirmar Cancelamento' });
        await act(async () => {
          await userEvent.click(confirmButton);
        });

        await waitFor(() => {
          expect(mockHandleCancelAnalysisGlobal).toHaveBeenCalledWith(
            mockAnalysisItemInProgress.id
          );
        });
      });
    });

    /**
     * @describe Context: When managing an errored analysis via AnalysisView.
     */
    describe('when managing an errored analysis via AnalysisView', () => {
      beforeEach(async () => {
        (
          global.mockUseAnalysisManagerReturnValue.fetchPastAnalyses as jest.Mock
        ).mockImplementation(async () => {
          await act(async () => {
            global.mockUseAnalysisManagerReturnValue.pastAnalyses = [mockAnalysisItemError];
            global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
          });
        });
        render(<HomePage />);
        await act(async () => {
          await (global.mockUseAnalysisManagerReturnValue.fetchPastAnalyses as jest.Mock)();
        });
        expect(await screen.findByText(mockAnalysisItemError.title!)).toBeInTheDocument();

        const accordionTrigger = screen.getByText(mockAnalysisItemError.title!);
        await act(async () => {
          await userEvent.click(accordionTrigger);
          global.mockUseAnalysisManagerReturnValue.currentAnalysis = mockAnalysisItemError;
          global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps =
            calculateDisplayedAnalysisSteps(mockAnalysisItemError);
        });
        expect(await screen.findByText(/Ocorreu um Erro/i)).toBeInTheDocument();
      });

      /**
       * @it It should allow retrying a failed analysis.
       */
      it('should allow retrying a failed analysis', async () => {
        await userEvent.click(screen.getByRole('button', { name: /Tentar Novamente/i }));
        await waitFor(() => {
          expect(mockHandleRetryAnalysisGlobal).toHaveBeenCalledWith(mockAnalysisItemError.id);
        });
      });
    });
  });
});
