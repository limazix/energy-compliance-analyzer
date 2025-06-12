/**
 * @fileoverview Global test lifecycle hooks (beforeEach, afterEach) and console mocks.
 */
import { act } from '@testing-library/react';

// Import mock control functions/stores from their respective setup files
import { mockHttpsCallableStore, type FirebaseFunctionsMock } from './firebase-functions.setup';
import { type FirebaseDatabaseMock } from './firebase-rtdb.setup';
import { type FirebaseStorageMock } from './firebase-storage.setup';
import {
  mockRouterPush,
  mockRouterReplace,
  mockUsePathname,
  mockUseParams,
  mockUseSearchParams,
} from './next-navigation.setup';
import { mockToastFn } from './ui-components.setup';

import type {
  MockAnalysisManagerReturnValue,
  MockFileUploadManagerReturnValue,
} from './custom-hooks.setup';
import type { User } from 'firebase/auth';

// --- Global Console Mocking ---
if (
  typeof globalThis.console.error !== 'function' ||
  !(globalThis.console.error as jest.Mock).mockClear
) {
  // eslint-disable-next-line no-console
  const originalConsoleError = console.error; // Keep if needed for some specific cases
  globalThis.console.error = jest.fn((...args: unknown[]) => {
    // Optionally call original console.error if you want to see errors during tests
    // originalConsoleError(...args);
    // For now, we suppress to keep test output clean, but this can be changed for debugging.
    const _suppress = originalConsoleError; // to use if needed without lint error
    const _args = args; // to use if needed
  });
}
// --- End Global Console Mocking ---

