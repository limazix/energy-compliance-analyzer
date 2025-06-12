/**
 * @fileoverview Mocks for custom application hooks (useAnalysisManager, useFileUploadManager).
 * This file also defines the global mock objects and their types.
 */
import { act } from '@testing-library/react';

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
  fetchPastAnalyses: jest.Mock<Promise<void>, []>; // Explicitly type as taking no arguments
  startAiProcessing: jest.Mock<Promise<void>, [string, string]>;
  handleAddTag: jest.Mock<Promise<void>, [string, string]>;
  handleRemoveTag: jest.Mock<Promise<void>, [string, string]>;
  handleDeleteAnalysis: jest.Mock<Promise<void>, [string, (() => void) | undefined]>;
  handleCancelAnalysis: jest.Mock<Promise<void>, [string]>;
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
    [User | null, string | undefined, string | undefined, string | undefined] // User can be null
  >;
}

// Augment globalThis to declare these properties
declare global {
  // eslint-disable-next-line no-var
  var mockUseAnalysisManagerReturnValue: MockAnalysisManagerReturnValue;
  // eslint-disable-next-line no-var
  var mockUseFileUploadManagerReturnValue: MockFileUploadManagerReturnValue;
}
// --- End TypeScript Global Augmentation ---

// Initialize global mock state objects
globalThis.mockUseAnalysisManagerReturnValue = {
  currentAnalysis: null,
  setCurrentAnalysis: jest.fn((newAnalysis: Analysis | null): void => {
    act(() => {
      globalThis.mockUseAnalysisManagerReturnValue.currentAnalysis = newAnalysis;
    });
  }),
  pastAnalyses: [],
  isLoadingPastAnalyses: false,
  tagInput: '',
  setTagInput: jest.fn(),
  fetchPastAnalyses: jest.fn(() => Promise.resolve()),
  startAiProcessing: jest.fn(() => Promise.resolve()),
  handleAddTag: jest.fn(() => Promise.resolve()),
  handleRemoveTag: jest.fn(() => Promise.resolve()),
  handleDeleteAnalysis: jest.fn((_id: string, cb?: () => void): Promise<void> => {
    cb?.();
    return Promise.resolve();
  }),
  handleCancelAnalysis: jest.fn(() => Promise.resolve()),
  downloadReportAsTxt: jest.fn(),
  displayedAnalysisSteps: [],
};

globalThis.mockUseFileUploadManagerReturnValue = {
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

// Mock useAnalysisManager
jest.mock('@/hooks/useAnalysisManager', () => ({
  useAnalysisManager: jest.fn(
    (): MockAnalysisManagerReturnValue => globalThis.mockUseAnalysisManagerReturnValue
  ),
}));

// Mock useFileUploadManager
jest.mock('@/features/file-upload/hooks/useFileUploadManager', () => ({
  useFileUploadManager: jest.fn(
    (): MockFileUploadManagerReturnValue => globalThis.mockUseFileUploadManagerReturnValue
  ),
}));
