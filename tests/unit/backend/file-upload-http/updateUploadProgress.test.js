// @ts-check
'use strict';

/**
 * @fileOverview Unit test suite for the httpsUpdateAnalysisUploadProgress Firebase Function.
 */

import { APP_CONFIG } from '../../../../functions/lib/shared/config/appConfig.js';
import { httpsUpdateAnalysisUploadProgress } from '../../../../functions/src/file-upload-http/updateUploadProgress.js';

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

const MOCK_USER_ID = 'test-user-update-progress';
const MOCK_ANALYSIS_ID = 'analysis-id-for-progress';
const UPLOAD_COMPLETED_OVERALL_PROGRESS = APP_CONFIG.PROGRESS_PERCENTAGE_UPLOAD_COMPLETE;

describe('httpsUpdateAnalysisUploadProgress (Unit)', () => {
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
    const data = { analysisId: MOCK_ANALYSIS_ID, uploadProgress: 50 };
    // @ts-expect-error - Testing invalid context for unauth error
    await expect(httpsUpdateAnalysisUploadProgress(data, {})).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('should throw "invalid-argument" if analysisId is missing', async () => {
    const context = { auth: { uid: MOCK_USER_ID } };
    // @ts-expect-error - Testing invalid input: missing analysisId
    await expect(
      httpsUpdateAnalysisUploadProgress({ uploadProgress: 50 }, context)
    ).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('should throw "invalid-argument" if uploadProgress is not a number', async () => {
    const context = { auth: { uid: MOCK_USER_ID } };
    // @ts-expect-error - Testing invalid input: missing uploadProgress
    await expect(
      httpsUpdateAnalysisUploadProgress({ analysisId: MOCK_ANALYSIS_ID }, context)
    ).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    // @ts-expect-error - Testing invalid input: uploadProgress is string
    await expect(
      httpsUpdateAnalysisUploadProgress(
        { analysisId: MOCK_ANALYSIS_ID, uploadProgress: 'fifty' },
        context
      )
    ).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('should throw "not-found" if analysis document does not exist', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false });
    const data = { analysisId: 'non-existent-id', uploadProgress: 75 };
    const context = { auth: { uid: MOCK_USER_ID } };

    await expect(httpsUpdateAnalysisUploadProgress(data, context)).rejects.toMatchObject({
      code: 'not-found',
      message: 'Documento da análise não encontrado.',
    });
    expect(mockFirestoreService.collection).toHaveBeenCalledWith('users');
    expect(mockFirestoreService.collection().doc).toHaveBeenCalledWith(MOCK_USER_ID);
    expect(mockFirestoreUserDocRef.collection).toHaveBeenCalledWith('analyses');
    expect(mockFirestoreCollectionRef.doc).toHaveBeenCalledWith('non-existent-id');
  });

  it('should update progress and return success if document exists', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: true });
    mockDocUpdate.mockResolvedValueOnce({});
    const data = { analysisId: MOCK_ANALYSIS_ID, uploadProgress: 60 };
    const context = { auth: { uid: MOCK_USER_ID } };
    const result = await httpsUpdateAnalysisUploadProgress(data, context);

    expect(mockFirestoreCollectionRef.doc).toHaveBeenCalledWith(MOCK_ANALYSIS_ID);
    const expectedOverallProgress = Math.min(
      UPLOAD_COMPLETED_OVERALL_PROGRESS - 1,
      Math.round(60 * (UPLOAD_COMPLETED_OVERALL_PROGRESS / 100))
    );
    expect(mockDocUpdate).toHaveBeenCalledWith({
      uploadProgress: 60,
      progress: expectedOverallProgress,
      status: 'uploading',
    });
    expect(result).toEqual({ success: true });
  });

  it('should cap overall progress based on upload at UPLOAD_COMPLETED_OVERALL_PROGRESS - 1', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: true });
    mockDocUpdate.mockResolvedValueOnce({});
    const data = { analysisId: MOCK_ANALYSIS_ID, uploadProgress: 100 };
    const context = { auth: { uid: MOCK_USER_ID } };

    await httpsUpdateAnalysisUploadProgress(data, context);
    const expectedOverallProgress = UPLOAD_COMPLETED_OVERALL_PROGRESS - 1;
    expect(mockDocUpdate).toHaveBeenCalledWith({
      uploadProgress: 100,
      progress: expectedOverallProgress,
      status: 'uploading',
    });
  });

  it('should handle Firestore "update" error', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: true });
    const firestoreError = new Error('Firestore update failed for progress');
    mockDocUpdate.mockRejectedValueOnce(firestoreError);
    const data = { analysisId: MOCK_ANALYSIS_ID, uploadProgress: 50 };
    const context = { auth: { uid: MOCK_USER_ID } };

    await expect(httpsUpdateAnalysisUploadProgress(data, context)).rejects.toMatchObject({
      code: 'internal',
    });
  });
});
