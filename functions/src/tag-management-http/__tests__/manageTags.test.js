// @ts-check
'use strict';

/**
 * @fileOverview Unit test suite for tag management HTTPS Callable Firebase Functions.
 */

import admin from 'firebase-admin';

import {
  httpsCallableAddTag,
  httpsCallableRemoveTag,
} from '../../../../functions/src/tag-management-http/manageTags.js';
// import { APP_CONFIG } from '../../../../src/config/appConfig.ts'; // No longer needed directly

// Mock firebase-admin before importing the functions
jest.mock('firebase-admin', () => {
  const actualAdmin = jest.requireActual('firebase-admin');
  const mockFirestoreInstance = {
    doc: jest.fn().mockReturnThis(),
    get: jest.fn(),
    update: jest.fn(),
    collection: jest.fn().mockReturnThis(),
    add: jest.fn(),
  };
  return {
    ...actualAdmin, // Spread actualAdmin to ensure static properties like FieldValue are available
    initializeApp: jest.fn(),
    firestore: jest.fn(() => mockFirestoreInstance), // Ensure this returns the mock with methods
    storage: jest.fn().mockReturnValue({
      bucket: jest.fn().mockReturnThis(),
      file: jest.fn().mockReturnThis(),
      exists: jest.fn(),
      delete: jest.fn(),
      save: jest.fn(),
      download: jest.fn(),
    }),
    database: jest.fn().mockReturnValue({
      ref: jest.fn().mockReturnThis(),
      push: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      onValue: jest.fn(),
      off: jest.fn(),
      child: jest.fn().mockReturnThis(),
    }),
    auth: jest.fn().mockReturnValue({}),
    messaging: jest.fn().mockReturnValue({}),
  };
});

const MOCK_USER_ID = 'test-user-123';
const MOCK_ANALYSIS_ID = 'analysis-abc-789';

describe('Tag Management HTTPS Callable Functions (Unit)', () => {
  let mockAdminFirestoreInstance;
  let mockDocGet;
  let mockDocUpdate;

  beforeEach(() => {
    // @ts-expect-error - admin is mocked for tests
    mockAdminFirestoreInstance = admin.firestore(); // Get the mocked instance
    mockDocGet = mockAdminFirestoreInstance.get; // Get the mocked get method
    mockDocUpdate = mockAdminFirestoreInstance.update; // Get the mocked update method

    // Clear mocks
    mockAdminFirestoreInstance.doc.mockClear();
    mockDocGet.mockClear();
    mockDocUpdate.mockClear();
  });

  describe('httpsCallableAddTag', () => {
    const validData = { analysisId: MOCK_ANALYSIS_ID, tag: 'new-tag' };
    const validAuthContext = { auth: { uid: MOCK_USER_ID } };

    it('should throw "unauthenticated" if no auth context', async () => {
      // @ts-expect-error - Testing invalid context: unauthenticated
      await expect(httpsCallableAddTag(validData, {})).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('should throw "invalid-argument" if analysisId is missing', async () => {
      // @ts-expect-error - Testing invalid input: analysisId missing
      await expect(httpsCallableAddTag({ tag: 'tag1' }, validAuthContext)).rejects.toMatchObject({
        code: 'invalid-argument',
      });
    });

    it('should throw "not-found" if analysis document does not exist', async () => {
      mockDocGet.mockResolvedValueOnce({ exists: false });
      await expect(httpsCallableAddTag(validData, validAuthContext)).rejects.toMatchObject({
        code: 'not-found',
      });
    });

    it('should add tag successfully if document exists and tag is new', async () => {
      mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ tags: ['old-tag'] }) });
      mockDocUpdate.mockResolvedValueOnce({});
      const result = await httpsCallableAddTag(validData, validAuthContext);
      expect(mockDocUpdate).toHaveBeenCalledWith({
        tags: admin.firestore.FieldValue.arrayUnion('new-tag'),
      });
      expect(result).toEqual({ success: true, message: 'Tag "new-tag" adicionada.' });
    });
  });

  describe('httpsCallableRemoveTag', () => {
    const validData = { analysisId: MOCK_ANALYSIS_ID, tag: 'tag-to-remove' };
    const validAuthContext = { auth: { uid: MOCK_USER_ID } };

    it('should remove tag successfully', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ tags: ['tag-to-remove', 'another-tag'] }),
      });
      mockDocUpdate.mockResolvedValueOnce({});
      const result = await httpsCallableRemoveTag(validData, validAuthContext);
      expect(mockDocUpdate).toHaveBeenCalledWith({
        tags: admin.firestore.FieldValue.arrayRemove('tag-to-remove'),
      });
      expect(result).toEqual({ success: true, message: 'Tag "tag-to-remove" removida.' });
    });
  });
});
