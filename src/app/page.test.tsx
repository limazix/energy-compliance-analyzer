
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import HomePage from './page';
import { useAuth as originalUseAuth } from '@/contexts/auth-context';
import { useAnalysisManager as originalUseAnalysisManager } from '@/hooks/useAnalysisManager';
import { useFileUploadManager as originalUseFileUploadManager } from '@/features/file-upload/hooks/useFileUploadManager';
import type { Analysis } from '@/types/analysis';
import { Timestamp } from 'firebase/firestore';

// Mocks
jest.mock('@/contexts/auth-context', () => ({
  __esModule: true,
  ...jest.requireActual('@/contexts/auth-context'),
  useAuth: jest.fn(),
}));
const useAuth = originalUseAuth as jest.Mock;

jest.mock('@/hooks/useAnalysisManager');
const useAnalysisManager = originalUseAnalysisManager as jest.Mock;

jest.mock('@/features/file-upload/hooks/useFileUploadManager');
const useFileUploadManager = originalUseFileUploadManager as jest.Mock;

// Server action mocks are in jest.setup.js

const mockRouterReplace = jest.requireMock('next/navigation').useRouter().replace;
const mockRouterPush = jest.requireMock('next/navigation').useRouter().push;

const mockUser = {
  uid: 'test-user-id',
  displayName: 'Dr. Test User',
  email: 'test@example.com',
  photoURL: 'https://placehold.co/100x100.png'
};

const mockAnalysisItemCompleted: Analysis = {
  id: 'analysis-completed-1',
  userId: mockUser.uid,
  fileName: 'completed-data.csv',
  title: 'Completed Analysis Sample',
  status: 'completed',
  progress: 100,
  tags: ['important', 'prodist'],
  createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
  completedAt: new Date(Date.now() - 86400000 * 1).toISOString(), // 1 day ago
  summary: 'This is a summary of the completed analysis.',
  structuredReport: {
    reportMetadata: { title: 'Completed Report', author: 'AI', generatedDate: new Date().toISOString().split('T')[0], subtitle: 'Mock Subtitle' },
    introduction: { objective: 'Test obj', overallResultsSummary: 'All good', usedNormsOverview: 'ANEEL XYZ' },
    analysisSections: [],
    finalConsiderations: 'None',
    bibliography: [],
    tableOfContents: [],
  },
  mdxReportStoragePath: `user_reports/${mockUser.uid}/analysis-completed-1/report.mdx`,
};

const mockAnalysisItemInProgress: Analysis = {
  id: 'analysis-inprogress-1',
  userId: mockUser.uid,
  fileName: 'inprogress-data.csv',
  title: 'Analysis In Progress',
  status: 'summarizing_data',
  progress: 30,
  tags: ['realtime'],
  createdAt: new Date().toISOString(),
};


