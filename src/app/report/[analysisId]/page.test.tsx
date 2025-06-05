
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


// --- Mocking firebase/database ---
// Declare variables in a higher scope. These will be assigned by the factory.
let mockFbRef: jest.Mock;
let mockFbOnValue: jest.Mock;
let mockFbPush: jest.Mock;
let mockFbUpdate: jest.Mock;
let mockFbServerTimestamp: jest.Mock;
let mockFbOff: jest.Mock;
let mockFbChild: jest.Mock;
let mockGetDatabase: jest.Mock;

jest.mock('firebase/database', () => {
  const originalModule = jest.requireActual('firebase/database');

  // Create new jest.fn() instances locally within the factory
  const _mockRef = jest.fn();
  const _mockOnValue = jest.fn();
  const _mockPush = jest.fn();
  const _mockUpdate = jest.fn();
  const _mockServerTimestamp = jest.fn();
  const _mockOff = jest.fn();
  const _mockChild = jest.fn();
  const _mockGetDatabase = jest.fn();

  // Assign these local mocks to the higher-scoped variables
  // so tests can reference them for configuration/assertions.
  mockFbRef = _mockRef;
  mockFbOnValue = _mockOnValue;
  mockFbPush = _mockPush;
  mockFbUpdate = _mockUpdate;
  mockFbServerTimestamp = _mockServerTimestamp;
  mockFbOff = _mockOff;
  mockFbChild = _mockChild;
  mockGetDatabase = _mockGetDatabase;

  return {
    __esModule: true,
    ...originalModule,
    ref: _mockRef, // Return the local mock instance
    onValue: _mockOnValue,
    push: _mockPush,
    update: _mockUpdate,
    serverTimestamp: _mockServerTimestamp,
    off: _mockOff,
    child: _mockChild,
    getDatabase: _mockGetDatabase,
  };
});
// --- End Mocking firebase/database ---


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


// Helper to simulate RTDB data changes for onValue
let onValueCallbackStore: ((snapshot: any) => void) | null = null;
let mockRtdbMessagesStore: Record<string, any> = {};

