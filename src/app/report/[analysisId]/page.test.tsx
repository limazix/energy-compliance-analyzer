
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ReportPage from './page';
import { useAuth as originalUseAuth } from '@/contexts/auth-context';
import { useParams as originalUseParams } from 'next/navigation'; 

// Mocks
jest.mock('@/contexts/auth-context', () => ({
  __esModule: true,
  ...jest.requireActual('@/contexts/auth-context'),
  useAuth: jest.fn(),
}));
const useAuth = originalUseAuth as jest.Mock;

jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'), 
  useParams: jest.fn(), 
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));
const useParams = originalUseParams as jest.Mock;


// Server action mocks are in jest.setup.js
const getAnalysisReportActionMock = jest.requireMock('@/features/report-viewing/actions/reportViewingActions').getAnalysisReportAction;
const askReportOrchestratorActionMock = jest.requireMock('@/features/report-chat/actions/reportChatActions').askReportOrchestratorAction;


// Updated to match firebase-emulator-data/auth_export/accounts.json
const mockUser = {
  uid: 'test-user-001',
  displayName: 'Test User One',
  email: 'test@example.com',
  photoURL: 'https://placehold.co/100x100.png?text=TU1'
};

// Updated to match an ID from firebase-emulator-data/firestore_export/firestore_export.json
// and firebase-emulator-data/database_export/database.json
const mockAnalysisId = 'analysis-id-completed-01'; 
const mockFileName = 'aneel_data_report_alpha.csv'; // From seed data for analysis-id-completed-01

// MDX content will still be mocked by getAnalysisReportActionMock as Storage isn't seeded
const mockMdxContent = `
# Relatório de Conformidade Alpha
Arquivo: ${mockFileName}
## Seção de Tensão
Os níveis de tensão mantiveram-se dentro dos limites adequados.
`;

// This structuredReport should be consistent with firebase-emulator-data/firestore_export.json
// for analysis-id-completed-01. This will be fetched by ReportPage via direct getDoc/onSnapshot.
const mockSeedStructuredReport = {
  reportMetadata: {
    title: 'Relatório de Conformidade da Qualidade de Energia Elétrica - Alpha',
    subtitle: `Análise referente ao arquivo ${mockFileName}`,
    author: 'Energy Compliance Analyzer',
    generatedDate: '2023-10-26',
  },
  tableOfContents: ["Introdução", "Análise de Tensão", "Conclusões"],
  introduction: {
    objective: 'Analisar a conformidade dos dados de qualidade de energia do arquivo aneel_data_report_alpha.csv.',
    overallResultsSummary: 'A análise indica conformidade geral com as normas ANEEL, com algumas variações de frequência necessitando monitoramento.',
    usedNormsOverview: 'REN 414/2010, PRODIST Módulo 8',
  },
  analysisSections: [
    {
      title: "Análise de Tensão",
      content: "Os níveis de tensão mantiveram-se dentro dos limites adequados na maior parte do tempo.",
      insights: ["Tensão predominantemente estável."],
      relevantNormsCited: ["PRODIST Módulo 8, Seção 3.2"],
      chartOrImageSuggestion: "Gráfico de linha da tensão ao longo do tempo."
    }
  ],
  finalConsiderations: 'Recomenda-se o monitoramento contínuo da frequência.',
  bibliography: [{ text: 'ANEEL. PRODIST Módulo 8 - Qualidade da Energia Elétrica.', link: 'https://www.aneel.gov.br' }],
};


// --- Mocking firebase/database ---
let onValueCallbackStore: ((snapshot: any) => void) | null = null;
let mockRtdbMessagesStore: Record<string, any> = {};

const simulateRtdbChangeAndNotify = () => {
  if (onValueCallbackStore) {
    // Ensure the snapshot mimics the Firebase RTDB snapshot structure
    onValueCallbackStore({ 
      exists: () => Object.keys(mockRtdbMessagesStore).length > 0, 
      val: () => mockRtdbMessagesStore 
    });
  }
};

