// @ts-check
'use strict';

/**
 * @fileOverview Test suite for HTTPS Callable Function in reportRetrievalHttp.js
 * (httpsCallableGetAnalysisReport)
 */

const admin = require('firebase-admin');
const functions = require('firebase-functions');
const functionsTest = require('firebase-functions-test')();

// Mock firebase-admin for Firestore
jest.mock('firebase-admin', () => {
  const actualAdmin = jest.requireActual('firebase-admin');
  const mockFirestore = {
    doc: jest.fn().mockReturnThis(),
    get: jest.fn(),
  };
  return {
    ...actualAdmin,
    initializeApp: jest.fn(),
    firestore: jest.fn(() => mockFirestore),
    // Mock other admin services if they get pulled in
    storage: jest.fn().mockReturnValue({ bucket: jest.fn() }),
    database: jest.fn().mockReturnValue({ ref: jest.fn() }),
    auth: jest.fn().mockReturnValue({}),
    messaging: jest.fn().mockReturnValue({}),
    pubsub: jest.fn().mockReturnValue({ topic: jest.fn() }),
  };
});

// Mock the storage utility
const mockGetAdminFileContentFromStorage = jest.fn();
jest.mock('../utils/storage.js', () => ({
  getAdminFileContentFromStorage: mockGetAdminFileContentFromStorage,
}));

// Import the function to be tested AFTER mocks are set up
const { httpsCallableGetAnalysisReport } = require('./reportRetrievalHttp');

const MOCK_USER_ID = 'test-user-report';
const MOCK_ANALYSIS_ID = 'analysis-report-id';
const MOCK_MDX_PATH = `user_reports/${MOCK_USER_ID}/${MOCK_ANALYSIS_ID}/report.mdx`;
const MOCK_MDX_CONTENT = '# Mock Report Content';
const MOCK_FILE_NAME = 'test_report.csv';
const MOCK_STRUCTURED_REPORT = {
  reportMetadata: { title: 'Test Report' },
  introduction: { objective: 'Test objective' },
  // ... other fields as per AnalyzeComplianceReportOutput
};

describe('Report Retrieval HTTPS Callable', () => {
  let mockAdminFirestore;

  beforeEach(() => {
    // @ts-ignore
    mockAdminFirestore = admin.firestore();
    mockAdminFirestore.doc.mockClear();
    mockAdminFirestore.get.mockClear();
    mockGetAdminFileContentFromStorage.mockClear();
  });

  afterAll(() => {
    functionsTest.cleanup();
  });

  const wrappedGetReport = functionsTest.wrap(httpsCallableGetAnalysisReport);
  const authContext = { auth: { uid: MOCK_USER_ID } };

  it('should throw "unauthenticated" if no auth context', async () => {
    await expect(wrappedGetReport({ analysisId: MOCK_ANALYSIS_ID }, {})).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('should throw "invalid-argument" if analysisId is missing', async () => {
    // @ts-ignore
    await expect(wrappedGetReport({}, authContext)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'ID da análise é obrigatório.',
    });
  });

  it('should throw "not-found" if analysis document does not exist', async () => {
    mockAdminFirestore.get.mockResolvedValueOnce({ exists: false });
    await expect(
      wrappedGetReport({ analysisId: MOCK_ANALYSIS_ID }, authContext)
    ).rejects.toMatchObject({
      code: 'not-found',
      message: 'Análise não encontrada ou você não tem permissão.',
    });
    expect(mockAdminFirestore.doc).toHaveBeenCalledWith(
      `users/${MOCK_USER_ID}/analyses/${MOCK_ANALYSIS_ID}`
    );
  });

  it('should throw "failed-precondition" if analysis status is "deleted"', async () => {
    mockAdminFirestore.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: 'deleted',
        fileName: MOCK_FILE_NAME,
        mdxReportStoragePath: MOCK_MDX_PATH,
      }),
    });
    await expect(
      wrappedGetReport({ analysisId: MOCK_ANALYSIS_ID }, authContext)
    ).rejects.toMatchObject({
      code: 'failed-precondition',
      message: 'Esta análise foi excluída.',
    });
  });

  it('should throw "failed-precondition" if analysis status is "cancelled"', async () => {
    mockAdminFirestore.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: 'cancelled',
        fileName: MOCK_FILE_NAME,
        mdxReportStoragePath: MOCK_MDX_PATH,
      }),
    });
    await expect(
      wrappedGetReport({ analysisId: MOCK_ANALYSIS_ID }, authContext)
    ).rejects.toMatchObject({
      code: 'failed-precondition',
      message: 'Esta análise foi cancelada.',
    });
  });

  it('should throw "not-found" if mdxReportStoragePath is missing', async () => {
    mockAdminFirestore.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'completed', fileName: MOCK_FILE_NAME, mdxReportStoragePath: null }),
    });
    await expect(
      wrappedGetReport({ analysisId: MOCK_ANALYSIS_ID }, authContext)
    ).rejects.toMatchObject({
      code: 'not-found',
      message: 'Relatório MDX não encontrado para esta análise.',
    });
  });

  it('should return report data successfully', async () => {
    mockAdminFirestore.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: 'completed',
        fileName: MOCK_FILE_NAME,
        mdxReportStoragePath: MOCK_MDX_PATH,
        structuredReport: MOCK_STRUCTURED_REPORT,
      }),
    });
    mockGetAdminFileContentFromStorage.mockResolvedValueOnce(MOCK_MDX_CONTENT);

    const result = await wrappedGetReport({ analysisId: MOCK_ANALYSIS_ID }, authContext);

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
    mockAdminFirestore.get.mockResolvedValueOnce({
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
      wrappedGetReport({ analysisId: MOCK_ANALYSIS_ID }, authContext)
    ).rejects.toMatchObject({
      code: 'internal',
      message: expect.stringContaining(
        `Erro ao carregar o relatório (GetReport Func): ${storageErrorMsg}`
      ),
    });
  });

  it('should handle Firestore get error', async () => {
    const firestoreErrorMsg = 'Firestore DB is offline';
    mockAdminFirestore.get.mockRejectedValueOnce(new Error(firestoreErrorMsg));

    await expect(
      wrappedGetReport({ analysisId: MOCK_ANALYSIS_ID }, authContext)
    ).rejects.toMatchObject({
      code: 'internal',
      message: expect.stringContaining(
        `Erro ao carregar o relatório (GetReport Func): ${firestoreErrorMsg}`
      ),
    });
  });
});
