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

// Define mocks for Firestore methods explicitly
const mockDocGet = jest.fn();
const mockDocUpdate = jest.fn();
// const mockCollectionAdd = jest.fn(); // Not directly used by SUT
const mockCollectionOrderBy = jest.fn();
const mockCollectionWhere = jest.fn();
const mockCollectionGet = jest.fn(); // For collection().get()

const mockFirestoreDocRef = {
  get: mockDocGet,
  update: mockDocUpdate,
};

const mockFirestoreCollectionRef = {
  // add: mockCollectionAdd, // Not directly used by SUT
  orderBy: mockCollectionOrderBy,
  where: mockCollectionWhere,
  get: mockCollectionGet,
  doc: jest.fn(() => mockFirestoreDocRef), // .collection().doc()
};

// The object returned by admin.firestore()
const mockFirestoreService = {
  collection: jest.fn(() => mockFirestoreCollectionRef),
  doc: jest.fn(() => mockFirestoreDocRef),
};

// Mock firebase-admin
jest.mock('firebase-admin', () => {
  const actualAdmin = jest.requireActual('firebase-admin'); // For Timestamp, FieldValue

  const mockAppsArray = [];
  const mockAppDelete = jest.fn(() => Promise.resolve());

  const createMockApp = (appName) => ({
    name: appName,
    firestore: jest.fn(() => mockFirestoreService),
    storage: () => ({ bucket: jest.fn(() => ({ file: jest.fn() })) }),
    auth: () => ({}),
    database: () => ({ ref: jest.fn() }),
    messaging: () => ({}),
    pubsub: () => ({ topic: jest.fn() }),
    delete: mockAppDelete,
  });

  const mockInitializeApp = jest.fn((_options, appNameParam) => {
    const name = appNameParam || '[DEFAULT]';
    let app = mockAppsArray.find((a) => a.name === name);
    if (!app) {
      app = createMockApp(name);
      mockAppsArray.push(app);
    }
    return app;
  });

  // admin.firestore should be a function that returns the service instance object (mockFirestoreService)
  // AND has static properties like Timestamp.
  const firestoreFactoryMock = Object.assign(
    jest.fn(() => mockFirestoreService), // This is admin.firestore()
    {
      Timestamp: actualAdmin.firestore.Timestamp,
      FieldValue: actualAdmin.firestore.FieldValue,
    }
  );

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
          mockAppsArray.push(appInstance);
        } else {
          throw new Error(
            `Firebase app "${name}" does not exist. Initialize via admin.initializeApp().`
          );
        }
      }
      return appInstance;
    }),
    firestore: firestoreFactoryMock,
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
  beforeEach(() => {
    // Reset app lifecycle mocks
    admin.initializeApp.mockClear();
    admin.app.mockClear();
    const appInstance = admin.app();
    if (appInstance && appInstance.delete && appInstance.delete.mockClear) {
      appInstance.delete.mockClear();
    }
    if (admin.apps && Array.isArray(admin.apps)) {
      admin.apps.length = 0; // Reset the apps array
    }
    // Re-initialize a default app for cleanup consistency if admin.apps became empty
    if (admin.apps && admin.apps.length === 0 && admin.initializeApp) {
      admin.initializeApp();
    }

    // Reset Firestore factory calls
    admin.firestore.mockClear(); // Corrected: remove 'as jest.Mock'

    // Reset methods on the service instance
    mockFirestoreService.collection
      .mockReset()
      .mockImplementation(() => mockFirestoreCollectionRef);
    mockFirestoreService.doc.mockReset().mockImplementation(() => mockFirestoreDocRef);

    // Reset methods on collection ref
    // mockFirestoreCollectionRef.add.mockReset(); // Not directly used by SUT
    mockFirestoreCollectionRef.orderBy.mockReset().mockReturnThis(); // Keep mockReturnThis for chaining
    mockFirestoreCollectionRef.where.mockReset().mockReturnThis(); // Keep mockReturnThis for chaining
    mockFirestoreCollectionRef.get.mockReset();
    mockFirestoreCollectionRef.doc.mockReset().mockImplementation(() => mockFirestoreDocRef);

    // Reset methods on doc ref
    mockDocGet.mockReset();
    mockDocUpdate.mockReset();
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
            createdAt: admin.firestore.Timestamp.fromDate(new Date('2023-01-04T10:00:00Z')),
          }),
        },
      ];
      mockCollectionGet.mockResolvedValueOnce({ docs: mockAnalysesData });

      const result = await wrappedGetPastAnalyses({ userId: MOCK_USER_ID }, {});

      expect(mockFirestoreService.collection).toHaveBeenCalledWith('users');
      expect(mockFirestoreService.doc).toHaveBeenCalledWith(MOCK_USER_ID); // doc called on service
      expect(mockFirestoreCollectionRef.orderBy).toHaveBeenCalledWith('createdAt', 'desc'); // orderBy on collection ref
      expect(result.analyses).toHaveLength(2); // Only non-deleted/pending items
      expect(result.analyses[0].id).toBe('analysis2');
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
            createdAt: admin.firestore.Timestamp.fromDate(new Date()),
          }),
        },
      ];
      mockCollectionGet.mockResolvedValueOnce({
        docs: mockAnalysesDataWithInvalidStatus,
      });

      const result = await wrappedGetPastAnalyses({ userId: MOCK_USER_ID }, {});
      expect(result.analyses).toHaveLength(1);
      expect(result.analyses[0].status).toBe('error');
      expect(result.analyses[0].errorMessage).toContain('Status inválido (weird_status)');
    });

    it('should handle Firestore query errors', async () => {
      mockCollectionGet.mockRejectedValueOnce(new Error('Firestore query failed'));
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
      mockDocGet.mockResolvedValueOnce({
        exists: false,
        data: () => undefined,
      });
      await expect(
        wrappedCancelAnalysis({ analysisId: MOCK_ANALYSIS_ID }, authContext)
      ).rejects.toMatchObject({
        code: 'not-found',
        message: `Análise ${MOCK_ANALYSIS_ID} não encontrada para cancelamento.`,
      });
      expect(mockFirestoreService.doc).toHaveBeenCalledWith(
        `users/${MOCK_USER_ID}/analyses/${MOCK_ANALYSIS_ID}`
      );
    });

    it('should set status to "cancelling" for a valid request', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'summarizing_data' }),
      });
      mockDocUpdate.mockResolvedValueOnce({});

      const result = await wrappedCancelAnalysis({ analysisId: MOCK_ANALYSIS_ID }, authContext);

      expect(mockDocUpdate).toHaveBeenCalledWith({
        status: 'cancelling',
        errorMessage: 'Cancelamento solicitado pelo usuário...',
      });
      expect(result).toEqual({ success: true, message: 'Solicitação de cancelamento enviada.' });
    });

    it('should return success if already cancelling', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'cancelling' }),
      });
      const result = await wrappedCancelAnalysis({ analysisId: MOCK_ANALYSIS_ID }, authContext);
      expect(mockDocUpdate).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: `Análise ${MOCK_ANALYSIS_ID} já está sendo cancelada.`,
      });
    });

    ['completed', 'error', 'cancelled', 'deleted', 'pending_deletion'].forEach((terminalStatus) => {
      it(`should not cancel if status is already "${terminalStatus}"`, async () => {
        mockDocGet.mockResolvedValueOnce({
          exists: true,
          data: () => ({ status: terminalStatus }),
        });
        const result = await wrappedCancelAnalysis({ analysisId: MOCK_ANALYSIS_ID }, authContext);
        expect(mockDocUpdate).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
        expect(result.message).toContain(`já está em um estado final (${terminalStatus})`);
      });
    });

    it('should handle Firestore update errors', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'identifying_regulations' }),
      });
      mockDocUpdate.mockRejectedValueOnce(new Error('Firestore update failed'));

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
