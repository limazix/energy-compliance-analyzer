// functions/src/file-upload-http/__tests__/createInitial.test.ts
'use strict';

/**
 * @fileOverview Unit test suite for the createInitialAnalysisEntry Firebase Function.
 */

import admin from 'firebase-admin';
import * as functions from 'firebase-functions';

import { APP_CONFIG } from '../../../../config/appConfig';
import { createInitialAnalysisEntry } from '../../../../functions/src/file-upload-http/createInitial';

// Mock firebase-admin
const mockFirestoreAdd = jest.fn();
const mockFirestoreDocRef: {
  set: jest.Mock;
  collection: jest.Mock;
  id: string;
} = {
  set: jest.fn(),
  collection: jest.fn(() => mockFirestoreCollectionRef),
  id: 'mock-analysis-id',
};
const mockFirestoreCollectionRef = {
  add: mockFirestoreAdd,
  doc: jest.fn(() => mockFirestoreDocRef),
};

const mockGetSignedUrl = jest.fn();
const mockStorageFile = { getSignedUrl: mockGetSignedUrl, path: 'mock/path/file.csv' };
const mockStorageBucket = { file: jest.fn(() => mockStorageFile) };
const mockStorageService = { bucket: jest.fn(() => mockStorageBucket) };

const mockFirestoreService = {
  collection: jest.fn(() => ({ doc: jest.fn(() => mockFirestoreDocRef) })),
};

jest.mock('firebase-admin', () => {
  const actualAdmin = jest.requireActual('firebase-admin');
  return {
    initializeApp: jest.fn(),
    firestore: jest.fn(() => mockFirestoreService),
    storage: jest.fn(() => mockStorageService), // Mock storage service
    'firestore.Timestamp': actualAdmin.firestore.Timestamp,
    'firestore.FieldValue': actualAdmin.firestore.FieldValue,
  };
});

interface CreateInitialAnalysisEntryPayload {
  fileName?: string;
  fileSize?: number;
  fileType?: string;
}

const MOCK_USER_ID = 'test-user-create-initial';

