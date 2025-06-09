/**
 * @fileoverview Test suite for the ReportPage component.
 * This file contains tests to ensure the ReportPage renders correctly,
 * displays report content (MDX), handles chat interactions including sending messages
 * and displaying AI responses, and manages report updates, structured in BDD style.
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  getDatabase as _originalGetDatabase,
  ref as _originalRef,
  onValue as _originalOnValue,
  push as _originalPush,
  update as _originalUpdate,
  serverTimestamp as _originalServerTimestamp,
  off as _originalOff,
  child as _originalChild,
} from 'firebase/database'; // Correct imports
import { useParams as originalUseParams } from 'next/navigation';

import { useAuth as originalUseAuth } from '@/contexts/auth-context';

import ReportPage from './page';

import type { User } from 'firebase/auth';
import type { DatabaseReference } from 'firebase/database'; // For typing mocks
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

const getAnalysisReportActionMock = jest.requireMock(
  '@/features/report-viewing/actions/reportViewingActions'
).getAnalysisReportAction as jest.Mock;
const askReportOrchestratorActionMock = jest.requireMock(
  '@/features/report-chat/actions/reportChatActions'
).askReportOrchestratorAction as jest.Mock;

// Define a more specific type for RTDB messages in tests
interface MockRTDBMessage {
  id?: string; // id might be added by the test logic from the key
  sender: 'user' | 'ai';
  text: string;
  timestamp: number | object; // Can be a number or a serverTimestamp placeholder
  isError?: boolean;
}

// Typing for Firebase database mock functions
let mockFbGetDatabase: jest.Mock<unknown, []>;
let mockFbRef: jest.Mock<DatabaseReference, [unknown, string?]>;
let mockFbOnValue: jest.Mock<
  () => void,
  [
    DatabaseReference,
    (snapshot: {
      exists: () => boolean;
      val: () => Record<string, MockRTDBMessage> | null;
    }) => void,
  ]
>;
let mockFbPush: jest.Mock<
  Promise<{ key: string | null }>,
  [DatabaseReference, Partial<MockRTDBMessage>]
>;
let mockFbUpdate: jest.Mock<Promise<void>, [DatabaseReference, Partial<MockRTDBMessage>]>;
let mockFbServerTimestamp: jest.Mock<object, []>;
let mockFbOff: jest.Mock<void, [DatabaseReference]>;
let mockFbChild: jest.Mock<DatabaseReference, [DatabaseReference, string]>;

jest.mock('firebase/database', () => {
  const actualFirebaseDatabase =
    jest.requireActual<typeof import('firebase/database')>('firebase/database');

  mockFbGetDatabase = jest.fn(() => ({})); // Returns a dummy DB object
  mockFbRef = jest.fn(
    (_db, path) =>
      ({
        path,
        key: path?.split('/').pop() || null,
        toString: () => path || '',
      }) as unknown as DatabaseReference
  );
  mockFbOnValue = jest.fn();
  mockFbPush = jest.fn();
  mockFbUpdate = jest.fn();
  mockFbServerTimestamp = jest.fn(() => actualFirebaseDatabase.serverTimestamp()); // Use actual serverTimestamp object
  mockFbOff = jest.fn();
  mockFbChild = jest.fn(
    (parentRef, childPath) =>
      ({
        ...parentRef,
        path: `${parentRef.path}/${childPath}`,
        key: childPath,
        toString: () => `${parentRef.path}/${childPath}`,
      }) as unknown as DatabaseReference
  );

  return {
    ...actualFirebaseDatabase,
    getDatabase: mockFbGetDatabase,
    ref: mockFbRef,
    onValue: mockFbOnValue,
    push: mockFbPush,
    update: mockFbUpdate,
    serverTimestamp: mockFbServerTimestamp,
    off: mockFbOff,
    child: mockFbChild,
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

let onValueCallbackStore:
  | ((snapshot: {
      exists: () => boolean;
      val: () => Record<string, MockRTDBMessage> | null;
    }) => void)
  | null = null;
let mockRtdbMessagesStore: Record<string, MockRTDBMessage> = {};

const simulateRtdbChangeAndNotify = () => {
  if (onValueCallbackStore) {
    onValueCallbackStore({
      exists: () => Object.keys(mockRtdbMessagesStore).length > 0,
      val: () => mockRtdbMessagesStore,
    });
  }
};

/**
 * @describe Test suite for the ReportPage component.
 * This suite covers the rendering of report content (MDX),
 * handling of user interactions with the chat interface,
 * communication with AI orchestrator actions, and dynamic updates to the report.
 */
