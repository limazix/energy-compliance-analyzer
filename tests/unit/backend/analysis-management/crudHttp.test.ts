// functions/src/analysis-management/__tests__/crudHttp.test.ts
'use strict';

/**
 * @fileOverview Unit test suite for HTTPS Callable Functions in crudHttp.ts
 */
import adminActual from 'firebase-admin';
import * as functions from 'firebase-functions';

import {
  CancelAnalysisRequest,
  GetPastAnalysesRequest,
  httpsCallableCancelAnalysis,
  httpsCallableGetPastAnalyses,
} from '../../../../functions/src/analysis-management/crudHttp'; // Using @functions alias

import type { Analysis } from '../../../../types/analysis'; // Path relative to project root

// --- Start of Pre-defined Mocks for firebase-admin ---
// DEFINE ALL MOCK COMPONENTS BEFORE jest.mock('firebase-admin')
const mockDocGet_crudHttp = jest.fn();
const mockDocUpdate_crudHttp = jest.fn();
const mockCollectionOrderBy_crudHttp = jest.fn().mockReturnThis();
const mockCollectionWhere_crudHttp = jest.fn().mockReturnThis();
const mockCollectionGet_crudHttp = jest.fn();
const mockCollectionAdd_crudHttp = jest.fn();

const mockFirestoreDocRef_crudHttp: {
  get: jest.Mock;
  update: jest.Mock;
  collection: jest.Mock;
} = {
  get: mockDocGet_crudHttp,
  update: mockDocUpdate_crudHttp,
  collection: jest.fn(() => mockFirestoreCollectionRef_crudHttp),
};

const mockFirestoreCollectionRef_crudHttp = {
  orderBy: mockCollectionOrderBy_crudHttp,
  where: mockCollectionWhere_crudHttp,
  get: mockCollectionGet_crudHttp,
  doc: jest.fn(() => mockFirestoreDocRef_crudHttp),
  add: mockCollectionAdd_crudHttp,
};

const mockFirestoreServiceInstance_crudHttp = {
  collection: jest.fn().mockImplementation(() => mockFirestoreCollectionRef_crudHttp),
  doc: jest.fn().mockImplementation(() => mockFirestoreDocRef_crudHttp),
};

const firestoreFactoryMock_crudHttp = jest.fn(() => mockFirestoreServiceInstance_crudHttp);
Object.assign(firestoreFactoryMock_crudHttp, {
  Timestamp: adminActual.firestore.Timestamp,
  FieldValue: adminActual.firestore.FieldValue,
});
// --- End of Pre-defined Mocks ---

