// @ts-check
'use strict';

/**
 * @fileOverview Unit test suite for HTTPS Callable Function in reportRetrievalHttp.js
 */
import adminActual from 'firebase-admin';

import { httpsCallableGetAnalysisReport } from '../../../../functions/src/analysis-management/reportRetrievalHttp.js';
import { getAdminFileContentFromStorage as originalGetAdminFileContentFromStorage } from '../../../../functions/src/utils/storage.js';
import { APP_CONFIG } from '../../../../src/config/appConfig.ts'; // Import from src

// Mock firebase-admin for Firestore
const mockDocGet_reportRetrieval = jest.fn();
const mockFirestoreService_reportRetrieval = {
  doc: jest.fn(() => ({
    get: mockDocGet_reportRetrieval,
  })),
};
jest.mock('firebase-admin', () => {
  const FirestoreTimestamp = adminActual.firestore.Timestamp;
  const FirestoreFieldValue = adminActual.firestore.FieldValue;

  return {
    initializeApp: jest.fn(),
    firestore: jest.fn(() => mockFirestoreService_reportRetrieval),
    'firestore.Timestamp': FirestoreTimestamp,
    'firestore.FieldValue': FirestoreFieldValue,
  };
});

jest.mock('../../../../functions/src/utils/storage.js', () => ({
  getAdminFileContentFromStorage: jest.fn(),
}));
const mockGetAdminFileContentFromStorage = originalGetAdminFileContentFromStorage;

const MOCK_USER_ID_REPORT = 'test-user-report';
const MOCK_ANALYSIS_ID_REPORT = 'analysis-report-id';
const MOCK_MDX_PATH_REPORT = `user_reports/${MOCK_USER_ID_REPORT}/${MOCK_ANALYSIS_ID_REPORT}/report.mdx`;
const MOCK_MDX_CONTENT_REPORT = '# Mock Report Content';
const MOCK_FILE_NAME_REPORT = 'test_report.csv';
const MOCK_STRUCTURED_REPORT_DATA = {
  reportMetadata: { title: 'Test Report', author: 'N/A', generatedDate: 'N/A' },
  introduction: {
    objective: 'Test objective',
    overallResultsSummary: 'N/A',
    usedNormsOverview: 'N/A',
  },
  tableOfContents: [],
  analysisSections: [],
  finalConsiderations: '',
  bibliography: [],
};
const MAX_ERROR_MESSAGE_LENGTH = APP_CONFIG.MAX_SERVER_ERROR_MESSAGE_LENGTH;

describe('Report Retrieval HTTPS Callable (Unit)', () => {
  beforeEach(() => {
    mockDocGet_reportRetrieval.mockReset();
    if (jest.isMockFunction(mockFirestoreService_reportRetrieval.doc)) {
      mockFirestoreService_reportRetrieval.doc.mockClear();
    }
  });

  const authContext = { auth: { uid: MOCK_USER_ID_REPORT } };

  it('should throw "unauthenticated" if no auth context', async () => {
    await expect(
      httpsCallableGetAnalysisReport({ analysisId: MOCK_ANALYSIS_ID_REPORT }, {})
    ).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('should throw "invalid-argument" if analysisId is missing', async () => {
    // @ts-expect-error - Testing invalid input: analysisId is required for this function call
    await expect(httpsCallableGetAnalysisReport({}, authContext)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'ID da análise é obrigatório.',
    });
  });

  it('should throw "not-found" if analysis document does not exist', async () => {
    mockDocGet_reportRetrieval.mockResolvedValueOnce({ exists: false });
    await expect(
      httpsCallableGetAnalysisReport({ analysisId: MOCK_ANALYSIS_ID_REPORT }, authContext)
    ).rejects.toMatchObject({
      code: 'not-found',
      message: 'Análise não encontrada ou você não tem permissão.',
    });
    expect(mockFirestoreService_reportRetrieval.doc).toHaveBeenCalledWith(
      `users/${MOCK_USER_ID_REPORT}/analyses/${MOCK_ANALYSIS_ID_REPORT}`
    );
  });

  it('should throw "failed-precondition" if analysis status is "deleted"', async () => {
    mockDocGet_reportRetrieval.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: 'deleted',
        fileName: MOCK_FILE_NAME_REPORT,
        mdxReportStoragePath: MOCK_MDX_PATH_REPORT,
      }),
    });
    await expect(
      httpsCallableGetAnalysisReport({ analysisId: MOCK_ANALYSIS_ID_REPORT }, authContext)
    ).rejects.toMatchObject({
      code: 'failed-precondition',
      message: 'Esta análise foi excluída.',
    });
  });

  it('should throw "not-found" if mdxReportStoragePath is missing', async () => {
    mockDocGet_reportRetrieval.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: 'completed',
        fileName: MOCK_FILE_NAME_REPORT,
        mdxReportStoragePath: null,
      }),
    });
    await expect(
      httpsCallableGetAnalysisReport({ analysisId: MOCK_ANALYSIS_ID_REPORT }, authContext)
    ).rejects.toMatchObject({
      code: 'not-found',
      message: 'Relatório MDX não encontrado para esta análise.',
    });
  });

  it('should return report data successfully', async () => {
    mockDocGet_reportRetrieval.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: 'completed',
        fileName: MOCK_FILE_NAME_REPORT,
        mdxReportStoragePath: MOCK_MDX_PATH_REPORT,
        structuredReport: MOCK_STRUCTURED_REPORT_DATA,
      }),
    });
    mockGetAdminFileContentFromStorage.mockResolvedValueOnce(MOCK_MDX_CONTENT_REPORT);

    const result = await httpsCallableGetAnalysisReport(
      { analysisId: MOCK_ANALYSIS_ID_REPORT },
      authContext
    );

    expect(mockGetAdminFileContentFromStorage).toHaveBeenCalledWith(MOCK_MDX_PATH_REPORT);
    expect(result).toEqual({
      mdxContent: MOCK_MDX_CONTENT_REPORT,
      fileName: MOCK_FILE_NAME_REPORT,
      analysisId: MOCK_ANALYSIS_ID_REPORT,
      error: null,
      structuredReport: MOCK_STRUCTURED_REPORT_DATA,
    });
  });

  it('should handle error from getAdminFileContentFromStorage', async () => {
    mockDocGet_reportRetrieval.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: 'completed',
        fileName: MOCK_FILE_NAME_REPORT,
        mdxReportStoragePath: MOCK_MDX_PATH_REPORT,
      }),
    });
    const storageErrorMsg = 'Failed to download file from storage';
    mockGetAdminFileContentFromStorage.mockRejectedValueOnce(new Error(storageErrorMsg));

    await expect(
      httpsCallableGetAnalysisReport({ analysisId: MOCK_ANALYSIS_ID_REPORT }, authContext)
    ).rejects.toMatchObject({
      code: 'internal',
      message: expect.stringContaining(
        `Erro ao carregar o relatório (GetReport Func): ${storageErrorMsg.substring(0, MAX_ERROR_MESSAGE_LENGTH - 30)}`
      ),
    });
  });
});
