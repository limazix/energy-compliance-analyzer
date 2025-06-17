'use strict';

/**
 * @fileOverview Test suite for the handleAnalysisDeletionRequest Firestore-triggered Firebase Function.
 */
import adminActual from 'firebase-admin';
import functionsTest from 'firebase-functions-test';

import { handleDeleteTrigger } from '../../../../functions/src/analysis-management/onDeleteTrigger.js'; // Correct relative path for SUT
import { APP_CONFIG } from '../../../../src/config/appConfig'; // Use @/ alias
import { deleteAdminFileFromStorage as originalDeleteAdminFileFromStorage } from '../../../../src/utils/storage'; // Use @/ alias

// --- Start of Pre-defined Mocks for firebase-admin ---
// DEFINE ALL MOCK COMPONENTS BEFORE jest.mock('firebase-admin')
const mockFirestoreDocUpdate_onDeleteTrigger = jest.fn();
const mockFirestoreDocGet_onDeleteTrigger = jest.fn();

const currentFirestoreDocRefMethods_onDeleteTrigger = {
  update: mockFirestoreDocUpdate_onDeleteTrigger,
  get: mockFirestoreDocGet_onDeleteTrigger,
};

const mockFirestoreCollectionRef_onDeleteTrigger = {
  doc: jest.fn(() => currentFirestoreDocRefMethods_onDeleteTrigger),
};

const mockFirestoreServiceInstance_onDeleteTrigger = {
  doc: jest.fn(() => currentFirestoreDocRefMethods_onDeleteTrigger),
  collection: jest.fn(() => mockFirestoreCollectionRef_onDeleteTrigger),
  snapshot_: jest.fn((data, docPath) => ({
    data: () => data,
    id: docPath.split('/').pop(),
    exists: data !== undefined,
    ref: {
      path: docPath,
      update: mockFirestoreDocUpdate_onDeleteTrigger,
      get: mockFirestoreDocGet_onDeleteTrigger,
    },
  })),
};

const firestoreFactoryMock_onDeleteTrigger = jest.fn(
  () => mockFirestoreServiceInstance_onDeleteTrigger
);
Object.assign(firestoreFactoryMock_onDeleteTrigger, {
  Timestamp: adminActual.firestore.Timestamp,
  FieldValue: {
    serverTimestamp: jest.fn(() => 'MOCK_SERVER_TIMESTAMP_onDeleteTrigger'),
    arrayUnion: jest.fn((...args) => ({ _methodName: 'arrayUnion', _elements: args })),
    arrayRemove: jest.fn((...args) => ({ _methodName: 'arrayRemove', _elements: args })),
    delete: jest.fn(() => ({ _methodName: 'delete' })),
    increment: jest.fn((n) => ({ _methodName: 'increment', _operand: n })),
  },
});
// --- End of Pre-defined Mocks ---

