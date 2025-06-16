// @ts-check
'use strict';

/**
 * @fileOverview Unit test suite for the httpsCreateInitialAnalysisRecord Firebase Function.
 */

import admin from 'firebase-admin';

import { httpsCreateInitialAnalysisRecord } from '../../../../functions/src/file-upload-http/createInitial.js';
import { APP_CONFIG } from '../../../../src/config/appConfig.ts'; // Import from src

// Mock firebase-admin
const mockFirestoreAdd = jest.fn();
const mockFirestoreCollectionRef = { add: mockFirestoreAdd };
const mockFirestoreDocRef = { collection: jest.fn(() => mockFirestoreCollectionRef) };
const mockFirestoreService = {
  collection: jest.fn(() => ({ doc: jest.fn(() => mockFirestoreDocRef) })), // Ensure it correctly mocks the path user/userId/analyses
};
jest.mock('firebase-admin', () => {
  const actualAdmin = jest.requireActual('firebase-admin');
  return {
    initializeApp: jest.fn(),
    firestore: jest.fn(() => mockFirestoreService),
    // Static properties
    'firestore.Timestamp': actualAdmin.firestore.Timestamp,
    'firestore.FieldValue': actualAdmin.firestore.FieldValue,
  };
});

const MOCK_USER_ID = 'test-user-create-initial';

describe('httpsCreateInitialAnalysisRecord (Unit)', () => {
  beforeEach(() => {
    mockFirestoreAdd.mockReset();
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
    // @ts-expect-error - Testing invalid context: unauthenticated
    await expect(
      httpsCreateInitialAnalysisRecord({ fileName: 'test.csv' }, {})
    ).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('should throw "invalid-argument" if fileName is missing', async () => {
    const context = { auth: { uid: MOCK_USER_ID } };
    // @ts-expect-error - Testing invalid input: fileName is missing
    await expect(httpsCreateInitialAnalysisRecord({}, context)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'Nome do arquivo é obrigatório.',
    });
  });

  it('should create an analysis record and return analysisId on success', async () => {
    const mockAnalysisId = 'new-analysis-doc-id';
    mockFirestoreAdd.mockResolvedValueOnce({ id: mockAnalysisId });

    const data = {
      fileName: 'data.csv',
      title: 'Test Title',
      description: 'Test Description',
      languageCode: 'en-US',
    };
    const context = { auth: { uid: MOCK_USER_ID } };

    const result = await httpsCreateInitialAnalysisRecord(data, context);

    expect(mockFirestoreService.collection).toHaveBeenCalledWith('users');
    expect(mockFirestoreService.collection().doc).toHaveBeenCalledWith(MOCK_USER_ID);
    expect(mockFirestoreDocRef.collection).toHaveBeenCalledWith('analyses');
    expect(mockFirestoreAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: MOCK_USER_ID,
        fileName: 'data.csv',
        title: 'Test Title',
        status: 'uploading',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    );
    expect(result).toEqual({ analysisId: mockAnalysisId });
  });

  it('should use default language code if not provided', async () => {
    const mockAnalysisId = 'new-analysis-doc-id-default-lang';
    mockFirestoreAdd.mockResolvedValueOnce({ id: mockAnalysisId });

    const data = {
      fileName: 'data_default_lang.csv',
      title: 'Test Title Default Lang',
      // description and languageCode omitted
    };
    const context = { auth: { uid: MOCK_USER_ID } };
    await httpsCreateInitialAnalysisRecord(data, context);
    expect(mockFirestoreAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        languageCode: APP_CONFIG.DEFAULT_LANGUAGE_CODE,
      })
    );
  });

  it('should handle Firestore "add" error', async () => {
    const firestoreError = new Error('Firestore add operation failed');
    mockFirestoreAdd.mockRejectedValueOnce(firestoreError);

    const data = { fileName: 'error-case.csv' };
    const context = { auth: { uid: MOCK_USER_ID } };

    await expect(httpsCreateInitialAnalysisRecord(data, context)).rejects.toMatchObject({
      code: 'internal',
      message: expect.stringContaining('Falha ao criar registro: Firestore add operation failed'),
    });
  });
});