const mockFbOnValue = jest.fn((ref, callback) => {
  onValueCallbackStore = callback;
  // Simulate initial data load (or empty state)
  Promise.resolve().then(() => simulateRtdbChangeAndNotify());
  return jest.fn(); // Return an unsubscribe function
});

const mockFbPush = jest.fn(async (ref, payload) => {
  const key = `test-msg-${Date.now()}-${Object.keys(mockRtdbMessagesStore).length}`;
  mockRtdbMessagesStore[key] = { ...payload, timestamp: Date.now() }; // Simulate server timestamping locally
  simulateRtdbChangeAndNotify();
  return Promise.resolve({ key });
});

const mockFbUpdate = jest.fn(async (ref, payload) => {
  // The 'ref' from rtdbRef for an update usually points to a specific path.
  // If 'ref.key' is available and represents the message ID for update:
  const messageKey = ref.key; 
  if (messageKey && mockRtdbMessagesStore[messageKey]) {
    mockRtdbMessagesStore[messageKey] = { ...mockRtdbMessagesStore[messageKey], ...payload };
    simulateRtdbChangeAndNotify();
  } else {
    // If updating the root of the chat (e.g., path `chats/${analysisId}`)
    // This case might need more specific handling based on how `rtdbUpdate` is used in the component
    // For now, assume updates are targeted at individual message keys if ref.key is present
    console.warn(`[mockFbUpdate] Update called on ref without a direct key match in mockRtdbMessagesStore or ref.key is missing. Ref path: ${ref.path}`);
    // Potentially, if payload is the full new state of the chat node:
    // mockRtdbMessagesStore = {...payload}; 
    // simulateRtdbChangeAndNotify();
  }
  return Promise.resolve();
});

const mockFbChild = jest.fn((parentRef, childPath) => {
    // Basic mock for child, returning an object that includes the path and key
    const newPath = `${parentRef.path}/${childPath}`;
    return { 
        ...parentRef, // inherit properties from parent ref if any
        path: newPath, 
        key: childPath // The key of a child is its last path segment
    };
});


