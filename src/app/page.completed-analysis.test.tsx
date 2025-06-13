/**
 * @fileoverview Test suite for HomePage interactions with completed analyses.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useAuth as originalUseAuth } from '@/contexts/auth-context';
import { calculateDisplayedAnalysisSteps } from '@/features/analysis-processing/utils/analysisStepsUtils';
import { getAnalysisReportAction as originalGetAnalysisReportAction } from '@/features/report-viewing/actions/reportViewingActions';
import type { Analysis } from '@/types/analysis';

import HomePage from './page';

import type { User } from 'firebase/auth';

// Mocks
jest.mock('@/contexts/auth-context', () => ({
  __esModule: true,
  ...jest.requireActual('@/contexts/auth-context'),
  useAuth: jest.fn(),
}));
const useAuth = originalUseAuth as jest.Mock;

const mockRouterPush = jest.fn();
jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  useRouter: () => ({ push: mockRouterPush, replace: jest.fn() }),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  useParams: jest.fn(() => ({})),
}));

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

// Firebase auth mock helper
let setMockUserForAuthStateChangedListener: (user: User | null) => void;

describe('HomePage Completed Analysis Interactions', () => {
  let mockFetchPastAnalysesGlobal: jest.Mock;

  beforeEach(async () => {
    const authMockModule = jest.requireMock('firebase/auth') as {
      __setMockUserForAuthStateChangedListener: (user: User | null) => void;
    };
    setMockUserForAuthStateChangedListener =
      authMockModule.__setMockUserForAuthStateChangedListener;

    await act(async () => {
      setMockUserForAuthStateChangedListener(mockUser);
    });
    useAuth.mockReturnValue({ user: mockUser, loading: false });

    if (!global.mockUseAnalysisManagerReturnValue) {
      global.mockUseAnalysisManagerReturnValue = {
        fetchPastAnalyses: jest.fn(),
        currentAnalysis: null,
        pastAnalyses: [],
        isLoadingPastAnalyses: true,
        setCurrentAnalysis: jest.fn(),
        tagInput: '',
        setTagInput: jest.fn(),
        startAiProcessing: jest.fn(),
        handleAddTag: jest.fn(),
        handleRemoveTag: jest.fn(),
        handleDeleteAnalysis: jest.fn(),
        handleCancelAnalysis: jest.fn(),
        handleRetryAnalysis: jest.fn(),
        downloadReportAsTxt: jest.fn(),
        displayedAnalysisSteps: [],
      };
    }
    mockFetchPastAnalysesGlobal = (
      global.mockUseAnalysisManagerReturnValue.fetchPastAnalyses as jest.Mock
    ).mockClear();

    await act(async () => {
      global.mockUseAnalysisManagerReturnValue.currentAnalysis = null;
      global.mockUseAnalysisManagerReturnValue.pastAnalyses = [mockAnalysisItemCompleted]; // Seed with completed analysis
      global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
      (global.mockUseAnalysisManagerReturnValue.setCurrentAnalysis as jest.Mock).mockClear();
    });

    mockFetchPastAnalysesGlobal.mockImplementation(async () => {
      await act(async () => {
        global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await act(async () => {
        global.mockUseAnalysisManagerReturnValue.pastAnalyses = [mockAnalysisItemCompleted];
        global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
      });
    });

    getAnalysisReportAction.mockResolvedValue({
      mdxContent: `# Test Report for ${mockAnalysisItemCompleted.id}`,
      fileName: mockAnalysisItemCompleted.fileName,
      analysisId: mockAnalysisItemCompleted.id,
      error: null,
    });

    if (!global.mockUseFileUploadManagerReturnValue) {
      global.mockUseFileUploadManagerReturnValue = {
        fileToUpload: null,
        isUploading: false,
        uploadProgress: 0,
        uploadError: null,
        handleFileSelection: jest.fn(),
        uploadFileAndCreateRecord: jest
          .fn()
          .mockResolvedValue({ analysisId: 'mock-id', fileName: 'mock.csv' }),
      };
    }

    render(<HomePage />);
    await waitFor(() => expect(mockFetchPastAnalysesGlobal).toHaveBeenCalled());
    await screen.findByText(mockAnalysisItemCompleted.title!);

    const completedAnalysisAccordionTrigger = screen.getByText(mockAnalysisItemCompleted.title!);
    await act(async () => {
      await userEvent.click(completedAnalysisAccordionTrigger);
    });
    // Simulate currentAnalysis update
    await act(async () => {
      global.mockUseAnalysisManagerReturnValue.currentAnalysis = mockAnalysisItemCompleted;
      global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps =
        calculateDisplayedAnalysisSteps(mockAnalysisItemCompleted);
    });
    await screen.findByText(/Análise Concluída com Sucesso!/i);
  });

  it('should navigate to the ReportPage when "Visualizar Relatório Detalhado" is clicked for a completed analysis', async () => {
    const viewReportButton = screen.getByRole('link', { name: /Visualizar Relatório Detalhado/i });
    await userEvent.click(viewReportButton);
    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith(`/report/${mockAnalysisItemCompleted.id}`);
    });
  });
});
