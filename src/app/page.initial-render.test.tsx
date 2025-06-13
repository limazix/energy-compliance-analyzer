/**
 * @fileoverview Test suite for HomePage initial rendering for authenticated users.
 */
import { act, render, screen, waitFor } from '@testing-library/react';

import { useAuth as originalUseAuth } from '@/contexts/auth-context';

import HomePage from './page';

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

// Firebase auth mock helper
let setMockUserForAuthStateChangedListener: (user: User | null) => void;

describe('HomePage Initial Render (Authenticated)', () => {
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
      global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = true; // Start loading
      global.mockUseAnalysisManagerReturnValue.tagInput = '';
      global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps = [];
      (global.mockUseAnalysisManagerReturnValue.setCurrentAnalysis as jest.Mock).mockClear();
      (global.mockUseAnalysisManagerReturnValue.setTagInput as jest.Mock).mockClear();
    });

    mockFetchPastAnalysesGlobal.mockImplementation(async () => {
      await act(async () => {
        global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 10)); // Simulate network delay
      await act(async () => {
        global.mockUseAnalysisManagerReturnValue.pastAnalyses = []; // No analyses for initial render test
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
        render(<HomePage />);
        await waitFor(() => expect(mockFetchPastAnalysesGlobal).toHaveBeenCalled());
        // Wait for the loading state to resolve and "No past analyses" to show
        await screen.findByText(/Nenhuma análise anterior encontrada./i, {}, { timeout: 5000 });
      });

      it('should render the AppHeader with a "New Analysis" button', () => {
        expect(screen.getByRole('button', { name: /Nova Análise/i })).toBeInTheDocument();
      });

      it('should display the "Your Past Analyses" section title', async () => {
        expect(
          // Using findByText which includes waitFor, though getByText might also work here
          // if the rendering order guarantees the title is present after "Nenhuma análise".
          await screen.findByText(`Suas Análises Anteriores`, { exact: false }, { timeout: 5000 })
        ).toBeInTheDocument();
      });

      it('should display "No past analyses found" if there are no analyses', () => {
        // Since findByText in beforeEach already confirmed this, we can use getByText.
        // This test now primarily serves as a clear, human-readable statement of an expected condition.
        expect(screen.getByText(/Nenhuma análise anterior encontrada./i)).toBeInTheDocument();
      });
    });
  });
});
