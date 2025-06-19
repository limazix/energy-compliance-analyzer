/**
 * @fileoverview Global test lifecycle hooks (beforeEach, afterEach) and console mocks.
 */
import { act } from '@testing-library/react';
import { User } from 'firebase/auth';

import type { AnalyzeComplianceReportOutput } from '@/ai/prompt-configs/analyze-compliance-report-prompt-config';
import type { Analysis } from '@/types/analysis'; // Assuming Analysis type is correctly defined

import { mockHttpsCallableStore } from './firebase-functions.setup'; // Import the store for clearing
import {
  mockRouterPush,
  mockRouterReplace,
  mockUseParams,
  mockUsePathname,
  mockUseSearchParams,
} from './next-navigation.setup';
import { mockToastFn } from './ui-components.setup';

import type {
  MockAnalysisManagerReturnValue,
  MockFileUploadManagerReturnValue,
} from './custom-hooks.setup'; // Ensure this is correctly typed
import type { FirebaseFunctionsMock } from './firebase-functions.setup'; // Corrected import name
import type { FirebaseDatabaseMock } from './firebase-rtdb.setup';
import type { FirebaseStorageMock } from './firebase-storage.setup';
import type { HttpsCallableResult } from 'firebase/functions';

// --- Global Console Mocking ---
// Store original console.error
const originalConsoleError = console.error;
// Mock console.error to suppress specific known "expected" errors during tests if necessary
// or to assert that it was called.
globalThis.console.error = jest.fn((...args: unknown[]) => {
  // Example: Suppress specific React warnings if they are noisy and expected
  // if (typeof args[0] === 'string' && args[0].includes('Warning: ReactDOM.render is no longer supported in React 18')) {
  //   return;
  // }
  // By default, don't call originalConsoleError to keep test output clean.
  originalConsoleError(...args); // Uncomment to see original errors during debugging
});
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
    if ((globalThis as unknown as { [key: string]: unknown }).mockUseAnalysisManagerReturnValue) {
      const manager = (
        globalThis as unknown as {
          [key: string]: MockAnalysisManagerReturnValue;
        }
      ).mockUseAnalysisManagerReturnValue;
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
      manager.handleDeleteAnalysis
        .mockClear()
        .mockImplementation(async (_id: string, cb?: () => void | Promise<void>) => {
          if (cb && typeof cb === 'function') {
            await cb(); // Ensure async callback is awaited
          }
          return Promise.resolve();
        });
      manager.handleCancelAnalysis.mockClear().mockResolvedValue(undefined);
      manager.handleRetryAnalysis.mockClear().mockResolvedValue(undefined);
      manager.downloadReportAsTxt.mockClear();
    }

    if ((globalThis as unknown as { [key: string]: unknown }).mockUseFileUploadManagerReturnValue) {
      const uploader = (
        globalThis as unknown as {
          [key: string]: MockFileUploadManagerReturnValue;
        }
      ).mockUseFileUploadManagerReturnValue;
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
      mockFn.mockImplementation(
        (
          _data: unknown // Changed from { fileName: string } to any
        ) =>
          Promise.resolve({
            data: {
              analysisId: `mock-analysis-id-for-${
                (_data as { fileName: string })?.fileName || 'unknown'
              }`,
            },
          } as HttpsCallableResult<{ analysisId: string }>)
      );
    } else if (key === 'httpsUpdateAnalysisUploadProgress' && mockFn) {
      mockFn.mockResolvedValue({
        data: { success: true },
      } as HttpsCallableResult<{ success: boolean }>);
    } else if (key === 'notifyFileUploadCompleteAction' && mockFn) {
      mockFn.mockResolvedValue({
        data: { success: true },
      } as HttpsCallableResult<{ success: boolean }>);
    } else if (key === 'httpsMarkUploadAsFailed' && mockFn) {
      mockFn.mockResolvedValue({
        data: { success: true },
      } as HttpsCallableResult<{ success: boolean }>);
    } else if (key === 'httpsCallableAskOrchestrator' && mockFn) {
      mockFn.mockResolvedValue({
        data: {
          success: true,
          aiMessageRtdbKey: 'mock-ai-key-default-callable-cleared',
          reportModified: false,
        },
      } as HttpsCallableResult<{
        success: boolean;
        aiMessageRtdbKey: string;
        reportModified: boolean;
      }>);
    } else if (key === 'httpsCallableAddTag' && mockFn) {
      mockFn.mockResolvedValue({
        data: { success: true, message: 'Tag added (mock callable)' },
      } as HttpsCallableResult<{ success: boolean; message: string }>);
    } else if (key === 'httpsCallableRemoveTag' && mockFn) {
      mockFn.mockResolvedValue({
        data: { success: true, message: 'Tag removed (mock callable)' },
      } as HttpsCallableResult<{ success: boolean; message: string }>);
    } else if (key === 'httpsCallableGetPastAnalyses' && mockFn) {
      mockFn.mockResolvedValue({
        data: { analyses: [] },
      } as HttpsCallableResult<{ analyses: Analysis[] }>);
    } else if (key === 'httpsCallableCancelAnalysis' && mockFn) {
      mockFn.mockResolvedValue({
        data: { success: true, message: 'Cancelled (mock callable)' },
      } as HttpsCallableResult<unknown>);
    } else if (key === 'httpsCallableTriggerProcessing' && mockFn) {
      mockFn.mockResolvedValue({
        data: { success: true, analysisId: 'mock-analysis-id-triggered' },
      } as HttpsCallableResult<{ success: boolean; analysisId: string }>);
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
              subtitle: 'Mock Subtitle',
            },
            tableOfContents: [],
            introduction: {
              objective: 'Mock Objective',
              overallResultsSummary: 'Mock Summary',
              usedNormsOverview: 'Mock Norms',
            },
            analysisSections: [],
            finalConsiderations: 'Mock Considerations',
            bibliography: [],
          },
        },
      } as HttpsCallableResult<{
        mdxContent: string;
        fileName: string;
        analysisId: string;
        error: null;
        structuredReport: AnalyzeComplianceReportOutput;
      }>);
    } else if (mockFn) {
      // Default for other functions if not specifically handled
      mockFn.mockResolvedValue({
        data: { success: true, message: `Default mock for ${key} cleared` },
      } as HttpsCallableResult<{ success: boolean; message: string }>);
    }
  });

  // Clear Firebase Auth State
  (globalThis as unknown as { [key: string]: unknown }).mockFirebaseAuthUserForListener = null;
  if ((globalThis as unknown as { [key: string]: unknown }).authStateListenerCallback) {
    act(() => {
      if ((globalThis as unknown as { [key: string]: unknown }).authStateListenerCallback) {
        // Double check due to potential async nature
        (
          globalThis as unknown as {
            [key: string]: (user: User | null) => void;
          }
        ).authStateListenerCallback(null);
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
  (globalThis as unknown as { [key: string]: unknown }).authStateListenerCallback = null; // Reset auth listener callback
});
