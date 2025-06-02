
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import HomePage from './page';
import { useAuth as originalUseAuth } from '@/contexts/auth-context';
import { useAnalysisManager as originalUseAnalysisManager } from '@/hooks/useAnalysisManager';
import { useFileUploadManager as originalUseFileUploadManager } from '@/features/file-upload/hooks/useFileUploadManager';
import { getPastAnalysesAction } from '@/app/actions';
import { Timestamp } from 'firebase/firestore'; // Import Timestamp
import type { Analysis } from '@/types/analysis';

// Mock dependencies
jest.mock('@/contexts/auth-context', () => ({
  __esModule: true, // This is important for ESM modules
  ...jest.requireActual('@/contexts/auth-context'), // Keep original AuthProvider
  useAuth: jest.fn(),
}));
const useAuth = originalUseAuth as jest.Mock;

jest.mock('@/hooks/useAnalysisManager');
const useAnalysisManager = originalUseAnalysisManager as jest.Mock;

jest.mock('@/features/file-upload/hooks/useFileUploadManager');
const useFileUploadManager = originalUseFileUploadManager as jest.Mock;

jest.mock('@/app/actions');
const mockGetPastAnalysesAction = getPastAnalysesAction as jest.Mock;

const mockRouterReplace = jest.fn();
const mockRouterPush = jest.fn(); // Though AppHeader might use Link not router.push directly for tabs

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
}));

const mockUser = {
  uid: 'test-user-id',
  displayName: 'Test User',
  email: 'test@example.com',
};

const mockAnalysisItem: Analysis = {
  id: 'analysis1',
  userId: 'test-user-id',
  fileName: 'test-file.csv',
  status: 'completed',
  progress: 100,
  tags: ['important'],
  createdAt: new Date().toISOString(),
  summary: 'Test summary',
  complianceReport: 'Test report',
};

