// @ts-check
'use strict';

/**
 * @fileOverview Unit test suite for the onAnalysisDeletionRequested Pub/Sub triggered Firebase Function.
 */

import admin from 'firebase-admin';

import { APP_CONFIG } from '../../../../functions/lib/shared/config/appConfig.js';
import { onAnalysisDeletionRequested } from '../../../../functions/src/analysis-management/onDeletionRequestPublish.js';

// Mock firebase-admin
const mockDocGet = jest.fn();
const mockDocUpdate = jest.fn();
const mockFirestoreService = {
  doc: jest.fn(() => ({ get: mockDocGet, update: mockDocUpdate })),
};
jest.mock('firebase-admin', () => {
  const actualAdmin = jest.requireActual('firebase-admin');
  return {
    initializeApp: jest.fn(),
    firestore: jest.fn(() => mockFirestoreService),
    // Static properties needed by SUT
    'firestore.Timestamp': actualAdmin.firestore.Timestamp,
    'firestore.FieldValue': actualAdmin.firestore.FieldValue,
  };
});

const MOCK_USER_ID = 'test-user-delete-pubsub';
const MOCK_ANALYSIS_ID = 'analysis-id-delete-pubsub';
const TOPIC_NAME = APP_CONFIG.TOPIC_ANALYSIS_DELETION_REQUEST;

describe('onAnalysisDeletionRequested Pub/Sub Function (Unit)', () => {
  beforeEach(() => {
    mockDocGet.mockReset();
    mockDocUpdate.mockReset();
    if (jest.isMockFunction(mockFirestoreService.doc)) {
      // Check if it's a mock before clearing
      mockFirestoreService.doc.mockClear();
    }
  });

  const createPubSubMessage = (payload) => {
    const dataBuffer = Buffer.from(JSON.stringify(payload));
    return {
      data: dataBuffer.toString('base64'),
      json: payload,
    };
  };

  const createContext = () => ({
    eventId: `event-${Date.now()}`,
    resource: {
      name: `projects/test-project/topics/${TOPIC_NAME}`,
      service: 'pubsub.googleapis.com',
      type: 'type.googleapis.com/google.pubsub.v1.PubsubMessage',
    },
  });

  it('should update status to "pending_deletion" for a valid request', async () => {
    const payload = {
      userId: MOCK_USER_ID,
      analysisId: MOCK_ANALYSIS_ID,
      requestedAt: Date.now(),
    };
    const message = createPubSubMessage(payload);
    const context = createContext();

    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'completed' }),
    });
    mockDocUpdate.mockResolvedValueOnce({});

    await onAnalysisDeletionRequested(message, context);

    expect(mockFirestoreService.doc).toHaveBeenCalledWith(
      `users/${MOCK_USER_ID}/analyses/${MOCK_ANALYSIS_ID}`
    );
    expect(mockDocUpdate).toHaveBeenCalledWith({
      status: 'pending_deletion',
      errorMessage: 'Exclusão solicitada via Pub/Sub e em processamento...',
      deletionRequestedAt: admin.firestore.Timestamp.fromMillis(payload.requestedAt),
    });
  });

  it('should use serverTimestamp if requestedAt is not in payload', async () => {
    const payload = { userId: MOCK_USER_ID, analysisId: MOCK_ANALYSIS_ID };
    const message = createPubSubMessage(payload);
    const context = createContext();

    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'error' }),
    });
    mockDocUpdate.mockResolvedValueOnce({});

    await onAnalysisDeletionRequested(message, context);

    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        deletionRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    );
  });

  it('should not update if analysis is already "deleted" or "pending_deletion"', async () => {
    const statuses = ['deleted', 'pending_deletion'];
    for (const status of statuses) {
      const payload = { userId: MOCK_USER_ID, analysisId: MOCK_ANALYSIS_ID };
      const message = createPubSubMessage(payload);
      const context = createContext();

      mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ status }) });
      mockDocUpdate.mockClear();

      await onAnalysisDeletionRequested(message, context);
      expect(mockDocUpdate).not.toHaveBeenCalled();
    }
  });

  it('should not update if analysis document does not exist', async () => {
    const payload = { userId: MOCK_USER_ID, analysisId: MOCK_ANALYSIS_ID };
    const message = createPubSubMessage(payload);
    const context = createContext();

    mockDocGet.mockResolvedValueOnce({ exists: false });
    await onAnalysisDeletionRequested(message, context);
    expect(mockDocUpdate).not.toHaveBeenCalled();
  });

  it('should log error and return null if payload is invalid (missing userId)', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const payload = { analysisId: MOCK_ANALYSIS_ID };
    // @ts-expect-error - Testing invalid payload, intentionally missing userId for this test case.
    const message = createPubSubMessage(payload);
    const context = createContext();

    const result = await onAnalysisDeletionRequested(message, context);

    expect(result).toBeNull();
    expect(mockDocUpdate).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid or missing userId in payload'),
      expect.anything()
    );
    consoleErrorSpy.mockRestore();
  });

  it('should throw error if Firestore update fails', async () => {
    const payload = { userId: MOCK_USER_ID, analysisId: MOCK_ANALYSIS_ID };
    const message = createPubSubMessage(payload);
    const context = createContext();
    const firestoreError = new Error('Firestore update failed');

    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'completed' }),
    });
    mockDocUpdate.mockRejectedValueOnce(firestoreError);

    await expect(onAnalysisDeletionRequested(message, context)).rejects.toThrow(firestoreError);
  });
});
