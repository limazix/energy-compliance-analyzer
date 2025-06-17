'use strict';

/**
 * @fileOverview Unit test suite for tag management HTTPS Callable Firebase Functions.
 */
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

import admin from 'firebase-admin';

import {
  httpsCallableAddTag,
  httpsCallableRemoveTag,
} from '../../../../functions/src/tag-management-http/manageTags.js'; // Corrected relative import for SUT

// Mock firebase-admin before importing the functions
// DEFINE ALL MOCK COMPONENTS BEFORE jest.mock('firebase-admin')
const mockAdminFirestoreInstanceDoc = jest.fn();
const mockAdminFirestoreInstanceGet = jest.fn();
const mockAdminFirestoreInstanceUpdate = jest.fn();

const mockFirestoreInstance = {
  doc: mockAdminFirestoreInstanceDoc.mockImplementation(() => ({
    get: mockAdminFirestoreInstanceGet,
    update: mockAdminFirestoreInstanceUpdate,
  })),
  collection: jest.fn().mockReturnThis(), // Added for completeness if needed
  add: jest.fn(), // Added for completeness if needed
};

jest.mock('firebase-admin', () => {
  const actualAdmin = jest.requireActual('firebase-admin');
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
  beforeEach(() => {
    // Clear mocks
    mockAdminFirestoreInstanceDoc.mockClear();
    mockAdminFirestoreInstanceGet.mockClear();
    mockAdminFirestoreInstanceUpdate.mockClear();
  });

  describe('httpsCallableAddTag', () => {
    const validData = { analysisId: MOCK_ANALYSIS_ID, tag: 'new-tag' };
    const validAuthContext = { auth: { uid: MOCK_USER_ID } };

    it('should throw "unauthenticated" if no auth context', async () => {
      // @ts-expect-error Testing invalid context: unauthenticated user
      await expect(httpsCallableAddTag(validData, {})).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('should throw "invalid-argument" if analysisId is missing', async () => {
      // @ts-expect-error Testing invalid input: analysisId missing
      await expect(httpsCallableAddTag({ tag: 'tag1' }, validAuthContext)).rejects.toMatchObject({
        code: 'invalid-argument',
      });
    });

    it('should throw "not-found" if analysis document does not exist', async () => {
      mockAdminFirestoreInstanceGet.mockResolvedValueOnce({ exists: false });
      await expect(httpsCallableAddTag(validData, validAuthContext)).rejects.toMatchObject({
        code: 'not-found',
      });
    });

    it('should add tag successfully if document exists and tag is new', async () => {
      mockAdminFirestoreInstanceGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ tags: ['old-tag'] }),
      });
      mockAdminFirestoreInstanceUpdate.mockResolvedValueOnce({});
      const result = await httpsCallableAddTag(validData, validAuthContext);
      expect(mockAdminFirestoreInstanceUpdate).toHaveBeenCalledWith({
        tags: admin.firestore.FieldValue.arrayUnion('new-tag'),
      });
      expect(result).toEqual({ success: true, message: 'Tag "new-tag" adicionada.' });
    });
  });

  describe('httpsCallableRemoveTag', () => {
    const validData = { analysisId: MOCK_ANALYSIS_ID, tag: 'tag-to-remove' };
    const validAuthContext = { auth: { uid: MOCK_USER_ID } };

    it('should remove tag successfully', async () => {
      mockAdminFirestoreInstanceGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ tags: ['tag-to-remove', 'another-tag'] }),
      });
      mockAdminFirestoreInstanceUpdate.mockResolvedValueOnce({});
      const result = await httpsCallableRemoveTag(validData, validAuthContext);
      expect(mockAdminFirestoreInstanceUpdate).toHaveBeenCalledWith({
        tags: admin.firestore.FieldValue.arrayRemove('tag-to-remove'),
      });
      expect(result).toEqual({ success: true, message: 'Tag "tag-to-remove" removida.' });
    });
  });
});