describe('HomePage - Navigation and Views', () => {
  let mockSetCurrentAnalysis: jest.Mock;
  let mockFetchPastAnalyses: jest.Mock;
  let mockStartAiProcessing: jest.Mock;
  let mockUploadFileAndCreateRecord: jest.Mock;
  let mockHandleDeleteAnalysis: jest.Mock;
  let mockHandleCancelAnalysis: jest.Mock;

  beforeEach(() => {
    // Reset all navigation mocks
    mockRouterPush.mockClear();
    mockRouterReplace.mockClear();

    // Setup hook mocks
    mockSetCurrentAnalysis = jest.fn();
    mockFetchPastAnalyses = jest.fn().mockResolvedValue(undefined);
    mockStartAiProcessing = jest.fn().mockResolvedValue(undefined);
    mockUploadFileAndCreateRecord = jest.fn().mockResolvedValue({
      analysisId: 'new-analysis-id',
      fileName: 'new-file.csv',
      error: null,
    });
    mockHandleDeleteAnalysis = jest.fn((id, cb) => { cb?.(); return Promise.resolve(); });
    mockHandleCancelAnalysis = jest.fn().mockResolvedValue(undefined);

    useAuth.mockReturnValue({ user: mockUser, loading: false });
    
    // Use a fresh mock object for each test to avoid interference
    const currentMockAnalysisManagerValue = {
      currentAnalysis: null,
      setCurrentAnalysis: mockSetCurrentAnalysis,
      pastAnalyses: [],
      isLoadingPastAnalyses: false,
      tagInput: '',
      setTagInput: jest.fn(),
      fetchPastAnalyses: mockFetchPastAnalyses,
      startAiProcessing: mockStartAiProcessing,
      handleAddTag: jest.fn(),
      handleRemoveTag: jest.fn(),
      handleDeleteAnalysis: mockHandleDeleteAnalysis,
      handleCancelAnalysis: mockHandleCancelAnalysis,
      downloadReportAsTxt: jest.fn(),
      displayedAnalysisSteps: [],
    };
    useAnalysisManager.mockReturnValue(currentMockAnalysisManagerValue);

    useFileUploadManager.mockReturnValue({
      fileToUpload: null,
      isUploading: false,
      uploadProgress: 0,
      uploadError: null,
      handleFileSelection: jest.fn(),
      uploadFileAndCreateRecord: mockUploadFileAndCreateRecord,
    });

    // Mock Firestore interaction via server actions if needed (already in jest.setup.js)
    const getPastAnalysesActionMock = jest.requireMock('@/features/analysis-listing/actions/analysisListingActions').getPastAnalysesAction;
    getPastAnalysesActionMock.mockResolvedValue([]);

    const { getAnalysisReportAction } = jest.requireMock('@/features/report-viewing/actions/reportViewingActions');
    getAnalysisReportAction.mockResolvedValue({
        mdxContent: `# Test Report for ${mockAnalysisItemCompleted.id}`,
        fileName: mockAnalysisItemCompleted.fileName,
        analysisId: mockAnalysisItemCompleted.id,
        error: null,
    });
  });

  test('redirects to /login if user is not authenticated', async () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    render(<HomePage />);
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/login');
    });
  });

  test('renders default view (Past Analyses Accordion) for authenticated user, including AppHeader with "Nova Análise" button', () => {
    render(<HomePage />);
    // Check for AppHeader content specific to authenticated user
    expect(screen.getByRole('button', { name: /Nova Análise/i })).toBeInTheDocument(); 
    // Check for HomePage specific content
    expect(screen.getByText(`Suas Análises Anteriores`)).toBeInTheDocument();
  });

  test('navigates to NewAnalysisForm when "Nova Análise" is clicked and back to Dashboard on cancel', () => {
    render(<HomePage />);
    fireEvent.click(screen.getByRole('button', { name: /Nova Análise/i }));
    expect(screen.getByText('Nova Análise de Conformidade')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar e Iniciar Análise/i})).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(screen.getByText('Suas Análises Anteriores')).toBeInTheDocument();
  });

  test('displays past analyses in accordion and expands to show AnalysisView', async () => {
    const mockPastAnalyses = [mockAnalysisItemCompleted, mockAnalysisItemInProgress];
    // Update the mock return value for useAnalysisManager for this specific test
    useAnalysisManager.mockReturnValue({
      ...global.mockUseAnalysisManagerReturnValue, // Use the base from jest.setup.js
      setCurrentAnalysis: mockSetCurrentAnalysis,
      pastAnalyses: mockPastAnalyses,
      fetchPastAnalyses: mockFetchPastAnalyses.mockResolvedValue(undefined),
    });
    
    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText(mockAnalysisItemCompleted.title!)).toBeInTheDocument();
      expect(screen.getByText(mockAnalysisItemInProgress.title!)).toBeInTheDocument();
    });

    const completedAnalysisAccordionTrigger = screen.getByText(mockAnalysisItemCompleted.title!);
    fireEvent.click(completedAnalysisAccordionTrigger);

    await waitFor(() => {
      expect(mockSetCurrentAnalysis).toHaveBeenCalledWith(mockAnalysisItemCompleted);
    });
    
    // Simulate that currentAnalysis is now set in the hook's return value
    useAnalysisManager.mockReturnValueOnce({
      ...global.mockUseAnalysisManagerReturnValue,
      currentAnalysis: mockAnalysisItemCompleted, // IMPORTANT: set currentAnalysis
      setCurrentAnalysis: mockSetCurrentAnalysis,
      pastAnalyses: mockPastAnalyses,
      fetchPastAnalyses: mockFetchPastAnalyses,
      displayedAnalysisSteps: [{name: "Upload do Arquivo e Preparação", status: "completed", progress: 100}], // Mock steps for completed
    });
    
    // Re-render or wait for component to update with new currentAnalysis
    // Since the component re-renders internally when state changes, we just need to wait for assertions.
    await waitFor(() => {
        const analysisViewTitle = screen.getByText(new RegExp(mockAnalysisItemCompleted.title!, 'i'));
        expect(analysisViewTitle).toBeInTheDocument();
        // Check for elements specific to AnalysisView for a 'completed' analysis
        expect(screen.getByText(/Análise Concluída com Sucesso!/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Visualizar Relatório Detalhado/i})).toBeInTheDocument();
    });
  });

  test('navigates to ReportPage when "Visualizar Relatório Detalhado" is clicked', async () => {
     useAnalysisManager.mockReturnValue({
      ...global.mockUseAnalysisManagerReturnValue,
      currentAnalysis: mockAnalysisItemCompleted,
      setCurrentAnalysis: mockSetCurrentAnalysis,
      pastAnalyses: [mockAnalysisItemCompleted],
      displayedAnalysisSteps: [{name: "Upload", status: "completed", progress: 100}],
    });

    render(<HomePage />);
    
    // Expand the accordion for the completed analysis
    const completedAnalysisAccordionTrigger = screen.getByText(mockAnalysisItemCompleted.title!);
    fireEvent.click(completedAnalysisAccordionTrigger);

    await waitFor(() => {
        expect(screen.getByText(/Análise Concluída com Sucesso!/i)).toBeInTheDocument();
    });

    const viewReportButton = screen.getByRole('button', { name: /Visualizar Relatório Detalhado/i });
    fireEvent.click(viewReportButton);

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith(`/report/${mockAnalysisItemCompleted.id}`);
    });
  });

  test('simulates file upload and navigates to AnalysisView for the new analysis', async () => {
    const newFileName = 'uploaded-test-file.csv';
    const newAnalysisId = `mock-analysis-id-for-${newFileName}`;
    const newAnalysisTitle = 'Freshly Uploaded Analysis';

    const mockNewAnalysisData: Analysis = {
      id: newAnalysisId,
      userId: mockUser.uid,
      fileName: newFileName,
      title: newAnalysisTitle,
      status: 'summarizing_data', // Initial status after finalizeFileUploadRecordAction
      progress: 10,
      uploadProgress: 100,
      createdAt: new Date().toISOString(),
      tags: [],
    };
    
    // Mock for useFileUploadManager
    const handleFileSelectionMock = jest.fn();
    useFileUploadManager.mockReturnValue({
      fileToUpload: new File(['col1,col2\nval1,val2'], newFileName, { type: 'text/csv' }),
      isUploading: false,
      uploadProgress: 0,
      uploadError: null,
      handleFileSelection: handleFileSelectionMock,
      uploadFileAndCreateRecord: mockUploadFileAndCreateRecord.mockResolvedValue({
        analysisId: newAnalysisId,
        fileName: newFileName,
        title: newAnalysisTitle,
        error: null,
      }),
    });

    // Mock for useAnalysisManager (specifically after upload)
     const setCurrentAnalysisForUpload = jest.fn();
     const startAiProcessingForUpload = jest.fn().mockResolvedValue(undefined);
     useAnalysisManager.mockReturnValue({
        ...global.mockUseAnalysisManagerReturnValue,
        setCurrentAnalysis: setCurrentAnalysisForUpload,
        startAiProcessing: startAiProcessingForUpload,
        fetchPastAnalyses: mockFetchPastAnalyses.mockResolvedValue(undefined), // To avoid errors on refetch
     });

    render(<HomePage />);

    // 1. Open the New Analysis Form
    fireEvent.click(screen.getByRole('button', { name: /Nova Análise/i }));
    await screen.findByText('Nova Análise de Conformidade');
    
    // 2. Fill in title (optional, as filename is default)
    const titleInput = screen.getByLabelText(/Título da Análise/i);
    fireEvent.change(titleInput, { target: { value: newAnalysisTitle } });

    // 3. Click "Enviar e Iniciar Análise"
    const submitButton = screen.getByRole('button', { name: /Enviar e Iniciar Análise/i });
    
    await act(async () => {
      fireEvent.click(submitButton);
    });
    
    // 4. Assertions
    await waitFor(() => {
      expect(mockUploadFileAndCreateRecord).toHaveBeenCalledWith(
        mockUser, // user object
        newAnalysisTitle, // title
        '', // description (empty in this test)
        expect.any(String) // languageCode
      );
    });
    
    await waitFor(() => {
      expect(setCurrentAnalysisForUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          id: newAnalysisId,
          fileName: newFileName,
          title: newAnalysisTitle,
        })
      );
    });

    await waitFor(() => {
        expect(startAiProcessingForUpload).toHaveBeenCalledWith(newAnalysisId, mockUser.uid);
    });
    
    useAnalysisManager.mockReturnValueOnce({
      ...global.mockUseAnalysisManagerReturnValue,
      currentAnalysis: { 
          ...mockNewAnalysisData,
          createdAt: new Date(mockNewAnalysisData.createdAt).toISOString(), 
      },
      setCurrentAnalysis: setCurrentAnalysisForUpload,
      startAiProcessing: startAiProcessingForUpload,
      displayedAnalysisSteps: [{name: 'Upload do Arquivo e Preparação', status: 'completed', progress:100}, {name: 'Sumarizando Dados...', status: 'in_progress', progress: 30}],
      fetchPastAnalyses: mockFetchPastAnalyses.mockResolvedValue(undefined),
    });

    await waitFor(() => {
      const analysisViewForNew = screen.getByText(new RegExp(newAnalysisTitle, "i"));
      expect(analysisViewForNew).toBeInTheDocument();
      expect(screen.getByText(/Sumarizando Dados da Qualidade de Energia/i)).toBeInTheDocument(); 
    });
  });

  test('can delete an analysis from the AnalysisView', async () => {
    useAnalysisManager.mockReturnValue({
      ...global.mockUseAnalysisManagerReturnValue,
      currentAnalysis: mockAnalysisItemCompleted,
      setCurrentAnalysis: mockSetCurrentAnalysis,
      pastAnalyses: [mockAnalysisItemCompleted],
      fetchPastAnalyses: mockFetchPastAnalyses,
      handleDeleteAnalysis: mockHandleDeleteAnalysis, 
    });

    render(<HomePage />);

    const accordionTrigger = screen.getByText(mockAnalysisItemCompleted.title!);
    fireEvent.click(accordionTrigger);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Excluir Análise/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Excluir Análise/i }));

    await waitFor(() => {
      expect(screen.getByText('Confirmar Exclusão')).toBeInTheDocument();
    });
    const confirmButton = screen.getByRole('button', { name: 'Confirmar Exclusão' });
    
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(mockHandleDeleteAnalysis).toHaveBeenCalledWith(mockAnalysisItemCompleted.id, expect.any(Function));
    });
    await waitFor(() => {
        expect(mockFetchPastAnalyses).toHaveBeenCalled();
    });
  });

});

