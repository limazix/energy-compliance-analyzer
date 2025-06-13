/**
 * @fileoverview Test suite for HomePage interactions with errored analyses.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useAuth as originalUseAuth } from '@/contexts/auth-context';
import { calculateDisplayedAnalysisSteps } from '@/features/analysis-processing/utils/analysisStepsUtils';
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

jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  useParams: jest.fn(() => ({})),
}));

const mockUser: User = { uid: 'test-user-001' } as User;

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
} as Analysis;

// Firebase auth mock helper
let setMockUserForAuthStateChangedListener: (user: User | null) => void;

describe('HomePage Errored Analysis Interactions', () => {
  let mockFetchPastAnalysesGlobal: jest.Mock;
  let mockHandleRetryAnalysisGlobal: jest.Mock;

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
    mockHandleRetryAnalysisGlobal = (
      global.mockUseAnalysisManagerReturnValue.handleRetryAnalysis as jest.Mock
    ).mockClear();

    await act(async () => {
      global.mockUseAnalysisManagerReturnValue.currentAnalysis = null;
      global.mockUseAnalysisManagerReturnValue.pastAnalyses = [mockAnalysisItemError];
      global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
      (global.mockUseAnalysisManagerReturnValue.setCurrentAnalysis as jest.Mock).mockClear();
    });

    mockFetchPastAnalysesGlobal.mockImplementation(async () => {
      await act(async () => {
        global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await act(async () => {
        global.mockUseAnalysisManagerReturnValue.pastAnalyses = [mockAnalysisItemError];
        global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
      });
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
    await screen.findByText(mockAnalysisItemError.title!);

    const accordionTrigger = screen.getByText(mockAnalysisItemError.title!);
    await act(async () => {
      await userEvent.click(accordionTrigger);
    });
    // Simulate currentAnalysis update
    await act(async () => {
      global.mockUseAnalysisManagerReturnValue.currentAnalysis = mockAnalysisItemError;
      global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps =
        calculateDisplayedAnalysisSteps(mockAnalysisItemError);
    });
    await screen.findByText(/Ocorreu um Erro/i);
  });

  it('should allow retrying a failed analysis', async () => {
    await userEvent.click(screen.getByRole('button', { name: /Tentar Novamente/i }));
    await waitFor(() => {
      expect(mockHandleRetryAnalysisGlobal).toHaveBeenCalledWith(mockAnalysisItemError.id);
    });
  });
});