// Mock firebase-admin
jest.mock('firebase-admin', () => {
  const mockAppsArrayInternal: adminActual.app.App[] = [];
  const mockAppDeleteInternal = jest.fn(() => Promise.resolve());

  const createMockAppInternal = (name: string): adminActual.app.App =>
    ({
      name,
      firestore: firestoreFactoryMock_crudHttp as unknown as () => adminActual.firestore.Firestore, // Use the factory mock defined above
      storage: jest.fn(() => ({
        bucket: jest.fn(() => ({
          file: jest.fn(() => ({
            exists: jest.fn(),
            delete: jest.fn(),
            save: jest.fn(),
            download: jest.fn(),
          })),
        })),
      })),
      delete: mockAppDeleteInternal,
      auth: jest.fn().mockReturnValue({}),
      database: jest.fn().mockReturnValue({ ref: jest.fn() }),
      messaging: jest.fn().mockReturnValue({}),
      pubsub: jest.fn().mockReturnValue({ topic: jest.fn() }),
    }) as unknown as adminActual.app.App;

  const mockInitializeAppInternal = jest.fn(
    (_options?: adminActual.AppOptions, appNameParam?: string) => {
      const name = appNameParam || '[DEFAULT]';
      let app = mockAppsArrayInternal.find((a) => a.name === name);
      if (!app) {
        app = createMockAppInternal(name);
        mockAppsArrayInternal.push(app);
      }
      return app;
    }
  );

  if (mockAppsArrayInternal.length === 0) {
    mockInitializeAppInternal();
  }

  return {
    initializeApp: mockInitializeAppInternal,
    get apps() {
      return mockAppsArrayInternal;
    },
    app: jest.fn((appNameParam?: string) => {
      const name = appNameParam || '[DEFAULT]';
      let appInstance = mockAppsArrayInternal.find((app) => app.name === name);
      if (!appInstance) {
        if (mockAppsArrayInternal.length === 0 && !appNameParam) {
          appInstance = mockInitializeAppInternal();
        } else {
          throw new Error(
            `Firebase app "${name}" does not exist. Ensure admin.initializeApp() is called or mocked for this app name.`
          );
        }
      }
      return appInstance;
    }),
    firestore: firestoreFactoryMock_crudHttp,
    storage: jest.fn().mockReturnValue({
      bucket: jest.fn(() => ({
        file: jest.fn(() => ({
          exists: jest.fn(),
          delete: jest.fn(),
          save: jest.fn(),
          download: jest.fn(),
        })),
      })),
    }),
    auth: jest.fn().mockReturnValue({}),
    database: jest.fn().mockReturnValue({ ref: jest.fn() }),
    messaging: jest.fn().mockReturnValue({}),
    pubsub: jest.fn().mockReturnValue({ topic: jest.fn() }),
    credential: {
      applicationDefault: jest.fn(),
      cert: jest.fn(),
    },
  };
});

const MOCK_USER_ID_CRUD = 'test-user-crud';
const MOCK_ANALYSIS_ID_CRUD = 'analysis-crud-id';