jest.mock('firebase/database', () => {
  const originalModule = jest.requireActual('firebase/database');
  return {
    __esModule: true,
    ...originalModule,
    ref: jest.fn((db, path) => ({ db, path, key: path.split('/').pop() })), // Mock ref to return an object with a key
    onValue: mockFbOnValue,
    push: mockFbPush,
    update: mockFbUpdate,
    serverTimestamp: jest.fn(() => ({ '.sv': 'timestamp' })), // Standard mock for RTDB serverTimestamp
    off: jest.fn(),
    child: mockFbChild, // Use the new mockFbChild
    getDatabase: jest.fn(() => ({})), // Mock getDatabase if it's ever called directly
  };
});
// --- End Mocking firebase/database ---


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

    askReportOrchestratorActionMock.mockReset(); // Reset this mock before each test
    askReportOrchestratorActionMock.mockResolvedValue({ // Default mock for orchestrator
      success: true,
      aiMessageRtdbKey: 'ai-response-key-default',
      reportModified: false,
    });

    // Clear local RTDB message store and callback for each test
    mockRtdbMessagesStore = {};
    onValueCallbackStore = null;

    // Clear the Jest mock functions for RTDB operations
    mockFbOnValue.mockClear();
    mockFbPush.mockClear();
    mockFbUpdate.mockClear();
    mockFbChild.mockClear();
    
    // Firestore getDoc and onSnapshot are NOT mocked here, so ReportPage will use emulators.
  });

  afterEach(() => {
    jest.restoreAllMocks(); 
  });

  test('renders loading state initially, then report content and chat interface (fetches structuredReport from Firestore emulator)', async () => {
    render(<ReportPage />);
    // Check for initial loader if AppHeader isn't immediately available
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');


    await waitFor(() => {
      expect(getAnalysisReportActionMock).toHaveBeenCalledWith(mockUser.uid, mockAnalysisId);
    });
    // Firestore getDoc for structuredReport happens inside ReportPage's useEffect

    await waitFor(() => {
      expect(screen.getByText(`Relatório: ${mockFileName}`)).toBeInTheDocument();
      // Check for a snippet from the MDX content (mocked)
      expect(screen.getByText(/Seção de Tensão/i)).toBeInTheDocument();
      expect(screen.getByText(/Interagir com o Relatório/i)).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Caixa de texto para interagir com o relatório/i })).toBeInTheDocument();
    }, { timeout: 7000 }); // Increased timeout for emulator interaction
    
    // Check for welcome message from AI (should be pushed to RTDB emulator by component if chat is empty)
    await waitFor(() => {
        // Check our local store that mimics RTDB via the light mocks
        const welcomeMsg = Object.values(mockRtdbMessagesStore).find(
            (msg: any) => msg.sender === 'ai' && msg.text.includes(`Olá! Sou seu assistente para este relatório (${mockFileName})`)
        );
        expect(welcomeMsg).toBeDefined();
        // Also check the screen for the message
        expect(screen.getByText(new RegExp(`Olá! Sou seu assistente para este relatório \\(${mockFileName}\\)`, "i"))).toBeInTheDocument();
    }, { timeout: 7000 });
  });

  test('sends user message to chat, calls orchestrator action, and displays AI response from RTDB emulator', async () => {
    const mockAiResponseText = "This is the AI's response to your query.";
    const aiRtdbKey = 'ai-key-test-stream';
    
    // Ensure askReportOrchestratorActionMock is set for *this specific test call*
    askReportOrchestratorActionMock.mockResolvedValueOnce({ 
      success: true,
      aiMessageRtdbKey: aiRtdbKey, 
      reportModified: false,
    });

    render(<ReportPage />);
    await waitFor(() => expect(screen.getByText(`Relatório: ${mockFileName}`)).toBeInTheDocument(), { timeout: 7000 });

    // Ensure initial welcome message appears from AI (and mockRtdbMessagesStore is populated)
    await waitFor(() => {
        const welcomeMsg = Object.values(mockRtdbMessagesStore).find(
             (msg: any) => msg.sender === 'ai' && msg.text.includes("Olá! Sou seu assistente")
        );
        expect(welcomeMsg).toBeDefined();
         // Ensure the initial onValue callback has populated chatMessages for the component
        expect(screen.getByText(new RegExp("Olá! Sou seu assistente", "i"))).toBeInTheDocument();
    }, { timeout: 7000 });


    const chatInput = screen.getByRole('textbox', { name: /Caixa de texto para interagir com o relatório/i });
    const sendButton = screen.getByRole('button', { name: /Enviar/i });
    const userMessage = "Can you explain section 1 in more detail?";

    fireEvent.change(chatInput, { target: { value: userMessage } });
    fireEvent.click(sendButton);

    // 1. User message should be in RTDB (check our local store) and on screen
    await waitFor(() => {
        const sentUserMsg = Object.values(mockRtdbMessagesStore).find((msg: any) => msg.sender === 'user' && msg.text === userMessage);
        expect(sentUserMsg).toBeDefined();
        expect(screen.getByText(userMessage)).toBeInTheDocument();
    }, { timeout: 7000 });
    
    // 2. Orchestrator action called
    await waitFor(() => {
      expect(askReportOrchestratorActionMock).toHaveBeenCalledWith(
        mockUser.uid,
        mockAnalysisId,
        userMessage,
        mockMdxContent, 
        expect.objectContaining(mockSeedStructuredReport), // Expecting the seeded structured report (or a subset if it loaded partially)
        mockFileName,
        expect.any(String) 
      );
    }, { timeout: 7000 });

    // 3. Simulate AI response being streamed/updated to RTDB by the action (via our mockUpdate/mockPush)
    // The askReportOrchestratorAction is responsible for updating RTDB.
    // Our mockFbUpdate (or mockFbPush if the action creates a new entry for AI response chunks) will handle this.
    // Here, we simulate the final state of the AI message.
    act(() => {
      // If the AI message is created with push and then updated:
      // mockRtdbMessagesStore[aiRtdbKey] = { sender: 'ai', text: mockAiResponseText, timestamp: Date.now() };
      // simulateRtdbChangeAndNotify(); 
      // OR if update is on an existing key from the action
      // Let's assume the action creates the key `aiRtdbKey` and then updates its text.
      // The action itself will call RTDB `update` which uses `mockFbUpdate`.
      // We need to ensure `mockFbUpdate` correctly updates the `mockRtdbMessagesStore`
      // and triggers `simulateRtdbChangeAndNotify`.
      
      // For simplicity in test, let's assume the orchestrator action's mock (if it were more detailed)
      // would lead to this state in mockRtdbMessagesStore which then notifies the component.
      // The current `askReportOrchestratorActionMock.mockResolvedValueOnce` doesn't directly manipulate RTDB.
      // The actual server action does. So, we simulate the consequence of the server action.
      if (aiRtdbKey) { // aiRtdbKey comes from the orchestrator mock result
        mockRtdbMessagesStore[aiRtdbKey] = { sender: 'ai', text: mockAiResponseText, timestamp: Date.now() };
        simulateRtdbChangeAndNotify();
      }
    });

    // 4. AI response visible in UI
    await waitFor(() => {
      expect(screen.getByText(mockAiResponseText)).toBeInTheDocument();
    }, { timeout: 7000 });
    expect(chatInput).toHaveValue(''); 
  });

  test('updates MDX content if AI modifies the report', async () => {
    const newMdxSection = "## Seção de Tensão - Revisada\nEsta seção foi atualizada pela IA.";
    const newFullMdx = `# Relatório de Conformidade Alpha\n${newMdxSection}`;
    const revisedStructuredReport = {
      ...mockSeedStructuredReport,
      analysisSections: [{ ...mockSeedStructuredReport.analysisSections[0], title: 'Seção de Tensão - Revisada', content: 'Esta seção foi atualizada pela IA.' }],
    };

    askReportOrchestratorActionMock.mockResolvedValueOnce({
      success: true,
      reportModified: true,
      revisedStructuredReport: revisedStructuredReport,
      newMdxContent: newFullMdx,
      aiMessageRtdbKey: 'ai-modify-key',
    });

    render(<ReportPage />);
    // Initial content (from mocked getAnalysisReportAction)
    await waitFor(() => expect(screen.getByText(/Seção de Tensão/i)).toBeInTheDocument() , { timeout: 7000 }); 

    const chatInput = screen.getByRole('textbox', { name: /Caixa de texto para interagir com o relatório/i });
    fireEvent.change(chatInput, { target: { value: "Please revise section 1." } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar/i }));

    await waitFor(() => {
      // Check for updated MDX content
      expect(screen.getByText("Seção de Tensão - Revisada")).toBeInTheDocument(); 
      expect(screen.queryByText("Os níveis de tensão mantiveram-se dentro dos limites adequados.")).not.toBeInTheDocument(); 
    }, { timeout: 7000 });
     await waitFor(() => {
        expect(jest.requireMock('@/hooks/use-toast').useToast().toast).toHaveBeenCalledWith(
            expect.objectContaining({ title: "Relatório Atualizado" })
        );
    }, { timeout: 7000 });
  });

  test('shows error message if fetching report (MDX) fails', async () => {
    const errorMessage = "Failed to load report MDX data due to network error.";
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
    }, { timeout: 7000 });
  });
  
  test('redirects to login if user is not authenticated while on report page', async () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    // Prevent getAnalysisReportActionMock from resolving to avoid state updates that might interfere
    getAnalysisReportActionMock.mockImplementationOnce(() => new Promise(() => {})); 

    render(<ReportPage />);
    
    await waitFor(() => {
      expect(jest.requireMock('next/navigation').useRouter().replace).toHaveBeenCalledWith('/login');
    }, { timeout: 7000 });
  });

});

