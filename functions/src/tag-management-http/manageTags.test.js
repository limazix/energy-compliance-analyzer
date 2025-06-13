// @ts-check
'use strict';

/**
 * @fileOverview Test suite for tag management HTTPS Callable Firebase Functions.
 * (httpsCallableAddTag, httpsCallableRemoveTag)
 */

const admin = require('firebase-admin');
const functionsTest = require('firebase-functions-test')(); // Initialize firebase-functions-test

// Mock firebase-admin before importing the functions
jest.mock('firebase-admin', () => {
  const actualAdmin = jest.requireActual('firebase-admin');
  return {
    ...actualAdmin, // Spread actualAdmin to keep other functionalities like firestore.FieldValue
    initializeApp: jest.fn(),
    firestore: jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnThis(), // Mock doc globally for chaining
      get: jest.fn(),
      update: jest.fn(),
      collection: jest.fn().mockReturnThis(), // Added for general adminDb usage
      add: jest.fn(), // Added for general adminDb usage
    }),
    storage: jest.fn().mockReturnValue({
      // Mock storage for other functions
      bucket: jest.fn().mockReturnThis(),
      file: jest.fn().mockReturnThis(),
      exists: jest.fn(),
      delete: jest.fn(),
      save: jest.fn(),
      download: jest.fn(),
    }),
    database: jest.fn().mockReturnValue({
      // Mock rtdb for other functions
      ref: jest.fn().mockReturnThis(),
      push: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      onValue: jest.fn(),
      off: jest.fn(),
      // eslint-disable-next-line no-restricted-globals
      child: jest.fn().mockReturnThis(),
    }),
    // Mock other admin services if they get pulled in by APP_CONFIG or other utils
    auth: jest.fn().mockReturnValue({}),
    messaging: jest.fn().mockReturnValue({}),
    // Add other services as needed
  };
});

// Now import the functions to be tested
const { httpsCallableAddTag, httpsCallableRemoveTag } = require('./manageTags');

const MOCK_USER_ID = 'test-user-123';
const MOCK_ANALYSIS_ID = 'analysis-abc-789';