describe('Analysis Management CRUD HTTPS Callables', () => {
  beforeEach(() => {
    firestoreFactoryMock_crudHttp.mockClear();
    mockFirestoreServiceInstance_crudHttp.collection
      .mockReset()
      .mockImplementation(() => mockFirestoreCollectionRef_crudHttp);
    mockFirestoreServiceInstance_crudHttp.doc
      .mockReset()
      .mockImplementation(() => mockFirestoreDocRef_crudHttp);
    mockFirestoreCollectionRef_crudHttp.orderBy.mockReset().mockReturnThis();
    mockFirestoreCollectionRef_crudHttp.where.mockReset().mockReturnThis();
    mockFirestoreCollectionRef_crudHttp.get.mockReset();
    mockFirestoreCollectionRef_crudHttp.doc
      .mockReset()
      .mockImplementation(() => mockFirestoreDocRef_crudHttp);
    mockFirestoreCollectionRef_crudHttp.add.mockReset();
    mockFirestoreDocRef_crudHttp.get.mockReset();
    mockFirestoreDocRef_crudHttp.update.mockReset();
    mockFirestoreDocRef_crudHttp.collection
      .mockReset()
      .mockImplementation(() => mockFirestoreCollectionRef_crudHttp);
  });

  describe('httpsCallableGetPastAnalyses', () => {
    it('should throw "invalid-argument" if userId is missing', async () => {
      await expect(
        httpsCallableGetPastAnalyses(
          {} as GetPastAnalysesRequest,
          {} as functions.https.CallableContext
        ) // This specific test case intentionally uses an empty object to check for the missing userId validation, so keeping `any` here is acceptable for the test's purpose.
      ).rejects.toMatchObject({
        code: 'invalid-argument',
        message: 'O ID do usuário (userId) é obrigatório no payload da solicitação.',
      });
    });

    it('should fetch and return analyses successfully', async () => {
      const mockAnalysesData = [
        {
          id: 'analysis2',
          data: () => ({
            userId: MOCK_USER_ID_CRUD,
            fileName: 'file2.csv',
            title: 'Analysis 2',
            status: 'summarizing_data',
            progress: 30,
            createdAt: adminActual.firestore.Timestamp.fromDate(new Date('2023-01-02T10:00:00Z')),
            tags: [],
          }),
        },
        {
          id: 'analysis1',
          data: () => ({
            userId: MOCK_USER_ID_CRUD,
            fileName: 'file1.csv',
            title: 'Analysis 1',
            status: 'completed',
            progress: 100,
            createdAt: adminActual.firestore.Timestamp.fromDate(new Date('2023-01-01T10:00:00Z')),
            tags: ['tagA'],
          }),
        },
        {
          id: 'analysis3-deleted',
          data: () => ({
            userId: MOCK_USER_ID_CRUD,
            fileName: 'file3.csv',
            title: 'Analysis 3 Deleted',
            status: 'deleted',
            progress: 100,
            createdAt: adminActual.firestore.Timestamp.fromDate(new Date('2023-01-03T10:00:00Z')),
          }),
        },
        {
          id: 'analysis4-pending-deletion',
          data: () => ({
            userId: MOCK_USER_ID_CRUD,
            fileName: 'file4.csv',
            title: 'Analysis 4 Pending Deletion',
            status: 'pending_deletion',
            progress: 100,
            createdAt: adminActual.firestore.Timestamp.fromDate(new Date('2023-01-04T10:00:00Z')),
          }),
        },
      ];
      mockCollectionGet_crudHttp.mockResolvedValueOnce({ docs: mockAnalysesData });

      const result = await httpsCallableGetPastAnalyses(
        { userId: MOCK_USER_ID_CRUD },
        {} as functions.https.CallableContext // Context is not used in this specific test, so casting to an empty context type is acceptable.
      );

      expect(mockFirestoreServiceInstance_crudHttp.collection).toHaveBeenCalledWith('users');
      expect(mockFirestoreDocRef_crudHttp.collection).toHaveBeenCalledWith('analyses');

      expect(mockCollectionOrderBy_crudHttp).toHaveBeenCalledWith('createdAt', 'desc');
      expect(result.analyses).toHaveLength(2);
      expect(result.analyses[0].id).toBe('analysis2');
      expect(result.analyses[1].id).toBe('analysis1');
      expect(result.analyses[0].status).toBe('summarizing_data');
      expect(result.analyses[1].createdAt).toBe('2023-01-01T10:00:00.000Z');
      expect((result.analyses[1] as Analysis).tags).toEqual(['tagA']);
    });

    it('should handle invalid status in Firestore data', async () => {
      const mockAnalysesDataWithInvalidStatus = [
        {
          id: 'analysis-invalid',
          data: () => ({
            userId: MOCK_USER_ID_CRUD,
            fileName: 'invalid.csv',
            title: 'Invalid Status Analysis',
            status: 'weird_status',
            progress: 50,
            createdAt: adminActual.firestore.Timestamp.fromDate(new Date()),
          }),
        },
      ];
      mockCollectionGet_crudHttp.mockResolvedValueOnce({
        docs: mockAnalysesDataWithInvalidStatus,
      });

      const result = await httpsCallableGetPastAnalyses(
        { userId: MOCK_USER_ID_CRUD },
        {} as functions.https.CallableContext // Context is not used in this specific test, so casting to an empty context type is acceptable.
      );
      expect(result.analyses).toHaveLength(1);
      expect(result.analyses[0].status).toBe('error');
      expect(result.analyses[0].errorMessage).toContain('Status inválido (weird_status)');
    });

    it('should handle Firestore query errors', async () => {
      mockCollectionGet_crudHttp.mockRejectedValueOnce(new Error('Firestore query failed'));
      await expect(
        httpsCallableGetPastAnalyses(
          { userId: MOCK_USER_ID_CRUD },
          {} as functions.https.CallableContext // Context is not used in this specific test, so casting to an empty context type is acceptable.
        )
      ).rejects.toMatchObject({
        code: 'internal',
        message: expect.stringContaining('Falha ao buscar análises: Firestore query failed'),
      });
    });
  });

  describe('httpsCallableCancelAnalysis', () => {
    const authContext = { auth: { uid: MOCK_USER_ID_CRUD } } as functions.https.CallableContext;

    it('should throw "unauthenticated" if no auth context', async () => {
      await expect(
        httpsCallableCancelAnalysis(
          { analysisId: MOCK_ANALYSIS_ID_CRUD },
          {} as functions.https.CallableContext
        )
      ).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('should throw "invalid-argument" if analysisId is missing', async () => {
      await expect(
        httpsCallableCancelAnalysis({} as CancelAnalysisRequest, authContext)
      ).rejects.toMatchObject({
        // This specific test case intentionally uses an empty object to check for the missing analysisId validation, so keeping `any` here is acceptable for the test's purpose.
        code: 'invalid-argument',
        message: 'ID da análise é obrigatório.',
      });
    });

    it('should throw "not-found" if analysis document does not exist', async () => {
      mockDocGet_crudHttp.mockResolvedValueOnce({
        exists: false,
        data: () => undefined,
      });
      await expect(
        httpsCallableCancelAnalysis({ analysisId: MOCK_ANALYSIS_ID_CRUD }, authContext)
      ).rejects.toMatchObject({
        code: 'not-found',
        message: `Análise ${MOCK_ANALYSIS_ID_CRUD} não encontrada para cancelamento.`,
      });
      expect(mockFirestoreServiceInstance_crudHttp.doc).toHaveBeenCalledWith(
        `users/${MOCK_USER_ID_CRUD}/analyses/${MOCK_ANALYSIS_ID_CRUD}`
      );
    });

    it('should set status to "cancelling" for a valid request', async () => {
      mockDocGet_crudHttp.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'summarizing_data' }),
      });
      mockDocUpdate_crudHttp.mockResolvedValueOnce({});

      const result = await httpsCallableCancelAnalysis(
        { analysisId: MOCK_ANALYSIS_ID_CRUD },
        authContext
      );

      expect(mockDocUpdate_crudHttp).toHaveBeenCalledWith({
        status: 'cancelling',
        errorMessage: 'Cancelamento solicitado pelo usuário...',
      });
      expect(result).toEqual({ success: true, message: 'Solicitação de cancelamento enviada.' });
    });

    it('should return success if already cancelling', async () => {
      mockDocGet_crudHttp.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'cancelling' }),
      });
      const result = await httpsCallableCancelAnalysis(
        { analysisId: MOCK_ANALYSIS_ID_CRUD },
        authContext
      );
      expect(mockDocUpdate_crudHttp).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: `Análise ${MOCK_ANALYSIS_ID_CRUD} já está sendo cancelada.`,
      });
    });

    ['completed', 'error', 'cancelled', 'deleted', 'pending_deletion'].forEach((terminalStatus) => {
      it(`should not cancel if status is already "${terminalStatus}"`, async () => {
        mockDocGet_crudHttp.mockResolvedValueOnce({
          exists: true,
          data: () => ({ status: terminalStatus }),
        });
        const result = await httpsCallableCancelAnalysis(
          { analysisId: MOCK_ANALYSIS_ID_CRUD },
          authContext
        );
        expect(mockDocUpdate_crudHttp).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
        expect(result.message).toContain(`já está em um estado final (${terminalStatus})`);
      });
    });

    it('should handle Firestore update errors', async () => {
      mockDocGet_crudHttp.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'identifying_regulations' }),
      });
      mockDocUpdate_crudHttp.mockRejectedValueOnce(new Error('Firestore update failed'));

      await expect(
        httpsCallableCancelAnalysis({ analysisId: MOCK_ANALYSIS_ID_CRUD }, authContext)
      ).rejects.toMatchObject({
        code: 'internal',
        message: expect.stringContaining(
          'Falha ao solicitar cancelamento: Firestore update failed'
        ),
      });
    });
  });
});
