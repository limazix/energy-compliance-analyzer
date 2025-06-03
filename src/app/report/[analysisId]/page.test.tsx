
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ReportPage from './page';
import { useAuth as originalUseAuth } from '@/contexts/auth-context';
import { useParams as originalUseParams } from 'next/navigation'; // Import directly

// Mocks
jest.mock('@/contexts/auth-context', () => ({
  __esModule: true,
  ...jest.requireActual('@/contexts/auth-context'),
  useAuth: jest.fn(),
}));
const useAuth = originalUseAuth as jest.Mock;

jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'), // Keep other exports
  useParams: jest.fn(), // Mock useParams specifically
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));
const useParams = originalUseParams as jest.Mock;


// Server action mocks are in jest.setup.js
const getAnalysisReportActionMock = jest.requireMock('@/features/report-viewing/actions/reportViewingActions').getAnalysisReportAction;
const askReportOrchestratorActionMock = jest.requireMock('@/features/report-chat/actions/reportChatActions').askReportOrchestratorAction;


const mockUser = {
  uid: 'test-user-id',
  displayName: 'Reporter Rex',
  email: 'reporter@example.com',
  photoURL: 'https://placehold.co/100x100.png?text=RR'
};

const mockAnalysisId = 'report-analysis-123';
const mockFileName = 'sample-report.csv';
const mockMdxContent = `
# Report Title for ${mockFileName}
This is the initial MDX content.
## Section 1
Some details here.
`;
const mockStructuredReport = {
  reportMetadata: { title: `Report Title for ${mockFileName}`, author: 'AI', generatedDate: '2023-01-01', subtitle: 'A mock report' },
  introduction: { objective: 'Test obj', overallResultsSummary: 'Initial summary', usedNormsOverview: 'ANEEL 123' },
  analysisSections: [{ title: 'Section 1', content: 'Some details here.', insights: [], relevantNormsCited: [] }],
  finalConsiderations: 'Initial considerations.',
  bibliography: [],
  tableOfContents: ['Introduction', 'Section 1', 'Final Considerations'],
};


// Mock RTDB - basic mock, replace with more sophisticated if needed for streaming tests later
let mockRtdbMessages = {};
const mockRtdbPush = jest.fn((ref, payload) => {
    const key = `msg-${Date.now()}-${Math.random()}`;
    if(ref.path.pieces_.join('/') === `chats/${mockAnalysisId}`) {
        mockRtdbMessages[key] = { ...payload, timestamp: payload.timestamp === global.FirebaseServerValue.TIMESTAMP ? Date.now() : payload.timestamp };
    }
    return Promise.resolve({ key });
});
const mockRtdbUpdate = jest.fn((ref, payload) => {
    if(ref.path.pieces_.join('/') === `chats/${mockAnalysisId}/${ref.key}`) {
         mockRtdbMessages[ref.key] = { ...mockRtdbMessages[ref.key], ...payload };
    }
    return Promise.resolve();
});
let onValueCallback;
const mockRtdbOnValue = jest.fn((ref, callback) => {
  onValueCallback = callback; // Store the callback
  // Simulate initial data fetch
  Promise.resolve().then(() => callback({ exists: () => Object.keys(mockRtdbMessages).length > 0, val: () => mockRtdbMessages }));
  return jest.fn(); // unsubscribe function
});

jest.mock('firebase/database', () => {
  const actualDb = jest.requireActual('firebase/database');
  global.FirebaseServerValue = { TIMESTAMP: '.sv:timestamp' }; // Mock serverTimestamp object
  return {
    ...actualDb,
    getDatabase: jest.fn(() => ({})), // Mock getDatabase if not using real emulators
    ref: jest.fn((db, path) => ({ path: path, key: path.substring(path.lastIndexOf('/') + 1) })), // Basic ref mock
    onValue: mockRtdbOnValue,
    push: mockRtdbPush,
    update: mockRtdbUpdate,
    serverTimestamp: jest.fn(() => global.FirebaseServerValue.TIMESTAMP), // Mock serverTimestamp utility
    off: jest.fn(),
    child: jest.fn((parentRef, childPath) => ({ ...parentRef, path: `${parentRef.path}/${childPath}`, key: childPath })),
  };
});

