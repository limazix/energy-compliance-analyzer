/**
 * @fileoverview Test suite for HomePage displaying past analyses.
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

const mockUser: User = {
  uid: 'test-user-001',
  displayName: 'Test User One',
  // ... other user properties
} as User;

const mockAnalysisItemCompleted: Analysis = {
  id: 'analysis-id-completed-01',
  userId: mockUser.uid,
  fileName: 'aneel_data_report_alpha.csv',
  title: 'Relatório de Conformidade Alpha',
  status: 'completed',
  progress: 100,
  createdAt: new Date('2023-10-25T10:00:00Z').toISOString(),
  tags: [],
  // ... other completed analysis properties
} as Analysis;

const mockAnalysisItemInProgress: Analysis = {
  id: 'analysis-id-inprogress-02',
  userId: mockUser.uid,
  fileName: 'power_quality_beta_set.csv',
  title: 'Análise Beta em Andamento',
  status: 'summarizing_data',
  progress: 30,
  createdAt: new Date('2023-10-27T09:00:00Z').toISOString(),
  tags: [],
  // ... other in-progress analysis properties
} as Analysis;

// Firebase auth mock helper
let setMockUserForAuthStateChangedListener: (user: User | null) => void;

describe('HomePage Past Analyses Display', () => {
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
      global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
      global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = true;
      (global.mockUseAnalysisManagerReturnValue.setCurrentAnalysis as jest.Mock).mockClear();
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
  });

  describe('when past analyses exist', () => {
    beforeEach(async () => {
      mockFetchPastAnalysesGlobal.mockImplementation(async () => {
        await act(async () => {
          global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = true;
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
        await act(async () => {
          global.mockUseAnalysisManagerReturnValue.pastAnalyses = [
            mockAnalysisItemCompleted,
            mockAnalysisItemInProgress,
          ];
          global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
        });
      });

      render(<HomePage />);
      await waitFor(() => expect(mockFetchPastAnalysesGlobal).toHaveBeenCalled());
      await screen.findByText(mockAnalysisItemCompleted.title!);
      await screen.findByText(mockAnalysisItemInProgress.title!);
    });

    it('should display each past analysis in an accordion', async () => {
      expect(screen.getByText(mockAnalysisItemCompleted.title!)).toBeInTheDocument();
      expect(screen.getByText(mockAnalysisItemInProgress.title!)).toBeInTheDocument();
    });

    it('should expand an accordion item to show the AnalysisView for the selected analysis', async () => {
      const completedAnalysisAccordionTrigger = screen.getByText(mockAnalysisItemCompleted.title!);
      await act(async () => {
        await userEvent.click(completedAnalysisAccordionTrigger);
      });
      // Simulate currentAnalysis update by the hook
      await act(async () => {
        global.mockUseAnalysisManagerReturnValue.currentAnalysis = mockAnalysisItemCompleted;
        global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps =
          calculateDisplayedAnalysisSteps(mockAnalysisItemCompleted);
      });

      await waitFor(() => {
        const analysisViewTitle = screen.getByText(
          new RegExp(mockAnalysisItemCompleted.title!, 'i')
        );
        expect(analysisViewTitle).toBeInTheDocument();
        // Check for a specific element from AnalysisResultsDisplay for completed analyses
        expect(screen.getByText(/Análise Concluída com Sucesso!/i)).toBeInTheDocument();
      });
    });
  });
});
