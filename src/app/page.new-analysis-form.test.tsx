/**
 * @fileoverview Test suite for HomePage New Analysis Form interactions.
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

describe('HomePage New Analysis Form', () => {
  let mockFetchPastAnalysesGlobal: jest.Mock;
  let mockStartAiProcessingGlobal: jest.Mock;

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
    mockStartAiProcessingGlobal = (
      global.mockUseAnalysisManagerReturnValue.startAiProcessing as jest.Mock
    ).mockClear();

    await act(async () => {
      global.mockUseAnalysisManagerReturnValue.currentAnalysis = null;
      global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
      global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = true;
      global.mockUseAnalysisManagerReturnValue.tagInput = '';
      global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps = [];
      (global.mockUseAnalysisManagerReturnValue.setCurrentAnalysis as jest.Mock).mockClear();
      (global.mockUseAnalysisManagerReturnValue.setTagInput as jest.Mock).mockClear();
    });

    mockFetchPastAnalysesGlobal.mockImplementation(async () => {
      await act(async () => {
        global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await act(async () => {
        global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
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
        uploadFileAndCreateRecord: jest.fn(),
      };
    }
    (global.mockUseFileUploadManagerReturnValue.uploadFileAndCreateRecord as jest.Mock).mockClear();
    (global.mockUseFileUploadManagerReturnValue.handleFileSelection as jest.Mock).mockClear();
    await act(async () => {
      global.mockUseFileUploadManagerReturnValue.fileToUpload = null;
      global.mockUseFileUploadManagerReturnValue.isUploading = false;
      global.mockUseFileUploadManagerReturnValue.uploadProgress = 0;
      global.mockUseFileUploadManagerReturnValue.uploadError = null;
    });
  });

  describe('when clicking the "New Analysis" button', () => {
    beforeEach(async () => {
      render(<HomePage />);
      await screen.findByText(/Nenhuma análise anterior encontrada./i, {}, { timeout: 5000 });
      await userEvent.click(screen.getByRole('button', { name: /Nova Análise/i }));
      await screen.findByText('Nova Análise de Conformidade', {}, { timeout: 5000 });
    });

    it('should display the NewAnalysisForm', () => {
      // The beforeEach already confirms "Nova Análise de Conformidade" is present.
      // We only need to check for another distinct element of the form.
      expect(screen.getByRole('button', { name: /Enviar e Iniciar Análise/i })).toBeInTheDocument();
    });

    it('should return to the dashboard view when "Cancel" is clicked in the NewAnalysisForm', async () => {
      await userEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
      expect(
        await screen.findByText(`Suas Análises Anteriores`, { exact: false }, { timeout: 5000 })
      ).toBeInTheDocument();
      expect(
        await screen.findByText(/Nenhuma análise anterior encontrada./i, {}, { timeout: 5000 })
      ).toBeInTheDocument();
    });
  });

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
          global.mockUseFileUploadManagerReturnValue.fileToUpload = fileToSet;
        });
      });

      render(<HomePage />);
      await screen.findByText(/Nenhuma análise anterior encontrada./i, {}, { timeout: 5000 });

      const novaAnaliseButton = screen.getByRole('button', { name: /Nova Análise/i });
      await userEvent.click(novaAnaliseButton);
      await screen.findByText('Nova Análise de Conformidade', {}, { timeout: 5000 });

      const fileInput = screen.getByLabelText(/Arquivo CSV de Dados/i);
      await userEvent.upload(fileInput, mockFile);

      const titleInput = await screen.findByLabelText(/Título da Análise/i);
      await waitFor(() => {
        expect(titleInput).toBeEnabled();
        expect(titleInput).toHaveValue(newFileName);
      });

      await userEvent.clear(titleInput);
      await userEvent.type(titleInput, newAnalysisTitle);

      const submitButton = screen.getByRole('button', { name: /Enviar e Iniciar Análise/i });
      await act(async () => {
        // Wrap submit in act
        await userEvent.click(submitButton);
      });
    });

    it('should call the upload and record creation process', async () => {
      await waitFor(() => {
        expect(
          global.mockUseFileUploadManagerReturnValue.uploadFileAndCreateRecord
        ).toHaveBeenCalledWith(mockUser, newAnalysisTitle, '', expect.any(String));
      });
    });

    it('should start AI processing for the new analysis', async () => {
      await waitFor(() => {
        // Wait for the mocked startAiProcessing to be called
        expect(mockStartAiProcessingGlobal).toHaveBeenCalledWith(newAnalysisId, mockUser.uid);
      });
    });

    it('should display the AnalysisView for the newly uploaded and processing analysis', async () => {
      // Simulate currentAnalysis being updated by the hook after upload/processing starts
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

      // Wait for the title to appear, which should imply the component is rendered.
      const analysisViewForNew = await screen.findByText(
        new RegExp(newAnalysisTitle, 'i'),
        {},
        { timeout: 5000 }
      );
      expect(analysisViewForNew).toBeInTheDocument();

      // Then assert the other elements which should now be present.
      expect(screen.getByText(/Upload do Arquivo e Preparação/i)).toBeInTheDocument();
      expect(screen.getByText(/Sumarizando Dados da Qualidade de Energia/i)).toBeInTheDocument();
    });
  });
});
