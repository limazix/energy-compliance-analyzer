/**
 * @fileoverview Test suite for HomePage general analysis management (e.g., deletion).
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

const mockAnalysisItemForDelete: Analysis = {
  id: 'analysis-id-to-delete-04',
  userId: mockUser.uid,
  fileName: 'data_to_delete.csv',
  title: 'Análise para Excluir',
  status: 'completed', // Can be any non-in-progress state for delete
  progress: 100,
  createdAt: new Date().toISOString(),
  tags: ['delete_me'],
} as Analysis;

// Firebase auth mock helper
let setMockUserForAuthStateChangedListener: (user: User | null) => void;

describe('HomePage Analysis Management (Deletion)', () => {
  let mockFetchPastAnalysesGlobal: jest.Mock;
  let mockHandleDeleteAnalysisGlobal: jest.Mock;

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
    mockHandleDeleteAnalysisGlobal = (
      global.mockUseAnalysisManagerReturnValue.handleDeleteAnalysis as jest.Mock
    ).mockClear();

    await act(async () => {
      global.mockUseAnalysisManagerReturnValue.currentAnalysis = null;
      global.mockUseAnalysisManagerReturnValue.pastAnalyses = [mockAnalysisItemForDelete];
      global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
      (global.mockUseAnalysisManagerReturnValue.setCurrentAnalysis as jest.Mock).mockClear();
    });

    mockFetchPastAnalysesGlobal.mockImplementation(async () => {
      await act(async () => {
        global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await act(async () => {
        global.mockUseAnalysisManagerReturnValue.pastAnalyses = [mockAnalysisItemForDelete]; // Start with the item to delete
        global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
      });
    });

    (mockHandleDeleteAnalysisGlobal as jest.Mock).mockImplementation(
      async (_id, cb?: () => void | Promise<void>) => {
        if (cb && typeof cb === 'function') {
          await cb(); // Ensure async callback is awaited
        }
      }
    );

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
    await screen.findByText(mockAnalysisItemForDelete.title!);

    const accordionTrigger = screen.getByText(mockAnalysisItemForDelete.title!);
    await act(async () => {
      await userEvent.click(accordionTrigger);
    });
    // Simulate currentAnalysis update
    await act(async () => {
      global.mockUseAnalysisManagerReturnValue.currentAnalysis = mockAnalysisItemForDelete;
      global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps =
        calculateDisplayedAnalysisSteps(mockAnalysisItemForDelete);
    });
    await screen.findByText(/Análise Concluída com Sucesso!/i); // Or appropriate for status
  });

  it('should allow deleting an analysis after confirmation', async () => {
    await userEvent.click(screen.getByRole('button', { name: /Excluir Análise/i }));

    const confirmDialogTitle = await screen.findByRole('heading', { name: 'Confirmar Exclusão' });
    expect(confirmDialogTitle).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: 'Confirmar Exclusão' });
    await act(async () => {
      await userEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(mockHandleDeleteAnalysisGlobal).toHaveBeenCalledWith(
        mockAnalysisItemForDelete.id,
        expect.any(Function) // The callback function
      );
    });
  });

  it('should update the list of past analyses after deletion', async () => {
    // Mock fetchPastAnalyses to simulate empty list after deletion
    // This specific mock will be called by afterDeleteAnalysis callback
    const fetchAfterDeleteMock = jest.fn(async () => {
      // Simulate the loading sequence more explicitly
      await act(async () => {
        global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = true;
      });
      // Short delay to ensure isLoadingPastAnalyses is true before setting to false
      await new Promise((resolve) => setTimeout(resolve, 50)); // Increased delay slightly
      await act(async () => {
        global.mockUseAnalysisManagerReturnValue.pastAnalyses = []; // Simulate empty list
        global.mockUseAnalysisManagerReturnValue.currentAnalysis = null;
        global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
      });
    });
    global.mockUseAnalysisManagerReturnValue.fetchPastAnalyses = fetchAfterDeleteMock;

    await userEvent.click(screen.getByRole('button', { name: /Excluir Análise/i }));
    const confirmButton = await screen.findByRole('button', { name: 'Confirmar Exclusão' });

    await act(async () => {
      await userEvent.click(confirmButton);
    });

    // Wait for the fetchAfterDeleteMock to have been called due to the onDeleted callback
    await waitFor(() => {
      expect(fetchAfterDeleteMock).toHaveBeenCalledTimes(1);
    });

    // Now check the UI state, waiting for "Nenhuma análise anterior encontrada."
    // This ensures that the component has re-rendered based on the updated pastAnalyses.
    await waitFor(
      async () => {
        expect(
          await screen.findByText(/Nenhuma análise anterior encontrada./i)
        ).toBeInTheDocument();
      },
      { timeout: 10000 } // Increased timeout for this specific check
    );

    expect(screen.queryByText(mockAnalysisItemForDelete.title!)).not.toBeInTheDocument();
    expect(global.mockUseAnalysisManagerReturnValue.currentAnalysis).toBeNull();
  }, 15000); // Increased timeout for the entire test case to 15 seconds
});
