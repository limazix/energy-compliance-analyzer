// @ts-check
'use strict';

/**
 * @fileOverview Unit test suite for the httpsCreateInitialAnalysisRecord Firebase Function.
 */

import admin from 'firebase-admin';

import { httpsCreateInitialAnalysisRecord } from '../../../../functions/src/file-upload-http/createInitial.js';

// Mock firebase-admin
const mockFirestoreAdd = jest.fn();
const mockFirestoreCollectionRef = { add: mockFirestoreAdd };
const mockFirestoreDocRef = { collection: jest.fn(() => mockFirestoreCollectionRef) };
const mockFirestoreService = {
  collection: jest.fn(() => mockFirestoreCollectionRef), // Default to collection returning collectionRef
  doc: jest.fn(() => mockFirestoreDocRef), // Default to doc returning docRef
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
    if (jest.isMockFunction(mockFirestoreService.collection))
      mockFirestoreService.collection.mockClear();
    if (jest.isMockFunction(mockFirestoreService.doc)) mockFirestoreService.doc.mockClear();
    if (jest.isMockFunction(mockFirestoreDocRef.collection))
      mockFirestoreDocRef.collection.mockClear();
  });

  it('should throw "unauthenticated" if no auth context', async () => {
    // @ts-expect-error - Testing invalid context to ensure it throws for unauthenticated user
    await expect(
      httpsCreateInitialAnalysisRecord({ fileName: 'test.csv' }, {})
    ).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('should throw "invalid-argument" if fileName is missing', async () => {
    const context = { auth: { uid: MOCK_USER_ID } };
    // @ts-expect-error - Testing invalid input for fileName, missing required field
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
    expect(mockFirestoreService.doc).toHaveBeenCalledWith(MOCK_USER_ID);
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
