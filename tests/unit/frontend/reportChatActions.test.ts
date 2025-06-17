// src/features/report-chat/actions/reportChatActions.test.ts
import { httpsCallable } from 'firebase/functions';

import type { AnalyzeComplianceReportOutput } from '@/ai/prompt-configs/analyze-compliance-report-prompt-config';
import { APP_CONFIG } from '@/config/appConfig';
import { askReportOrchestratorAction } from '@/features/report-chat/actions/reportChatActions';
import { functionsInstance } from '@/lib/firebase'; // For httpsCallable mock

import type { HttpsCallableResult } from 'firebase/functions';

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
  reportMetadata: { title: 'Mock Report', author: 'AI', generatedDate: '2023-01-01' },
  tableOfContents: [],
  introduction: { objective: '', overallResultsSummary: '', usedNormsOverview: '' },
  analysisSections: [],
  finalConsiderations: '',
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

describe('askReportOrchestratorAction (Unit)', () => {
  let mockCallableFn: jest.Mock;

  beforeEach(() => {
    mockHttpsCallable.mockClear();
    mockCallableFn = jest.fn();
    mockHttpsCallable.mockReturnValue(mockCallableFn);
  });

  it('should call httpsCallableAskOrchestrator and return success', async () => {
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
    expect(mockCallableFn).toHaveBeenCalledWith(expect.objectContaining({ userId: MOCK_USER_ID }));
    expect(result.success).toBe(true);
  });

  it('should return an error if the callable function returns an error', async () => {
    const functionErrorMessage = 'AI processing failed.';
    mockCallableFn.mockResolvedValueOnce({
      data: { success: false, error: functionErrorMessage },
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
    const callableError = new Error('Network error');
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
    expect(result.error).toContain('Erro ao processar sua solicitação (SA): Network error');
  });
});