describe('Tag Management HTTPS Callable Functions', () => {
  let mockFirestoreDoc;
  let mockDocGet;
  let mockDocUpdate;

  beforeEach(() => {
    // Reset mocks for each test
    // @ts-ignore
    mockFirestoreDoc = admin.firestore().doc;
    // @ts-ignore
    mockDocGet = admin.firestore().get;
    // @ts-ignore
    mockDocUpdate = admin.firestore().update;

    mockFirestoreDoc.mockClear();
    mockDocGet.mockClear();
    mockDocUpdate.mockClear();
  });

  afterEach(() => {
    functionsTest.cleanup();
  });

  describe('httpsCallableAddTag', () => {
    const validData = { analysisId: MOCK_ANALYSIS_ID, tag: 'new-tag' };
    const validAuthContext = { auth: { uid: MOCK_USER_ID } };

    it('should throw "unauthenticated" if no auth context', async () => {
      await expect(httpsCallableAddTag(validData, {})).rejects.toMatchObject({
        code: 'unauthenticated',
        message: 'A função deve ser chamada por um usuário autenticado.',
      });
    });

    it('should throw "invalid-argument" if analysisId is missing', async () => {
      await expect(httpsCallableAddTag({ tag: 'tag1' }, validAuthContext)).rejects.toMatchObject({
        code: 'invalid-argument',
        message: 'ID da análise e tag são obrigatórios.',
      });
    });

    it('should throw "invalid-argument" if tag is missing or empty', async () => {
      await expect(
        httpsCallableAddTag({ analysisId: MOCK_ANALYSIS_ID }, validAuthContext)
      ).rejects.toMatchObject({
        code: 'invalid-argument',
        message: 'ID da análise e tag são obrigatórios.',
      });
      await expect(
        httpsCallableAddTag({ analysisId: MOCK_ANALYSIS_ID, tag: '  ' }, validAuthContext)
      ).rejects.toMatchObject({
        code: 'invalid-argument',
        message: 'ID da análise e tag são obrigatórios.',
      });
    });

    it('should throw "not-found" if analysis document does not exist', async () => {
      mockDocGet.mockResolvedValueOnce({ exists: false });
      mockFirestoreDoc.mockReturnValueOnce({ get: mockDocGet, update: mockDocUpdate });

      await expect(httpsCallableAddTag(validData, validAuthContext)).rejects.toMatchObject({
        code: 'not-found',
        message: 'Análise não encontrada.',
      });
      expect(mockFirestoreDoc).toHaveBeenCalledWith(
        `users/${MOCK_USER_ID}/analyses/${MOCK_ANALYSIS_ID}`
      );
    });

    it('should add tag successfully if document exists and tag is new', async () => {
      mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ tags: ['old-tag'] }) });
      mockDocUpdate.mockResolvedValueOnce({}); // Simulate successful update
      mockFirestoreDoc.mockReturnValueOnce({ get: mockDocGet, update: mockDocUpdate });

      const result = await httpsCallableAddTag(validData, validAuthContext);

      expect(mockFirestoreDoc).toHaveBeenCalledWith(
        `users/${MOCK_USER_ID}/analyses/${MOCK_ANALYSIS_ID}`
      );
      expect(mockDocUpdate).toHaveBeenCalledWith({
        tags: admin.firestore.FieldValue.arrayUnion('new-tag'),
      });
      expect(result).toEqual({ success: true, message: 'Tag "new-tag" adicionada.' });
    });

    it('should return success if tag already exists (arrayUnion handles this)', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ tags: ['new-tag', 'old-tag'] }),
      });
      mockDocUpdate.mockResolvedValueOnce({});
      mockFirestoreDoc.mockReturnValueOnce({ get: mockDocGet, update: mockDocUpdate });

      const result = await httpsCallableAddTag(validData, validAuthContext);

      expect(mockDocUpdate).toHaveBeenCalledWith({
        tags: admin.firestore.FieldValue.arrayUnion('new-tag'),
      });
      expect(result).toEqual({ success: true, message: 'Tag "new-tag" já existe.' });
    });

    it('should handle Firestore update error', async () => {
      mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ tags: [] }) });
      mockDocUpdate.mockRejectedValueOnce(new Error('Firestore update failed'));
      mockFirestoreDoc.mockReturnValueOnce({ get: mockDocGet, update: mockDocUpdate });

      await expect(httpsCallableAddTag(validData, validAuthContext)).rejects.toMatchObject({
        code: 'internal',
        message: expect.stringContaining('Falha ao adicionar tag: Firestore update failed'),
      });
    });
  });

  describe('httpsCallableRemoveTag', () => {
    const validData = { analysisId: MOCK_ANALYSIS_ID, tag: 'tag-to-remove' };
    const validAuthContext = { auth: { uid: MOCK_USER_ID } };

    it('should throw "unauthenticated" if no auth context', async () => {
      await expect(httpsCallableRemoveTag(validData, {})).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('should throw "invalid-argument" if analysisId or tag is missing', async () => {
      await expect(httpsCallableRemoveTag({ tag: 'tag1' }, validAuthContext)).rejects.toMatchObject(
        {
          code: 'invalid-argument',
        }
      );
      await expect(
        httpsCallableRemoveTag({ analysisId: MOCK_ANALYSIS_ID }, validAuthContext)
      ).rejects.toMatchObject({
        code: 'invalid-argument',
      });
    });

    it('should throw "not-found" if analysis document does not exist', async () => {
      mockDocGet.mockResolvedValueOnce({ exists: false });
      mockFirestoreDoc.mockReturnValueOnce({ get: mockDocGet, update: mockDocUpdate });

      await expect(httpsCallableRemoveTag(validData, validAuthContext)).rejects.toMatchObject({
        code: 'not-found',
        message: 'Análise não encontrada.',
      });
    });

    it('should remove tag successfully', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ tags: ['tag-to-remove', 'another-tag'] }),
      });
      mockDocUpdate.mockResolvedValueOnce({});
      mockFirestoreDoc.mockReturnValueOnce({ get: mockDocGet, update: mockDocUpdate });

      const result = await httpsCallableRemoveTag(validData, validAuthContext);

      expect(mockDocUpdate).toHaveBeenCalledWith({
        tags: admin.firestore.FieldValue.arrayRemove('tag-to-remove'),
      });
      expect(result).toEqual({ success: true, message: 'Tag "tag-to-remove" removida.' });
    });

    it('should handle Firestore update error during removal', async () => {
      mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ tags: ['tag-to-remove'] }) });
      mockDocUpdate.mockRejectedValueOnce(new Error('Firestore remove failed'));
      mockFirestoreDoc.mockReturnValueOnce({ get: mockDocGet, update: mockDocUpdate });

      await expect(httpsCallableRemoveTag(validData, validAuthContext)).rejects.toMatchObject({
        code: 'internal',
        message: expect.stringContaining('Falha ao remover tag: Firestore remove failed'),
      });
    });
  });
});
