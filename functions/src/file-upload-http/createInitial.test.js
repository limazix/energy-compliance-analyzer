// @ts-check
'use strict';

/**
 * @fileOverview Test suite for the httpsCreateInitialAnalysisRecord Firebase Function.
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
      add: jest.fn(), // Specific mock for 'add'
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
const { httpsCreateInitialAnalysisRecord } = require('./createInitial');

const MOCK_USER_ID = 'test-user-create-initial';

describe('httpsCreateInitialAnalysisRecord', () => {
  let mockFirestoreAdd;

  beforeEach(() => {
    // Reset mocks for each test
    // @ts-ignore
    mockFirestoreAdd = admin.firestore().add;
    mockFirestoreAdd.mockClear();
  });

  afterAll(() => {
    functionsTest.cleanup();
  });

  it('should throw "unauthenticated" if no auth context', async () => {
    const wrapped = functionsTest.wrap(httpsCreateInitialAnalysisRecord);
    await expect(wrapped({ fileName: 'test.csv' }, {})).rejects.toMatchObject({
      code: 'unauthenticated',
      message: 'A função deve ser chamada por um usuário autenticado.',
    });
  });

  it('should throw "invalid-argument" if fileName is missing', async () => {
    const wrapped = functionsTest.wrap(httpsCreateInitialAnalysisRecord);
    const context = { auth: { uid: MOCK_USER_ID } };
    await expect(wrapped({}, context)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'Nome do arquivo é obrigatório.',
    });
  });

  it('should throw "invalid-argument" if fileName is empty after trim', async () => {
    const wrapped = functionsTest.wrap(httpsCreateInitialAnalysisRecord);
    const context = { auth: { uid: MOCK_USER_ID } };
    await expect(wrapped({ fileName: '   ' }, context)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'Nome do arquivo é obrigatório.',
    });
  });

  it('should create an analysis record and return analysisId on success', async () => {
    const mockAnalysisId = 'new-analysis-doc-id';
    mockFirestoreAdd.mockResolvedValueOnce({ id: mockAnalysisId });
    const wrapped = functionsTest.wrap(httpsCreateInitialAnalysisRecord);

    const data = {
      fileName: 'data.csv',
      title: 'Test Title',
      description: 'Test Description',
      languageCode: 'en-US',
    };
    const context = { auth: { uid: MOCK_USER_ID } };

    const result = await wrapped(data, context);

    expect(admin.firestore().collection).toHaveBeenCalledWith('users');
    expect(admin.firestore().doc).toHaveBeenCalledWith(MOCK_USER_ID);
    expect(admin.firestore().collection).toHaveBeenCalledWith('analyses');
    expect(mockFirestoreAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: MOCK_USER_ID,
        fileName: 'data.csv',
        title: 'Test Title',
        description: 'Test Description',
        languageCode: 'en-US',
        status: 'uploading',
        progress: 0,
        uploadProgress: 0,
        tags: [],
        createdAt: expect.any(Object), // Firebase Server Timestamp
      })
    );
    expect(result).toEqual({ analysisId: mockAnalysisId });
  });

  it('should use fileName for title if title is not provided', async () => {
    mockFirestoreAdd.mockResolvedValueOnce({ id: 'another-id' });
    const wrapped = functionsTest.wrap(httpsCreateInitialAnalysisRecord);
    const data = { fileName: 'only-filename.csv' };
    const context = { auth: { uid: MOCK_USER_ID } };

    await wrapped(data, context);
    expect(mockFirestoreAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'only-filename.csv',
      })
    );
  });

  it('should handle Firestore "add" error', async () => {
    const firestoreError = new Error('Firestore add operation failed');
    mockFirestoreAdd.mockRejectedValueOnce(firestoreError);
    const wrapped = functionsTest.wrap(httpsCreateInitialAnalysisRecord);

    const data = { fileName: 'error-case.csv' };
    const context = { auth: { uid: MOCK_USER_ID } };

    await expect(wrapped(data, context)).rejects.toMatchObject({
      code: 'internal',
      message: expect.stringContaining('Falha ao criar registro: Firestore add operation failed'),
    });
  });
});
