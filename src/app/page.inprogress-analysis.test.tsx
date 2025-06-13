/**
 * @fileoverview Test suite for HomePage interactions with in-progress analyses.
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
  isDataChunked: true,
  tags: ['cliente_beta', 'realtime'],
  createdAt: new Date('2023-10-27T09:00:00Z').toISOString(),
} as Analysis;

// Firebase auth mock helper
let setMockUserForAuthStateChangedListener: (user: User | null) => void;

describe('HomePage In-Progress Analysis Interactions', () => {
  let mockFetchPastAnalysesGlobal: jest.Mock;
  let mockHandleCancelAnalysisGlobal: jest.Mock;

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
    mockHandleCancelAnalysisGlobal = (
      global.mockUseAnalysisManagerReturnValue.handleCancelAnalysis as jest.Mock
    ).mockClear();

    await act(async () => {
      global.mockUseAnalysisManagerReturnValue.currentAnalysis = null;
      global.mockUseAnalysisManagerReturnValue.pastAnalyses = [mockAnalysisItemInProgress];
      global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
      (global.mockUseAnalysisManagerReturnValue.setCurrentAnalysis as jest.Mock).mockClear();
    });

    mockFetchPastAnalysesGlobal.mockImplementation(async () => {
      await act(async () => {
        global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await act(async () => {
        global.mockUseAnalysisManagerReturnValue.pastAnalyses = [mockAnalysisItemInProgress];
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
    await screen.findByText(mockAnalysisItemInProgress.title!);

    const accordionTrigger = screen.getByText(mockAnalysisItemInProgress.title!);
    await act(async () => {
      await userEvent.click(accordionTrigger);
    });
    // Simulate currentAnalysis update
    await act(async () => {
      global.mockUseAnalysisManagerReturnValue.currentAnalysis = mockAnalysisItemInProgress;
      global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps =
        calculateDisplayedAnalysisSteps(mockAnalysisItemInProgress);
    });
    await screen.findByText(/Progresso da Análise:/i);
  });

  it('should allow cancelling an analysis after confirmation', async () => {
    await userEvent.click(screen.getByRole('button', { name: /Cancelar Análise/i }));
    const confirmDialogTitle = await screen.findByText('Confirmar Cancelamento');
    expect(confirmDialogTitle).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: 'Confirmar Cancelamento' });
    await act(async () => {
      // Wrap in act for state updates
      await userEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(mockHandleCancelAnalysisGlobal).toHaveBeenCalledWith(mockAnalysisItemInProgress.id);
    });
  });
});
