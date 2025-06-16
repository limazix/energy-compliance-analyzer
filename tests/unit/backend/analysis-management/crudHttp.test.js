// @ts-check
'use strict';

/**
 * @fileOverview Unit test suite for HTTPS Callable Functions in crudHttp.js
 */

import admin from 'firebase-admin';

import {
  httpsCallableGetPastAnalyses,
  httpsCallableCancelAnalysis,
} from '../../../../functions/src/analysis-management/crudHttp.js';

process.env.GCLOUD_PROJECT = 'electric-magnitudes-analizer'; // Set for consistent logging

// Define mocks for Firestore methods explicitly
const mockDocGet = jest.fn();
const mockDocUpdate = jest.fn();
const mockCollectionOrderBy = jest.fn().mockReturnThis(); // Enable chaining for orderBy
const mockCollectionWhere = jest.fn().mockReturnThis(); // Enable chaining for where
const mockCollectionGet = jest.fn();

const mockFirestoreDocRef = {
  get: mockDocGet,
  update: mockDocUpdate,
  collection: jest.fn(() => mockFirestoreCollectionRef), // For subcollections
};

const mockFirestoreCollectionRef = {
  orderBy: mockCollectionOrderBy,
  where: mockCollectionWhere,
  get: mockCollectionGet,
  doc: jest.fn(() => mockFirestoreDocRef),
};

const mockFirestoreService = {
  collection: jest.fn(() => mockFirestoreCollectionRef),
  doc: jest.fn(() => mockFirestoreDocRef),
};

// Mock firebase-admin
jest.mock('firebase-admin', () => {
  const actualAdmin = jest.requireActual('firebase-admin');
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
          // If default app is requested and no apps exist, initialize and add default
          appInstance = createMockApp(name); // Default name will be '[DEFAULT]'
          mockAppsArray.push(appInstance);
        } else {
          // If a named app is requested and not found, or default is requested and others exist but not default
          throw new Error(
            `Firebase app "${name}" does not exist. Initialize via admin.initializeApp(). Current apps: ${mockAppsArray.map((a) => a.name).join(', ')}`
          );
        }
      }
      return appInstance;
    }),
    firestore: firestoreFactoryMock, // This is admin.firestore
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

const MOCK_USER_ID = 'test-user-crud';
const MOCK_ANALYSIS_ID = 'analysis-crud-id';

