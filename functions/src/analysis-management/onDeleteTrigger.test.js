// @ts-check
'use strict';

/**
 * @fileOverview Test suite for the handleAnalysisDeletionRequest Firestore-triggered Firebase Function.
 */

const admin = require('firebase-admin');
const functions = require('firebase-functions');
const functionsTest = require('firebase-functions-test')();

// Mock firebase-admin
jest.mock('firebase-admin', () => {
  const mockFirestoreInstance = {
    doc: jest.fn().mockReturnThis(),
    update: jest.fn(),
    snapshot_: jest.fn((path, data) => {
      const docPath = typeof path === 'string' ? path : 'mock/path'; // Ensure path is a string
      return {
        ref: { path: docPath },
        data: () => data,
        exists: true,
        id: docPath.split('/').pop() || 'mockId', // Use docPath here
        createTime: admin.firestore.Timestamp.now(), // Use actual Timestamp for type consistency
        updateTime: admin.firestore.Timestamp.now(),
        readTime: admin.firestore.Timestamp.now(),
      };
    }),
    collection: jest.fn().mockReturnThis(), // For general adminDb usage if any
  };

  const mockAppsArray = [];
  const mockAppDelete = jest.fn(() => Promise.resolve()); // Mock for app.delete()

  const createMockApp = (name) => ({
    name,
    firestore: () => mockFirestoreInstance,
    storage: () => ({ bucket: jest.fn(() => ({ file: jest.fn() })) }), // Mock storage
    delete: mockAppDelete,
  });

  const mockInitializeApp = jest.fn((_config, appNameParam) => {
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
  firestoreMockFn.Timestamp = {
    now: jest.fn(() => ({
      toDate: () => new Date(),
      toMillis: () => Date.now(),
      isEqual: (_other) => false,
      valueOf: () => String(Date.now()),
      nanoseconds: 0,
      seconds: Math.floor(Date.now() / 1000),
      toString: () => new Date().toISOString(),
      toJSON: () => ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }),
    })),
    fromDate: (date) => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    }),
    fromMillis: (ms) => {
      const d = new Date(ms);
      return {
        toDate: () => d,
        toMillis: () => ms,
        seconds: Math.floor(ms / 1000),
        nanoseconds: 0,
      };
    },
  };
  // Ensure FieldValue is a more complete mock, similar to crudHttp.test.js
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
      let app = mockAppsArray.find((app) => app.name === name);
      if (!app) {
        app = createMockApp(name);
        // @ts-ignore
        mockAppsArray.push(app);
      }
      return app;
    }),
    firestore: firestoreMockFn,
    storage: jest.fn().mockReturnValue({ bucket: jest.fn() }), // Mock storage for other functions
    // Add other services if they are used by the SUT or its direct imports
    auth: jest.fn(),
    database: jest.fn(),
    messaging: jest.fn(),
    pubsub: jest.fn(), // Mock pubsub for other functions
    credential: {
      applicationDefault: jest.fn(),
      cert: jest.fn(),
    },
  };
});

// Mock the storage utility function
const mockDeleteAdminFileFromStorage = jest.fn();
jest.mock('../utils/storage.js', () => ({
  deleteAdminFileFromStorage: mockDeleteAdminFileFromStorage,
  // getAdminFileContentFromStorage: jest.fn(), // if other functions in SUT use it
}));

// Import the function to be tested AFTER mocks are set up
const { handleAnalysisDeletionRequest } = require('./onDeleteTrigger');

const MOCK_USER_ID = 'test-user-ondelete';
const MOCK_ANALYSIS_ID = 'analysis-id-ondelete';
const MOCK_CSV_PATH = `user_uploads/${MOCK_USER_ID}/${MOCK_ANALYSIS_ID}/data.csv`;
const MOCK_MDX_PATH = `user_reports/${MOCK_USER_ID}/${MOCK_ANALYSIS_ID}/report.mdx`;

