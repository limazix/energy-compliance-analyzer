// src/features/report-chat/actions/reportChatActions.test.ts
import { httpsCallable, type HttpsCallableResult } from 'firebase/functions';

import type { AnalyzeComplianceReportOutput } from '@/ai/prompt-configs/analyze-compliance-report-prompt-config';
import { APP_CONFIG } from '@/config/appConfig';
import { functionsInstance } from '@/lib/firebase'; // For httpsCallable mock

import {
  askReportOrchestratorAction,
  type AskReportOrchestratorServerActionResult,
} from './reportChatActions';

// Mock firebase/functions
jest.mock('firebase/functions', () => {
  const original = jest.requireActual('firebase/functions');
  return {
    ...original,
    httpsCallable: jest.fn(),
  };
});

const mockHttpsCallable = httpsCallable as jest.Mock;

const MOCK_USER_ID = 'test-user-chat';
const MOCK_ANALYSIS_ID = 'test-analysis-chat';
const MOCK_USER_INPUT = 'Explain section A.';
const MOCK_MDX_CONTENT = '# Report Title\nSection A content.';
const MOCK_STRUCTURED_REPORT: AnalyzeComplianceReportOutput = {
  reportMetadata: {
    title: 'Mock Report Title',
    author: 'Mock Author',
    generatedDate: '2023-01-01',
  },
  tableOfContents: ['Intro', 'Section A'],
  introduction: {
    objective: 'Mock objective',
    overallResultsSummary: 'Mock summary',
    usedNormsOverview: 'Mock norms',
  },
  analysisSections: [
    { title: 'Section A', content: 'Content for section A', insights: [], relevantNormsCited: [] },
  ],
  finalConsiderations: 'Mock considerations',
  bibliography: [],
};
const MOCK_FILE_NAME = 'report-chat.csv';
const MOCK_LANGUAGE_CODE = APP_CONFIG.DEFAULT_LANGUAGE_CODE;

interface HttpsCallableAskOrchestratorResponseData {
  success: boolean;
  error?: string;
  aiMessageRtdbKey?: string;
  reportModified?: boolean;
  revisedStructuredReport?: AnalyzeComplianceReportOutput;
  newMdxContent?: string;
}