describe('ReportPage', () => {
  beforeEach(() => {
    // Firebase database mocks are now typed and assigned in the jest.mock block above.
    // Clear them here.
    mockFbGetDatabase.mockClear();
    mockFbRef.mockClear();
    mockFbOnValue.mockClear();
    mockFbPush.mockClear();
    mockFbUpdate.mockClear();
    mockFbServerTimestamp.mockClear();
    mockFbOff.mockClear();
    mockFbChild.mockClear();

    useAuth.mockReturnValue({ user: mockUser, loading: false });
    useParams.mockReturnValue({ analysisId: mockAnalysisId });

    getAnalysisReportActionMock.mockResolvedValue({
      mdxContent: mockMdxContent,
      fileName: mockFileName,
      analysisId: mockAnalysisId,
      error: null,
      // Ensure structuredReport is passed for initial chat context
      structuredReport: mockSeedStructuredReport,
    });

    askReportOrchestratorActionMock.mockReset();
    askReportOrchestratorActionMock.mockResolvedValue({
      success: true,
      aiMessageRtdbKey: 'ai-response-key-default',
      reportModified: false,
    });

    mockRtdbMessagesStore = {};
    onValueCallbackStore = null;

    // Redefine mock implementations for firebase/database functions for clarity and control in each test run
    mockFbGetDatabase.mockImplementation(() => ({})); // Return dummy DB object
    mockFbRef.mockImplementation(
      (_db, path) =>
        ({
          db: _db,
          path,
          key: path?.split('/').pop() || null,
          toString: () => path || '',
        }) as unknown as DatabaseReference
    );
    mockFbOnValue.mockImplementation((_refPassedToOnValue, callback) => {
      onValueCallbackStore = callback;
      // Simulate initial call to onValue with empty data or existing data
      Promise.resolve().then(() => simulateRtdbChangeAndNotify());
      return mockFbOff; // Return the unsubscribe function
    });
    mockFbPush.mockImplementation(async (_refPassedToPush, payload) => {
      const key = `test-msg-${Date.now()}-${Object.keys(mockRtdbMessagesStore).length}`;
      mockRtdbMessagesStore[key] = {
        id: key, // Add id to match ChatMessage
        sender: payload.sender || 'ai', // Ensure sender is 'user' | 'ai'
        text: payload.text || '',
        timestamp: payload.timestamp || Date.now(), // Simulate server timestamp locally if not provided
        isError: payload.isError,
      };
      simulateRtdbChangeAndNotify(); // Notify listeners of the change
      return Promise.resolve({ key } as unknown as DatabaseReference); // Return a ref-like object with a key
    });
    mockFbUpdate.mockImplementation(async (refPassedToUpdate, payload) => {
      const messageKey = (refPassedToUpdate as unknown as { key: string }).key;
      if (messageKey && mockRtdbMessagesStore[messageKey]) {
        mockRtdbMessagesStore[messageKey] = { ...mockRtdbMessagesStore[messageKey], ...payload };
        simulateRtdbChangeAndNotify(); // Notify listeners
      }
      return Promise.resolve();
    });
    mockFbChild.mockImplementation(
      (parentRef, childPath) =>
        ({
          ...parentRef,
          path: `${parentRef.path}/${childPath}`,
          key: childPath,
          toString: () => `${parentRef.path}/${childPath}`,
        }) as unknown as DatabaseReference
    );
  });

  afterEach(() => {
    mockFbGetDatabase.mockClear();
    mockFbRef.mockClear();
    mockFbOnValue.mockClear();
    mockFbPush.mockClear();
    mockFbUpdate.mockClear();
    mockFbServerTimestamp.mockClear();
    mockFbOff.mockClear();
    mockFbChild.mockClear();
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
      getAnalysisReportActionMock.mockImplementationOnce(() => new Promise(() => {})); // Prevent report fetch

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
      // Ensure getAnalysisReportActionMock is set up for success for these tests
      getAnalysisReportActionMock.mockResolvedValue({
        mdxContent: mockMdxContent,
        fileName: mockFileName,
        analysisId: mockAnalysisId,
        error: null,
        structuredReport: mockSeedStructuredReport,
      });
      render(<ReportPage />);
      // Wait for initial loading to complete and report to be displayed
      await waitFor(
        () => expect(screen.getByText(`Relatório: ${mockFileName}`)).toBeInTheDocument(),
        { timeout: 7000 }
      );
      // Wait for welcome message
      await waitFor(
        () => {
          const welcomeMsgPattern = new RegExp(
            `Olá! Sou seu assistente para este relatório \\(${mockFileName}\\)`,
            'i'
          );
          expect(screen.getByText(welcomeMsgPattern)).toBeInTheDocument();
        },
        { timeout: 7000 }
      );
    });

    /**
     * @it It should initially display a loading state then the report and chat.
     */
    it('should initially display a loading state then the report and chat', async () => {
      // Loading state is implicitly tested by the beforeEach waitFors
      expect(getAnalysisReportActionMock).toHaveBeenCalledWith(mockUser.uid, mockAnalysisId);
      expect(screen.getByText(`Relatório: ${mockFileName}`)).toBeInTheDocument();
      expect(screen.getByText(/Seção de Tensão/i)).toBeInTheDocument(); // From MDX
      expect(screen.getByText(/Interagir com o Relatório/i)).toBeInTheDocument(); // Chat section title
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
        askReportOrchestratorActionMock.mockResolvedValueOnce({
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

        // Simulate AI streaming its response by updating the RTDB store directly
        // This needs to happen after the orchestrator action is called and the placeholder is potentially created
        await waitFor(() => expect(askReportOrchestratorActionMock).toHaveBeenCalled());
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
            expect(askReportOrchestratorActionMock).toHaveBeenCalledWith(
              mockUser.uid,
              mockAnalysisId,
              userMessage,
              mockMdxContent,
              expect.objectContaining(mockSeedStructuredReport),
              mockFileName,
              expect.any(String) // languageCode
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
        // Wait for response display to ensure input clear has happened
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
        askReportOrchestratorActionMock.mockResolvedValueOnce({
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
            // Check that old content is gone
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
      getAnalysisReportActionMock.mockResolvedValueOnce({
        mdxContent: null,
        fileName: mockFileName, // May still have filename
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