jest.mock('firebase-admin', () => {
  const mockAppsArrayInternal = [];
  const mockAppDeleteInternal = jest.fn(() => Promise.resolve());

  const createMockAppInternal = (name) => ({
    name,
    firestore: firestoreFactoryMock_onDeleteTrigger, // Use the factory mock defined above
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
    // @ts-expect-error - Test: Pubsub is not always available on App
    pubsub: jest.fn().mockReturnValue({ topic: jest.fn() }),
  });

  const mockInitializeAppInternal = jest.fn((_options, appNameParam) => {
    const name = appNameParam || '[DEFAULT]';
    let app = mockAppsArrayInternal.find((a) => a.name === name);
    if (!app) {
      app = createMockAppInternal(name);
      mockAppsArrayInternal.push(app);
    }
    return app;
  });

  if (mockAppsArrayInternal.length === 0) {
    mockInitializeAppInternal();
  }

  return {
    initializeApp: mockInitializeAppInternal,
    get apps() {
      return mockAppsArrayInternal;
    },
    app: jest.fn((appNameParam) => {
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
    firestore: firestoreFactoryMock_onDeleteTrigger,
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

jest.mock('../../../../src/utils/storage', () => ({
  // Use @/ alias
  deleteAdminFileFromStorage: jest.fn(),
}));
const mockDeleteAdminFileFromStorage = originalDeleteAdminFileFromStorage;

const MOCK_USER_ID = 'test-user-ondelete';
const MOCK_ANALYSIS_ID = 'analysis-id-ondelete';
const MOCK_CSV_PATH = `user_uploads/${MOCK_USER_ID}/${MOCK_ANALYSIS_ID}/data.csv`;
const MOCK_MDX_PATH = `user_reports/${MOCK_USER_ID}/${MOCK_ANALYSIS_ID}/report.mdx`;
const MAX_ERROR_MSG_LENGTH_FUNC = APP_CONFIG.MAX_SERVER_ERROR_MESSAGE_LENGTH;

describe('handleAnalysisDeletionRequest Firestore Trigger', () => {
  let wrappedHandleAnalysisDeletionRequest;
  let testInstance;

  beforeAll(() => {
    testInstance = functionsTest({
      projectId: 'test-project-ondelete',
    });
    testInstance.mockConfig({
      firebase: { projectId: 'test-project-ondelete' },
      // @ts-expect-error - Test: app_config is not a standard firebase config key
      app_config: APP_CONFIG,
    });
  });

  beforeEach(() => {
    mockFirestoreDocUpdate_onDeleteTrigger.mockReset();
    mockFirestoreDocGet_onDeleteTrigger.mockReset();
    firestoreFactoryMock_onDeleteTrigger.mockClear();
    mockFirestoreServiceInstance_onDeleteTrigger.doc
      .mockClear()
      .mockImplementation(() => currentFirestoreDocRefMethods_onDeleteTrigger);
    mockFirestoreServiceInstance_onDeleteTrigger.collection.mockClear();
    mockDeleteAdminFileFromStorage.mockReset();
    wrappedHandleAnalysisDeletionRequest = testInstance.wrap(
      handleDeleteTrigger // Use the exported name from SUT
    );
  });

  afterAll(() => {
    testInstance.cleanup();
  });

  const createChangeObject = (beforeData, afterData) => {
    const docPath = `users/${MOCK_USER_ID}/analyses/${MOCK_ANALYSIS_ID}`;
    const beforeSnap = mockFirestoreServiceInstance_onDeleteTrigger.snapshot_(beforeData, docPath);
    const afterSnap = mockFirestoreServiceInstance_onDeleteTrigger.snapshot_(afterData, docPath);
    return testInstance.makeChange(beforeSnap, afterSnap);
  };

  const context = {
    params: { userId: MOCK_USER_ID, analysisId: MOCK_ANALYSIS_ID },
  };

  it('should not run if status is not "pending_deletion"', async () => {
    const change = createChangeObject({ status: 'completed' }, { status: 'completed' });
    await wrappedHandleAnalysisDeletionRequest(change, context);
    expect(mockDeleteAdminFileFromStorage).not.toHaveBeenCalled();
    expect(currentFirestoreDocRefMethods_onDeleteTrigger.update).not.toHaveBeenCalled();
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
    currentFirestoreDocRefMethods_onDeleteTrigger.update.mockResolvedValue(undefined);

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_CSV_PATH);
    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_MDX_PATH);
    expect(currentFirestoreDocRefMethods_onDeleteTrigger.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'deleted',
        errorMessage: 'Análise e arquivos associados foram excluídos com sucesso.',
      })
    );
  });

  it('should handle missing CSV path gracefully', async () => {
    const change = createChangeObject(
      { status: 'error' },
      { status: 'pending_deletion', mdxReportStoragePath: MOCK_MDX_PATH }
    );
    mockDeleteAdminFileFromStorage.mockResolvedValue(undefined);
    currentFirestoreDocRefMethods_onDeleteTrigger.update.mockResolvedValue(undefined);

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).not.toHaveBeenCalledWith(MOCK_CSV_PATH);
    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_MDX_PATH);
    expect(currentFirestoreDocRefMethods_onDeleteTrigger.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'deleted' })
    );
  });

  it('should handle missing MDX path gracefully', async () => {
    const change = createChangeObject(
      { status: 'error' },
      { status: 'pending_deletion', powerQualityDataUrl: MOCK_CSV_PATH }
    );
    mockDeleteAdminFileFromStorage.mockResolvedValue(undefined);
    currentFirestoreDocRefMethods_onDeleteTrigger.update.mockResolvedValue(undefined);

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_CSV_PATH);
    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledTimes(1);
    expect(currentFirestoreDocRefMethods_onDeleteTrigger.update).toHaveBeenCalledWith(
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
    currentFirestoreDocRefMethods_onDeleteTrigger.update.mockResolvedValue(undefined);

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_CSV_PATH);
    expect(currentFirestoreDocRefMethods_onDeleteTrigger.update).toHaveBeenCalledWith({
      status: 'error',
      errorMessage: expect.stringContaining(
        `Falha no processo de exclusão (Func): ${deletionError.message.substring(0, MAX_ERROR_MSG_LENGTH_FUNC)}`
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
    currentFirestoreDocRefMethods_onDeleteTrigger.update.mockResolvedValue(undefined);

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_CSV_PATH);
    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledWith(MOCK_MDX_PATH);
    expect(currentFirestoreDocRefMethods_onDeleteTrigger.update).toHaveBeenCalledWith({
      status: 'error',
      errorMessage: expect.stringContaining(
        `Falha no processo de exclusão (Func): ${deletionError.message.substring(0, MAX_ERROR_MSG_LENGTH_FUNC)}`
      ),
    });
  });

  it('should log critical error if Firestore update fails after successful file deletions', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
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

    currentFirestoreDocRefMethods_onDeleteTrigger.update.mockImplementationOnce(async (payload) => {
      if (payload.status === 'deleted') {
        throw firestoreUpdateError;
      }
      return undefined;
    });
    currentFirestoreDocRefMethods_onDeleteTrigger.update.mockImplementationOnce(async () => {
      throw new Error('Secondary Firestore update to error status also failed');
    });

    await wrappedHandleAnalysisDeletionRequest(change, context);

    expect(mockDeleteAdminFileFromStorage).toHaveBeenCalledTimes(2);
    expect(currentFirestoreDocRefMethods_onDeleteTrigger.update).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `[Func_handleDeletion] CRITICAL: Failed to update Firestore with error state for ${MOCK_ANALYSIS_ID} after deletion failure:`
      ),
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });
});