const simulateRtdbChangeAndNotify = () => {
  if (onValueCallbackStore) {
    onValueCallbackStore({ 
      exists: () => Object.keys(mockRtdbMessagesStore).length > 0, 
      val: () => mockRtdbMessagesStore 
    });
  }
};


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

    askReportOrchestratorActionMock.mockReset(); 
    askReportOrchestratorActionMock.mockResolvedValue({ 
      success: true,
      aiMessageRtdbKey: 'ai-response-key-default',
      reportModified: false,
    });

    // Clear and set default implementations for RTDB mocks
    mockRtdbMessagesStore = {};
    onValueCallbackStore = null;

    mockGetDatabase.mockClear().mockImplementation(() => ({})); 
    mockFbRef.mockClear().mockImplementation((db, path) => ({ db, path, key: path.split('/').pop(), toString: () => path }));
    mockFbOnValue.mockClear().mockImplementation((ref, callback) => {
      onValueCallbackStore = callback;
      Promise.resolve().then(() => simulateRtdbChangeAndNotify());
      return mockFbOff; 
    });
    mockFbPush.mockClear().mockImplementation(async (ref, payload) => {
      const key = `test-msg-${Date.now()}-${Object.keys(mockRtdbMessagesStore).length}`;
      mockRtdbMessagesStore[key] = { ...payload, timestamp: Date.now() }; 
      simulateRtdbChangeAndNotify();
      return Promise.resolve({ key });
    });
    mockFbUpdate.mockClear().mockImplementation(async (ref, payload) => {
      const messageKey = ref.key; 
      if (messageKey && mockRtdbMessagesStore[messageKey]) {
        mockRtdbMessagesStore[messageKey] = { ...mockRtdbMessagesStore[messageKey], ...payload };
        simulateRtdbChangeAndNotify();
      }
      return Promise.resolve();
    });
    mockFbServerTimestamp.mockClear().mockImplementation(() => ({ '.sv': 'timestamp' }));
    mockFbOff.mockClear().mockImplementation(() => {});
    mockFbChild.mockClear().mockImplementation((parentRef, childPath) => {
      const newPath = `${parentRef.path}/${childPath}`;
      return { ...parentRef, path: newPath, key: childPath, toString: () => newPath };
    });
    
  });

  afterEach(() => {
    // jest.restoreAllMocks(); // This might be too broad if other tests in the suite rely on persistent mocks.
    // Clear specific mocks if needed, though beforeEach should handle it.
  });

  test('renders loading state initially, then report content and chat interface (fetches structuredReport from Firestore emulator)', async () => {
    render(<ReportPage />);
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');


    await waitFor(() => {
      expect(getAnalysisReportActionMock).toHaveBeenCalledWith(mockUser.uid, mockAnalysisId);
    });

    await waitFor(() => {
      expect(screen.getByText(`Relatório: ${mockFileName}`)).toBeInTheDocument();
      expect(screen.getByText(/Seção de Tensão/i)).toBeInTheDocument();
      expect(screen.getByText(/Interagir com o Relatório/i)).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Caixa de texto para interagir com o relatório/i })).toBeInTheDocument();
    }, { timeout: 7000 }); 
    
    await waitFor(() => {
        const welcomeMsg = Object.values(mockRtdbMessagesStore).find(
            (msg: any) => msg.sender === 'ai' && msg.text.includes(`Olá! Sou seu assistente para este relatório (${mockFileName})`)
        );
        expect(welcomeMsg).toBeDefined();
        expect(screen.getByText(new RegExp(`Olá! Sou seu assistente para este relatório \\(${mockFileName}\\)`, "i"))).toBeInTheDocument();
    }, { timeout: 7000 });
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
    await waitFor(() => expect(screen.getByText(`Relatório: ${mockFileName}`)).toBeInTheDocument(), { timeout: 7000 });

    await waitFor(() => {
        const welcomeMsg = Object.values(mockRtdbMessagesStore).find(
             (msg: any) => msg.sender === 'ai' && msg.text.includes("Olá! Sou seu assistente")
        );
        expect(welcomeMsg).toBeDefined();
        expect(screen.getByText(new RegExp("Olá! Sou seu assistente", "i"))).toBeInTheDocument();
    }, { timeout: 7000 });


    const chatInput = screen.getByRole('textbox', { name: /Caixa de texto para interagir com o relatório/i });
    const sendButton = screen.getByRole('button', { name: /Enviar/i });
    const userMessage = "Can you explain section 1 in more detail?";

    fireEvent.change(chatInput, { target: { value: userMessage } });
    fireEvent.click(sendButton);

    await waitFor(() => {
        const sentUserMsg = Object.values(mockRtdbMessagesStore).find((msg: any) => msg.sender === 'user' && msg.text === userMessage);
        expect(sentUserMsg).toBeDefined();
        expect(screen.getByText(userMessage)).toBeInTheDocument();
    }, { timeout: 7000 });
    
    await waitFor(() => {
      expect(askReportOrchestratorActionMock).toHaveBeenCalledWith(
        mockUser.uid,
        mockAnalysisId,
        userMessage,
        mockMdxContent, 
        expect.objectContaining(mockSeedStructuredReport), 
        mockFileName,
        expect.any(String) 
      );
    }, { timeout: 7000 });

    act(() => {
      if (aiRtdbKey) { 
        mockRtdbMessagesStore[aiRtdbKey] = { sender: 'ai', text: mockAiResponseText, timestamp: Date.now() };
        simulateRtdbChangeAndNotify();
      }
    });

    await waitFor(() => {
      expect(screen.getByText(mockAiResponseText)).toBeInTheDocument();
    }, { timeout: 7000 });
    expect(chatInput).toHaveValue(''); 
  });

  test('updates MDX content if AI modifies the report', async () => {
    const newMdxSection = "## Seção de Tensão - Revisada\\nEsta seção foi atualizada pela IA.";
    const newFullMdx = `# Relatório de Conformidade Alpha\\n${newMdxSection}`;
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
    await waitFor(() => expect(screen.getByText(/Seção de Tensão/i)).toBeInTheDocument() , { timeout: 7000 }); 

    const chatInput = screen.getByRole('textbox', { name: /Caixa de texto para interagir com o relatório/i });
    fireEvent.change(chatInput, { target: { value: "Please revise section 1." } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar/i }));

    await waitFor(() => {
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
    getAnalysisReportActionMock.mockImplementationOnce(() => new Promise(() => {})); 

    render(<ReportPage />);
    
    await waitFor(() => {
      expect(jest.requireMock('next/navigation').useRouter().replace).toHaveBeenCalledWith('/login');
    }, { timeout: 7000 });
  });

});