describe('askReportOrchestratorAction', () => {
  let mockCallableFn: jest.Mock;

  beforeEach(() => {
    mockHttpsCallable.mockClear();
    mockCallableFn = jest.fn();
    mockHttpsCallable.mockReturnValue(mockCallableFn);
  });

  it('should call httpsCallableAskOrchestrator and return success without modification', async () => {
    const mockResponseData: HttpsCallableAskOrchestratorResponseData = {
      success: true,
      aiMessageRtdbKey: 'ai-msg-key-1',
      reportModified: false,
    };
    mockCallableFn.mockResolvedValueOnce({
      data: mockResponseData,
    } as HttpsCallableResult<HttpsCallableAskOrchestratorResponseData>);

    const result = await askReportOrchestratorAction(
      MOCK_USER_ID,
      MOCK_ANALYSIS_ID,
      MOCK_USER_INPUT,
      MOCK_MDX_CONTENT,
      MOCK_STRUCTURED_REPORT,
      MOCK_FILE_NAME,
      MOCK_LANGUAGE_CODE
    );

    expect(mockHttpsCallable).toHaveBeenCalledWith(
      functionsInstance,
      'httpsCallableAskOrchestrator'
    );
    expect(mockCallableFn).toHaveBeenCalledWith({
      userId: MOCK_USER_ID,
      analysisId: MOCK_ANALYSIS_ID,
      userInputText: MOCK_USER_INPUT,
      currentReportMdx: MOCK_MDX_CONTENT,
      currentStructuredReport: MOCK_STRUCTURED_REPORT,
      analysisFileName: MOCK_FILE_NAME,
      languageCode: MOCK_LANGUAGE_CODE,
    });
    expect(result.success).toBe(true);
    expect(result.aiMessageRtdbKey).toBe('ai-msg-key-1');
    expect(result.reportModified).toBe(false);
    expect(result.error).toBeUndefined();
  });

  it('should call httpsCallableAskOrchestrator and return success with modification', async () => {
    const mockRevisedReport: AnalyzeComplianceReportOutput = {
      ...MOCK_STRUCTURED_REPORT,
      finalConsiderations: 'Revised considerations.',
    };
    const mockNewMdx = '# Report Title\nSection A content.\nRevised considerations.';
    const mockResponseData: HttpsCallableAskOrchestratorResponseData = {
      success: true,
      aiMessageRtdbKey: 'ai-msg-key-2',
      reportModified: true,
      revisedStructuredReport: mockRevisedReport,
      newMdxContent: mockNewMdx,
    };
    mockCallableFn.mockResolvedValueOnce({
      data: mockResponseData,
    } as HttpsCallableResult<HttpsCallableAskOrchestratorResponseData>);

    const result = await askReportOrchestratorAction(
      MOCK_USER_ID,
      MOCK_ANALYSIS_ID,
      MOCK_USER_INPUT,
      MOCK_MDX_CONTENT,
      MOCK_STRUCTURED_REPORT,
      MOCK_FILE_NAME,
      MOCK_LANGUAGE_CODE
    );

    expect(result.success).toBe(true);
    expect(result.aiMessageRtdbKey).toBe('ai-msg-key-2');
    expect(result.reportModified).toBe(true);
    expect(result.revisedStructuredReport).toEqual(mockRevisedReport);
    expect(result.newMdxContent).toBe(mockNewMdx);
    expect(result.error).toBeUndefined();
  });

  it('should return an error if the callable function returns an error in its data', async () => {
    const functionErrorMessage = 'AI processing failed.';
    const mockResponseData: HttpsCallableAskOrchestratorResponseData = {
      success: false,
      error: functionErrorMessage,
    };
    mockCallableFn.mockResolvedValueOnce({
      data: mockResponseData,
    } as HttpsCallableResult<HttpsCallableAskOrchestratorResponseData>);

    const result = await askReportOrchestratorAction(
      MOCK_USER_ID,
      MOCK_ANALYSIS_ID,
      MOCK_USER_INPUT,
      MOCK_MDX_CONTENT,
      MOCK_STRUCTURED_REPORT,
      MOCK_FILE_NAME,
      MOCK_LANGUAGE_CODE
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(functionErrorMessage);
  });

  it('should return an error if the callable function call itself fails', async () => {
    const callableError = new Error('Network error calling function');
    mockCallableFn.mockRejectedValueOnce(callableError);

    const result = await askReportOrchestratorAction(
      MOCK_USER_ID,
      MOCK_ANALYSIS_ID,
      MOCK_USER_INPUT,
      MOCK_MDX_CONTENT,
      MOCK_STRUCTURED_REPORT,
      MOCK_FILE_NAME,
      MOCK_LANGUAGE_CODE
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain(
      'Erro ao processar sua solicitação (SA): Network error calling function'
    );
  });

  it('should return an error for missing userId', async () => {
    const result = await askReportOrchestratorAction(
      '', // Invalid userId
      MOCK_ANALYSIS_ID,
      MOCK_USER_INPUT,
      MOCK_MDX_CONTENT,
      MOCK_STRUCTURED_REPORT,
      MOCK_FILE_NAME,
      MOCK_LANGUAGE_CODE
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('[SA_askOrchestrator] User ID e Analysis ID são obrigatórios.');
  });

  it('should return an error for missing analysisId', async () => {
    const result = await askReportOrchestratorAction(
      MOCK_USER_ID,
      '', // Invalid analysisId
      MOCK_USER_INPUT,
      MOCK_MDX_CONTENT,
      MOCK_STRUCTURED_REPORT,
      MOCK_FILE_NAME,
      MOCK_LANGUAGE_CODE
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('[SA_askOrchestrator] User ID e Analysis ID são obrigatórios.');
  });

  it('should return an error for empty userInputText', async () => {
    const result = await askReportOrchestratorAction(
      MOCK_USER_ID,
      MOCK_ANALYSIS_ID,
      '  ', // Empty input
      MOCK_MDX_CONTENT,
      MOCK_STRUCTURED_REPORT,
      MOCK_FILE_NAME,
      MOCK_LANGUAGE_CODE
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('[SA_askOrchestrator] Entrada do usuário vazia.');
  });

  it('should return an error for missing currentStructuredReport', async () => {
    const result = await askReportOrchestratorAction(
      MOCK_USER_ID,
      MOCK_ANALYSIS_ID,
      MOCK_USER_INPUT,
      MOCK_MDX_CONTENT,
      null, // Missing structured report
      MOCK_FILE_NAME,
      MOCK_LANGUAGE_CODE
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe(
      '[SA_askOrchestrator] O relatório estruturado atual é necessário para processar esta solicitação.'
    );
  });

  it('should return an error for missing currentReportMdx', async () => {
    const result = await askReportOrchestratorAction(
      MOCK_USER_ID,
      MOCK_ANALYSIS_ID,
      MOCK_USER_INPUT,
      '', // Missing mdx content
      MOCK_STRUCTURED_REPORT,
      MOCK_FILE_NAME,
      MOCK_LANGUAGE_CODE
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe(
      '[SA_askOrchestrator] O conteúdo MDX do relatório atual é necessário para fornecer contexto à IA.'
    );
  });
});
