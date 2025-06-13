// @ts-check
'use strict';

/**
 * @fileOverview Test suite for the onAnalysisDeletionRequested Pub/Sub triggered Firebase Function.
 */

const admin = require('firebase-admin');
const functions = require('firebase-functions');
const functionsTest = require('firebase-functions-test')();

// Mock firebase-admin
jest.mock('firebase-admin', () => {
  const actualAdmin = jest.requireActual('firebase-admin');
  const mockFirestore = {
    doc: jest.fn().mockReturnThis(),
    get: jest.fn(),
    update: jest.fn(),
  };
  return {
    ...actualAdmin,
    initializeApp: jest.fn(),
    firestore: jest.fn(() => mockFirestore),
    // Mock other services if needed
    storage: jest.fn().mockReturnValue({ bucket: jest.fn() }),
    database: jest.fn().mockReturnValue({ ref: jest.fn() }),
    auth: jest.fn().mockReturnValue({}),
    messaging: jest.fn().mockReturnValue({}),
    pubsub: jest.fn().mockReturnValue({ topic: jest.fn() }), // Though this function doesn't publish
  };
});

// Import the function to be tested
const { onAnalysisDeletionRequested } = require('./onDeletionRequestPublish');
const { APP_CONFIG } = require('../../lib/shared/config/appConfig.js');

const MOCK_USER_ID = 'test-user-delete-pubsub';
const MOCK_ANALYSIS_ID = 'analysis-id-delete-pubsub';
const TOPIC_NAME = APP_CONFIG.TOPIC_ANALYSIS_DELETION_REQUEST;

describe('onAnalysisDeletionRequested Pub/Sub Function', () => {
  let mockAdminFirestore;
  let wrappedOnAnalysisDeletionRequested;

  beforeEach(() => {
    // @ts-ignore
    mockAdminFirestore = admin.firestore();
    mockAdminFirestore.doc.mockClear();
    mockAdminFirestore.get.mockClear();
    mockAdminFirestore.update.mockClear();

    wrappedOnAnalysisDeletionRequested = functionsTest.wrap(onAnalysisDeletionRequested);
  });

  afterAll(() => {
    functionsTest.cleanup();
  });

  const createPubSubMessage = (payload) => {
    const dataBuffer = Buffer.from(JSON.stringify(payload));
    return {
      data: dataBuffer.toString('base64'),
      json: payload, // For functions-test to directly access parsed JSON
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

    mockAdminFirestore.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'completed' }),
    });
    mockAdminFirestore.update.mockResolvedValueOnce({});

    await wrappedOnAnalysisDeletionRequested(message, context);

    expect(mockAdminFirestore.doc).toHaveBeenCalledWith(
      `users/${MOCK_USER_ID}/analyses/${MOCK_ANALYSIS_ID}`
    );
    expect(mockAdminFirestore.update).toHaveBeenCalledWith({
      status: 'pending_deletion',
      errorMessage: 'Exclusão solicitada via Pub/Sub e em processamento...',
      deletionRequestedAt: admin.firestore.Timestamp.fromMillis(payload.requestedAt),
    });
  });

  it('should use serverTimestamp if requestedAt is not in payload', async () => {
    const payload = { userId: MOCK_USER_ID, analysisId: MOCK_ANALYSIS_ID }; // No requestedAt
    const message = createPubSubMessage(payload);
    const context = createContext();

    mockAdminFirestore.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'error' }),
    });
    mockAdminFirestore.update.mockResolvedValueOnce({});

    await wrappedOnAnalysisDeletionRequested(message, context);

    expect(mockAdminFirestore.update).toHaveBeenCalledWith(
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

      mockAdminFirestore.get.mockResolvedValueOnce({ exists: true, data: () => ({ status }) });
      mockAdminFirestore.doc.mockClear(); // Clear before next iteration's get
      mockAdminFirestore.update.mockClear();

      await wrappedOnAnalysisDeletionRequested(message, context);

      expect(mockAdminFirestore.update).not.toHaveBeenCalled();
    }
  });

  it('should not update if analysis document does not exist', async () => {
    const payload = { userId: MOCK_USER_ID, analysisId: MOCK_ANALYSIS_ID };
    const message = createPubSubMessage(payload);
    const context = createContext();

    mockAdminFirestore.get.mockResolvedValueOnce({ exists: false });

    await wrappedOnAnalysisDeletionRequested(message, context);

    expect(mockAdminFirestore.update).not.toHaveBeenCalled();
  });

  it('should log error and return null if payload is invalid (missing userId)', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const payload = { analysisId: MOCK_ANALYSIS_ID }; // Missing userId
    // @ts-ignore // Testing invalid payload
    const message = createPubSubMessage(payload);
    const context = createContext();

    const result = await wrappedOnAnalysisDeletionRequested(message, context);

    expect(result).toBeNull(); // Function should acknowledge and exit
    expect(mockAdminFirestore.update).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid or missing userId in payload'),
      expect.anything()
    );
    consoleErrorSpy.mockRestore();
  });

  it('should log error and return null if payload is invalid (missing analysisId)', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const payload = { userId: MOCK_USER_ID }; // Missing analysisId
    // @ts-ignore // Testing invalid payload
    const message = createPubSubMessage(payload);
    const context = createContext();

    const result = await wrappedOnAnalysisDeletionRequested(message, context);

    expect(result).toBeNull();
    expect(mockAdminFirestore.update).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid or missing analysisId in payload'),
      expect.anything()
    );
    consoleErrorSpy.mockRestore();
  });

  it('should log error and return null if message data is not valid JSON', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const malformedMessage = {
      data: Buffer.from('not json').toString('base64'),
      // No 'json' property for this specific test
    };
    const context = createContext();

    // @ts-ignore // Testing malformed message
    const result = await wrappedOnAnalysisDeletionRequested(malformedMessage, context);

    expect(result).toBeNull();
    expect(mockAdminFirestore.update).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error parsing Pub/Sub message payload'),
      expect.anything()
    );
    consoleErrorSpy.mockRestore();
  });

  it('should throw error if Firestore update fails', async () => {
    const payload = { userId: MOCK_USER_ID, analysisId: MOCK_ANALYSIS_ID };
    const message = createPubSubMessage(payload);
    const context = createContext();
    const firestoreError = new Error('Firestore update failed');

    mockAdminFirestore.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'completed' }),
    });
    mockAdminFirestore.update.mockRejectedValueOnce(firestoreError);

    await expect(wrappedOnAnalysisDeletionRequested(message, context)).rejects.toThrow(
      firestoreError
    );
  });
});
