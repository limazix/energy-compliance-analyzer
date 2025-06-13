// @ts-check
'use strict';

/**
 * @fileOverview Test suite for HTTPS Callable Functions in crudHttp.js
 * (httpsCallableGetPastAnalyses, httpsCallableCancelAnalysis)
 */

const admin = require('firebase-admin');
const functions = require('firebase-functions');
const functionsTest = require('firebase-functions-test')();

// Mock firebase-admin
jest.mock('firebase-admin', () => {
  const actualAdmin = jest.requireActual('firebase-admin');
  const mockFirestore = {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    get: jest.fn(),
    update: jest.fn(),
    add: jest.fn(), // For other potential uses if APP_CONFIG pulls in more
  };
  return {
    ...actualAdmin,
    initializeApp: jest.fn(),
    firestore: jest.fn(() => mockFirestore),
    // Mock other admin services if they get pulled in
    storage: jest.fn().mockReturnValue({ bucket: jest.fn() }),
    database: jest.fn().mockReturnValue({ ref: jest.fn() }),
    auth: jest.fn().mockReturnValue({}),
    messaging: jest.fn().mockReturnValue({}),
    pubsub: jest.fn().mockReturnValue({ topic: jest.fn() }),
  };
});

// Import the functions to be tested AFTER mocks are set up
const { httpsCallableGetPastAnalyses, httpsCallableCancelAnalysis } = require('./crudHttp');

const MOCK_USER_ID = 'test-user-crud';
const MOCK_ANALYSIS_ID = 'analysis-crud-id';

describe('Analysis Management CRUD HTTPS Callables', () => {
  let mockAdminFirestore;

  beforeEach(() => {
    // @ts-ignore
    mockAdminFirestore = admin.firestore();
    // Clear all mocks on admin.firestore().<method>()
    Object.values(mockAdminFirestore).forEach((mockFn) => {
      if (jest.isMockFunction(mockFn)) {
        mockFn.mockClear();
      }
    });
    // Specifically clear chained methods if they were returned by 'this'
    if (jest.isMockFunction(mockAdminFirestore.collection().doc().collection().orderBy().get)) {
      mockAdminFirestore.collection().doc().collection().orderBy().get.mockClear();
    }
    if (jest.isMockFunction(mockAdminFirestore.collection().doc().get)) {
      mockAdminFirestore.collection().doc().get.mockClear();
    }
    if (jest.isMockFunction(mockAdminFirestore.collection().doc().update)) {
      mockAdminFirestore.collection().doc().update.mockClear();
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
      // @ts-ignore
      mockAdminFirestore.get.mockResolvedValueOnce({ docs: mockAnalysesData });

      const result = await wrappedGetPastAnalyses({ userId: MOCK_USER_ID }, {});

      expect(mockAdminFirestore.collection).toHaveBeenCalledWith('users');
      expect(mockAdminFirestore.doc).toHaveBeenCalledWith(MOCK_USER_ID);
      expect(mockAdminFirestore.collection).toHaveBeenCalledWith('analyses');
      expect(mockAdminFirestore.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
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
            createdAt: admin.firestore.Timestamp.fromDate(new Date()),
          }),
        },
      ];
      // @ts-ignore
      mockAdminFirestore.get.mockResolvedValueOnce({ docs: mockAnalysesDataWithInvalidStatus });

      const result = await wrappedGetPastAnalyses({ userId: MOCK_USER_ID }, {});
      expect(result.analyses).toHaveLength(1);
      expect(result.analyses[0].status).toBe('error');
      expect(result.analyses[0].errorMessage).toContain('Status inválido (weird_status)');
    });

    it('should handle Firestore query errors', async () => {
      mockAdminFirestore.get.mockRejectedValueOnce(new Error('Firestore query failed'));
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
      mockAdminFirestore.get.mockResolvedValueOnce({ exists: false });
      await expect(
        wrappedCancelAnalysis({ analysisId: MOCK_ANALYSIS_ID }, authContext)
      ).rejects.toMatchObject({
        code: 'not-found',
        message: `Análise ${MOCK_ANALYSIS_ID} não encontrada para cancelamento.`,
      });
      expect(mockAdminFirestore.doc).toHaveBeenCalledWith(
        `users/${MOCK_USER_ID}/analyses/${MOCK_ANALYSIS_ID}`
      );
    });

    it('should set status to "cancelling" for a valid request', async () => {
      mockAdminFirestore.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'summarizing_data' }),
      });
      mockAdminFirestore.update.mockResolvedValueOnce({});

      const result = await wrappedCancelAnalysis({ analysisId: MOCK_ANALYSIS_ID }, authContext);

      expect(mockAdminFirestore.update).toHaveBeenCalledWith({
        status: 'cancelling',
        errorMessage: 'Cancelamento solicitado pelo usuário...',
      });
      expect(result).toEqual({ success: true, message: 'Solicitação de cancelamento enviada.' });
    });

    it('should return success if already cancelling', async () => {
      mockAdminFirestore.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'cancelling' }),
      });
      const result = await wrappedCancelAnalysis({ analysisId: MOCK_ANALYSIS_ID }, authContext);
      expect(mockAdminFirestore.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: `Análise ${MOCK_ANALYSIS_ID} já está sendo cancelada.`,
      });
    });

    ['completed', 'error', 'cancelled', 'deleted', 'pending_deletion'].forEach((terminalStatus) => {
      it(`should not cancel if status is already "${terminalStatus}"`, async () => {
        mockAdminFirestore.get.mockResolvedValueOnce({
          exists: true,
          data: () => ({ status: terminalStatus }),
        });
        const result = await wrappedCancelAnalysis({ analysisId: MOCK_ANALYSIS_ID }, authContext);
        expect(mockAdminFirestore.update).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
        expect(result.message).toContain(`já está em um estado final (${terminalStatus})`);
      });
    });

    it('should handle Firestore update errors', async () => {
      mockAdminFirestore.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'identifying_regulations' }),
      });
      mockAdminFirestore.update.mockRejectedValueOnce(new Error('Firestore update failed'));

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