describe('HomePage Navigation and Views', () => {
  let mockSetCurrentAnalysis: jest.Mock;
  let mockFetchPastAnalyses: jest.Mock;
  let mockStartAiProcessing: jest.Mock;
  let mockUploadFileAndCreateRecord: jest.Mock;

  beforeEach(() => {
    mockSetCurrentAnalysis = jest.fn();
    mockFetchPastAnalyses = jest.fn().mockResolvedValue(undefined);
    mockStartAiProcessing = jest.fn().mockResolvedValue(undefined);
    mockUploadFileAndCreateRecord = jest.fn().mockResolvedValue({
      analysisId: 'new-analysis-id',
      fileName: 'new-file.csv',
      error: null,
    });

    useAuth.mockReturnValue({ user: mockUser, loading: false });
    useAnalysisManager.mockReturnValue({
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
      handleDeleteAnalysis: jest.fn((id, cb) => { cb?.(); return Promise.resolve(); }),
      downloadReportAsTxt: jest.fn(),
      displayedAnalysisSteps: [],
    });
    useFileUploadManager.mockReturnValue({
      fileToUpload: null,
      isUploading: false,
      uploadProgress: 0,
      uploadError: null,
      handleFileSelection: jest.fn(),
      uploadFileAndCreateRecord: mockUploadFileAndCreateRecord,
    });
    mockGetPastAnalysesAction.mockResolvedValue([]);

    // Mock getDoc from Firestore
    const mockFirestore = require('firebase/firestore');
    mockFirestore.getDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ ...mockAnalysisItem, createdAt: Timestamp.now(), completedAt: Timestamp.now() }),
        id: 'new-analysis-id'
    });

    mockRouterReplace.mockClear();
    mockRouterPush.mockClear();
  });

  test('redirects to /login if user is not authenticated', async () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    render(<HomePage />);
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/login');
    });
  });

  test('renders DashboardView by default for authenticated user', () => {
    render(<HomePage />);
    expect(screen.getByText(`Bem-vindo(a), ${mockUser.displayName}!`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Iniciar Nova Análise/i })).toBeInTheDocument();
  });

  test('navigates to NewAnalysisForm and back to Dashboard', () => {
    render(<HomePage />);
    // Go to New Analysis
    fireEvent.click(screen.getByRole('button', { name: /Iniciar Nova Análise/i }));
    expect(screen.getByText('Nova Análise de Conformidade')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar e Iniciar Análise/i})).toBeInTheDocument();

    // Go back to Dashboard by cancelling
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(screen.getByText(`Bem-vindo(a), ${mockUser.displayName}!`)).toBeInTheDocument();
  });

  test('navigates to PastAnalysesView via header tab and back to Dashboard via breadcrumb', async () => {
    mockGetPastAnalysesAction.mockResolvedValueOnce([mockAnalysisItem]);
     useAnalysisManager.mockReturnValue({
      ...global.mockUseAnalysisManagerReturnValue, // from jest.setup.js
      pastAnalyses: [mockAnalysisItem],
      fetchPastAnalyses: mockFetchPastAnalyses.mockResolvedValueOnce(undefined), // Ensure it's the specific mock for this test run
    });

    render(<HomePage />);

    // Navigate to Past Analyses via tab
    const pastAnalysesTab = screen.getByRole('tab', { name: /Análises Anteriores/i });
    fireEvent.click(pastAnalysesTab);

    await waitFor(() => {
      expect(mockFetchPastAnalyses).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
        expect(screen.getByText('Análises Anteriores')).toBeInTheDocument();
    });
    expect(screen.getByText(mockAnalysisItem.fileName)).toBeInTheDocument();

    // Navigate back to Dashboard via breadcrumb
    const dashboardBreadcrumb = screen.getByRole('button', { name: 'Dashboard' });
    fireEvent.click(dashboardBreadcrumb);
    await waitFor(() => {
        expect(screen.getByText(`Bem-vindo(a), ${mockUser.displayName}!`)).toBeInTheDocument();
    });
  });

  test('navigates from PastAnalysesView to AnalysisView and uses breadcrumbs', async () => {
     mockGetPastAnalysesAction.mockResolvedValueOnce([mockAnalysisItem]);
     const analysisManagerMockValues = {
      ...global.mockUseAnalysisManagerReturnValue,
      pastAnalyses: [mockAnalysisItem],
      setCurrentAnalysis: mockSetCurrentAnalysis,
      fetchPastAnalyses: mockFetchPastAnalyses.mockResolvedValueOnce(undefined),
    };
    useAnalysisManager.mockReturnValue(analysisManagerMockValues);


    render(<HomePage />);

    // Go to Past Analyses
    fireEvent.click(screen.getByRole('tab', { name: /Análises Anteriores/i }));
    await waitFor(() => expect(screen.getByText('Análises Anteriores')).toBeInTheDocument());
    expect(screen.getByText(mockAnalysisItem.fileName)).toBeInTheDocument();


    // Click "Ver Detalhes"
    fireEvent.click(screen.getByRole('button', { name: /Ver Detalhes/i }));
    
    // This will update currentAnalysis in useAnalysisManager's state.
    // We need to re-render with the updated mock or ensure the component reacts.
    // The component re-renders because setCurrentAnalysis is called.
    // The crucial part is that useAnalysisManager's mock returns the new currentAnalysis.
    analysisManagerMockValues.currentAnalysis = mockAnalysisItem; // Simulate state update
    useAnalysisManager.mockReturnValue(analysisManagerMockValues); // Re-apply mock with updated state

    await waitFor(() => {
      expect(mockSetCurrentAnalysis).toHaveBeenCalledWith(mockAnalysisItem);
    });

    // Manually trigger re-render if needed, or rely on component's useEffect reacting to setCurrentAnalysis
    // Forcing re-render to ensure the view updates based on mocked `currentAnalysis`
    // This is often tricky in tests. The component's internal useEffect should handle it.
    // Let's assume setCurrentAnalysis triggers the view change.

    await waitFor(() => {
        expect(screen.getByText(/Resultados da Análise|Análise em Andamento|Erro na Análise/)).toBeInTheDocument(); // General title
        expect(screen.getByText(new RegExp(`Arquivo: ${mockAnalysisItem.fileName}`))).toBeInTheDocument();
        expect(screen.getByText(mockAnalysisItem.summary!)).toBeInTheDocument(); // Assuming status is 'completed'
    });


    // Breadcrumb back to Past Analyses
    const pastAnalysesBreadcrumb = screen.getByRole('button', { name: 'Análises Anteriores' });
    fireEvent.click(pastAnalysesBreadcrumb);
    await waitFor(() => {
        // We need to reset currentAnalysis for PastAnalysesView to show list again
        analysisManagerMockValues.currentAnalysis = null;
        useAnalysisManager.mockReturnValue(analysisManagerMockValues);
    });
    await waitFor(() => expect(screen.getByText('Análises Anteriores')).toBeInTheDocument());
     // Ensure past analyses are re-fetched or list is shown
    expect(screen.getByText(mockAnalysisItem.fileName)).toBeInTheDocument();


    // Go back to Analysis View for dashboard breadcrumb test
    fireEvent.click(screen.getByRole('button', { name: /Ver Detalhes/i }));
    analysisManagerMockValues.currentAnalysis = mockAnalysisItem;
    useAnalysisManager.mockReturnValue(analysisManagerMockValues);
    await waitFor(() => expect(screen.getByText(new RegExp(`Arquivo: ${mockAnalysisItem.fileName}`))).toBeInTheDocument());

    // Breadcrumb back to Dashboard
    const dashboardBreadcrumbFromAnalysisView = screen.getAllByRole('button', { name: 'Dashboard' })[0]; // first one is in breadcrumbs
    fireEvent.click(dashboardBreadcrumbFromAnalysisView);
    await waitFor(() => {
        analysisManagerMockValues.currentAnalysis = null;
        useAnalysisManager.mockReturnValue(analysisManagerMockValues);
    });
    await waitFor(() => expect(screen.getByText(`Bem-vindo(a), ${mockUser.displayName}!`)).toBeInTheDocument());
  });


  test('navigates to AnalysisView after simulated file upload', async () => {
    const newFileName = 'uploaded-file.csv';
    const newAnalysisId = `mock-analysis-id-for-${newFileName}`;
    const uploadedAnalysisData = {
        ...mockAnalysisItem,
        id: newAnalysisId,
        fileName: newFileName,
        status: 'identifying_regulations', // Initial status after successful upload & record finalization
        createdAt: Timestamp.now(),
    };

    useFileUploadManager.mockReturnValue({
      ...global.mockUseFileUploadManagerReturnValue,
      fileToUpload: new File(['content'], newFileName, { type: 'text/csv' }), // Simulate a file is selected
      uploadFileAndCreateRecord: mockUploadFileAndCreateRecord.mockResolvedValue({
        analysisId: newAnalysisId,
        fileName: newFileName,
        error: null,
      }),
    });

    // Mock getDoc to return the new analysis data when HomePage tries to fetch it
     const mockFirestore = require('firebase/firestore');
     mockFirestore.getDoc.mockImplementation(async (docRef) => {
        // Assuming docRef.id or some property can identify it's the new analysis
        // For simplicity, let's assume any getDoc call after upload is for the new one in this test
        if (docRef?.id === newAnalysisId || docRef?._key?.path?.segments?.includes(newAnalysisId) ) {
             return Promise.resolve({
                exists: () => true,
                data: () => ({ ...uploadedAnalysisData, createdAt: Timestamp.now() }), // Ensure Timestamps
                id: newAnalysisId
            });
        }
        return Promise.resolve({ exists: () => false, data: () => ({}), id: 'other-doc' });
    });
    
    const analysisManagerMockValues = {
      ...global.mockUseAnalysisManagerReturnValue,
      setCurrentAnalysis: mockSetCurrentAnalysis,
      startAiProcessing: mockStartAiProcessing.mockResolvedValue(undefined), // Ensure it's the specific mock for this test run
    };
    useAnalysisManager.mockReturnValue(analysisManagerMockValues);


    render(<HomePage />);

    // Start new analysis
    fireEvent.click(screen.getByRole('button', { name: /Iniciar Nova Análise/i }));
    expect(screen.getByText('Nova Análise de Conformidade')).toBeInTheDocument();

    // Simulate file input if necessary (though useFileUploadManager handles selection)
    // const fileInput = screen.getByLabelText(/selecione o arquivo/i) or similar, then fireEvent.change

    // Click upload and analyze
    const uploadButton = screen.getByRole('button', { name: /Enviar e Iniciar Análise/i });
    
    // Use act for state updates from async operations
    await act(async () => {
        fireEvent.click(uploadButton);
        // Wait for promises in uploadFileAndCreateRecord and handleUploadResult to resolve
        await mockUploadFileAndCreateRecord; 
    });

    // Check that setCurrentAnalysis was called with the new analysis data
    // This requires that handleUploadResult correctly fetches and sets the analysis
    await waitFor(() => {
      expect(mockSetCurrentAnalysis).toHaveBeenCalledWith(expect.objectContaining({
        id: newAnalysisId,
        fileName: newFileName,
        status: 'identifying_regulations',
      }));
    });
    
    // And that AI processing was started
    await waitFor(() => {
        expect(mockStartAiProcessing).toHaveBeenCalledWith(newAnalysisId, mockUser.uid);
    });

    // Simulate the state update for currentAnalysis in the hook
    analysisManagerMockValues.currentAnalysis = {
      ...uploadedAnalysisData,
      createdAt: uploadedAnalysisData.createdAt.toDate().toISOString() // Convert Timestamp to ISO string
    };
    useAnalysisManager.mockReturnValue(analysisManagerMockValues);

    // Check if AnalysisView is rendered
    await waitFor(() => {
        expect(screen.getByText(/Análise em Andamento/)).toBeInTheDocument(); // Title for 'identifying_regulations'
        expect(screen.getByText(new RegExp(`Arquivo: ${newFileName}`))).toBeInTheDocument();
    });
  });
});

// Helper to reset specific mock implementations if needed between describe blocks or tests
// Currently handled in beforeEach
afterEach(() => {
  jest.clearAllMocks();
});
