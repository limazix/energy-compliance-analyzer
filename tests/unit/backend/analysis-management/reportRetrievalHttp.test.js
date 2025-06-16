// @ts-check
'use strict';

/**
 * @fileOverview Unit test suite for HTTPS Callable Function in reportRetrievalHttp.js
 */

import { httpsCallableGetAnalysisReport } from '../../../../functions/src/analysis-management/reportRetrievalHttp.js';
import { getAdminFileContentFromStorage as originalGetAdminFileContentFromStorage } from '../../../../functions/src/utils/storage.js';

// Mock firebase-admin for Firestore
const mockDocGet = jest.fn();
const mockFirestoreService = {
  doc: jest.fn(() => ({ get: mockDocGet })),
};
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(() => mockFirestoreService),
}));

jest.mock('../../../../functions/src/utils/storage.js', () => ({
  getAdminFileContentFromStorage: jest.fn(),
}));
const mockGetAdminFileContentFromStorage = originalGetAdminFileContentFromStorage;

const MOCK_USER_ID = 'test-user-report';
const MOCK_ANALYSIS_ID = 'analysis-report-id';
const MOCK_MDX_PATH = `user_reports/${MOCK_USER_ID}/${MOCK_ANALYSIS_ID}/report.mdx`;
const MOCK_MDX_CONTENT = '# Mock Report Content';
const MOCK_FILE_NAME = 'test_report.csv';
const MOCK_STRUCTURED_REPORT = {
  reportMetadata: { title: 'Test Report' },
  introduction: { objective: 'Test objective' },
};

describe('Report Retrieval HTTPS Callable (Unit)', () => {
  beforeEach(() => {
    mockDocGet.mockReset();
    mockGetAdminFileContentFromStorage.mockReset();
    if (jest.isMockFunction(mockFirestoreService.doc)) {
      // Check if it's a mock before clearing
      mockFirestoreService.doc.mockClear();
    }
  });

  const authContext = { auth: { uid: MOCK_USER_ID } };

  it('should throw "unauthenticated" if no auth context', async () => {
    await expect(
      httpsCallableGetAnalysisReport({ analysisId: MOCK_ANALYSIS_ID }, {})
    ).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('should throw "invalid-argument" if analysisId is missing', async () => {
    // @ts-expect-error - Testing invalid input for analysisId as it's required.
    await expect(httpsCallableGetAnalysisReport({}, authContext)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'ID da análise é obrigatório.',
    });
  });

  it('should throw "not-found" if analysis document does not exist', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false });
    await expect(
      httpsCallableGetAnalysisReport({ analysisId: MOCK_ANALYSIS_ID }, authContext)
    ).rejects.toMatchObject({
      code: 'not-found',
      message: 'Análise não encontrada ou você não tem permissão.',
    });
    expect(mockFirestoreService.doc).toHaveBeenCalledWith(
      `users/${MOCK_USER_ID}/analyses/${MOCK_ANALYSIS_ID}`
    );
  });

  it('should throw "failed-precondition" if analysis status is "deleted"', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: 'deleted',
        fileName: MOCK_FILE_NAME,
        mdxReportStoragePath: MOCK_MDX_PATH,
      }),
    });
    await expect(
      httpsCallableGetAnalysisReport({ analysisId: MOCK_ANALYSIS_ID }, authContext)
    ).rejects.toMatchObject({
      code: 'failed-precondition',
      message: 'Esta análise foi excluída.',
    });
  });

  it('should throw "not-found" if mdxReportStoragePath is missing', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'completed', fileName: MOCK_FILE_NAME, mdxReportStoragePath: null }),
    });
    await expect(
      httpsCallableGetAnalysisReport({ analysisId: MOCK_ANALYSIS_ID }, authContext)
    ).rejects.toMatchObject({
      code: 'not-found',
      message: 'Relatório MDX não encontrado para esta análise.',
    });
  });

  it('should return report data successfully', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: 'completed',
        fileName: MOCK_FILE_NAME,
        mdxReportStoragePath: MOCK_MDX_PATH,
        structuredReport: MOCK_STRUCTURED_REPORT,
      }),
    });
    mockGetAdminFileContentFromStorage.mockResolvedValueOnce(MOCK_MDX_CONTENT);

    const result = await httpsCallableGetAnalysisReport(
      { analysisId: MOCK_ANALYSIS_ID },
      authContext
    );

    expect(mockGetAdminFileContentFromStorage).toHaveBeenCalledWith(MOCK_MDX_PATH);
    expect(result).toEqual({
      mdxContent: MOCK_MDX_CONTENT,
      fileName: MOCK_FILE_NAME,
      analysisId: MOCK_ANALYSIS_ID,
      error: null,
      structuredReport: MOCK_STRUCTURED_REPORT,
    });
  });

  it('should handle error from getAdminFileContentFromStorage', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: 'completed',
        fileName: MOCK_FILE_NAME,
        mdxReportStoragePath: MOCK_MDX_PATH,
      }),
    });
    const storageErrorMsg = 'Failed to download file from storage';
    mockGetAdminFileContentFromStorage.mockRejectedValueOnce(new Error(storageErrorMsg));

    await expect(
      httpsCallableGetAnalysisReport({ analysisId: MOCK_ANALYSIS_ID }, authContext)
    ).rejects.toMatchObject({
      code: 'internal',
      message: expect.stringContaining(
        `Erro ao carregar o relatório (GetReport Func): ${storageErrorMsg}`
      ),
    });
  });
});
