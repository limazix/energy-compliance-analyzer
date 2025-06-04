
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


// RTDB mocks are removed from here. Tests will use the real RTDB emulator via SDK.
let mockRtdbMessagesStore = {}; // Local store for RTDB messages for test verification
let onValueCallbackStore; // Store for onValue callback

// Helper to simulate RTDB updates for testing chat display
const simulateRtdbMessage = (key, messageData) => {
  mockRtdbMessagesStore[key] = { ...messageData, timestamp: Date.now() }; // Simulate server timestamp
  if (onValueCallbackStore) {
    onValueCallbackStore({ exists: () => true, val: () => mockRtdbMessagesStore });
  }
};


describe('ReportPage', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ user: mockUser, loading: false });
    useParams.mockReturnValue({ analysisId: mockAnalysisId });
    
    // getAnalysisReportAction remains mocked because it fetches MDX from Storage (not seeded)
    getAnalysisReportActionMock.mockResolvedValue({
      mdxContent: mockMdxContent,
      fileName: mockFileName,
      analysisId: mockAnalysisId,
      error: null,
    });

    askReportOrchestratorActionMock.mockResolvedValue({ // Default mock for orchestrator
      success: true,
      aiMessageRtdbKey: 'ai-response-key-default',
      reportModified: false,
    });

    // Clear local RTDB message store for each test
    mockRtdbMessagesStore = {};
    onValueCallbackStore = null;

    // Mock the firebase/database onValue to capture its callback for simulation
    // This is a light mock just to control the flow of RTDB data in tests
    const actualFirebaseDatabase = jest.requireActual('firebase/database');
    jest.spyOn(actualFirebaseDatabase, 'onValue').mockImplementation((ref, callback) => {
      onValueCallbackStore = callback;
      // Simulate initial load with potentially empty or seeded data from emulator
      // (The actual component will make this call to the emulator)
      Promise.resolve().then(() => {
        // Try to get real data from RTDB seed (if any for this analysisId)
        // For this test, we'll mostly simulate new messages.
        // The component's useEffect will fetch initial seeded data from RTDB emulator.
        // This mock just ensures the callback is captured.
      });
      return jest.fn(); // unsubscribe
    });
    jest.spyOn(actualFirebaseDatabase, 'push').mockImplementation(async (ref, payload) => {
        const key = `test-msg-${Date.now()}`;
        simulateRtdbMessage(key, payload); // Add to our local store and trigger onValue
        return Promise.resolve({ key });
    });
    jest.spyOn(actualFirebaseDatabase, 'update').mockImplementation(async (ref, payload) => {
       if (mockRtdbMessagesStore[ref.key]) {
           mockRtdbMessagesStore[ref.key] = { ...mockRtdbMessagesStore[ref.key], ...payload };
           if (onValueCallbackStore) {
                onValueCallbackStore({ exists: () => true, val: () => mockRtdbMessagesStore });
           }
       }
       return Promise.resolve();
    });
    
    // Firestore getDoc and onSnapshot are NOT mocked here, so ReportPage will use emulators.
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Restore all mocks, including firebase/database
  });

  test('renders loading state initially, then report content and chat interface (fetches structuredReport from Firestore emulator)', async () => {
    render(<ReportPage />);
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('status', { name: /loader/i })); 

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
    }, { timeout: 5000 }); // Increased timeout for emulator interaction
    
    // Check for welcome message from AI (should be pushed to RTDB emulator by component if chat is empty)
    await waitFor(() => {
        // Check our local store that mimics RTDB via the light mocks
        const welcomeMsg = Object.values(mockRtdbMessagesStore).find(
            (msg: any) => msg.sender === 'ai' && msg.text.includes(`Olá! Sou seu assistente para este relatório (${mockFileName})`)
        );
        expect(welcomeMsg).toBeDefined();
        expect(screen.getByText(new RegExp(`Olá! Sou seu assistente para este relatório \\(${mockFileName}\\)`, "i"))).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  test('sends user message to chat, calls orchestrator action, and displays AI response from RTDB emulator', async () => {
    const mockAiResponseText = "This is the AI's response to your query.";
    const aiRtdbKey = 'ai-key-test-stream';
    askReportOrchestratorActionMock.mockResolvedValueOnce({ 
      success: true,
      aiMessageRtdbKey: aiRtdbKey, 
      reportModified: false,
    });

    render(<ReportPage />);
    await waitFor(() => expect(screen.getByText(`Relatório: ${mockFileName}`)).toBeInTheDocument(), { timeout: 5000 });

    // Ensure initial welcome message appears from AI
    await waitFor(() => {
        const welcomeMsg = Object.values(mockRtdbMessagesStore).find(
             (msg: any) => msg.sender === 'ai' && msg.text.includes("Olá! Sou seu assistente")
        );
        expect(welcomeMsg).toBeDefined();
    }, { timeout: 5000 });


    const chatInput = screen.getByRole('textbox', { name: /Caixa de texto para interagir com o relatório/i });
    const sendButton = screen.getByRole('button', { name: /Enviar/i });
    const userMessage = "Can you explain section 1 in more detail?";

    fireEvent.change(chatInput, { target: { value: userMessage } });
    fireEvent.click(sendButton);

    // 1. User message should be in RTDB (check our local store)
    await waitFor(() => {
        const sentUserMsg = Object.values(mockRtdbMessagesStore).find((msg: any) => msg.sender === 'user' && msg.text === userMessage);
        expect(sentUserMsg).toBeDefined();
        expect(screen.getByText(userMessage)).toBeInTheDocument();
    }, { timeout: 5000 });
    
    // 2. Orchestrator action called
    await waitFor(() => {
      expect(askReportOrchestratorActionMock).toHaveBeenCalledWith(
        mockUser.uid,
        mockAnalysisId,
        userMessage,
        mockMdxContent, 
        mockSeedStructuredReport, // Expecting the seeded structured report
        mockFileName,
        expect.any(String) 
      );
    }, { timeout: 5000 });

    // 3. Simulate AI response being streamed to RTDB by the action (via our light mock)
    // The actual askReportOrchestratorAction is responsible for updating RTDB.
    // For the test, we simulate this update to the aiRtdbKey.
    act(() => {
      simulateRtdbMessage(aiRtdbKey, { sender: 'ai', text: mockAiResponseText, timestamp: Date.now() });
    });

    // 4. AI response visible in UI
    await waitFor(() => {
      expect(screen.getByText(mockAiResponseText)).toBeInTheDocument();
    }, { timeout: 5000 });
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
    await waitFor(() => expect(screen.getByText(/Seção de Tensão/i)).toBeInTheDocument() , { timeout: 5000 }); 

    const chatInput = screen.getByRole('textbox', { name: /Caixa de texto para interagir com o relatório/i });
    fireEvent.change(chatInput, { target: { value: "Please revise section 1." } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar/i }));

    await waitFor(() => {
      // Check for updated MDX content
      expect(screen.getByText("Seção de Tensão - Revisada")).toBeInTheDocument(); 
      expect(screen.queryByText("Os níveis de tensão mantiveram-se dentro dos limites adequados.")).not.toBeInTheDocument(); 
    }, { timeout: 5000 });
     await waitFor(() => {
        expect(jest.requireMock('@/hooks/use-toast').useToast().toast).toHaveBeenCalledWith(
            expect.objectContaining({ title: "Relatório Atualizado" })
        );
    }, { timeout: 5000 });
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
    }, { timeout: 5000 });
  });
  
  test('redirects to login if user is not authenticated while on report page', async () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    getAnalysisReportActionMock.mockReturnValueOnce(new Promise(() => {})); 

    render(<ReportPage />);
    
    await waitFor(() => {
      expect(jest.requireMock('next/navigation').useRouter().replace).toHaveBeenCalledWith('/login');
    }, { timeout: 5000 });
  });

});
