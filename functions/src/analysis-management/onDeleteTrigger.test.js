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
  const actualAdmin = jest.requireActual('firebase-admin'); // For Timestamp, FieldValue

  // Mock for the object returned by admin.firestore().doc('path')
  const mockFirestoreDocRefMethods = {
    update: jest.fn(),
    get: jest.fn(),
    // Add other document specific methods if your SUT uses them
  };

  // This is the "service instance" object returned by admin.firestore()
  // It needs .doc(), .collection(), and .snapshot_()
  const mockFirestoreServiceInstance = {
    doc: jest.fn(() => mockFirestoreDocRefMethods),
    collection: jest.fn().mockReturnThis(), // Or a more specific mock if needed
    snapshot_: jest.fn((path, data) => {
      const docPath = typeof path === 'string' ? path : 'mock/path';
      // Ensure data() returns the raw data object, and exists depends on data
      return {
        ref: { path: docPath },
        data: () => data,
        exists: !!data, // snapshot.exists should be true if data is provided, false if data is null/undefined
        id: docPath.split('/').pop() || 'mockId',
        createTime: actualAdmin.firestore.Timestamp.now(),
        updateTime: actualAdmin.firestore.Timestamp.now(),
        readTime: actualAdmin.firestore.Timestamp.now(),
      };
    }),
    // Add other service instance methods if needed by SUT (e.g., batch, runTransaction)
  };

  // admin.firestore should be a function that returns the service instance object (mockFirestoreServiceInstance)
  // AND has static properties like Timestamp.
  const firestoreFactoryMock = Object.assign(
    jest.fn(() => mockFirestoreServiceInstance),
    {
      Timestamp: actualAdmin.firestore.Timestamp,
      FieldValue: actualAdmin.firestore.FieldValue,
    }
  );

  const mockAppsArray = [];
  const mockAppDelete = jest.fn(() => Promise.resolve());

  const createMockApp = (name) => ({
    name,
    firestore: () => mockFirestoreServiceInstance, // Correct: app.firestore() returns the service instance directly
    storage: () => ({ bucket: jest.fn(() => ({ file: jest.fn() })) }),
    delete: mockAppDelete,
    // Mock other app services if needed by SUT
    auth: jest.fn(),
    database: jest.fn(),
    messaging: jest.fn(),
    pubsub: jest.fn(),
  });

  const mockInitializeApp = jest.fn((_config, appNameParam) => {
    const name = appNameParam || '[DEFAULT]';
    let app = mockAppsArray.find((a) => a.name === name);
    if (!app) {
      app = createMockApp(name);
      // @ts-ignore
      mockAppsArray.push(app);
    }
    return app;
  });

  // Ensure a default app is 'initialized' for functionsTest.cleanup()
  if (mockAppsArray.length === 0) {
    mockInitializeApp();
  }

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
          // if default app is requested and no apps exist, initialize default
          appInstance = mockInitializeApp();
        } else {
          // This case should ideally not be hit if initializeApp is called by default.
          // For safety, throw or return a newly created one if name is specific.
          // However, functionsTest typically relies on the default app.
          throw new Error(
            `Firebase app "${name}" does not exist. Ensure admin.initializeApp() is called or mocked for this app name.`
          );
        }
      }
      return appInstance;
    }),
    firestore: firestoreFactoryMock, // admin.firestore returns the factory
    storage: jest.fn().mockReturnValue({ bucket: jest.fn() }),
    auth: jest.fn(),
    database: jest.fn(),
    messaging: jest.fn(),
    pubsub: jest.fn(),
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
  let wrappedHandleAnalysisDeletionRequest;

  // To hold references to the actual mock instances for clearing
  let currentFirestoreServiceInstance;
  let currentFirestoreDocRefMethods;

  beforeEach(() => {
    // Reset admin app mocks
    // @ts-ignore
    admin.initializeApp.mockClear();
    // @ts-ignore
    if (admin.apps && Array.isArray(admin.apps)) {
      admin.apps.length = 0; // Reset the apps array
      // Re-initialize default app for cleanup
      // @ts-ignore
      if (admin.apps.length === 0) admin.initializeApp();
    }
    // @ts-ignore
    if (admin.app.mockClear) admin.app.mockClear();
    // @ts-ignore
    const appInstance = admin.app();
    // @ts-ignore
    if (appInstance && appInstance.delete && appInstance.delete.mockClear) {
      // @ts-ignore
      appInstance.delete.mockClear();
    }

    // Get the mock Firestore service instance and doc ref methods for resetting
    // admin.firestore is the factory, calling it gives the service instance
    currentFirestoreServiceInstance = admin.firestore(); // This is mockFirestoreServiceInstance from the mock factory

    // Clear methods on the service instance
    currentFirestoreServiceInstance.doc.mockClear();
    currentFirestoreServiceInstance.collection.mockClear();
    currentFirestoreServiceInstance.snapshot_.mockClear();

    // Get the object returned by .doc() to clear its methods
    currentFirestoreDocRefMethods = currentFirestoreServiceInstance.doc('any/path'); // Call to get the instance
    currentFirestoreDocRefMethods.update.mockClear();
    currentFirestoreDocRefMethods.get.mockClear();

    mockDeleteAdminFileFromStorage.mockClear();
    wrappedHandleAnalysisDeletionRequest = functionsTest.wrap(handleAnalysisDeletionRequest);
  });

  afterAll(() => {
    functionsTest.cleanup();
  });

  const createChangeObject = (beforeData, afterData) => {
    const docPath = `users/${MOCK_USER_ID}/analyses/${MOCK_ANALYSIS_ID}`;
    // makeDocumentSnapshot will use admin.firestore().snapshot_(path, data)
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
    expect(currentFirestoreDocRefMethods.update).not.toHaveBeenCalled();
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
    currentFirestoreDocRefMethods.update.mockResolvedValue(undefined);

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_CSV_PATH);
    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_MDX_PATH);
    expect(currentFirestoreDocRefMethods.update).toHaveBeenCalledWith(
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
    currentFirestoreDocRefMethods.update.mockResolvedValue(undefined);

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).not.toHaveBeenCalledWith(MOCK_CSV_PATH);
    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_MDX_PATH);
    expect(currentFirestoreDocRefMethods.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'deleted' })
    );
  });

  it('should handle missing MDX path gracefully', async () => {
    const change = createChangeObject(
      { status: 'error' },
      { status: 'pending_deletion', powerQualityDataUrl: MOCK_CSV_PATH } // No mdxReportStoragePath
    );
    mockDeleteAdminFileFromStorage.mockResolvedValue(undefined);
    currentFirestoreDocRefMethods.update.mockResolvedValue(undefined);

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_CSV_PATH);
    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledTimes(1);
    expect(currentFirestoreDocRefMethods.update).toHaveBeenCalledWith(
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
    currentFirestoreDocRefMethods.update.mockResolvedValue(undefined);

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_CSV_PATH);
    expect(currentFirestoreDocRefMethods.update).toHaveBeenCalledWith({
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
      if (filePath === MOCK_CSV_PATH) return undefined;
      if (filePath === MOCK_MDX_PATH) throw deletionError;
      return undefined;
    });
    currentFirestoreDocRefMethods.update.mockResolvedValue(undefined);

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_CSV_PATH);
    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_MDX_PATH);
    expect(currentFirestoreDocRefMethods.update).toHaveBeenCalledWith({
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
    mockDeleteAdminFileFromStorage.mockResolvedValue(undefined);
    const firestoreUpdateError = new Error('Firestore final update failed');

    currentFirestoreDocRefMethods.update.mockImplementationOnce(async (payload) => {
      if (payload.status === 'deleted') {
        throw firestoreUpdateError;
      }
      return undefined;
    });
    currentFirestoreDocRefMethods.update.mockImplementationOnce(async () => {
      throw new Error('Secondary Firestore update to error status also failed');
    });

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledTimes(2);
    expect(currentFirestoreDocRefMethods.update).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `[Func_handleDeletion] CRITICAL: Failed to update Firestore with error state for ${MOCK_ANALYSIS_ID} after deletion failure:`
      ),
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });
});