describe('Analysis Management CRUD HTTPS Callables', () => {
  beforeEach(() => {
    // Clear mock app array and re-initialize default app for a clean state
    const adminApps = admin.apps;
    while (adminApps.length > 0) {
      const appToClean = adminApps.pop();
      if (appToClean && appToClean.delete) {
        appToClean.delete(); // Call mock delete
      }
    }
    if (admin.apps.length === 0 && admin.initializeApp) {
      admin.initializeApp(); // Re-initialize default app
    }

    // Reset Firestore factory calls
    if (jest.isMockFunction(admin.firestore)) {
      admin.firestore.mockClear();
    }

    // Reset methods on the service instance
    mockFirestoreService.collection
      .mockReset()
      .mockImplementation(() => mockFirestoreCollectionRef);
    mockFirestoreService.doc.mockReset().mockImplementation(() => mockFirestoreDocRef);

    // Reset methods on collection and doc references
    mockFirestoreCollectionRef.orderBy.mockReset().mockReturnThis();
    mockFirestoreCollectionRef.where.mockReset().mockReturnThis();
    mockFirestoreCollectionRef.get.mockReset();
    mockFirestoreCollectionRef.doc.mockReset().mockImplementation(() => mockFirestoreDocRef);

    mockDocGet.mockReset();
    mockDocUpdate.mockReset();
  });

  describe('httpsCallableGetPastAnalyses', () => {
    it('should throw "invalid-argument" if userId is missing', async () => {
      await expect(httpsCallableGetPastAnalyses({}, {})).rejects.toMatchObject({
        code: 'invalid-argument',
        message: 'O ID do usuário (userId) é obrigatório no payload da solicitação.',
      });
    });

    it('should fetch and return analyses successfully', async () => {
      const mockAnalysesData = [
        {
          id: 'analysis2',
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
          id: 'analysis1',
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
      mockFirestoreService.collection.mockImplementation((path) => {
        if (path === 'users') return mockFirestoreCollectionRef;
        if (path === 'analyses') return mockFirestoreCollectionRef;
        return mockFirestoreCollectionRef;
      });
      mockFirestoreCollectionRef.doc.mockReturnValue(mockFirestoreDocRef);
      mockFirestoreDocRef.collection = jest.fn(() => mockFirestoreCollectionRef);

      mockCollectionGet.mockResolvedValueOnce({ docs: mockAnalysesData });

      const result = await httpsCallableGetPastAnalyses({ userId: MOCK_USER_ID }, {});

      expect(mockFirestoreService.collection).toHaveBeenCalledWith('users');
      expect(mockFirestoreCollectionRef.doc).toHaveBeenCalledWith(MOCK_USER_ID);
      expect(mockFirestoreDocRef.collection).toHaveBeenCalledWith('analyses');

      expect(mockFirestoreCollectionRef.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
      expect(result.analyses).toHaveLength(2);
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
            status: 'weird_status',
            progress: 50,
            createdAt: admin.firestore.Timestamp.fromDate(new Date()),
          }),
        },
      ];
      mockCollectionGet.mockResolvedValueOnce({
        docs: mockAnalysesDataWithInvalidStatus,
      });

      const result = await httpsCallableGetPastAnalyses({ userId: MOCK_USER_ID }, {});
      expect(result.analyses).toHaveLength(1);
      expect(result.analyses[0].status).toBe('error');
      expect(result.analyses[0].errorMessage).toContain('Status inválido (weird_status)');
    });

    it('should handle Firestore query errors', async () => {
      mockCollectionGet.mockRejectedValueOnce(new Error('Firestore query failed'));
      await expect(
        httpsCallableGetPastAnalyses({ userId: MOCK_USER_ID }, {})
      ).rejects.toMatchObject({
        code: 'internal',
        message: expect.stringContaining('Falha ao buscar análises: Firestore query failed'),
      });
    });
  });

  describe('httpsCallableCancelAnalysis', () => {
    const authContext = { auth: { uid: MOCK_USER_ID } };

    it('should throw "unauthenticated" if no auth context', async () => {
      await expect(
        httpsCallableCancelAnalysis({ analysisId: MOCK_ANALYSIS_ID }, {})
      ).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('should throw "invalid-argument" if analysisId is missing', async () => {
      // @ts-expect-error - Testing invalid input: missing analysisId for this test
      await expect(httpsCallableCancelAnalysis({}, authContext)).rejects.toMatchObject({
        code: 'invalid-argument',
        message: 'ID da análise é obrigatório.',
      });
    });

    it('should throw "not-found" if analysis document does not exist', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: false, // Ensure this is a boolean
        data: () => undefined,
      });
      await expect(
        httpsCallableCancelAnalysis({ analysisId: MOCK_ANALYSIS_ID }, authContext)
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
        exists: true, // Boolean
        data: () => ({ status: 'summarizing_data' }),
      });
      mockDocUpdate.mockResolvedValueOnce({});

      const result = await httpsCallableCancelAnalysis(
        { analysisId: MOCK_ANALYSIS_ID },
        authContext
      );

      expect(mockDocUpdate).toHaveBeenCalledWith({
        status: 'cancelling',
        errorMessage: 'Cancelamento solicitado pelo usuário...',
      });
      expect(result).toEqual({ success: true, message: 'Solicitação de cancelamento enviada.' });
    });

    it('should return success if already cancelling', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true, // Boolean
        data: () => ({ status: 'cancelling' }),
      });
      const result = await httpsCallableCancelAnalysis(
        { analysisId: MOCK_ANALYSIS_ID },
        authContext
      );
      expect(mockDocUpdate).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: `Análise ${MOCK_ANALYSIS_ID} já está sendo cancelada.`,
      });
    });

    ['completed', 'error', 'cancelled', 'deleted', 'pending_deletion'].forEach((terminalStatus) => {
      it(`should not cancel if status is already "${terminalStatus}"`, async () => {
        mockDocGet.mockResolvedValueOnce({
          exists: true, // Boolean
          data: () => ({ status: terminalStatus }),
        });
        const result = await httpsCallableCancelAnalysis(
          { analysisId: MOCK_ANALYSIS_ID },
          authContext
        );
        expect(mockDocUpdate).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
        expect(result.message).toContain(`já está em um estado final (${terminalStatus})`);
      });
    });

    it('should handle Firestore update errors', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true, // Boolean
        data: () => ({ status: 'identifying_regulations' }),
      });
      mockDocUpdate.mockRejectedValueOnce(new Error('Firestore update failed'));

      await expect(
        httpsCallableCancelAnalysis({ analysisId: MOCK_ANALYSIS_ID }, authContext)
      ).rejects.toMatchObject({
        code: 'internal',
        message: expect.stringContaining(
          'Falha ao solicitar cancelamento: Firestore update failed'
        ),
      });
    });
  });
});
