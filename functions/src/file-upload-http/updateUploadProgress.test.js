// @ts-check
'use strict';

/**
 * @fileOverview Test suite for the httpsUpdateAnalysisUploadProgress Firebase Function.
 */

const admin = require('firebase-admin');
const functionsTest = require('firebase-functions-test')();

// Mock firebase-admin
jest.mock('firebase-admin', () => {
  const actualAdmin = jest.requireActual('firebase-admin');
  return {
    ...actualAdmin,
    initializeApp: jest.fn(),
    firestore: jest.fn().mockReturnValue({
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      get: jest.fn(),
      update: jest.fn(),
    }),
    // Mock other admin services if they get pulled in
    storage: jest.fn().mockReturnValue({ bucket: jest.fn() }),
    database: jest.fn().mockReturnValue({ ref: jest.fn() }),
    auth: jest.fn().mockReturnValue({}),
    messaging: jest.fn().mockReturnValue({}),
    pubsub: jest.fn().mockReturnValue({ topic: jest.fn() }),
  };
});

// Import the function to be tested
const { httpsUpdateAnalysisUploadProgress } = require('./updateUploadProgress');
const { APP_CONFIG } = require('../../lib/shared/config/appConfig.js');

const MOCK_USER_ID = 'test-user-update-progress';
const MOCK_ANALYSIS_ID = 'analysis-id-for-progress';
const UPLOAD_COMPLETED_OVERALL_PROGRESS = APP_CONFIG.PROGRESS_PERCENTAGE_UPLOAD_COMPLETE;

describe('httpsUpdateAnalysisUploadProgress', () => {
  let mockFirestoreGet;
  let mockFirestoreUpdate;
  let mockFirestoreDoc;

  beforeEach(() => {
    // @ts-ignore
    mockFirestoreGet = admin.firestore().get;
    // @ts-ignore
    mockFirestoreUpdate = admin.firestore().update;
    // @ts-ignore
    mockFirestoreDoc = admin.firestore().doc;

    mockFirestoreGet.mockClear();
    mockFirestoreUpdate.mockClear();
    mockFirestoreDoc.mockClear();
  });

  afterAll(() => {
    functionsTest.cleanup();
  });

  it('should throw "unauthenticated" if no auth context', async () => {
    const wrapped = functionsTest.wrap(httpsUpdateAnalysisUploadProgress);
    const data = { analysisId: MOCK_ANALYSIS_ID, uploadProgress: 50 };
    await expect(wrapped(data, {})).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('should throw "invalid-argument" if analysisId is missing', async () => {
    const wrapped = functionsTest.wrap(httpsUpdateAnalysisUploadProgress);
    const context = { auth: { uid: MOCK_USER_ID } };
    // @ts-ignore
    await expect(wrapped({ uploadProgress: 50 }, context)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'ID da análise e progresso do upload são obrigatórios.',
    });
  });

  it('should throw "invalid-argument" if uploadProgress is not a number', async () => {
    const wrapped = functionsTest.wrap(httpsUpdateAnalysisUploadProgress);
    const context = { auth: { uid: MOCK_USER_ID } };
    // @ts-ignore
    await expect(wrapped({ analysisId: MOCK_ANALYSIS_ID }, context)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'ID da análise e progresso do upload são obrigatórios.',
    });
    await expect(
      // @ts-ignore
      wrapped({ analysisId: MOCK_ANALYSIS_ID, uploadProgress: 'fifty' }, context)
    ).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'ID da análise e progresso do upload são obrigatórios.',
    });
  });

  it('should throw "not-found" if analysis document does not exist', async () => {
    mockFirestoreGet.mockResolvedValueOnce({ exists: false });
    mockFirestoreDoc.mockReturnValueOnce({ get: mockFirestoreGet, update: mockFirestoreUpdate });

    const wrapped = functionsTest.wrap(httpsUpdateAnalysisUploadProgress);
    const data = { analysisId: 'non-existent-id', uploadProgress: 75 };
    const context = { auth: { uid: MOCK_USER_ID } };

    await expect(wrapped(data, context)).rejects.toMatchObject({
      code: 'not-found',
      message: 'Documento da análise não encontrado.',
    });
    expect(mockFirestoreDoc).toHaveBeenCalledWith(`users/${MOCK_USER_ID}/analyses/non-existent-id`);
  });

  it('should update progress and return success if document exists', async () => {
    mockFirestoreGet.mockResolvedValueOnce({ exists: true });
    mockFirestoreUpdate.mockResolvedValueOnce({});
    mockFirestoreDoc.mockReturnValueOnce({ get: mockFirestoreGet, update: mockFirestoreUpdate });

    const wrapped = functionsTest.wrap(httpsUpdateAnalysisUploadProgress);
    const data = { analysisId: MOCK_ANALYSIS_ID, uploadProgress: 60 };
    const context = { auth: { uid: MOCK_USER_ID } };

    const result = await wrapped(data, context);

    expect(mockFirestoreDoc).toHaveBeenCalledWith(
      `users/${MOCK_USER_ID}/analyses/${MOCK_ANALYSIS_ID}`
    );
    const expectedOverallProgress = Math.min(
      UPLOAD_COMPLETED_OVERALL_PROGRESS - 1, // 9
      Math.round(60 * (UPLOAD_COMPLETED_OVERALL_PROGRESS / 100)) // 60 * 0.1 = 6
    ); // So, 6
    expect(mockFirestoreUpdate).toHaveBeenCalledWith({
      uploadProgress: 60,
      progress: expectedOverallProgress,
      status: 'uploading',
    });
    expect(result).toEqual({ success: true });
  });

  it('should cap overall progress based on upload at UPLOAD_COMPLETED_OVERALL_PROGRESS - 1', async () => {
    mockFirestoreGet.mockResolvedValueOnce({ exists: true });
    mockFirestoreUpdate.mockResolvedValueOnce({});
    mockFirestoreDoc.mockReturnValueOnce({ get: mockFirestoreGet, update: mockFirestoreUpdate });

    const wrapped = functionsTest.wrap(httpsUpdateAnalysisUploadProgress);
    const data = { analysisId: MOCK_ANALYSIS_ID, uploadProgress: 100 }; // Upload is 100%
    const context = { auth: { uid: MOCK_USER_ID } };

    await wrapped(data, context);

    const expectedOverallProgress = UPLOAD_COMPLETED_OVERALL_PROGRESS - 1; // Should be capped
    expect(mockFirestoreUpdate).toHaveBeenCalledWith({
      uploadProgress: 100,
      progress: expectedOverallProgress,
      status: 'uploading',
    });
  });

  it('should handle Firestore "update" error', async () => {
    mockFirestoreGet.mockResolvedValueOnce({ exists: true });
    const firestoreError = new Error('Firestore update failed for progress');
    mockFirestoreUpdate.mockRejectedValueOnce(firestoreError);
    mockFirestoreDoc.mockReturnValueOnce({ get: mockFirestoreGet, update: mockFirestoreUpdate });

    const wrapped = functionsTest.wrap(httpsUpdateAnalysisUploadProgress);
    const data = { analysisId: MOCK_ANALYSIS_ID, uploadProgress: 50 };
    const context = { auth: { uid: MOCK_USER_ID } };

    await expect(wrapped(data, context)).rejects.toMatchObject({
      code: 'internal',
      message: expect.stringContaining(
        'Falha ao atualizar progresso: Firestore update failed for progress'
      ),
    });
  });
});
