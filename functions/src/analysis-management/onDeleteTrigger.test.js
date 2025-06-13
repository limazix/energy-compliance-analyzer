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
    // Add snapshot_ method expected by firebase-functions-test
    snapshot_: jest.fn((path, data) => {
      // Return a basic mock of a snapshot object.
      // firebase-functions-test's makeDocumentSnapshot will use this.
      return {
        ref: { path }, // Or more detailed mock if needed by SUT indirectly
        data: () => data,
        exists: true, // Assume it exists for the purpose of snapshot creation
        id: path.split('/').pop() || 'mockId',
        createTime: admin.firestore.Timestamp.now(), // Use actual Timestamp for type consistency
        updateTime: admin.firestore.Timestamp.now(),
        readTime: admin.firestore.Timestamp.now(),
      };
    }),
    // Keep collection and other methods if your SUT or other parts of the test might need them
    collection: jest.fn().mockReturnThis(),
  };

  const mockAppsArray = [];

  const mockInitializeApp = jest.fn((_config, appName) => {
    const name = appName || '[DEFAULT]';
    let app = mockAppsArray.find((app) => app.name === name);
    if (!app) {
      app = {
        name,
        firestore: () => mockFirestoreInstance,
        // Add other services if needed by SUT
        storage: () => ({ bucket: jest.fn(() => ({ file: jest.fn() })) }), // Basic mock for storage
      };
      mockAppsArray.push(app);
    }
    return app;
  });

  // Ensure admin.firestore itself is a function that returns the instance
  const firestoreMockFn = jest.fn(() => mockFirestoreInstance);
  // Attach static properties like Timestamp and FieldValue to the firestoreMockFn
  firestoreMockFn.Timestamp = {
    now: jest.fn(() => ({
      toDate: () => new Date(),
      toMillis: () => Date.now(),
      isEqual: (other) => other instanceof firestoreMockFn.Timestamp, // Basic mock
      valueOf: () => String(Date.now()),
      nanoseconds: 0,
      seconds: Math.floor(Date.now() / 1000),
      toString: () => new Date().toISOString(),
      toJSON: () => ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }),
      isEqual: (other) => false, // Simplified
      toMillis: () => Date.now(),
      valueOf: () => String(Date.now()),
    })),
    fromDate: (date) => ({
      toDate: () => date,
      // ... other Timestamp methods if needed
    }),
  };
  firestoreMockFn.FieldValue = {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP_PLACEHOLDER'), // Placeholder
    // ... other FieldValue methods if needed (arrayUnion, delete, etc.)
  };

  return {
    initializeApp: mockInitializeApp,
    get apps() {
      return mockAppsArray;
    },
    app: jest.fn((appName) => {
      const name = appName || '[DEFAULT]';
      let app = mockAppsArray.find((app) => app.name === name);
      if (!app) {
        // If app doesn't exist, simulate creating/returning one
        app = { name, firestore: firestoreMockFn }; // Use the function here
        mockAppsArray.push(app);
      }
      return app;
    }),
    firestore: firestoreMockFn, // Use the function here
    storage: jest.fn().mockReturnValue({ bucket: jest.fn() }),
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
    mockAdminFirestore = admin.firestore(); // This will now be our enhanced mock
    mockAdminFirestore.doc.mockClear();
    mockAdminFirestore.update.mockClear();
    // Clear the snapshot_ mock if needed, though it's usually fine
    if (mockAdminFirestore.snapshot_ && jest.isMockFunction(mockAdminFirestore.snapshot_)) {
      mockAdminFirestore.snapshot_.mockClear();
    }

    mockDeleteAdminFileFromStorage.mockClear();
    // Reset admin.apps for each test
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
    const beforeSnap = functionsTest.firestore.makeDocumentSnapshot(
      beforeData,
      `users/${MOCK_USER_ID}/analyses/${MOCK_ANALYSIS_ID}`
    );
    const afterSnap = functionsTest.firestore.makeDocumentSnapshot(
      afterData,
      `users/${MOCK_USER_ID}/analyses/${MOCK_ANALYSIS_ID}`
    );
    return functionsTest.makeChange(beforeSnap, afterSnap);
  };

  const context = {
    params: { userId: MOCK_USER_ID, analysisId: MOCK_ANALYSIS_ID },
  };

  it('should not run if status is not "pending_deletion"', async () => {
    const change = createChangeObject(
      { status: 'completed' },
      { status: 'completed' } // No change to pending_deletion
    );
    await wrappedHandleAnalysisDeletionRequest(change, context);
    expect(mockDeleteAdminFileFromStorage).not.toHaveBeenCalled();
    expect(mockAdminFirestore.update).not.toHaveBeenCalled();
  });

  it('should delete files and update status to "deleted" on success', async () => {
    const change = createChangeObject(
      {
        status: 'completed',
        powerQualityDataUrl: MOCK_CSV_PATH,
        mdxReportStoragePath: MOCK_MDX_PATH,
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
      { status: 'error', mdxReportStoragePath: MOCK_MDX_PATH },
      { status: 'pending_deletion', mdxReportStoragePath: MOCK_MDX_PATH }
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
      { status: 'error', powerQualityDataUrl: MOCK_CSV_PATH },
      { status: 'pending_deletion', powerQualityDataUrl: MOCK_CSV_PATH }
    );
    mockDeleteAdminFileFromStorage.mockResolvedValue(undefined);
    mockAdminFirestore.update.mockResolvedValue(undefined);

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_CSV_PATH);
    // Check it was called only once (for CSV, not for MDX)
    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledTimes(1);
    expect(mockAdminFirestore.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'deleted' })
    );
  });

  it('should update status to "error" if CSV deletion fails', async () => {
    const change = createChangeObject(
      {
        status: 'reviewing_report',
        powerQualityDataUrl: MOCK_CSV_PATH,
        mdxReportStoragePath: MOCK_MDX_PATH,
      },
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
    expect(mockAdminFirestore.update).toHaveBeenCalledWith({
      status: 'error',
      errorMessage: expect.stringContaining(
        `Falha no processo de exclusão (Func): ${deletionError.message}`
      ),
    });
  });

  it('should update status to "error" if MDX deletion fails', async () => {
    const change = createChangeObject(
      {
        status: 'completed',
        powerQualityDataUrl: MOCK_CSV_PATH,
        mdxReportStoragePath: MOCK_MDX_PATH,
      },
      {
        status: 'pending_deletion',
        powerQualityDataUrl: MOCK_CSV_PATH,
        mdxReportStoragePath: MOCK_MDX_PATH,
      }
    );
    const deletionError = new Error('Storage MDX deletion failed');
    mockDeleteAdminFileFromStorage.mockImplementation(async (filePath) => {
      if (filePath === MOCK_CSV_PATH) return undefined; // CSV deletion succeeds
      if (filePath === MOCK_MDX_PATH) throw deletionError;
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
      {
        status: 'completed',
        powerQualityDataUrl: MOCK_CSV_PATH,
        mdxReportStoragePath: MOCK_MDX_PATH,
      },
      {
        status: 'pending_deletion',
        powerQualityDataUrl: MOCK_CSV_PATH,
        mdxReportStoragePath: MOCK_MDX_PATH,
      }
    );
    mockDeleteAdminFileFromStorage.mockResolvedValue(undefined);
    const firestoreUpdateError = new Error('Firestore final update failed');

    mockAdminFirestore.update.mockImplementation(async (payload) => {
      if (payload.status === 'deleted') {
        throw firestoreUpdateError;
      }
      if (payload.status === 'error') {
        throw new Error('Secondary Firestore update to error status also failed');
      }
      return undefined;
    });

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledTimes(2);
    expect(mockAdminFirestore.update).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `[Func_handleDeletion] CRITICAL: Failed to update Firestore with error state for ${MOCK_ANALYSIS_ID} after deletion failure:`
      ),
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });
});