describe('handleAnalysisDeletionRequest Firestore Trigger', () => {
  let mockAdminFirestore;
  let wrappedHandleAnalysisDeletionRequest;

  beforeEach(() => {
    mockAdminFirestore = admin.firestore();
    mockAdminFirestore.doc.mockClear();
    mockAdminFirestore.update.mockClear();
    if (mockAdminFirestore.snapshot_ && jest.isMockFunction(mockAdminFirestore.snapshot_)) {
      mockAdminFirestore.snapshot_.mockClear();
    }
    // @ts-ignore
    if (admin.app().delete.mockClear) {
      // @ts-ignore
      admin.app().delete.mockClear();
    }

    mockDeleteAdminFileFromStorage.mockClear();
    if (admin.apps && Array.isArray(admin.apps)) {
      admin.apps.length = 0;
    }
    if (admin.initializeApp && jest.isMockFunction(admin.initializeApp)) {
      admin.initializeApp.mockClear();
    }

    wrappedHandleAnalysisDeletionRequest = functionsTest.wrap(handleAnalysisDeletionRequest);
  });

  afterAll(() => {
    functionsTest.cleanup();
  });

  const createChangeObject = (beforeData, afterData) => {
    const docPath = `users/${MOCK_USER_ID}/analyses/${MOCK_ANALYSIS_ID}`;
    const beforeSnap = functionsTest.firestore.makeDocumentSnapshot(beforeData, docPath);
    const afterSnap = functionsTest.firestore.makeDocumentSnapshot(afterData, docPath);
    return functionsTest.makeChange(beforeSnap, afterSnap);
  };

  const context = {
    params: { userId: MOCK_USER_ID, analysisId: MOCK_ANALYSIS_ID },
  };

  it('should not run if status is not "pending_deletion"', async () => {
    const change = createChangeObject({ status: 'completed' }, { status: 'completed' });
    await wrappedHandleAnalysisDeletionRequest(change, context);
    expect(mockDeleteAdminFileFromStorage).not.toHaveBeenCalled();
    expect(mockAdminFirestore.update).not.toHaveBeenCalled();
  });

  it('should delete files and update status to "deleted" on success', async () => {
    const change = createChangeObject(
      {
        status: 'completed',
      },
      {
        status: 'pending_deletion',
        powerQualityDataUrl: MOCK_CSV_PATH,
        mdxReportStoragePath: MOCK_MDX_PATH,
      }
    );
    mockDeleteAdminFileFromStorage.mockResolvedValue(undefined);
    mockAdminFirestore.update.mockResolvedValue(undefined);

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_CSV_PATH);
    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_MDX_PATH);
    expect(mockAdminFirestore.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'deleted',
        errorMessage: 'Análise e arquivos associados foram excluídos com sucesso.',
      })
    );
  });

  it('should handle missing CSV path gracefully', async () => {
    const change = createChangeObject(
      { status: 'error' },
      { status: 'pending_deletion', mdxReportStoragePath: MOCK_MDX_PATH } // No powerQualityDataUrl
    );
    mockDeleteAdminFileFromStorage.mockResolvedValue(undefined);
    mockAdminFirestore.update.mockResolvedValue(undefined);

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).not.toHaveBeenCalledWith(MOCK_CSV_PATH);
    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_MDX_PATH);
    expect(mockAdminFirestore.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'deleted' })
    );
  });

  it('should handle missing MDX path gracefully', async () => {
    const change = createChangeObject(
      { status: 'error' },
      { status: 'pending_deletion', powerQualityDataUrl: MOCK_CSV_PATH } // No mdxReportStoragePath
    );
    mockDeleteAdminFileFromStorage.mockResolvedValue(undefined);
    mockAdminFirestore.update.mockResolvedValue(undefined);

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_CSV_PATH);
    // Check it was called only once (for CSV)
    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledTimes(1);
    expect(mockAdminFirestore.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'deleted' })
    );
  });

  it('should update status to "error" if CSV deletion fails', async () => {
    const change = createChangeObject(
      { status: 'reviewing_report' },
      {
        status: 'pending_deletion',
        powerQualityDataUrl: MOCK_CSV_PATH,
        mdxReportStoragePath: MOCK_MDX_PATH,
      }
    );
    const deletionError = new Error('Storage CSV deletion failed');
    mockDeleteAdminFileFromStorage.mockImplementation(async (filePath) => {
      if (filePath === MOCK_CSV_PATH) throw deletionError;
      return undefined;
    });
    mockAdminFirestore.update.mockResolvedValue(undefined);

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_CSV_PATH);
    // MDX deletion might not be called if CSV deletion throws and is caught.
    // Let's check that update to 'error' happened.
    expect(mockAdminFirestore.update).toHaveBeenCalledWith({
      status: 'error',
      errorMessage: expect.stringContaining(
        `Falha no processo de exclusão (Func): ${deletionError.message}`
      ),
    });
  });

  it('should update status to "error" if MDX deletion fails', async () => {
    const change = createChangeObject(
      { status: 'completed' },
      {
        status: 'pending_deletion',
        powerQualityDataUrl: MOCK_CSV_PATH,
        mdxReportStoragePath: MOCK_MDX_PATH,
      }
    );
    const deletionError = new Error('Storage MDX deletion failed');
    mockDeleteAdminFileFromStorage.mockImplementation(async (filePath) => {
      if (filePath === MOCK_CSV_PATH) return undefined; // CSV deletes successfully
      if (filePath === MOCK_MDX_PATH) throw deletionError; // MDX fails
      return undefined;
    });
    mockAdminFirestore.update.mockResolvedValue(undefined);

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_CSV_PATH);
    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_MDX_PATH);
    expect(mockAdminFirestore.update).toHaveBeenCalledWith({
      status: 'error',
      errorMessage: expect.stringContaining(
        `Falha no processo de exclusão (Func): ${deletionError.message}`
      ),
    });
  });

  it('should log critical error if Firestore update fails after successful file deletions', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const change = createChangeObject(
      { status: 'completed' },
      {
        status: 'pending_deletion',
        powerQualityDataUrl: MOCK_CSV_PATH,
        mdxReportStoragePath: MOCK_MDX_PATH,
      }
    );
    mockDeleteAdminFileFromStorage.mockResolvedValue(undefined); // Both files delete fine
    const firestoreUpdateError = new Error('Firestore final update failed');

    // First update (to 'deleted') fails
    mockAdminFirestore.update.mockImplementationOnce(async (payload) => {
      if (payload.status === 'deleted') {
        throw firestoreUpdateError;
      }
      return undefined;
    });
    // Second update (to 'error' in catch block) also fails
    mockAdminFirestore.update.mockImplementationOnce(async () => {
      throw new Error('Secondary Firestore update to error status also failed');
    });

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledTimes(2); // Both CSV and MDX
    expect(mockAdminFirestore.update).toHaveBeenCalledTimes(2); // Attempted 'deleted', then attempted 'error'
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `[Func_handleDeletion] CRITICAL: Failed to update Firestore with error state for ${MOCK_ANALYSIS_ID} after deletion failure:`
      ),
      expect.any(Error) // The error from the second update attempt
    );
    consoleErrorSpy.mockRestore();
  });
});
