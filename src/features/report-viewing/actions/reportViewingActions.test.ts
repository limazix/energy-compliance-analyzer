// src/features/report-viewing/actions/reportViewingActions.test.ts
import { httpsCallable, type HttpsCallableResult } from 'firebase/functions';

import type { AnalyzeComplianceReportOutput } from '@/ai/prompt-configs/analyze-compliance-report-prompt-config';
import { functionsInstance } from '@/lib/firebase'; // For httpsCallable mock
import type { AnalysisReportData } from '@/types/analysis';

import { getAnalysisReportAction } from './reportViewingActions';

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
  reportMetadata: {
    title: 'Mock Report Title',
    author: 'Mock Author',
    generatedDate: '2023-01-01',
  },
  tableOfContents: ['Intro'],
  introduction: {
    objective: 'Mock objective',
    overallResultsSummary: 'Mock summary',
    usedNormsOverview: 'Mock norms',
  },
  analysisSections: [],
  finalConsiderations: 'Mock considerations',
  bibliography: [],
};

interface HttpsCallableGetAnalysisReportResponseData {
  mdxContent: string | null;
  fileName: string | null;
  analysisId: string;
  error?: string | null;
  structuredReport?: AnalyzeComplianceReportOutput | null;
}

describe('getAnalysisReportAction', () => {
  let mockCallableFn: jest.Mock;

  beforeEach(() => {
    mockHttpsCallable.mockClear();
    mockCallableFn = jest.fn();
    mockHttpsCallable.mockReturnValue(mockCallableFn);
  });

  it('should call httpsCallableGetAnalysisReport and return report data on success', async () => {
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
    expect(result.fileName).toBe(MOCK_FILE_NAME);
    expect(result.analysisId).toBe(MOCK_ANALYSIS_ID);
    expect(result.structuredReport).toEqual(MOCK_STRUCTURED_REPORT);
    expect(result.error).toBeNull();
  });

  it('should return an error if the callable function returns an error in its data', async () => {
    const functionErrorMessage = 'Report not found in function';
    const mockResponseData: HttpsCallableGetAnalysisReportResponseData = {
      mdxContent: null,
      fileName: MOCK_FILE_NAME,
      analysisId: MOCK_ANALYSIS_ID,
      structuredReport: null,
      error: functionErrorMessage,
    };
    mockCallableFn.mockResolvedValueOnce({
      data: mockResponseData,
    } as HttpsCallableResult<HttpsCallableGetAnalysisReportResponseData>);

    const result = await getAnalysisReportAction(MOCK_USER_ID, MOCK_ANALYSIS_ID);

    expect(result.error).toBe(functionErrorMessage);
    expect(result.mdxContent).toBeNull();
    expect(result.structuredReport).toBeNull();
  });

  it('should return an error if the callable function call itself fails', async () => {
    const callableError = new Error('Callable function network failure');
    mockCallableFn.mockRejectedValueOnce(callableError);

    const result = await getAnalysisReportAction(MOCK_USER_ID, MOCK_ANALYSIS_ID);

    expect(result.error).toContain(
      'Erro ao carregar o relatório (SA): Callable function network failure'
    );
    expect(result.mdxContent).toBeNull();
    expect(result.structuredReport).toBeNull();
  });

  it('should return an error if analysisId is empty or invalid', async () => {
    const result1 = await getAnalysisReportAction(MOCK_USER_ID, '');
    expect(result1.error).toBe('[SA_getAnalysisReport] Analysis ID é obrigatório.');
    expect(mockCallableFn).not.toHaveBeenCalled();

    // @ts-expect-error testing invalid input
    const result2 = await getAnalysisReportAction(MOCK_USER_ID, null);
    expect(result2.error).toBe('[SA_getAnalysisReport] Analysis ID é obrigatório.');
    expect(mockCallableFn).not.toHaveBeenCalled();
  });

  it('should return null for fileName, mdxContent, and structuredReport if function response is minimal but successful', async () => {
    // Simulate a case where the function call is successful but returns no actual content, only the ID.
    // This might happen if the analysis exists but has no report yet.
    const mockResponseData: HttpsCallableGetAnalysisReportResponseData = {
      mdxContent: null,
      fileName: null,
      analysisId: MOCK_ANALYSIS_ID,
      structuredReport: null,
      error: null,
    };
    mockCallableFn.mockResolvedValueOnce({
      data: mockResponseData,
    } as HttpsCallableResult<HttpsCallableGetAnalysisReportResponseData>);

    const result = await getAnalysisReportAction(MOCK_USER_ID, MOCK_ANALYSIS_ID);

    expect(result.mdxContent).toBeNull();
    expect(result.fileName).toBeNull();
    expect(result.structuredReport).toBeNull();
    expect(result.analysisId).toBe(MOCK_ANALYSIS_ID);
    expect(result.error).toBeNull();
  });
});
