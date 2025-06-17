// src/features/report-viewing/actions/reportViewingActions.test.ts
import { httpsCallable } from 'firebase/functions';

import type { AnalyzeComplianceReportOutput } from '@/ai/prompt-configs/analyze-compliance-report-prompt-config';
import { getAnalysisReportAction } from '@/features/report-viewing/actions/reportViewingActions';
import { functionsInstance } from '@/lib/firebase';

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

const MOCK_USER_ID = 'test-user-report-view';
const MOCK_ANALYSIS_ID = 'test-analysis-report-view';
const MOCK_FILE_NAME = 'report.csv';
const MOCK_MDX_CONTENT = '# Mock Report Content';
const MOCK_STRUCTURED_REPORT: AnalyzeComplianceReportOutput = {
  reportMetadata: { title: 'Mock Report', author: 'AI', generatedDate: '2023-01-01' },
  tableOfContents: [],
  introduction: { objective: '', overallResultsSummary: '', usedNormsOverview: '' },
  analysisSections: [],
  finalConsiderations: '',
  bibliography: [],
};

interface HttpsCallableGetAnalysisReportResponseData {
  mdxContent: string | null;
  fileName: string | null;
  analysisId: string;
  error?: string | null;
  structuredReport?: AnalyzeComplianceReportOutput | null;
}

describe('getAnalysisReportAction (Unit)', () => {
  let mockCallableFn: jest.Mock;

  beforeEach(() => {
    mockHttpsCallable.mockClear();
    mockCallableFn = jest.fn();
    mockHttpsCallable.mockReturnValue(mockCallableFn);
  });

  it('should call httpsCallableGetAnalysisReport and return data', async () => {
    const mockResponseData: HttpsCallableGetAnalysisReportResponseData = {
      mdxContent: MOCK_MDX_CONTENT,
      fileName: MOCK_FILE_NAME,
      analysisId: MOCK_ANALYSIS_ID,
      structuredReport: MOCK_STRUCTURED_REPORT,
      error: null,
    };
    mockCallableFn.mockResolvedValueOnce({
      data: mockResponseData,
    } as HttpsCallableResult<HttpsCallableGetAnalysisReportResponseData>);

    const result = await getAnalysisReportAction(MOCK_USER_ID, MOCK_ANALYSIS_ID);

    expect(mockHttpsCallable).toHaveBeenCalledWith(
      functionsInstance,
      'httpsCallableGetAnalysisReport'
    );
    expect(mockCallableFn).toHaveBeenCalledWith({ analysisId: MOCK_ANALYSIS_ID });
    expect(result.mdxContent).toBe(MOCK_MDX_CONTENT);
  });

  it('should return an error if callable function returns error', async () => {
    const functionErrorMessage = 'Report not found in function';
    mockCallableFn.mockResolvedValueOnce({
      data: { error: functionErrorMessage, analysisId: MOCK_ANALYSIS_ID },
    } as HttpsCallableResult<HttpsCallableGetAnalysisReportResponseData>);

    const result = await getAnalysisReportAction(MOCK_USER_ID, MOCK_ANALYSIS_ID);
    expect(result.error).toBe(functionErrorMessage);
  });

  it('should return an error if callable function call fails', async () => {
    const callableError = new Error('Network failure');
    mockCallableFn.mockRejectedValueOnce(callableError);
    const result = await getAnalysisReportAction(MOCK_USER_ID, MOCK_ANALYSIS_ID);
    expect(result.error).toContain('Erro ao carregar o relatório (SA): Network failure');
  });
});
