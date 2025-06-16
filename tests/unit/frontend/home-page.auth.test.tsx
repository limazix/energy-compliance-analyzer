/**
 * @fileoverview Test suite for HomePage authentication scenarios.
 */
import { act, render, waitFor } from '@testing-library/react';

import HomePage from '@/app/page';
import { useAuth as originalUseAuth } from '@/contexts/auth-context';

import type { User } from 'firebase/auth';

// Mocks
jest.mock('@/contexts/auth-context', () => ({
  __esModule: true,
  ...jest.requireActual('@/contexts/auth-context'),
  useAuth: jest.fn(),
}));
const useAuth = originalUseAuth as jest.Mock;

const mockRouterReplace = jest.fn();
jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  useRouter: () => ({
    push: jest.fn(),
    replace: mockRouterReplace,
  }),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  useParams: jest.fn(() => ({})),
}));

// Firebase auth mock helper
let setMockUserForAuthStateChangedListener: (user: User | null) => void;

describe('HomePage Authentication', () => {
  beforeEach(async () => {
    mockRouterReplace.mockClear();
    const authMockModule = jest.requireMock('firebase/auth') as {
      __setMockUserForAuthStateChangedListener: (user: User | null) => void;
    };
    setMockUserForAuthStateChangedListener =
      authMockModule.__setMockUserForAuthStateChangedListener;

    // Default to no user for these auth tests unless overridden
    await act(async () => {
      setMockUserForAuthStateChangedListener(null);
    });
    useAuth.mockReturnValue({ user: null, loading: false });

    // Mock useAnalysisManager minimal setup for HomePage rendering without errors
    if (!global.mockUseAnalysisManagerReturnValue) {
      global.mockUseAnalysisManagerReturnValue = {
        fetchPastAnalyses: jest.fn().mockResolvedValue(undefined),
        currentAnalysis: null,
        pastAnalyses: [],
        isLoadingPastAnalyses: false,
        // Add other properties with default mock values as needed by HomePage
        setCurrentAnalysis: jest.fn(),
        tagInput: '',
        setTagInput: jest.fn(),
        startAiProcessing: jest.fn().mockResolvedValue(undefined),
        handleAddTag: jest.fn().mockResolvedValue(undefined),
        handleRemoveTag: jest.fn().mockResolvedValue(undefined),
        handleDeleteAnalysis: jest.fn().mockResolvedValue(undefined),
        handleCancelAnalysis: jest.fn().mockResolvedValue(undefined),
        handleRetryAnalysis: jest.fn().mockResolvedValue(undefined),
        downloadReportAsTxt: jest.fn(),
        displayedAnalysisSteps: [],
      };
    }
    (global.mockUseAnalysisManagerReturnValue.fetchPastAnalyses as jest.Mock).mockImplementation(
      async () => {
        await act(async () => {
          global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
          global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
        });
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
  });

  /**
   * @describe Scenario: Given the user is not authenticated.
   */
  describe('given the user is not authenticated', () => {
    /**
     * @it It should redirect to the login page.
     */
    it('should redirect to the login page', async () => {
      // useAuth is already returning { user: null, loading: false } from beforeEach
      await act(async () => {
        render(<HomePage />);
      });
      await waitFor(() => {
        expect(mockRouterReplace).toHaveBeenCalledWith('/login');
      });
    });
  });

  /**
   * @describe Scenario: Given authentication is loading.
   */
  describe('given authentication is loading', () => {
    /**
     * @it It should show a loading indicator.
     */
    it('should show a loading indicator', async () => {
      useAuth.mockReturnValue({ user: null, loading: true });
      render(<HomePage />);
      // Assuming HomePage shows a generic loader when authLoading is true
      // (as implemented in AuthProvider and HomePage itself)
      expect(screen.getByRole('progressbar', { hidden: true })).toBeInTheDocument(); // A common way to find spinners
    });
  });
});
