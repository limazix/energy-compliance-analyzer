/**
 * @fileoverview Test suite for the HomePage component.
 * This file contains integration tests for the main page of the application,
 * covering navigation, analysis listing, new analysis creation,
 * file upload simulation, and analysis management features like deletion, structured in BDD style.
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Import Timestamp if it's needed for creating mock data, otherwise remove
// import { Timestamp } from 'firebase/firestore';
import { useRouter as _originalUseRouter } from 'next/navigation'; // Correct import for App Router

import { useAuth as originalUseAuth } from '@/contexts/auth-context';
// Import the actual calculateDisplayedAnalysisSteps function
import { calculateDisplayedAnalysisSteps } from '@/features/analysis-processing/utils/analysisStepsUtils';
import type { Analysis } from '@/types/analysis';

import HomePage from './page';

import type { User } from 'firebase/auth';
import type { _NextRouter } from 'next/router'; // For typing mockRouter

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

// Define a type for the global mock value for better type safety
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface _MockFileUploadManagerReturnValue {
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
  var mockUseFileUploadManagerReturnValue: _MockFileUploadManagerReturnValue;
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
  let _mockHandleCancelAnalysisGlobal: jest.Mock; // Prefixed as unused
  let _mockSetCurrentAnalysisGlobal: jest.Mock; // Prefixed as unused

  // Mock for function returned by useFileUploadManager
  let mockUploadFileAndCreateRecordGlobal: jest.Mock;
  let _mockHandleFileSelectionGlobal: jest.Mock; // Prefixed as unused

  // Firebase auth mock helper from jest.setup.js
  let setMockUserForAuthStateChangedListener: (user: User | null) => void;
  const { __setMockUserForAuthStateChangedListener } = jest.requireMock('firebase/auth') as {
    __setMockUserForAuthStateChangedListener: (user: User | null) => void;
  };

  beforeEach(async () => {
    mockRouterPush.mockClear();
    mockRouterReplace.mockClear();

    setMockUserForAuthStateChangedListener = __setMockUserForAuthStateChangedListener;

    // Set up auth state for AuthProvider: User is logged in
    // This will make onAuthStateChanged in AuthProvider receive mockUser
    await act(async () => {
      if (setMockUserForAuthStateChangedListener) {
        setMockUserForAuthStateChangedListener(mockUser);
      } else {
        // Fallback or error if the helper isn't found, though it should be.
        console.error(
          'ERROR IN TEST SETUP: __setMockUserForAuthStateChangedListener is not available on auth mock.'
        );
      }
    });

    // This mock is for components consuming useAuth directly
    useAuth.mockReturnValue({ user: mockUser, loading: false });

    // Clear and set up global mocks for useAnalysisManager functions
    mockFetchPastAnalysesGlobal = (
      global.mockUseAnalysisManagerReturnValue.fetchPastAnalyses as jest.Mock
    ).mockClear();
    mockStartAiProcessingGlobal = (
      global.mockUseAnalysisManagerReturnValue.startAiProcessing as jest.Mock
    ).mockClear();
    mockHandleDeleteAnalysisGlobal = (
      global.mockUseAnalysisManagerReturnValue.handleDeleteAnalysis as jest.Mock
    ).mockClear();
    _mockHandleCancelAnalysisGlobal = (
      global.mockUseAnalysisManagerReturnValue.handleCancelAnalysis as jest.Mock
    ).mockClear();
    _mockSetCurrentAnalysisGlobal = (
      global.mockUseAnalysisManagerReturnValue.setCurrentAnalysis as jest.Mock
    ).mockClear();
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
    // Ensure global.mockUseFileUploadManagerReturnValue is initialized if not already by jest.setup.js
    if (!global.mockUseFileUploadManagerReturnValue) {
      global.mockUseFileUploadManagerReturnValue = {
        handleFileSelection: jest.fn(),
        uploadFileAndCreateRecord: jest.fn(),
      } as unknown as _MockFileUploadManagerReturnValue; // Add other props if needed
    }
    mockUploadFileAndCreateRecordGlobal = (
      global.mockUseFileUploadManagerReturnValue.uploadFileAndCreateRecord as jest.Mock
    ).mockClear();
    _mockHandleFileSelectionGlobal = (
      global.mockUseFileUploadManagerReturnValue.handleFileSelection as jest.Mock
    ).mockClear();

    act(() => {
      global.mockUseFileUploadManagerReturnValue.fileToUpload = null;
      global.mockUseFileUploadManagerReturnValue.isUploading = false;
      global.mockUseFileUploadManagerReturnValue.uploadProgress = 0;
      global.mockUseFileUploadManagerReturnValue.uploadError = null;
    });

    // Default mock implementation for fetchPastAnalyses if not overridden by specific tests
    mockFetchPastAnalysesGlobal.mockImplementation(async () => {
      await act(async () => {
        // Ensure state updates are wrapped
        global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
        // IMPORTANT: Ensure pastAnalyses is initialized for default cases
        if (!global.mockUseAnalysisManagerReturnValue.pastAnalyses) {
          global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
        }
      });
      return Promise.resolve(undefined);
    });

    const { getAnalysisReportAction } = jest.requireMock(
      '@/features/report-viewing/actions/reportViewingActions'
    ) as { getAnalysisReportAction: jest.Mock };
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
  });

  /**
   * @describe Scenario: Given the user is authenticated.
   */
  describe('given the user is authenticated', () => {
    /**
     * @describe Context: When visiting the page.
     */
    describe('when visiting the page', () => {
      let initialFetchCompletedPromiseResolve: () => void;
      const initialFetchCompletedPromise = new Promise<void>((resolve) => {
        initialFetchCompletedPromiseResolve = resolve;
      });

      beforeEach(async () => {
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
          await initialFetchCompletedPromise;
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
        expect(screen.getByText(`Suas Análises Anteriores`)).toBeInTheDocument();
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
        let initialFetchCompletedPromiseResolve: () => void;
        const initialFetchCompletedPromise = new Promise<void>((resolve) => {
          initialFetchCompletedPromiseResolve = resolve;
        });
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
          await initialFetchCompletedPromise;
        });

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
      beforeEach(async () => {
        mockFetchPastAnalysesGlobal.mockImplementation(async () => {
          await act(async () => {
            // Wrap all async state updates in one act
            global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = true;
            await new Promise((r) => setTimeout(r, 10)); // Simulate network delay
            global.mockUseAnalysisManagerReturnValue.pastAnalyses = [
              mockAnalysisItemCompleted,
              mockAnalysisItemInProgress,
            ];
            global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
          });
        });

        render(<HomePage />);
        // The findByText in the test will wait for the component to settle after these updates.
      });

      /**
       * @it It should display each past analysis in an accordion.
       */
      it('should display each past analysis in an accordion', async () => {
        expect(await screen.findByText(mockAnalysisItemCompleted.title!)).toBeInTheDocument();
        expect(await screen.findByText(mockAnalysisItemInProgress.title!)).toBeInTheDocument();
      });

      /**
       * @it It should expand an accordion item to show the AnalysisView for the selected analysis.
       */
      it('should expand an accordion item to show the AnalysisView for the selected analysis', async () => {
        const completedAnalysisAccordionTrigger = await screen.findByText(
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
        const completedAnalysisAccordionTrigger = await screen.findByText(
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
      const handleFileSelectionMockImpl = (
        eventOrFile: File | React.ChangeEvent<HTMLInputElement> | null
      ) => {
        let fileToSet: File | null = null;
        if (eventOrFile instanceof File || eventOrFile === null) {
          fileToSet = eventOrFile;
        } else if (
          eventOrFile &&
          (eventOrFile as React.ChangeEvent<HTMLInputElement>).target &&
          (eventOrFile as React.ChangeEvent<HTMLInputElement>).target.files &&
          (eventOrFile as React.ChangeEvent<HTMLInputElement>).target.files![0]
        ) {
          fileToSet = (eventOrFile as React.ChangeEvent<HTMLInputElement>).target.files![0];
        }
        act(() => {
          global.mockUseFileUploadManagerReturnValue.fileToUpload = fileToSet;
        });
      };

      beforeEach(async () => {
        mockUploadFileAndCreateRecordGlobal.mockResolvedValue({
          analysisId: newAnalysisId,
          fileName: newFileName,
          title: newAnalysisTitle,
          error: null,
        });
        mockStartAiProcessingGlobal.mockResolvedValue(undefined as void); // Explicitly type the resolved value

        let initialFetchAnalysesPromiseResolve: () => void;
        const initialFetchAnalysesPromise = new Promise<void>((resolve) => {
          initialFetchAnalysesPromiseResolve = resolve;
        });
        mockFetchPastAnalysesGlobal.mockImplementation(async () => {
          await act(async () => {
            // Wrap in act
            global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
            global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
          });
          if (initialFetchAnalysesPromiseResolve) initialFetchAnalysesPromiseResolve();
          return Promise.resolve(undefined);
        });
        (
          global.mockUseFileUploadManagerReturnValue.handleFileSelection as jest.Mock
        ).mockImplementation(handleFileSelectionMockImpl);

        await act(async () => {
          render(<HomePage />);
        });
        await act(async () => {
          await initialFetchAnalysesPromise;
        });

        const novaAnaliseButton = await screen.findByRole('button', { name: /Nova Análise/i });
        await userEvent.click(novaAnaliseButton);

        const fileInput = screen.getByLabelText(/Arquivo CSV de Dados/i);
        await userEvent.upload(fileInput, mockFile);
        handleFileSelectionMockImpl({
          target: { files: [mockFile] },
        } as React.ChangeEvent<HTMLInputElement>);

        const titleInput = screen.getByLabelText(/Título da Análise/i);
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
          expect(mockUploadFileAndCreateRecordGlobal).toHaveBeenCalledWith(
            mockUser,
            newAnalysisTitle,
            '',
            expect.any(String)
          );
        });
      });

      /**
       * @it It should start AI processing for the new analysis.
       */
      it('should start AI processing for the new analysis', async () => {
        act(() => {
          global.mockUseAnalysisManagerReturnValue.currentAnalysis = {
            id: newAnalysisId,
          } as Analysis;
          global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps =
            calculateDisplayedAnalysisSteps({
              id: newAnalysisId,
              status: 'summarizing_data',
            } as Analysis);
        });
        await waitFor(() => {
          expect(mockStartAiProcessingGlobal).toHaveBeenCalledWith(newAnalysisId, mockUser.uid);
        });
      });

      /**
       * @it It should display the AnalysisView for the newly uploaded and processing analysis.
       */
      it('should display the AnalysisView for the newly uploaded and processing analysis', async () => {
        act(() => {
          global.mockUseAnalysisManagerReturnValue.currentAnalysis = {
            id: newAnalysisId,
            title: newAnalysisTitle,
            status: 'summarizing_data',
            progress: 10,
          } as Analysis;
          global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps =
            calculateDisplayedAnalysisSteps({
              id: newAnalysisId,
              title: newAnalysisTitle,
              status: 'summarizing_data',
              progress: 10,
            } as Analysis);
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
      beforeEach(async () => {
        let firstFetchCompletedPromiseResolve: () => void;
        const firstFetchCompletedPromise = new Promise<void>((resolve) => {
          firstFetchCompletedPromiseResolve = resolve;
        });

        mockFetchPastAnalysesGlobal.mockImplementationOnce(async () => {
          await act(async () => {
            // Wrap in act
            global.mockUseAnalysisManagerReturnValue.pastAnalyses = [mockAnalysisItemCompleted];
            global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
          });
          if (firstFetchCompletedPromiseResolve) firstFetchCompletedPromiseResolve();
          return Promise.resolve(undefined);
        });

        mockHandleDeleteAnalysisGlobal.mockImplementation(async (id, cb) => {
          cb?.();
          return Promise.resolve();
        });

        await act(async () => {
          render(<HomePage />);
        });
        await act(async () => {
          await firstFetchCompletedPromise;
        });

        const accordionTrigger = await screen.findByText(mockAnalysisItemCompleted.title!);
        await act(async () => {
          await userEvent.click(accordionTrigger);
          global.mockUseAnalysisManagerReturnValue.currentAnalysis = mockAnalysisItemCompleted;
          global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps =
            calculateDisplayedAnalysisSteps(mockAnalysisItemCompleted);
        });
      });

      /**
       * @it It should allow deleting an analysis after confirmation.
       */
      it('should allow deleting an analysis after confirmation', async () => {
        await waitFor(() => {
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
        let secondFetchCompletedPromiseResolve: () => void;
        const secondFetchCompletedPromise = new Promise<void>((resolve) => {
          secondFetchCompletedPromiseResolve = resolve;
        });
        mockFetchPastAnalysesGlobal.mockImplementationOnce(async () => {
          // For the fetch after deletion
          await act(async () => {
            // Wrap in act
            global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
            global.mockUseAnalysisManagerReturnValue.currentAnalysis = null;
            global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
          });
          if (secondFetchCompletedPromiseResolve) secondFetchCompletedPromiseResolve();
          return Promise.resolve(undefined);
        });

        await userEvent.click(screen.getByRole('button', { name: /Excluir Análise/i }));
        const confirmButton = screen.getByRole('button', { name: 'Confirmar Exclusão' });
        await act(async () => {
          await userEvent.click(confirmButton);
        });

        await act(async () => {
          // Ensure React processes state changes from the delete & subsequent fetch
          await secondFetchCompletedPromise;
        });
        expect(
          await screen.findByText(/Nenhuma análise anterior encontrada./i)
        ).toBeInTheDocument();
        expect(global.mockUseAnalysisManagerReturnValue.currentAnalysis).toBeNull();
      });
    });
  });
});