beforeEach(() => {
  // Clear Next.js Navigation Mocks
  mockRouterPush.mockClear();
  mockRouterReplace.mockClear();
  mockUsePathname.mockClear();
  mockUseParams.mockClear();
  mockUseSearchParams.mockClear();

  // Clear UI Component Mocks
  mockToastFn.mockClear();

  // Clear Custom Hook Global Return Values
  act(() => {
    if (globalThis.mockUseAnalysisManagerReturnValue) {
      const manager =
        globalThis.mockUseAnalysisManagerReturnValue as MockAnalysisManagerReturnValue;
      manager.currentAnalysis = null;
      manager.pastAnalyses = [];
      manager.isLoadingPastAnalyses = false;
      manager.displayedAnalysisSteps = [];
      manager.tagInput = '';
      manager.setCurrentAnalysis.mockClear();
      manager.setTagInput.mockClear();
      manager.fetchPastAnalyses.mockClear().mockResolvedValue(undefined);
      manager.startAiProcessing.mockClear().mockResolvedValue(undefined);
      manager.handleAddTag.mockClear().mockResolvedValue(undefined);
      manager.handleRemoveTag.mockClear().mockResolvedValue(undefined);
      manager.handleDeleteAnalysis.mockClear().mockImplementation((_id, cb) => {
        cb?.();
        return Promise.resolve();
      });
      manager.handleCancelAnalysis.mockClear().mockResolvedValue(undefined);
      manager.downloadReportAsTxt.mockClear();
    }

    if (globalThis.mockUseFileUploadManagerReturnValue) {
      const uploader =
        globalThis.mockUseFileUploadManagerReturnValue as MockFileUploadManagerReturnValue;
      uploader.fileToUpload = null;
      uploader.isUploading = false;
      uploader.uploadProgress = 0;
      uploader.uploadError = null;
      uploader.handleFileSelection.mockClear();
      uploader.uploadFileAndCreateRecord.mockClear().mockResolvedValue({
        analysisId: 'mock-analysis-upload-id',
        fileName: 'mock-file.csv',
        error: null,
      });
    }
  });

  // Clear Firebase Functions Callable Mocks
  const callableMockModule = jest.requireMock('firebase/functions') as FirebaseFunctionsMock;
  const callableMockClearStore =
    callableMockModule.__mockHttpsCallableStore || mockHttpsCallableStore;
  Object.keys(callableMockClearStore).forEach((key: string) => {
    const mockFn = callableMockClearStore[key];
    if (mockFn && typeof mockFn.mockClear === 'function') {
      mockFn.mockClear();
    }
    // Reset to default implementation for common functions
    if (key === 'httpsCreateInitialAnalysisRecord' && mockFn) {
      mockFn.mockImplementation((data: { fileName: string }) =>
        Promise.resolve({ data: { analysisId: `mock-analysis-id-for-${data.fileName}` } })
      );
    } else if (key === 'httpsUpdateAnalysisUploadProgress' && mockFn) {
      mockFn.mockResolvedValue({ data: { success: true } });
    } else if (key === 'httpsFinalizeFileUploadRecord' && mockFn) {
      mockFn.mockResolvedValue({ data: { success: true } });
    } else if (key === 'httpsMarkUploadAsFailed' && mockFn) {
      mockFn.mockResolvedValue({ data: { success: true } });
    } else if (key === 'httpsCallableAskOrchestrator' && mockFn) {
      mockFn.mockResolvedValue({
        data: {
          success: true,
          aiMessageRtdbKey: 'mock-ai-key-default-callable-cleared',
          reportModified: false,
        },
      });
    } else if (key === 'httpsCallableAddTag' && mockFn) {
      mockFn.mockResolvedValue({ data: { success: true, message: 'Tag added (mock callable)' } });
    } else if (key === 'httpsCallableRemoveTag' && mockFn) {
      mockFn.mockResolvedValue({ data: { success: true, message: 'Tag removed (mock callable)' } });
    } else if (key === 'httpsCallableGetPastAnalyses' && mockFn) {
      mockFn.mockResolvedValue({ data: { analyses: [] } });
    } else if (key === 'httpsCallableDeleteAnalysis' && mockFn) {
      mockFn.mockResolvedValue({ data: { success: true, message: 'Deleted (mock callable)' } });
    } else if (key === 'httpsCallableCancelAnalysis' && mockFn) {
      mockFn.mockResolvedValue({ data: { success: true, message: 'Cancelled (mock callable)' } });
    } else if (key === 'httpsCallableTriggerProcessing' && mockFn) {
      mockFn.mockResolvedValue({
        data: { success: true, analysisId: 'mock-analysis-id-triggered' },
      });
    } else if (key === 'httpsCallableGetAnalysisReport' && mockFn) {
      mockFn.mockResolvedValue({
        data: {
          mdxContent: '# Mock Report Callable Default',
          fileName: 'mock-report-callable-default.csv',
          analysisId: 'default-mock-analysis-id-callable',
          error: null,
          structuredReport: {
            reportMetadata: {
              title: 'Mock Default Title Callable',
              author: 'Test',
              generatedDate: '2023-01-01',
            },
            tableOfContents: [],
            introduction: { objective: '', overallResultsSummary: '', usedNormsOverview: '' },
            analysisSections: [],
            finalConsiderations: '',
            bibliography: [],
          },
        },
      });
    } else if (mockFn) {
      // Default for other functions if not specifically handled
      mockFn.mockResolvedValue({
        data: { success: true, message: `Default mock for ${key} cleared` },
      });
    }
  });

  // Clear Firebase Auth State
  globalThis.mockFirebaseAuthUserForListener = null;
  if (globalThis.authStateListenerCallback) {
    act(() => {
      if (globalThis.authStateListenerCallback) {
        // Double check due to potential async nature
        globalThis.authStateListenerCallback(null);
      }
    });
  }

  // Clear Firebase Storage Mocks
  const storageMockModule = jest.requireMock('firebase/storage') as FirebaseStorageMock;
  if (storageMockModule.__mockRef) storageMockModule.__mockRef.mockClear();
  if (storageMockModule.__mockUploadBytesResumable) {
    storageMockModule.__mockUploadBytesResumable
      .mockClear()
      .mockReturnValue(storageMockModule.__mockUploadTask);
  }
  if (storageMockModule.__mockGetDownloadURL) {
    storageMockModule.__mockGetDownloadURL
      .mockClear()
      .mockResolvedValue('https://fake.storage.googleapis.com/mock/path/to/default.csv');
  }
  if (storageMockModule.__mockUploadTask?.on) storageMockModule.__mockUploadTask.on.mockClear();

  // Clear Firebase RTDB Mocks
  const firebaseDbMockModule = jest.requireMock('firebase/database') as FirebaseDatabaseMock;
  firebaseDbMockModule.__mockGetDatabase.mockClear();
  firebaseDbMockModule.__mockRef.mockClear();
  firebaseDbMockModule.__mockOnValue.mockClear();
  firebaseDbMockModule.__mockPush.mockClear();
  firebaseDbMockModule.__mockUpdate.mockClear();
  firebaseDbMockModule.__mockServerTimestamp.mockClear();
  firebaseDbMockModule.__mockOff.mockClear();
  firebaseDbMockModule.__mockChild.mockClear();

  // Clear global console error mock calls for the next test
  const consoleErrorMock = globalThis.console.error as jest.Mock;
  if (consoleErrorMock?.mockClear) {
    consoleErrorMock.mockClear();
  }
});

afterEach(() => {
  jest.clearAllMocks(); // Standard Jest clear
  globalThis.authStateListenerCallback = null; // Reset auth listener callback
});

// Helper to mock useAuth for specific tests if needed, though global mock is primary
export const mockAuthContext = (
  user: User | null,
  loading = false
): typeof import('@/contexts/auth-context') => {
  const useAuthActual =
    jest.requireActual<typeof import('@/contexts/auth-context')>('@/contexts/auth-context');
  jest.spyOn(useAuthActual, 'useAuth').mockReturnValue({ user, loading });
  return useAuthActual;
};
