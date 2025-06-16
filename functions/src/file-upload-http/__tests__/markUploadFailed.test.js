// @ts-check
'use strict';

/**
 * @fileOverview Unit test suite for the httpsMarkUploadAsFailed Firebase Function.
 */

import { httpsMarkUploadAsFailed } from '../../../../functions/src/file-upload-http/markUploadFailed.js';
// import { APP_CONFIG } from '../../../../src/config/appConfig.ts'; // No longer needed directly

// Mock firebase-admin
const mockDocGet = jest.fn();
const mockDocUpdate = jest.fn();
const mockFirestoreDocRef = { get: mockDocGet, update: mockDocUpdate };
const mockFirestoreCollectionRef = { doc: jest.fn(() => mockFirestoreDocRef) };
const mockFirestoreUserDocRef = { collection: jest.fn(() => mockFirestoreCollectionRef) };
const mockFirestoreService = {
  collection: jest.fn(() => ({ doc: jest.fn(() => mockFirestoreUserDocRef) })),
};
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(() => mockFirestoreService),
}));

const MOCK_USER_ID = 'test-user-mark-failed';
const MOCK_ANALYSIS_ID = 'analysis-id-for-failure';

describe('httpsMarkUploadAsFailed (Unit)', () => {
  beforeEach(() => {
    mockDocGet.mockReset();
    mockDocUpdate.mockReset();
    mockFirestoreService.collection.mockClear();
    if (mockFirestoreService.collection().doc) {
      mockFirestoreService.collection().doc.mockClear();
    }
    if (mockFirestoreUserDocRef.collection) {
      mockFirestoreUserDocRef.collection.mockClear();
    }
    if (mockFirestoreCollectionRef.doc) {
      mockFirestoreCollectionRef.doc.mockClear();
    }
  });

  it('should throw "unauthenticated" if no auth context', async () => {
    const data = { analysisId: MOCK_ANALYSIS_ID, uploadErrorMessage: 'Test error' };
    // @ts-expect-error - Testing invalid context: unauthenticated
    await expect(httpsMarkUploadAsFailed(data, {})).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('should return success and specific message if analysisId is null', async () => {
    const data = { analysisId: null, uploadErrorMessage: 'Error during record creation' };
    const context = { auth: { uid: MOCK_USER_ID } };
    const result = await httpsMarkUploadAsFailed(data, context);
    expect(result).toEqual({
      success: true,
      message: 'Nenhum ID de análise fornecido, nada a marcar no DB.',
    });
    expect(mockFirestoreCollectionRef.doc).not.toHaveBeenCalled();
  });

  it('should return success and message if document not found for a given analysisId', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false });
    const data = {
      analysisId: 'non-existent-id',
      uploadErrorMessage: 'File not found in storage',
    };
    const context = { auth: { uid: MOCK_USER_ID } };
    const result = await httpsMarkUploadAsFailed(data, context);

    expect(mockFirestoreService.collection).toHaveBeenCalledWith('users');
    expect(mockFirestoreService.collection().doc).toHaveBeenCalledWith(MOCK_USER_ID);
    expect(mockFirestoreUserDocRef.collection).toHaveBeenCalledWith('analyses');
    expect(mockFirestoreCollectionRef.doc).toHaveBeenCalledWith('non-existent-id');
    expect(result).toEqual({
      success: true,
      message: 'Documento da análise não encontrado para marcar falha.',
    });
    expect(mockDocUpdate).not.toHaveBeenCalled();
  });

  it('should update Firestore and return success if document exists', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: true });
    mockDocUpdate.mockResolvedValueOnce({});
    const uploadErrorMessage = 'Storage upload timed out.';
    const data = { analysisId: MOCK_ANALYSIS_ID, uploadErrorMessage };
    const context = { auth: { uid: MOCK_USER_ID } };
    const result = await httpsMarkUploadAsFailed(data, context);

    expect(mockFirestoreCollectionRef.doc).toHaveBeenCalledWith(MOCK_ANALYSIS_ID);
    expect(mockDocUpdate).toHaveBeenCalledWith({
      status: 'error',
      errorMessage: `Falha no upload: ${String(uploadErrorMessage).substring(0, 325)}`, // Matches MAX_ERROR_MESSAGE_LENGTH - 25
      progress: 0,
      uploadProgress: 0,
    });
    expect(result).toEqual({ success: true });
  });

  it('should handle Firestore "update" error', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: true });
    const firestoreError = new Error('Firestore update failed when marking failed');
    mockDocUpdate.mockRejectedValueOnce(firestoreError);
    const data = { analysisId: MOCK_ANALYSIS_ID, uploadErrorMessage: 'Some upload error' };
    const context = { auth: { uid: MOCK_USER_ID } };

    await expect(httpsMarkUploadAsFailed(data, context)).rejects.toMatchObject({
      code: 'internal',
      message: expect.stringContaining(
        'Falha ao marcar falha no upload: Firestore update failed when marking failed'
      ),
    });
  });
});