// Mock Firestore direct usage (getDoc, onSnapshot for structuredReport)
const mockDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockFirestoreOnSnapshot = jest.fn();
jest.mock('firebase/firestore', () => {
    const actualFirestore = jest.requireActual('firebase/firestore');
    return {
        ...actualFirestore,
        doc: mockDoc,
        getDoc: mockGetDoc,
        onSnapshot: mockFirestoreOnSnapshot,
    };
});


describe('ReportPage', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ user: mockUser, loading: false });
    useParams.mockReturnValue({ analysisId: mockAnalysisId });
    getAnalysisReportActionMock.mockResolvedValue({
      mdxContent: mockMdxContent,
      fileName: mockFileName,
      analysisId: mockAnalysisId,
      error: null,
    });
    askReportOrchestratorActionMock.mockResolvedValue({
      success: true,
      aiMessageRtdbKey: 'ai-response-key-1',
      reportModified: false,
    });

    // Mock for initial structured report fetch (getDoc)
    mockGetDoc.mockImplementation(async (docRef) => {
        if (docRef._key.path.segments.join('/') === `users/${mockUser.uid}/analyses/${mockAnalysisId}`) {
            return Promise.resolve({
                exists: () => true,
                data: () => ({
                    structuredReport: mockStructuredReport,
                    fileName: mockFileName, // ensure fileName is part of this mock if needed
                    mdxReportStoragePath: `user_reports/${mockUser.uid}/${mockAnalysisId}/report.mdx`,
                }),
                id: mockAnalysisId,
            });
        }
        return Promise.resolve({ exists: () => false, data: () => undefined });
    });
    
    // Mock for Firestore onSnapshot listener
    mockFirestoreOnSnapshot.mockImplementation((docRef, callback) => {
        // Simulate initial data for the listener
        if (docRef._key.path.segments.join('/') === `users/${mockUser.uid}/analyses/${mockAnalysisId}`) {
            callback({
                exists: () => true,
                data: () => ({
                    structuredReport: mockStructuredReport,
                    mdxReportStoragePath: `user_reports/${mockUser.uid}/${mockAnalysisId}/report.mdx`,
                }),
            });
        }
        return jest.fn(); // unsubscribe function
    });


    mockRtdbMessages = {}; // Clear RTDB messages for each test
    mockRtdbPush.mockClear();
    mockRtdbOnValue.mockClear();
    onValueCallback = null; // Clear the callback
  });

  test('renders loading state initially, then report content and chat interface', async () => {
    render(<ReportPage />);
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('status', { name: /loader/i })); // Assuming Loader2 has role status and aria-label or similar

    await waitFor(() => {
      expect(getAnalysisReportActionMock).toHaveBeenCalledWith(mockUser.uid, mockAnalysisId);
    });
    await waitFor(() => {
        expect(mockGetDoc).toHaveBeenCalled(); // For initial structured report
    });

    await waitFor(() => {
      expect(screen.getByText(`Relatório: ${mockFileName}`)).toBeInTheDocument();
      // Check for a snippet from the MDX content
      expect(screen.getByText('Section 1')).toBeInTheDocument();
      expect(screen.getByText(/Interagir com o Relatório/i)).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Caixa de texto para interagir com o relatório/i })).toBeInTheDocument();
    });
    
    // Check for welcome message from AI (pushed to RTDB)
    await waitFor(() => {
       expect(mockRtdbPush).toHaveBeenCalledWith(
         expect.objectContaining({ path: `chats/${mockAnalysisId}`}),
         expect.objectContaining({
           sender: 'ai',
           text: expect.stringContaining(`Olá! Sou seu assistente para este relatório (${mockFileName})`)
         })
       );
    });
  });

  test('sends user message to chat, calls orchestrator action, and displays AI response from RTDB', async () => {
    const mockAiResponseText = "This is the AI's response to your query.";
    askReportOrchestratorActionMock.mockResolvedValueOnce({ // Specific mock for this test
      success: true,
      aiMessageRtdbKey: 'ai-key-test-1', // Will be used by action to push to RTDB
      reportModified: false,
    });

    render(<ReportPage />);
    await waitFor(() => expect(screen.getByText(`Relatório: ${mockFileName}`)).toBeInTheDocument());

    const chatInput = screen.getByRole('textbox', { name: /Caixa de texto para interagir com o relatório/i });
    const sendButton = screen.getByRole('button', { name: /Enviar/i });
    const userMessage = "Can you explain section 1 in more detail?";

    fireEvent.change(chatInput, { target: { value: userMessage } });
    fireEvent.click(sendButton);

    // 1. User message pushed to RTDB
    await waitFor(() => {
      expect(mockRtdbPush).toHaveBeenCalledWith(
        expect.objectContaining({ path: `chats/${mockAnalysisId}`}), // Check path
        expect.objectContaining({ sender: 'user', text: userMessage })
      );
    });
    
    // 2. Orchestrator action called
    await waitFor(() => {
      expect(askReportOrchestratorActionMock).toHaveBeenCalledWith(
        mockUser.uid,
        mockAnalysisId,
        userMessage,
        mockMdxContent, // currentMdx
        mockStructuredReport, // currentStructuredReport
        mockFileName,
        expect.any(String) // languageCode
      );
    });

    // 3. Simulate AI response being streamed to RTDB by the action
    // The action itself (mocked here) is responsible for pushing the AI message.
    // If the action directly pushes to RTDB, we need to trigger the onValue callback.
    // For this test, let's assume askReportOrchestratorActionMock indicates success
    // and then we manually simulate the RTDB update that the real action would do.

    act(() => {
      if (onValueCallback) {
        const aiMsgKey = askReportOrchestratorActionMock.mock.results[0].value.aiMessageRtdbKey || 'ai-key-test-1';
        mockRtdbMessages[aiMsgKey] = { sender: 'ai', text: mockAiResponseText, timestamp: Date.now() };
        onValueCallback({ exists: () => true, val: () => mockRtdbMessages });
      }
    });

    // 4. AI response visible in UI
    await waitFor(() => {
      expect(screen.getByText(mockAiResponseText)).toBeInTheDocument();
    });
    expect(chatInput).toHaveValue(''); // Input cleared
  });

  test('updates MDX content if AI modifies the report', async () => {
    const newMdxSection = "## Section 1 - Revised\nThis section has been updated by the AI.";
    const newFullMdx = `# Report Title for ${mockFileName}\n${newMdxSection}`;
    const revisedStructuredReport = {
      ...mockStructuredReport,
      analysisSections: [{ title: 'Section 1 - Revised', content: 'This section has been updated by the AI.', insights: [], relevantNormsCited: [] }],
    };

    askReportOrchestratorActionMock.mockResolvedValueOnce({
      success: true,
      reportModified: true,
      revisedStructuredReport: revisedStructuredReport,
      newMdxContent: newFullMdx,
      aiMessageRtdbKey: 'ai-modify-key',
    });

    render(<ReportPage />);
    await waitFor(() => expect(screen.getByText('Section 1')).toBeInTheDocument()); // Initial content

    const chatInput = screen.getByRole('textbox', { name: /Caixa de texto para interagir com o relatório/i });
    fireEvent.change(chatInput, { target: { value: "Please revise section 1." } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar/i }));

    await waitFor(() => {
      expect(screen.getByText("Section 1 - Revised")).toBeInTheDocument(); // Updated content
      expect(screen.queryByText("Some details here.")).not.toBeInTheDocument(); // Old content gone
    });
     await waitFor(() => {
        expect(jest.requireMock('@/hooks/use-toast').useToast().toast).toHaveBeenCalledWith(
            expect.objectContaining({ title: "Relatório Atualizado" })
        );
    });
  });

  test('shows error message if fetching report fails', async () => {
    const errorMessage = "Failed to load report data due to network error.";
    getAnalysisReportActionMock.mockResolvedValueOnce({
      mdxContent: null,
      fileName: mockFileName,
      analysisId: mockAnalysisId,
      error: errorMessage,
    });

    render(<ReportPage />);

    await waitFor(() => {
      expect(screen.getByText(/Falha ao Carregar Relatório/i)).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /Tentar Novamente/i})).toBeInTheDocument();
    });
  });
  
  test('redirects to login if user is not authenticated while on report page', async () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    // Make getAnalysisReportAction return loading first to simulate initial state
    getAnalysisReportActionMock.mockReturnValueOnce(new Promise(() => {})); // Keep it pending

    render(<ReportPage />);
    
    // Since auth state changes, useEffect in ReportPage should trigger redirect
    await waitFor(() => {
      expect(jest.requireMock('next/navigation').useRouter().replace).toHaveBeenCalledWith('/login');
    });
  });

});