describe('createInitialAnalysisEntry (Unit)', () => {
  beforeEach(() => {
    mockFirestoreAdd.mockReset();
    mockFirestoreDocRef.set.mockReset();
    mockGetSignedUrl.mockReset();
    mockStorageBucket.file.mockClear();
    if (jest.isMockFunction(mockFirestoreService.collection)) {
      mockFirestoreService.collection.mockClear();
    }
    if (
      mockFirestoreService.collection() &&
      jest.isMockFunction(mockFirestoreService.collection().doc)
    ) {
      mockFirestoreService.collection().doc.mockClear();
    }
    if (mockFirestoreDocRef && jest.isMockFunction(mockFirestoreDocRef.collection)) {
      mockFirestoreDocRef.collection.mockClear();
    }
  });

  it('should throw "unauthenticated" if no auth context', async () => {
    await expect(
      createInitialAnalysisEntry(
        { fileName: 'test.csv', fileSize: 100, fileType: 'text/csv' },
        {} as functions.https.CallableContext
      )
    ).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('should throw "invalid-argument" if required fields are missing', async () => {
    const context = { auth: { uid: MOCK_USER_ID } } as functions.https.CallableContext;
    await expect(
      createInitialAnalysisEntry(
        { fileSize: 100, fileType: 'text/csv' } as CreateInitialAnalysisEntryPayload,
        context
      )
    ).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'Missing required fields (fileName, fileType, fileSize must be > 0).',
    });
  });

  it('should create an analysis entry and return analysisId and signedUrl on success', async () => {
    const mockAnalysisId = 'new-analysis-doc-id';
    const mockSignedUrl = 'https://fake-signed-url.com/upload';
    // Ensure the doc() call for analysisRef returns an object with an 'id' property
    (mockFirestoreService.collection().doc().collection().doc as jest.Mock).mockReturnValueOnce({
      id: mockAnalysisId,
      set: mockFirestoreDocRef.set,
    });
    mockFirestoreDocRef.set.mockResolvedValueOnce({});
    mockGetSignedUrl.mockResolvedValueOnce([mockSignedUrl]);

    const data = {
      fileName: 'data.csv',
      title: 'Test Title',
      description: 'Test Description',
      fileSize: 12345,
      fileType: 'text/csv',
      languageCode: 'en-US',
    };
    const context = { auth: { uid: MOCK_USER_ID } } as functions.https.CallableContext;

    const result = await createInitialAnalysisEntry(data, context);

    expect(mockFirestoreService.collection).toHaveBeenCalledWith('users');
    expect(mockFirestoreService.collection().doc).toHaveBeenCalledWith(MOCK_USER_ID);
    expect(mockFirestoreDocRef.collection).toHaveBeenCalledWith('analyses');
    // Check that Firestore doc().set was called with the analysisId from analysisRef.id
    expect(mockFirestoreDocRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: MOCK_USER_ID,
        fileName: 'data.csv',
        title: 'Test Title',
        status: 'uploading',
        storageFilePath: `user_uploads/${MOCK_USER_ID}/${mockAnalysisId}/data.csv`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    );
    expect(mockStorageBucket.file).toHaveBeenCalledWith(
      `user_uploads/${MOCK_USER_ID}/${mockAnalysisId}/data.csv`
    );
    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'write',
        contentType: 'text/csv',
        version: 'v4',
      })
    );
    expect(result).toEqual({ analysisId: mockAnalysisId, signedUrl: mockSignedUrl });
  });

  it('should use default language code if not provided', async () => {
    const mockAnalysisId = 'default-lang-id';
    (mockFirestoreService.collection().doc().collection().doc as jest.Mock).mockReturnValueOnce({
      id: mockAnalysisId,
      set: mockFirestoreDocRef.set,
    });
    mockFirestoreDocRef.set.mockResolvedValueOnce({});
    mockGetSignedUrl.mockResolvedValueOnce(['https://fake-signed-url.com/upload']);

    const data = {
      fileName: 'data_default_lang.csv',
      title: 'Test Title Default Lang',
      fileSize: 500,
      fileType: 'text/csv',
      // description and languageCode omitted
    };
    const context = { auth: { uid: MOCK_USER_ID } } as functions.https.CallableContext;
    await createInitialAnalysisEntry(data, context);
    expect(mockFirestoreDocRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        languageCode: APP_CONFIG.DEFAULT_LANGUAGE_CODE,
      })
    );
  });

  it('should handle Firestore "set" error', async () => {
    const firestoreError = new Error('Firestore set operation failed');
    mockFirestoreDocRef.set.mockRejectedValueOnce(firestoreError);
    mockGetSignedUrl.mockResolvedValueOnce(['https://fake-signed-url.com/upload']);

    const data = {
      fileName: 'error-case.csv',
      fileSize: 100,
      fileType: 'text/csv',
    };
    const context = { auth: { uid: MOCK_USER_ID } } as functions.https.CallableContext;

    await expect(createInitialAnalysisEntry(data, context)).rejects.toMatchObject({
      code: 'internal',
      message: expect.stringContaining(
        'Falha ao criar registro inicial: Firestore set operation failed'
      ),
    });
  });

  it('should handle Storage "getSignedUrl" error', async () => {
    const storageError = new Error('Storage getSignedUrl failed');
    mockFirestoreDocRef.set.mockResolvedValueOnce({});
    mockGetSignedUrl.mockRejectedValueOnce(storageError);

    const data = {
      fileName: 'storage-error.csv',
      fileSize: 100,
      fileType: 'text/csv',
    };
    const context = { auth: { uid: MOCK_USER_ID } } as functions.https.CallableContext;

    await expect(createInitialAnalysisEntry(data, context)).rejects.toMatchObject({
      code: 'internal',
      message: expect.stringContaining(
        'Falha ao criar registro inicial: Storage getSignedUrl failed'
      ),
    });
  });
});
