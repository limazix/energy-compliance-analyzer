// @ts-check
'use strict';

/**
 * @fileOverview Test suite for the handleAnalysisDeletionRequest Firestore-triggered Firebase Function.
 */

import admin from 'firebase-admin';
import functionsTest from 'firebase-functions-test';

import { handleAnalysisDeletionRequest } from '../../../../functions/src/analysis-management/onDeleteTrigger.js';
import { deleteAdminFileFromStorage as originalDeleteAdminFileFromStorage } from '../../../../functions/src/utils/storage.js';

// Define mocks for Firestore methods at a higher scope
const mockFirestoreDocUpdate = jest.fn();
const mockFirestoreDocGet = jest.fn(); // Not directly used by SUT but good for completeness
const currentFirestoreDocRefMethods = {
  // Renamed to avoid conflict
  update: mockFirestoreDocUpdate,
  get: mockFirestoreDocGet,
};

const mockFirestoreServiceInstance = {
  doc: jest.fn(() => currentFirestoreDocRefMethods), // doc() returns the object with update/get
  collection: jest.fn().mockReturnThis(), // For chaining if needed
  // snapshot_ will be assigned directly to firebase-functions-test
};

const firestoreFactoryMock = jest.fn(() => mockFirestoreServiceInstance);

// Mock firebase-admin
jest.mock('firebase-admin', () => {
  const actualAdmin = jest.requireActual('firebase-admin'); // For Timestamp, FieldValue

  const mockAppsArray = [];
  const mockAppDelete = jest.fn(() => Promise.resolve());

  const createMockApp = (name) => ({
    name,
    firestore: firestoreFactoryMock, // Use the factory mock
    storage: () => ({ bucket: jest.fn(() => ({ file: jest.fn() })) }), // Simplified storage mock
    delete: mockAppDelete,
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
      mockAppsArray.push(app);
    }
    return app;
  });

  if (mockAppsArray.length === 0) {
    mockInitializeApp(); // Ensure a default app is 'initialized'
  }

  // Assign static properties to the factory mock itself
  Object.assign(firestoreFactoryMock, {
    Timestamp: actualAdmin.firestore.Timestamp,
    FieldValue: {
      serverTimestamp: jest.fn(() => 'MOCK_SERVER_TIMESTAMP'), // Return a placeholder
      arrayUnion: jest.fn((...args) => ({ _methodName: 'arrayUnion', _elements: args })),
      arrayRemove: jest.fn((...args) => ({ _methodName: 'arrayRemove', _elements: args })),
      delete: jest.fn(() => ({ _methodName: 'delete' })),
      increment: jest.fn((n) => ({ _methodName: 'increment', _operand: n })),
    },
  });

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
          appInstance = mockInitializeApp();
        } else {
          throw new Error(
            `Firebase app "${name}" does not exist. Ensure admin.initializeApp() is called or mocked for this app name.`
          );
        }
      }
      return appInstance;
    }),
    firestore: firestoreFactoryMock,
    storage: jest.fn().mockReturnValue({ bucket: jest.fn(() => ({ file: jest.fn() })) }), // Simplified
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
jest.mock('../../../../functions/src/utils/storage.js', () => ({
  deleteAdminFileFromStorage: jest.fn(),
}));
const mockDeleteAdminFileFromStorage = originalDeleteAdminFileFromStorage;

const MOCK_USER_ID = 'test-user-ondelete';
const MOCK_ANALYSIS_ID = 'analysis-id-ondelete';
const MOCK_CSV_PATH = `user_uploads/${MOCK_USER_ID}/${MOCK_ANALYSIS_ID}/data.csv`;
const MOCK_MDX_PATH = `user_reports/${MOCK_USER_ID}/${MOCK_ANALYSIS_ID}/report.mdx`;

describe('handleAnalysisDeletionRequest Firestore Trigger', () => {
  let wrappedHandleAnalysisDeletionRequest;

  beforeEach(() => {
    // Reset the factory mock and its returned instance's method mocks
    firestoreFactoryMock.mockReset().mockImplementation(() => mockFirestoreServiceInstance);

    // Reset methods on the service instance (which is returned by the factory)
    mockFirestoreServiceInstance.doc
      .mockReset()
      .mockImplementation(() => currentFirestoreDocRefMethods); // Ensure doc() returns our specific doc ref mock
    mockFirestoreServiceInstance.collection.mockReset().mockReturnThis();

    // Reset methods on the specific document reference mock
    currentFirestoreDocRefMethods.update.mockReset();
    currentFirestoreDocRefMethods.get.mockReset();

    mockDeleteAdminFileFromStorage.mockReset();

    // Wrap the function for testing
    wrappedHandleAnalysisDeletionRequest = functionsTest.wrap(handleAnalysisDeletionRequest);
    functionsTest.mockConfig({ firebase: { projectId: 'test-project-ondelete' } }); // Minimal config
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
    expect(currentFirestoreDocRefMethods.update).not.toHaveBeenCalled();
  });

  it('should delete files and update status to "deleted" on success', async () => {
    const change = createChangeObject(
      {
        status: 'completed', // Before state
      },
      {
        // After state - this is what change.after.data() will return
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
      if (filePath === MOCK_CSV_PATH) return undefined; // CSV deletion succeeds
      if (filePath === MOCK_MDX_PATH) throw deletionError; // MDX deletion fails
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
    mockDeleteAdminFileFromStorage.mockResolvedValue(undefined); // Both file deletions succeed
    const firestoreUpdateError = new Error('Firestore final update failed');

    // First update to 'deleted' fails
    currentFirestoreDocRefMethods.update.mockImplementationOnce(async (payload) => {
      if (payload.status === 'deleted') {
        throw firestoreUpdateError;
      }
      return undefined;
    });
    // Second update (to 'error' status) also fails
    currentFirestoreDocRefMethods.update.mockImplementationOnce(async () => {
      throw new Error('Secondary Firestore update to error status also failed');
    });

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledTimes(2); // Both CSV and MDX
    expect(currentFirestoreDocRefMethods.update).toHaveBeenCalledTimes(2); // Attempted 'deleted', then attempted 'error'
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `[Func_handleDeletion] CRITICAL: Failed to update Firestore with error state for ${MOCK_ANALYSIS_ID} after deletion failure:`
      ),
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });
});
