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
  };
  // @ts-ignore
  const mockAppsArray = []; // Initialize as an empty array

  const mockInitializeApp = jest.fn((_config, appName) => {
    const name = appName || '[DEFAULT]';
    // @ts-ignore
    if (!mockAppsArray.find((app) => app.name === name)) {
      // @ts-ignore
      mockAppsArray.push({ name, firestore: () => mockFirestoreInstance });
    }
    return { name, firestore: () => mockFirestoreInstance }; // Return a mock app object
  });

  const mockApp = jest.fn((appName) => {
    const name = appName || '[DEFAULT]';
    // @ts-ignore
    const existingApp = mockAppsArray.find((app) => app.name === name);
    if (existingApp) {
      return existingApp;
    }
    // If app doesn't exist, simulate creating/returning one
    const newApp = { name, firestore: () => mockFirestoreInstance };
    // @ts-ignore
    mockAppsArray.push(newApp);
    return newApp;
  });

  return {
    initializeApp: mockInitializeApp,
    // @ts-ignore
    get apps() {
      return mockAppsArray;
    }, // Use a getter for apps
    app: mockApp,
    firestore: jest.fn(() => mockFirestoreInstance),
    // storage: jest.fn().mockReturnValue({ bucket: jest.fn() }), // Mock if directly used by the SUT
    credential: {
      // Mock admin.credential if initializeApp uses it
      cert: jest.fn(),
      applicationDefault: jest.fn(),
    },
  };
});

// Mock the storage utility function
const mockDeleteAdminFileFromStorage = jest.fn();
jest.mock('../utils/storage.js', () => ({
  deleteAdminFileFromStorage: mockDeleteAdminFileFromStorage,
  // getAdminFileContentFromStorage: jest.fn(), // Mock if it were also used
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
    // @ts-ignore
    mockAdminFirestore = admin.firestore();
    mockAdminFirestore.doc.mockClear();
    mockAdminFirestore.update.mockClear();
    mockDeleteAdminFileFromStorage.mockClear();
    // @ts-ignore
    admin.apps.length = 0; // Reset the apps array for each test
    // @ts-ignore
    if (admin.initializeApp.mockClear) {
      // @ts-ignore
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
    mockDeleteAdminFileFromStorage.mockResolvedValue(undefined); // Both calls succeed
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
      { status: 'error', mdxReportStoragePath: MOCK_MDX_PATH }, // No CSV path
      { status: 'pending_deletion', mdxReportStoragePath: MOCK_MDX_PATH }
    );
    mockDeleteAdminFileFromStorage.mockResolvedValue(undefined); // MDX deletion succeeds
    mockAdminFirestore.update.mockResolvedValue(undefined);

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).not.toHaveBeenCalledWith(MOCK_CSV_PATH); // Or expect it to be called with undefined/null if the logic was different
    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_MDX_PATH);
    expect(mockAdminFirestore.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'deleted' })
    );
  });

  it('should handle missing MDX path gracefully', async () => {
    const change = createChangeObject(
      { status: 'error', powerQualityDataUrl: MOCK_CSV_PATH }, // No MDX path
      { status: 'pending_deletion', powerQualityDataUrl: MOCK_CSV_PATH }
    );
    mockDeleteAdminFileFromStorage.mockResolvedValue(undefined); // CSV deletion succeeds
    mockAdminFirestore.update.mockResolvedValue(undefined);

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_CSV_PATH);
    expect(mockDeleteAdminFileFromStorage).not.toHaveBeenCalledWith(MOCK_MDX_PATH);
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
      return undefined; // MDX deletion would still "succeed" or not be called
    });
    mockAdminFirestore.update.mockResolvedValue(undefined); // Update to error status

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_CSV_PATH);
    // Depending on exact error handling, MDX might still be attempted or skipped
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
      if (filePath === MOCK_MDX_PATH) throw deletionError;
      return undefined; // CSV deletion succeeds
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
    mockDeleteAdminFileFromStorage.mockResolvedValue(undefined); // Files deleted
    const firestoreUpdateError = new Error('Firestore final update failed');
    // mockAdminFirestore.update.mockRejectedValueOnce(firestoreUpdateError); // First update (to 'deleted') fails

    // Simulate the first update (to 'deleted') failing, then the second update (to 'error') also failing
    mockAdminFirestore.update.mockImplementation(async (payload) => {
      if (payload.status === 'deleted') {
        throw firestoreUpdateError; // Simulate fail on 'deleted' status update
      }
      if (payload.status === 'error') {
        throw new Error('Secondary Firestore update to error status also failed');
      }
      return undefined;
    });

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledTimes(2); // Both CSV and MDX
    expect(mockAdminFirestore.update).toHaveBeenCalledTimes(2); // Attempt to set 'deleted', then attempt to set 'error'
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `[Func_handleDeletion] CRITICAL: Failed to update Firestore with error state for ${MOCK_ANALYSIS_ID} after deletion failure:`
      ),
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });
});
