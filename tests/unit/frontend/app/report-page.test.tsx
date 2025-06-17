/**
 * @fileoverview Test suite for the ReportPage component.
 * This file contains tests to ensure the ReportPage renders correctly,
 * displays report content (MDX), handles chat interactions including sending messages
 * and displaying AI responses, and manages report updates, structured in BDD style.
 */
import React from 'react'; // Import React for type definitions and JSX

import { act, render, screen, waitFor } from '@testing-library/react'; // Correct import order
import userEvent from '@testing-library/user-event';
import { useParams as originalUseParams } from 'next/navigation';

import ReportPage from '@/app/report/[analysisId]/page';
// import type { AnalyzeComplianceReportOutput } from '@/ai/prompt-configs/analyze-compliance-report-prompt-config'; // Removed unused import
import { useAuth as originalUseAuth } from '@/contexts/auth-context';
import { askReportOrchestratorAction as originalAskReportOrchestratorAction } from '@/features/report-chat/actions/reportChatActions';
import { getAnalysisReportAction as originalGetAnalysisReportAction } from '@/features/report-viewing/actions/reportViewingActions';

import type { User } from 'firebase/auth';
import type { DataSnapshot, DatabaseReference, Unsubscribe } from 'firebase/database';

// Mocks
jest.mock('@/contexts/auth-context', () => ({
  __esModule: true,
  ...jest.requireActual('@/contexts/auth-context'), // Important to get the actual AuthProvider
  useAuth: jest.fn(), // This is what tests will override for components consuming the context
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

// Mock the server action modules themselves
jest.mock('@/features/report-viewing/actions/reportViewingActions');
jest.mock('@/features/report-chat/actions/reportChatActions');

// Explicitly type the imported mocked actions
const getAnalysisReportAction = originalGetAnalysisReportAction as jest.Mock;
const askReportOrchestratorAction = originalAskReportOrchestratorAction as jest.Mock;

// Define a more specific type for RTDB messages in tests
interface MockRTDBMessage {
  id?: string; // id might be added by the test logic from the key
  sender: 'user' | 'ai';
  text: string;
  timestamp: number | object; // Can be a number or a serverTimestamp placeholder
  isError?: boolean;
}

// Define a type for the exported mock functions from the mocked module
export interface FirebaseDatabaseMockAccess {
  getDatabase: jest.Mock<unknown, []>;
  ref: jest.Mock<DatabaseReference, [unknown, string?]>;
  onValue: jest.Mock<Unsubscribe, [DatabaseReference, (snapshot: DataSnapshot) => void]>;
  push: jest.Mock<DatabaseReference, [DatabaseReference, Partial<MockRTDBMessage>]>;
  update: jest.Mock<Promise<void>, [DatabaseReference, Partial<MockRTDBMessage>]>;
  serverTimestamp: jest.Mock<object, []>;
  off: jest.Mock<void, [DatabaseReference, string?, ((a: DataSnapshot | null) => unknown)?]>;
  child: jest.Mock<DatabaseReference, [DatabaseReference, string]>;

  // Actual mock instances for manipulation
  __mockGetDatabase: jest.Mock<unknown, []>;
  __mockRef: jest.Mock<DatabaseReference, [unknown, string?]>;
  __mockOnValue: jest.Mock<Unsubscribe, [DatabaseReference, (snapshot: DataSnapshot) => void]>;
  __mockPush: jest.Mock<DatabaseReference, [DatabaseReference, Partial<MockRTDBMessage>]>;
  __mockUpdate: jest.Mock<Promise<void>, [DatabaseReference, Partial<MockRTDBMessage>]>;
  __mockServerTimestamp: jest.Mock<object, []>;
  __mockOff: jest.Mock<void, [DatabaseReference, string?, ((a: DataSnapshot | null) => unknown)?]>;
  __mockChild: jest.Mock<DatabaseReference, [DatabaseReference, string]>;
}

jest.mock('firebase/database', (): FirebaseDatabaseMockAccess => {
  const actualFirebaseDatabase =
    jest.requireActual<typeof import('firebase/database')>('firebase/database');

  // Define mock functions *inside* the factory
  const mockGetDatabaseFn = jest.fn(
    () => ({}) as ReturnType<FirebaseDatabaseMockAccess['getDatabase']>
  );
  const mockRefFn = jest.fn(
    (db, path) =>
      ({
        key: path?.split('/').pop() || null,
        path,
        toJSON: () => ({ path }), // Basic toJSON
        toString: () => path || '', // Basic toString
        parent: null, // Simplified
        root: null, // Simplified
        database: db, // Reference to the database instance
      }) as unknown as DatabaseReference
  );
  const mockOnValueFn = jest.fn() as FirebaseDatabaseMockAccess['onValue'];
  const mockPushFn = jest.fn() as FirebaseDatabaseMockAccess['push'];
  const mockUpdateFn = jest.fn() as FirebaseDatabaseMockAccess['update'];
  const mockServerTimestampFn = jest.fn(() => actualFirebaseDatabase.serverTimestamp());
  const mockOffFn = jest.fn() as FirebaseDatabaseMockAccess['off'];
  const mockChildFn = jest.fn(
    (parentRef: DatabaseReference, childPath: string): DatabaseReference =>
      ({
        ...parentRef,
        path: `${(parentRef as { path: string }).path}/${childPath}`,
        key: childPath,
        toString: () => `${(parentRef as { path: string }).path}/${childPath}`,
      }) as unknown as DatabaseReference
  );

  return {
    ...actualFirebaseDatabase,
    // Override with the locally defined mock functions
    getDatabase: mockGetDatabaseFn,
    ref: mockRefFn,
    onValue: mockOnValueFn,
    push: mockPushFn,
    update: mockUpdateFn,
    serverTimestamp: mockServerTimestampFn,
    off: mockOffFn,
    child: mockChildFn,
    // Export these mock functions so tests can access them if needed
    __mockGetDatabase: mockGetDatabaseFn,
    __mockRef: mockRefFn,
    __mockOnValue: mockOnValueFn,
    __mockPush: mockPushFn,
    __mockUpdate: mockUpdateFn,
    __mockServerTimestamp: mockServerTimestampFn,
    __mockOff: mockOffFn,
    __mockChild: mockChildFn,
  };
});

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

const mockAnalysisId = 'analysis-id-completed-01';
const mockFileName = 'aneel_data_report_alpha.csv';

const mockMdxContent = `
# Relatório de Conformidade Alpha
Arquivo: ${mockFileName}
## Seção de Tensão
Os níveis de tensão mantiveram-se dentro dos limites adequados.
`;

const mockSeedStructuredReport = {
  reportMetadata: {
    title: 'Relatório de Conformidade da Qualidade de Energia Elétrica - Alpha',
    subtitle: `Análise referente ao arquivo ${mockFileName}`,
    author: 'Energy Compliance Analyzer',
    generatedDate: '2023-10-26',
  },
  tableOfContents: ['Introdução', 'Análise de Tensão', 'Conclusões'],
  introduction: {
    objective:
      'Analisar a conformidade dos dados de qualidade de energia do arquivo aneel_data_report_alpha.csv.',
    overallResultsSummary:
      'A análise indica conformidade geral com as normas ANEEL, com algumas variações de frequência necessitando monitoramento.',
    usedNormsOverview: 'REN 414/2010, PRODIST Módulo 8',
  },
  analysisSections: [
    {
      title: 'Análise de Tensão',
      content:
        'Os níveis de tensão mantiveram-se dentro dos limites adequados na maior parte do tempo.',
      insights: ['Tensão predominantemente estável.'],
      relevantNormsCited: ['PRODIST Módulo 8, Seção 3.2'],
      chartOrImageSuggestion: 'Gráfico de linha da tensão ao longo do tempo.',
    },
  ],
  finalConsiderations: 'Recomenda-se o monitoramento contínuo da frequência.',
  bibliography: [
    {
      text: 'ANEEL. PRODIST Módulo 8 - Qualidade da Energia Elétrica.',
      link: 'https://www.aneel.gov.br',
    },
  ],
};

let onValueCallbackStore: ((snapshot: DataSnapshot) => void) | null = null;

let mockRtdbMessagesStore: Record<string, MockRTDBMessage> = {};

const simulateRtdbChangeAndNotify = () => {
  if (onValueCallbackStore) {
    // Simulate a DataSnapshot object
    const mockSnapshot = {
      exists: () => Object.keys(mockRtdbMessagesStore).length > 0,
      val: () => mockRtdbMessagesStore,
      // Add other DataSnapshot methods if needed by your component
      key: 'mock-snapshot-key', // Example key
      child: jest.fn(),
      forEach: jest.fn(),
      hasChild: jest.fn(),
      hasChildren: jest.fn(),
      numChildren: jest.fn(() => Object.keys(mockRtdbMessagesStore).length),
      exportVal: jest.fn(),
      getPriority: jest.fn(),
      ref: {} as DatabaseReference, // Dummy ref
      toJSON: jest.fn(() => mockRtdbMessagesStore),
    } as DataSnapshot;
    onValueCallbackStore(mockSnapshot);
  }
};

/**
 * @describe Test suite for the ReportPage component.
 * This suite covers the rendering of report content (MDX),
 * handling of user interactions with the chat interface,
 * communication with AI orchestrator actions, and dynamic updates to the report.
 */
describe('ReportPage', () => {
  // Helper function to get the mock accessors for firebase/database
  const getDatabaseMocks = () =>
    jest.requireMock('firebase/database') as FirebaseDatabaseMockAccess;

  beforeEach(() => {
    // Clear any previous mock states or implementations
    (getAnalysisReportAction as jest.Mock).mockClear();
    (askReportOrchestratorAction as jest.Mock).mockClear();

    const {
      __mockGetDatabase,
      __mockRef,
      __mockOnValue,
      __mockPush,
      __mockUpdate,
      __mockServerTimestamp,
      __mockOff,
      __mockChild,
    } = getDatabaseMocks();

    __mockGetDatabase.mockClear();
    __mockRef.mockClear();
    __mockOnValue.mockClear();
    __mockPush.mockClear();
    __mockUpdate.mockClear();
    __mockServerTimestamp.mockClear();
    __mockOff.mockClear();
    __mockChild.mockClear();

    useAuth.mockReturnValue({ user: mockUser, loading: false });
    useParams.mockReturnValue({ analysisId: mockAnalysisId });

    // Default mock implementation for getAnalysisReportAction
    (getAnalysisReportAction as jest.Mock).mockResolvedValue({
      mdxContent: mockMdxContent,
      fileName: mockFileName,
      analysisId: mockAnalysisId,
      error: null,
      structuredReport: mockSeedStructuredReport,
    });

    // Default mock implementation for askReportOrchestratorAction
    (askReportOrchestratorAction as jest.Mock).mockResolvedValue({
      success: true,
      aiMessageRtdbKey: 'ai-response-key-default',
      reportModified: false,
    });

    mockRtdbMessagesStore = {};
    onValueCallbackStore = null;

    __mockGetDatabase.mockImplementation(
      () => ({}) as ReturnType<FirebaseDatabaseMockAccess['getDatabase']>
    );
    __mockRef.mockImplementation(
      (db, path) =>
        ({
          db: db,
          path,
          key: path?.split('/').pop() || null,
          toString: () => path || '',
        }) as unknown as DatabaseReference
    );
    __mockOnValue.mockImplementation((_refPassedToOnValue, callback) => {
      onValueCallbackStore = callback;
      Promise.resolve().then(() => simulateRtdbChangeAndNotify());
      return __mockOff as Unsubscribe;
    });
    __mockPush.mockImplementation(async (_refPassedToPush, payload) => {
      const key = `test-msg-${Date.now()}-${Object.keys(mockRtdbMessagesStore).length}`;
      mockRtdbMessagesStore[key] = {
        id: key,
        sender: payload.sender || 'ai',
        text: payload.text || '',
        timestamp: payload.timestamp || Date.now(),
        isError: payload.isError,
      };
      simulateRtdbChangeAndNotify();
      return Promise.resolve({ key } as unknown as DatabaseReference);
    });
    __mockUpdate.mockImplementation(async (refPassedToUpdate, payload) => {
      const messageKey = (refPassedToUpdate as unknown as { key: string }).key;
      if (messageKey && mockRtdbMessagesStore[messageKey]) {
        mockRtdbMessagesStore[messageKey] = { ...mockRtdbMessagesStore[messageKey], ...payload };
        simulateRtdbChangeAndNotify();
      }
      return Promise.resolve();
    });
    __mockChild.mockImplementation(
      (parentRef: DatabaseReference, childPath: string): DatabaseReference =>
        ({
          ...parentRef,
          path: `${(parentRef as { path: string }).path}/${childPath}`,
          key: childPath,
          toString: () => `${(parentRef as { path: string }).path}/${childPath}`,
        }) as unknown as DatabaseReference
    );
  });

  afterEach(() => {
    const {
      __mockGetDatabase,
      __mockRef,
      __mockOnValue,
      __mockPush,
      __mockUpdate,
      __mockServerTimestamp,
      __mockOff,
      __mockChild,
    } = getDatabaseMocks();

    __mockGetDatabase.mockClear();
    __mockRef.mockClear();
    __mockOnValue.mockClear();
    __mockPush.mockClear();
    __mockUpdate.mockClear();
    __mockServerTimestamp.mockClear();
    __mockOff.mockClear();
    __mockChild.mockClear();
  });

  /**
   * @describe Scenario: Given the user is not authenticated.
   */
  describe('given the user is not authenticated', () => {
    /**
     * @it It should redirect to the login page.
     */
    it('should redirect to the login page', async () => {
      useAuth.mockReturnValue({ user: null, loading: false });
      (getAnalysisReportAction as jest.Mock).mockImplementationOnce(
        () => new Promise((_resolve) => undefined) // Prevent resolution
      );

      render(<ReportPage />);

      await waitFor(() => {
        expect(jest.requireMock('next/navigation').useRouter().replace).toHaveBeenCalledWith(
          '/login'
        );
      });
    });
  });

  /**
   * @describe Scenario: Given the user is authenticated and navigates to a valid report.
   */
  describe('given the user is authenticated and navigates to a valid report', () => {
    beforeEach(async () => {
      render(<ReportPage />);
      const welcomeMsgPattern = new RegExp(
        `Olá! Sou seu assistente para este relatório \\(${mockFileName}\\)`,
        'i'
      );
      // Use findByText which includes waitFor, and check for the welcome message as it indicates
      // that reportData.fileName is loaded and the initial chat message is processed.
      await screen.findByText(welcomeMsgPattern, undefined, { timeout: 7000 });
      // After welcome message, report filename should also be present
      expect(screen.getByText(`Relatório: ${mockFileName}`)).toBeInTheDocument();
    });

    /**
     * @it It should initially display a loading state then the report and chat.
     */
    it('should initially display a loading state then the report and chat', async () => {
      expect(getAnalysisReportAction).toHaveBeenCalledWith(mockUser.uid, mockAnalysisId);
      expect(screen.getByText(`Relatório: ${mockFileName}`)).toBeInTheDocument();
      expect(screen.getByText(/Seção de Tensão/i)).toBeInTheDocument();
      expect(screen.getByText(/Interagir com o Relatório/i)).toBeInTheDocument();
      expect(
        screen.getByRole('textbox', { name: /Caixa de texto para interagir com o relatório/i })
      ).toBeInTheDocument();
    });

    /**
     * @describe Context: When the user sends a message in the chat.
     */
    describe('when the user sends a message in the chat', () => {
      const userMessage = 'Can you explain section 1 in more detail?';
      const mockAiResponseText = "This is the AI's response to your query.";
      const aiRtdbKey = 'ai-key-test-stream';

      beforeEach(async () => {
        (askReportOrchestratorAction as jest.Mock).mockResolvedValueOnce({
          success: true,
          aiMessageRtdbKey: aiRtdbKey,
          reportModified: false,
        });

        const chatInput = screen.getByRole('textbox', {
          name: /Caixa de texto para interagir com o relatório/i,
        });
        const sendButton = screen.getByRole('button', { name: /Enviar/i });

        await userEvent.type(chatInput, userMessage);
        await userEvent.click(sendButton);

        await waitFor(() => expect(askReportOrchestratorAction).toHaveBeenCalled());
        act(() => {
          mockRtdbMessagesStore[aiRtdbKey] = {
            id: aiRtdbKey,
            sender: 'ai',
            text: mockAiResponseText,
            timestamp: Date.now(),
          };
          simulateRtdbChangeAndNotify();
        });
      });

      /**
       * @it It should save the user message to RTDB and display it.
       */
      it('should save the user message to RTDB and display it', async () => {
        await waitFor(
          () => {
            const sentUserMsg = Object.values(mockRtdbMessagesStore).find(
              (msg) => msg.sender === 'user' && msg.text === userMessage
            );
            expect(sentUserMsg).toBeDefined();
            expect(screen.getByText(userMessage)).toBeInTheDocument();
          },
          { timeout: 7000 }
        );
      });

      /**
       * @it It should call the AI orchestrator action.
       */
      it('should call the AI orchestrator action', async () => {
        await waitFor(
          () => {
            expect(askReportOrchestratorAction).toHaveBeenCalledWith(
              mockUser.uid,
              mockAnalysisId,
              userMessage,
              mockMdxContent,
              expect.objectContaining(mockSeedStructuredReport),
              mockFileName,
              expect.any(String)
            );
          },
          { timeout: 7000 }
        );
      });

      /**
       * @it It should display the AI response streamed from RTDB.
       */
      it('should display the AI response streamed from RTDB', async () => {
        await waitFor(
          () => {
            expect(screen.getByText(mockAiResponseText)).toBeInTheDocument();
          },
          { timeout: 7000 }
        );
      });

      /**
       * @it It should clear the input field after sending.
       */
      it('should clear the input field after sending', async () => {
        const chatInput = screen.getByRole('textbox', {
          name: /Caixa de texto para interagir com o relatório/i,
        });
        await waitFor(() => expect(screen.getByText(mockAiResponseText)).toBeInTheDocument(), {
          timeout: 7000,
        });
        expect(chatInput).toHaveValue('');
      });
    });

    /**
     * @describe Context: When the AI modifies the report via chat.
     */
    describe('when the AI modifies the report via chat', () => {
      const newMdxSection = '## Seção de Tensão - Revisada\\nEsta seção foi atualizada pela IA.';
      const newFullMdx = `# Relatório de Conformidade Alpha\\n${newMdxSection}`;
      const revisedStructuredReport = {
        ...mockSeedStructuredReport,
        analysisSections: [
          {
            ...mockSeedStructuredReport.analysisSections[0],
            title: 'Seção de Tensão - Revisada',
            content: 'Esta seção foi atualizada pela IA.',
          },
        ],
      };

      beforeEach(async () => {
        (askReportOrchestratorAction as jest.Mock).mockResolvedValueOnce({
          success: true,
          reportModified: true,
          revisedStructuredReport: revisedStructuredReport,
          newMdxContent: newFullMdx,
          aiMessageRtdbKey: 'ai-modify-key',
        });

        const chatInput = screen.getByRole('textbox', {
          name: /Caixa de texto para interagir com o relatório/i,
        });
        await userEvent.type(chatInput, 'Please revise section 1.');
        await userEvent.click(screen.getByRole('button', { name: /Enviar/i }));
      });

      /**
       * @it It should update the displayed MDX content.
       */
      it('should update the displayed MDX content', async () => {
        await waitFor(
          () => {
            expect(screen.getByText('Seção de Tensão - Revisada')).toBeInTheDocument();
            expect(
              screen.queryByText('Os níveis de tensão mantiveram-se dentro dos limites adequados.')
            ).not.toBeInTheDocument();
          },
          { timeout: 7000 }
        );
      });

      /**
       * @it It should show a toast notification about the report update.
       */
      it('should show a toast notification about the report update', async () => {
        await waitFor(
          () => {
            expect(
              (
                jest.requireMock('@/hooks/use-toast') as { useToast: () => { toast: jest.Mock } }
              ).useToast().toast
            ).toHaveBeenCalledWith(expect.objectContaining({ title: 'Relatório Atualizado' }));
          },
          { timeout: 7000 }
        );
      });
    });
  });

  /**
   * @describe Scenario: Given an invalid report ID or fetch error.
   */
  describe('given an invalid report ID or fetch error', () => {
    const errorMessage = 'Failed to load report MDX data due to network error.';
    beforeEach(async () => {
      (getAnalysisReportAction as jest.Mock).mockResolvedValueOnce({
        mdxContent: null,
        fileName: mockFileName,
        analysisId: mockAnalysisId,
        error: errorMessage,
        structuredReport: null,
      });
      render(<ReportPage />);
    });

    /**
     * @it It should display an error message indicating the report could not be loaded.
     */
    it('should display an error message indicating the report could not be loaded', async () => {
      await waitFor(
        () => {
          expect(screen.getByText(/Falha ao Carregar Relatório/i)).toBeInTheDocument();
          expect(screen.getByText(errorMessage)).toBeInTheDocument();
        },
        { timeout: 7000 }
      );
    });

    /**
     * @it It should provide a "Retry" button.
     */
    it('should provide a "Retry" button', async () => {
      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /Tentar Novamente/i })).toBeInTheDocument();
        },
        { timeout: 7000 }
      );
    });
  });
});
