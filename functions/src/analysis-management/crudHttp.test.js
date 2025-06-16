// @ts-check
'use strict';

/**
 * @fileOverview Test suite for HTTPS Callable Functions in crudHttp.js
 * (httpsCallableGetPastAnalyses, httpsCallableCancelAnalysis)
 */

process.env.GCLOUD_PROJECT = 'electric-magnitudes-analizer'; // Set for consistent logging

const admin = require('firebase-admin');
const functions = require('firebase-functions');
const functionsTest = require('firebase-functions-test')();

// Mock firebase-admin
jest.mock('firebase-admin', () => {
  const mockFirestoreInstance = {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    get: jest.fn(), // This will be configured per test using mockResolvedValueOnce
    update: jest.fn(),
    add: jest.fn(),
  };

  const mockAppsArray = [];
  const mockAppDelete = jest.fn(() => Promise.resolve());

  const createMockApp = (appName) => ({
    name: appName,
    firestore: () => mockFirestoreInstance,
    storage: () => ({ bucket: jest.fn(() => ({ file: jest.fn() })) }),
    auth: () => ({}),
    database: () => ({ ref: jest.fn() }),
    messaging: () => ({}),
    pubsub: () => ({ topic: jest.fn() }),
    delete: mockAppDelete,
  });

  const mockInitializeApp = jest.fn((_options, appNameParam) => {
    const name = appNameParam || '[DEFAULT]';
    let app = mockAppsArray.find((app) => app.name === name);
    if (!app) {
      app = createMockApp(name);
      // @ts-ignore
      mockAppsArray.push(app);
    }
    return app;
  });

  const firestoreMockFn = jest.fn(() => mockFirestoreInstance);

  // Attach static properties like Timestamp and FieldValue to the firestoreMockFn itself
  firestoreMockFn.Timestamp = {
    fromDate: (date) => ({
      toDate: () => date,
      _seconds: Math.floor(new Date(date).getTime() / 1000),
      _nanoseconds: (new Date(date).getTime() % 1000) * 1e6,
    }),
    now: () => {
      const now = new Date();
      return {
        toDate: () => now,
        _seconds: Math.floor(now.getTime() / 1000),
        _nanoseconds: (now.getTime() % 1000) * 1e6,
      };
    },
  };
  firestoreMockFn.FieldValue = {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP_PLACEHOLDER'),
    arrayUnion: jest.fn((...args) => ({ _kind: 'arrayUnion', elements: args })),
    arrayRemove: jest.fn((...args) => ({ _kind: 'arrayRemove', elements: args })),
    delete: jest.fn(() => ({ _kind: 'delete' })),
    increment: jest.fn((n) => ({ _operand: n, _kind: 'increment' })),
  };

  return {
    initializeApp: mockInitializeApp,
    get apps() {
      return mockAppsArray;
    },
    app: jest.fn((appNameParam) => {
      const name = appNameParam || '[DEFAULT]';
      let appInstance = mockAppsArray.find((app) => app.name === name);
      if (!appInstance) {
        if (mockAppsArray.length === 0 && !appNameParam) {
          appInstance = createMockApp(name);
          // @ts-ignore
          mockAppsArray.push(appInstance);
        } else {
          throw new Error(
            `Firebase app "${name}" does not exist. Initialize via admin.initializeApp().`
          );
        }
      }
      return appInstance;
    }),
    firestore: firestoreMockFn, // Use the function that has static properties
    storage: jest.fn().mockReturnValue({ bucket: jest.fn() }),
    database: jest.fn().mockReturnValue({ ref: jest.fn() }),
    auth: jest.fn().mockReturnValue({}),
    messaging: jest.fn().mockReturnValue({}),
    pubsub: jest.fn().mockReturnValue({ topic: jest.fn() }),
    credential: {
      cert: jest.fn(),
      applicationDefault: jest.fn(),
    },
  };
});

// Import the functions to be tested AFTER mocks are set up
const { httpsCallableGetPastAnalyses, httpsCallableCancelAnalysis } = require('./crudHttp');

const MOCK_USER_ID = 'test-user-crud';
const MOCK_ANALYSIS_ID = 'analysis-crud-id';

