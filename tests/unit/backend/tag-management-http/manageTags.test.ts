// functions/src/tag-management-http/__tests__/manageTags.test.ts
'use strict';

/**
 * @fileOverview Unit test suite for tag management HTTPS Callable Firebase Functions.
 */

import * as admin from 'firebase-admin';

import {
  AddTagRequest,
  addTagLogic,
  removeTagLogic,
} from '../../../../functions/src/tag-management-http/manageTags';
import { firebaseServerProvider } from '../../../../lib/firebase-server-provider';

import type * as functions from 'firebase-functions';

const MOCK_USER_ID = 'test-user-123';
const MOCK_ANALYSIS_ID = 'analysis-abc-789';

describe('Tag Management Logic (Unit)', () => {
  const db = firebaseServerProvider.getFirestore();

  describe('addTagLogic', () => {
    const validData: AddTagRequest = { analysisId: MOCK_ANALYSIS_ID, tag: 'new-tag' };
    const validAuthContext = { auth: { uid: MOCK_USER_ID } };

    it('should throw "unauthenticated" if no auth context', async () => {
      await expect(
        addTagLogic(validData, { auth: undefined } as functions.https.CallableContext, db)
      ).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('should throw "invalid-argument" if analysisId is missing', async () => {
      await expect(
        addTagLogic(
          { tag: 'tag1' } as AddTagRequest,
          validAuthContext as functions.https.CallableContext,
          db
        )
      ).rejects.toMatchObject({
        code: 'invalid-argument',
      });
    });

    it('should throw "not-found" if analysis document does not exist', async () => {
      (
        (db.collection as any)('users')
          .doc(MOCK_USER_ID)
          .collection('analyses')
          .doc(MOCK_ANALYSIS_ID).get as jest.Mock
      ).mockResolvedValueOnce({ exists: false });
      await expect(
        addTagLogic(validData, validAuthContext as functions.https.CallableContext, db)
      ).rejects.toMatchObject({
        code: 'not-found',
      });
    });

    it('should add tag successfully if document exists and tag is new', async () => {
      (
        (db.collection as any)('users')
          .doc(MOCK_USER_ID)
          .collection('analyses')
          .doc(MOCK_ANALYSIS_ID).get as jest.Mock
      ).mockResolvedValueOnce({
        exists: true,
        data: () => ({ tags: ['old-tag'] }),
      });
      (
        (db.collection as any)('users')
          .doc(MOCK_USER_ID)
          .collection('analyses')
          .doc(MOCK_ANALYSIS_ID).update as jest.Mock
      ).mockResolvedValueOnce({});
      const result = await addTagLogic(validData, validAuthContext as any, db);
      expect(
        (db.collection as any)('users')
          .doc(MOCK_USER_ID)
          .collection('analyses')
          .doc(MOCK_ANALYSIS_ID).update
      ).toHaveBeenCalledWith({
        tags: admin.firestore.FieldValue.arrayUnion('new-tag'),
      });
      expect(result).toEqual({ success: true, message: 'Tag "new-tag" adicionada.' });
    });
  });

  describe('removeTagLogic', () => {
    const validData = { analysisId: MOCK_ANALYSIS_ID, tag: 'tag-to-remove' };
    const validAuthContext = { auth: { uid: MOCK_USER_ID } };
    const validContext: functions.https.CallableContext = {
      auth: { uid: MOCK_USER_ID },
    } as functions.https.CallableContext;
    it('should remove tag successfully', async () => {
      (
        (db.collection as any)('users')
          .doc(MOCK_USER_ID)
          .collection('analyses')
          .doc(MOCK_ANALYSIS_ID).get as jest.Mock
      ).mockResolvedValueOnce({
        exists: true,
        data: () => ({ tags: ['tag-to-remove', 'another-tag'] }),
      });
      (
        (db.collection as any)('users')
          .doc(MOCK_USER_ID)
          .collection('analyses')
          .doc(MOCK_ANALYSIS_ID).update as jest.Mock
      ).mockResolvedValueOnce({});
      const result = await removeTagLogic(validData, validAuthContext as any, db);
      expect(
        (db.collection as any)('users')
          .doc(MOCK_USER_ID)
          .collection('analyses')
          .doc(MOCK_ANALYSIS_ID).update
      ).toHaveBeenCalledWith({
        tags: admin.firestore.FieldValue.arrayRemove('tag-to-remove'),
      });
      expect(result).toEqual({ success: true, message: 'Tag "tag-to-remove" removida.' });
    });
  });
});
