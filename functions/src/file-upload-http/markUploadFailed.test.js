// @ts-check
'use strict';

/**
 * @fileOverview Test suite for the httpsMarkUploadAsFailed Firebase Function.
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
const { httpsMarkUploadAsFailed } = require('./markUploadFailed');

const MOCK_USER_ID = 'test-user-mark-failed';
const MOCK_ANALYSIS_ID = 'analysis-id-for-failure';

describe('httpsMarkUploadAsFailed', () => {
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
    const wrapped = functionsTest.wrap(httpsMarkUploadAsFailed);
    const data = { analysisId: MOCK_ANALYSIS_ID, uploadErrorMessage: 'Test error' };
    await expect(wrapped(data, {})).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('should return success and specific message if analysisId is null', async () => {
    const wrapped = functionsTest.wrap(httpsMarkUploadAsFailed);
    const data = { analysisId: null, uploadErrorMessage: 'Error during record creation' };
    const context = { auth: { uid: MOCK_USER_ID } };

    const result = await wrapped(data, context);
    expect(result).toEqual({
      success: true,
      message: 'Nenhum ID de análise fornecido, nada a marcar no DB.',
    });
    expect(mockFirestoreDoc).not.toHaveBeenCalled();
  });

  it('should return success and message if document not found for a given analysisId', async () => {
    mockFirestoreGet.mockResolvedValueOnce({ exists: false });
    mockFirestoreDoc.mockReturnValueOnce({ get: mockFirestoreGet, update: mockFirestoreUpdate });

    const wrapped = functionsTest.wrap(httpsMarkUploadAsFailed);
    const data = {
      analysisId: 'non-existent-id',
      uploadErrorMessage: 'File not found in storage',
    };
    const context = { auth: { uid: MOCK_USER_ID } };

    const result = await wrapped(data, context);
    expect(mockFirestoreDoc).toHaveBeenCalledWith(`users/${MOCK_USER_ID}/analyses/non-existent-id`);
    expect(result).toEqual({
      success: true,
      message: 'Documento da análise não encontrado para marcar falha.',
    });
    expect(mockFirestoreUpdate).not.toHaveBeenCalled();
  });

  it('should update Firestore and return success if document exists', async () => {
    mockFirestoreGet.mockResolvedValueOnce({ exists: true });
    mockFirestoreUpdate.mockResolvedValueOnce({});
    mockFirestoreDoc.mockReturnValueOnce({ get: mockFirestoreGet, update: mockFirestoreUpdate });

    const wrapped = functionsTest.wrap(httpsMarkUploadAsFailed);
    const uploadErrorMessage = 'Storage upload timed out.';
    const data = { analysisId: MOCK_ANALYSIS_ID, uploadErrorMessage };
    const context = { auth: { uid: MOCK_USER_ID } };

    const result = await wrapped(data, context);

    expect(mockFirestoreDoc).toHaveBeenCalledWith(
      `users/${MOCK_USER_ID}/analyses/${MOCK_ANALYSIS_ID}`
    );
    expect(mockFirestoreUpdate).toHaveBeenCalledWith({
      status: 'error',
      errorMessage: expect.stringContaining(`Falha no upload: ${uploadErrorMessage}`),
      progress: 0,
      uploadProgress: 0,
    });
    expect(result).toEqual({ success: true });
  });

  it('should truncate a long uploadErrorMessage', async () => {
    mockFirestoreGet.mockResolvedValueOnce({ exists: true });
    mockFirestoreUpdate.mockResolvedValueOnce({});
    mockFirestoreDoc.mockReturnValueOnce({ get: mockFirestoreGet, update: mockFirestoreUpdate });

    const wrapped = functionsTest.wrap(httpsMarkUploadAsFailed);
    const longErrorMessage = 'a'.repeat(500);
    const data = { analysisId: MOCK_ANALYSIS_ID, uploadErrorMessage: longErrorMessage };
    const context = { auth: { uid: MOCK_USER_ID } };

    await wrapped(data, context);
    const expectedTruncatedMessage = longErrorMessage.substring(0, 350 - 25); // Max - prefix length
    expect(mockFirestoreUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        errorMessage: expect.stringContaining(expectedTruncatedMessage),
      })
    );
  });

  it('should handle Firestore "update" error', async () => {
    mockFirestoreGet.mockResolvedValueOnce({ exists: true });
    const firestoreError = new Error('Firestore update failed when marking failed');
    mockFirestoreUpdate.mockRejectedValueOnce(firestoreError);
    mockFirestoreDoc.mockReturnValueOnce({ get: mockFirestoreGet, update: mockFirestoreUpdate });

    const wrapped = functionsTest.wrap(httpsMarkUploadAsFailed);
    const data = { analysisId: MOCK_ANALYSIS_ID, uploadErrorMessage: 'Some upload error' };
    const context = { auth: { uid: MOCK_USER_ID } };

    await expect(wrapped(data, context)).rejects.toMatchObject({
      code: 'internal',
      message: expect.stringContaining(
        'Falha ao marcar falha no upload: Firestore update failed when marking failed'
      ),
    });
  });
});