describe('Analysis Management CRUD HTTPS Callables', () => {
  let mockAdminFirestoreInstance;

  beforeEach(() => {
    // @ts-ignore
    mockAdminFirestoreInstance = admin.firestore();
    // Reset individual method mocks on the instance
    Object.values(mockAdminFirestoreInstance).forEach((mockFn) => {
      if (jest.isMockFunction(mockFn)) {
        // Use mockReset to clear mockResolvedValueOnce queue
        mockFn.mockReset();
      }
    });
    // @ts-ignore
    if (admin.firestore.mockReset) {
      // @ts-ignore
      admin.firestore.mockReset();
    }
    // @ts-ignore
    if (admin.initializeApp.mockClear) {
      // @ts-ignore
      admin.initializeApp.mockClear();
    }
    // @ts-ignore
    if (admin.app.mockClear) {
      // @ts-ignore
      admin.app.mockClear();
    }
    // @ts-ignore
    if (admin.app()?.delete?.mockClear) {
      // @ts-ignore
      admin.app().delete.mockClear();
    }
    // @ts-ignore
    admin.apps.length = 0;

    // @ts-ignore
    if (admin.apps.length === 0) {
      // @ts-ignore
      admin.initializeApp();
    }
  });

  afterAll(() => {
    functionsTest.cleanup();
  });

  describe('httpsCallableGetPastAnalyses', () => {
    const wrappedGetPastAnalyses = functionsTest.wrap(httpsCallableGetPastAnalyses);

    it('should throw "invalid-argument" if userId is missing', async () => {
      await expect(wrappedGetPastAnalyses({}, {})).rejects.toMatchObject({
        code: 'invalid-argument',
        message: 'O ID do usuário (userId) é obrigatório no payload da solicitação.',
      });
    });

    it('should fetch and return analyses successfully', async () => {
      const mockAnalysesData = [
        {
          id: 'analysis2', // More recent
          data: () => ({
            userId: MOCK_USER_ID,
            fileName: 'file2.csv',
            title: 'Analysis 2',
            status: 'summarizing_data',
            progress: 30,
            // @ts-ignore
            createdAt: admin.firestore.Timestamp.fromDate(new Date('2023-01-02T10:00:00Z')),
            tags: [],
          }),
        },
        {
          id: 'analysis1', // Older
          data: () => ({
            userId: MOCK_USER_ID,
            fileName: 'file1.csv',
            title: 'Analysis 1',
            status: 'completed',
            progress: 100,
            // @ts-ignore
            createdAt: admin.firestore.Timestamp.fromDate(new Date('2023-01-01T10:00:00Z')),
            tags: ['tagA'],
          }),
        },
        {
          id: 'analysis3-deleted',
          data: () => ({
            userId: MOCK_USER_ID,
            fileName: 'file3.csv',
            title: 'Analysis 3 Deleted',
            status: 'deleted',
            progress: 100,
            // @ts-ignore
            createdAt: admin.firestore.Timestamp.fromDate(new Date('2023-01-03T10:00:00Z')),
          }),
        },
        {
          id: 'analysis4-pending-deletion',
          data: () => ({
            userId: MOCK_USER_ID,
            fileName: 'file4.csv',
            title: 'Analysis 4 Pending Deletion',
            status: 'pending_deletion',
            progress: 100,
            // @ts-ignore
            createdAt: admin.firestore.Timestamp.fromDate(new Date('2023-01-04T10:00:00Z')),
          }),
        },
      ];
      // @ts-ignore
      mockAdminFirestoreInstance.get.mockResolvedValueOnce({ docs: mockAnalysesData });

      const result = await wrappedGetPastAnalyses({ userId: MOCK_USER_ID }, {});

      expect(mockAdminFirestoreInstance.collection).toHaveBeenCalledWith('users');
      expect(mockAdminFirestoreInstance.doc).toHaveBeenCalledWith(MOCK_USER_ID);
      expect(mockAdminFirestoreInstance.collection).toHaveBeenCalledWith('analyses');
      expect(mockAdminFirestoreInstance.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
      expect(result.analyses).toHaveLength(2); // Only non-deleted/pending items
      expect(result.analyses[0].id).toBe('analysis2'); // Sorted desc by createdAt
      expect(result.analyses[1].id).toBe('analysis1');
      expect(result.analyses[0].status).toBe('summarizing_data');
      expect(result.analyses[1].createdAt).toBe('2023-01-01T10:00:00.000Z');
      expect(result.analyses[1].tags).toEqual(['tagA']);
    });

    it('should handle invalid status in Firestore data', async () => {
      const mockAnalysesDataWithInvalidStatus = [
        {
          id: 'analysis-invalid',
          data: () => ({
            userId: MOCK_USER_ID,
            fileName: 'invalid.csv',
            title: 'Invalid Status Analysis',
            status: 'weird_status', // Invalid status
            progress: 50,
            // @ts-ignore
            createdAt: admin.firestore.Timestamp.fromDate(new Date()),
          }),
        },
      ];
      // @ts-ignore
      mockAdminFirestoreInstance.get.mockResolvedValueOnce({
        docs: mockAnalysesDataWithInvalidStatus,
      });

      const result = await wrappedGetPastAnalyses({ userId: MOCK_USER_ID }, {});
      expect(result.analyses).toHaveLength(1);
      expect(result.analyses[0].status).toBe('error');
      expect(result.analyses[0].errorMessage).toContain('Status inválido (weird_status)');
    });

    it('should handle Firestore query errors', async () => {
      mockAdminFirestoreInstance.get.mockRejectedValueOnce(new Error('Firestore query failed'));
      await expect(wrappedGetPastAnalyses({ userId: MOCK_USER_ID }, {})).rejects.toMatchObject({
        code: 'internal',
        message: expect.stringContaining('Falha ao buscar análises: Firestore query failed'),
      });
    });
  });

  describe('httpsCallableCancelAnalysis', () => {
    const wrappedCancelAnalysis = functionsTest.wrap(httpsCallableCancelAnalysis);
    const authContext = { auth: { uid: MOCK_USER_ID } };

    it('should throw "unauthenticated" if no auth context', async () => {
      await expect(
        wrappedCancelAnalysis({ analysisId: MOCK_ANALYSIS_ID }, {})
      ).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('should throw "invalid-argument" if analysisId is missing', async () => {
      // @ts-ignore
      await expect(wrappedCancelAnalysis({}, authContext)).rejects.toMatchObject({
        code: 'invalid-argument',
        message: 'ID da análise é obrigatório.',
      });
    });

    it('should throw "not-found" if analysis document does not exist', async () => {
      // Ensure .get() is mocked to return a snapshot with exists: false
      mockAdminFirestoreInstance.get.mockResolvedValueOnce({
        exists: false, // Correct: exists is a boolean property
        data: () => undefined, // data is a function
      });
      await expect(
        wrappedCancelAnalysis({ analysisId: MOCK_ANALYSIS_ID }, authContext)
      ).rejects.toMatchObject({
        code: 'not-found',
        message: `Análise ${MOCK_ANALYSIS_ID} não encontrada para cancelamento.`,
      });
      expect(mockAdminFirestoreInstance.doc).toHaveBeenCalledWith(
        `users/${MOCK_USER_ID}/analyses/${MOCK_ANALYSIS_ID}`
      );
    });

    it('should set status to "cancelling" for a valid request', async () => {
      mockAdminFirestoreInstance.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'summarizing_data' }),
      });
      mockAdminFirestoreInstance.update.mockResolvedValueOnce({});

      const result = await wrappedCancelAnalysis({ analysisId: MOCK_ANALYSIS_ID }, authContext);

      expect(mockAdminFirestoreInstance.update).toHaveBeenCalledWith({
        status: 'cancelling',
        errorMessage: 'Cancelamento solicitado pelo usuário...',
      });
      expect(result).toEqual({ success: true, message: 'Solicitação de cancelamento enviada.' });
    });

    it('should return success if already cancelling', async () => {
      mockAdminFirestoreInstance.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'cancelling' }),
      });
      const result = await wrappedCancelAnalysis({ analysisId: MOCK_ANALYSIS_ID }, authContext);
      expect(mockAdminFirestoreInstance.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: `Análise ${MOCK_ANALYSIS_ID} já está sendo cancelada.`,
      });
    });

    ['completed', 'error', 'cancelled', 'deleted', 'pending_deletion'].forEach((terminalStatus) => {
      it(`should not cancel if status is already "${terminalStatus}"`, async () => {
        mockAdminFirestoreInstance.get.mockResolvedValueOnce({
          exists: true,
          data: () => ({ status: terminalStatus }),
        });
        const result = await wrappedCancelAnalysis({ analysisId: MOCK_ANALYSIS_ID }, authContext);
        expect(mockAdminFirestoreInstance.update).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
        expect(result.message).toContain(`já está em um estado final (${terminalStatus})`);
      });
    });

    it('should handle Firestore update errors', async () => {
      mockAdminFirestoreInstance.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'identifying_regulations' }),
      });
      mockAdminFirestoreInstance.update.mockRejectedValueOnce(new Error('Firestore update failed'));

      await expect(
        wrappedCancelAnalysis({ analysisId: MOCK_ANALYSIS_ID }, authContext)
      ).rejects.toMatchObject({
        code: 'internal',
        message: expect.stringContaining(
          'Falha ao solicitar cancelamento: Firestore update failed'
        ),
      });
    });
  });
});
