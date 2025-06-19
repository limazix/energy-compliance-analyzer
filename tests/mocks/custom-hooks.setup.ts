/**
 * @fileoverview Mocks for custom application hooks (useAnalysisManager, useFileUploadManager).
 * This file also defines the global mock objects and their types.
 * The actual jest.mock calls for these hooks and mockAuthContext are moved to frontend-specific.setup.ts
 * to avoid issues with the backend test environment.
 */
import type { Analysis, AnalysisStep } from '@/types/analysis'; // Ensure this path is correct

import type { User } from 'firebase/auth';

// --- TypeScript Global Augmentation for custom properties on globalThis ---
export interface MockAnalysisManagerReturnValue {
  currentAnalysis: Analysis | null;
  setCurrentAnalysis: jest.Mock<void, [Analysis | null]>;
  pastAnalyses: Analysis[];
  isLoadingPastAnalyses: boolean;
  tagInput: string;
  setTagInput: jest.Mock<void, [string]>;
  fetchPastAnalyses: jest.Mock<Promise<void>, []>;
  startAiProcessing: jest.Mock<Promise<void>, [string, string]>;
  handleAddTag: jest.Mock<Promise<void>, [string, string]>;
  handleRemoveTag: jest.Mock<Promise<void>, [string, string]>;
  handleDeleteAnalysis: jest.Mock<
    Promise<void>,
    [string, (() => void | Promise<void>) | undefined]
  >;
  handleCancelAnalysis: jest.Mock<Promise<void>, [string]>;
  handleRetryAnalysis: jest.Mock<Promise<void>, [string]>;
  downloadReportAsTxt: jest.Mock<void, [Analysis | null]>;
  displayedAnalysisSteps: AnalysisStep[];
}

export interface MockFileUploadManagerReturnValue {
  fileToUpload: File | null;
  isUploading: boolean;
  uploadProgress: number;
  uploadError: string | null;
  handleFileSelection: jest.Mock<void, [React.ChangeEvent<HTMLInputElement> | File | null]>;
  uploadFileAndCreateRecord: jest.Mock<
    Promise<{
      analysisId: string | null;
      fileName: string | null;
      title?: string | null;
      description?: string | null;
      languageCode?: string | null;
      error?: string | null;
    }>,
    [User | null, string | undefined, string | undefined, string | undefined]
  >;
}

// Augment globalThis to declare these properties
declare global {
  // eslint-disable-next-line no-var
  var mockUseAnalysisManagerReturnValue: MockAnalysisManagerReturnValue;
  // eslint-disable-next-line no-var
  var mockUseFileUploadManagerReturnValue: MockFileUploadManagerReturnValue;
  // eslint-disable-next-line no-var
  var mockFirebaseAuthUserForListener: User | null;
  // eslint-disable-next-line no-var
  var authStateListenerCallback: ((user: User | null) => void) | null;
}
// --- End TypeScript Global Augmentation ---

// Initialize global mock state objects
// These initializations themselves are environment-agnostic.
// The jest.mock calls that *use* these are in frontend-specific.setup.ts.
(globalThis as unknown as { [key: string]: unknown }).mockUseAnalysisManagerReturnValue = {
  currentAnalysis: null,
  setCurrentAnalysis: jest.fn((newAnalysis: Analysis | null): void => {
    (
      globalThis as unknown as {
        [key: string]: MockAnalysisManagerReturnValue;
      }
    ).mockUseAnalysisManagerReturnValue.currentAnalysis = newAnalysis;
  }),
  pastAnalyses: [],
  isLoadingPastAnalyses: false,
  tagInput: '',
  setTagInput: jest.fn(),
  fetchPastAnalyses: jest.fn(() => Promise.resolve()),
  startAiProcessing: jest.fn(() => Promise.resolve()),
  handleAddTag: jest.fn(() => Promise.resolve()),
  handleRemoveTag: jest.fn(() => Promise.resolve()),
  handleDeleteAnalysis: jest.fn((_id: string, cb?: () => void | Promise<void>): Promise<void> => {
    if (cb && typeof cb === 'function') {
      return Promise.resolve(cb()).catch(() => undefined); // Ensure promise resolution even if cb throws
    }
    return Promise.resolve();
  }),
  handleCancelAnalysis: jest.fn(() => Promise.resolve()),
  handleRetryAnalysis: jest.fn(() => Promise.resolve()),
  downloadReportAsTxt: jest.fn(),
  displayedAnalysisSteps: [],
};

(globalThis as unknown as { [key: string]: unknown }).mockUseFileUploadManagerReturnValue = {
  fileToUpload: null,
  isUploading: false,
  uploadProgress: 0,
  uploadError: null,
  handleFileSelection: jest.fn(),
  uploadFileAndCreateRecord: jest.fn((_user, _title, _description, _languageCode) =>
    Promise.resolve({
      analysisId: 'mock-analysis-upload-id',
      fileName: 'mock-file.csv',
      error: null,
    })
  ),
};

// Initialize moved global auth mock properties
(globalThis as unknown as { [key: string]: unknown }).mockFirebaseAuthUserForListener = null;
(globalThis as unknown as { [key: string]: unknown }).authStateListenerCallback = null;

// The jest.mock calls for useAnalysisManager, useFileUploadManager, and the mockAuthContext function
// have been moved to tests/mocks/frontend-specific.setup.ts
