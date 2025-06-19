// functions/src/analysis-management/__tests__/onDeletionRequestPublish.test.ts
'use strict';

/**
 * @fileOverview Unit test suite for the onAnalysisDeletionRequested Pub/Sub triggered Firebase Function.
 */
import adminActual from 'firebase-admin';
import * as functions from 'firebase-functions';

import { APP_CONFIG } from '../../../../config/appConfig';
import { onAnalysisDeletionRequested } from '../../../../functions/src/analysis-management/onDeletionRequestPublish';

// Mock firebase-admin
const mockDocGet = jest.fn();
const mockDocUpdate = jest.fn();
const mockFirestoreService = {
  doc: jest.fn(() => ({ get: mockDocGet, update: mockDocUpdate })),
};
jest.mock('firebase-admin', () => {
  const actualAdminInternal = jest.requireActual('firebase-admin');
  return {
    initializeApp: jest.fn(),
    firestore: jest.fn(() => mockFirestoreService),
    // Use actualAdminInternal for static properties if they don't need mocking
    'firestore.Timestamp': actualAdminInternal.firestore.Timestamp,
    'firestore.FieldValue': actualAdminInternal.firestore.FieldValue,
  };
});

const MOCK_USER_ID_DEL_PUBSUB = 'test-user-delete-pubsub';
const MOCK_ANALYSIS_ID_DEL_PUBSUB = 'analysis-id-delete-pubsub';
const TOPIC_NAME = APP_CONFIG.TOPIC_ANALYSIS_DELETION_REQUEST;

describe('onAnalysisDeletionRequested Pub/Sub Function (Unit)', () => {
  beforeEach(() => {
    mockDocGet.mockReset();
    mockDocUpdate.mockReset();
    if (jest.isMockFunction(mockFirestoreService.doc)) {
      mockFirestoreService.doc.mockClear();
    }
  });

  const createPubSubMessage = (payload: object): functions.pubsub.Message => {
    const dataBuffer = Buffer.from(JSON.stringify(payload));
    return {
      data: dataBuffer.toString('base64'),
      json: payload,
    } as functions.pubsub.Message;
  };

  const createContext = (): functions.EventContext => ({
    eventId: `event-${Date.now()}`,
    resource: {
      name: `projects/test-project/topics/${TOPIC_NAME}`,
      service: 'pubsub.googleapis.com',
      type: 'type.googleapis.com/google.pubsub.v1.PubsubMessage',
    },
    eventType: 'google.pubsub.topic.publish',
    timestamp: new Date().toISOString(),
    params: {},
  });

  it('should update status to "pending_deletion" for a valid request', async () => {
    const payload = {
      userId: MOCK_USER_ID_DEL_PUBSUB,
      analysisId: MOCK_ANALYSIS_ID_DEL_PUBSUB,
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
      `users/${MOCK_USER_ID_DEL_PUBSUB}/analyses/${MOCK_ANALYSIS_ID_DEL_PUBSUB}`
    );
    expect(mockDocUpdate).toHaveBeenCalledWith({
      status: 'pending_deletion',
      errorMessage: 'Exclusão solicitada via Pub/Sub e em processamento...',
      deletionRequestedAt: adminActual.firestore.Timestamp.fromMillis(payload.requestedAt),
    });
  });

  it('should use serverTimestamp if requestedAt is not in payload', async () => {
    const payload = { userId: MOCK_USER_ID_DEL_PUBSUB, analysisId: MOCK_ANALYSIS_ID_DEL_PUBSUB };
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
        deletionRequestedAt: adminActual.firestore.FieldValue.serverTimestamp(),
      })
    );
  });

  it('should not update if analysis is already "deleted" or "pending_deletion"', async () => {
    const statuses = ['deleted', 'pending_deletion'];
    for (const status of statuses) {
      const payload = { userId: MOCK_USER_ID_DEL_PUBSUB, analysisId: MOCK_ANALYSIS_ID_DEL_PUBSUB };
      const message = createPubSubMessage(payload);
      const context = createContext();

      mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ status }) });
      mockDocUpdate.mockClear(); // Ensure it's clear before this iteration

      await onAnalysisDeletionRequested(message, context);
      expect(mockDocUpdate).not.toHaveBeenCalled();
    }
  });

  it('should not update if analysis document does not exist', async () => {
    const payload = { userId: MOCK_USER_ID_DEL_PUBSUB, analysisId: MOCK_ANALYSIS_ID_DEL_PUBSUB };
    const message = createPubSubMessage(payload);
    const context = createContext();

    mockDocGet.mockResolvedValueOnce({ exists: false });
    await onAnalysisDeletionRequested(message, context);
    expect(mockDocUpdate).not.toHaveBeenCalled();
  });

  it('should log error and return null if payload is invalid (missing userId)', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
      /* Mute console.error */
    });
    const payload = { analysisId: MOCK_ANALYSIS_ID_DEL_PUBSUB }; // Missing userId
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
    const payload = { userId: MOCK_USER_ID_DEL_PUBSUB, analysisId: MOCK_ANALYSIS_ID_DEL_PUBSUB };
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
