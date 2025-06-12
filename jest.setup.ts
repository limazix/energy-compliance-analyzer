// jest.setup.ts
/**
 * @fileoverview Jest setup file.
 * This file is executed before each test suite. It's used to configure
 * or set up the testing environment, including mocking global objects,
 * Firebase SDKs, and other utilities to ensure tests run in a consistent
 * and isolated manner.
 */

import '@testing-library/jest-dom';

import React from 'react'; // Import React for createElement

import { act } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';

import type { Analysis, AnalysisStep } from '@/types/analysis'; // Ensure this path is correct

import type { User } from 'firebase/auth';
import type { DatabaseReference } from 'firebase/database';
import type { NextRouter } from 'next/router';

// Define types for the global mock values for better type safety
interface MockAnalysisManagerReturnValue {
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
  handleDeleteAnalysis: jest.Mock<Promise<void>, [string, (() => void) | undefined]>;
  handleCancelAnalysis: jest.Mock<Promise<void>, [string]>;
  downloadReportAsTxt: jest.Mock<void, [Analysis | null]>;
  displayedAnalysisSteps: AnalysisStep[];
}

interface MockFileUploadManagerReturnValue {
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
    [User, string | undefined, string | undefined, string | undefined]
  >;
}

// Extend the Global interface to include custom properties
declare global {
  // eslint-disable-next-line no-var
  var mockUseAnalysisManagerReturnValue: MockAnalysisManagerReturnValue;
  // eslint-disable-next-line no-var
  var mockUseFileUploadManagerReturnValue: MockFileUploadManagerReturnValue;
  // eslint-disable-next-line no-var
  var EMULATORS_CONNECTED: boolean;
  // eslint-disable-next-line no-var
  var mockFirebaseAuthUserForListener: User | null;
  // eslint-disable-next-line no-var
  var authStateListenerCallback: ((user: User | null) => void) | null;
}

global.mockFirebaseAuthUserForListener = null;
global.authStateListenerCallback = null;

// --- Firebase Auth Mock ---
interface FirebaseAuthMock {
  __setMockUserForAuthStateChangedListener: (user: User | null) => void;
  // Add other explicitly mocked auth functions if their signatures are needed
}

jest.mock('firebase/auth', () => {
  const actualFirebaseAuth = jest.requireActual('firebase/auth');

  const __setMockUserForAuthStateChangedListener = (user: User | null) => {
    global.mockFirebaseAuthUserForListener = user;
    if (global.authStateListenerCallback) {
      act(() => {
        if (global.authStateListenerCallback) {
          global.authStateListenerCallback(global.mockFirebaseAuthUserForListener);
        }
      });
    }
  };

  return {
    ...actualFirebaseAuth,
    onAuthStateChanged: jest.fn((_authInstance, listener: (user: User | null) => void) => {
      global.authStateListenerCallback = listener;
      act(() => {
        if (global.authStateListenerCallback) {
          global.authStateListenerCallback(global.mockFirebaseAuthUserForListener);
        }
      });
      return jest.fn(); // Return unsubscribe function
    }),
    signInWithPopup: jest.fn(),
    signOut: jest.fn(),
    __setMockUserForAuthStateChangedListener,
  };
});
// --- End Firebase Auth Mock ---

// --- Firebase Storage Mock ---
interface FirebaseStorageMock {
  ref: jest.Mock;
  uploadBytesResumable: jest.Mock;
  getDownloadURL: jest.Mock;
  __mockRef: jest.Mock;
  __mockUploadBytesResumable: jest.Mock;
  __mockGetDownloadURL: jest.Mock;
  __mockUploadTask_on: jest.Mock;
  __mockUploadTask_snapshot: Record<string, unknown>; // General snapshot structure
}

jest.mock('firebase/storage', () => {
  const actualStorage = jest.requireActual('firebase/storage');

  const mockUploadTaskOn = jest.fn(
    (
      event: string,
      progressCb?: (snapshot: Record<string, unknown>) => void, // Simplified snapshot type
      _errorCb?: (error: Error) => void,
      completeCb?: (snapshot: Record<string, unknown>) => void // Simplified snapshot type
    ) => {
      const snapshotRef = {
        toString: () => 'gs://fake-bucket/mock/path/to/file.csv',
        name: 'file.csv',
      };
      const progressSnapshot = {
        bytesTransferred: 50,
        totalBytes: 100,
        state: 'running',
        ref: snapshotRef,
      };
      const completeSnapshot = {
        bytesTransferred: 100,
        totalBytes: 100,
        state: 'success',
        ref: snapshotRef,
        metadata: { fullPath: 'mock/path/to/file.csv' },
        task: null,
      };

      if (event === 'state_changed' && progressCb) {
        act(() => progressCb({ ...progressSnapshot, bytesTransferred: 0 }));
        act(() => progressCb(progressSnapshot));
        act(() => progressCb({ ...progressSnapshot, bytesTransferred: 100 }));
      }
      if (event === 'state_changed' && completeCb) {
        Promise.resolve().then(() => act(() => completeCb(completeSnapshot)));
      }
      return jest.fn(); // Return an unsubscribe function
    }
  );

  const mockUploadTask = {
    on: mockUploadTaskOn,
    snapshot: {
      ref: { toString: () => 'gs://fake-bucket/mock/path/to/file.csv', name: 'file.csv' },
      bytesTransferred: 100,
      totalBytes: 100,
      state: 'success',
      metadata: { fullPath: 'mock/path/to/file.csv' },
      task: null,
    },
    pause: jest.fn(),
    resume: jest.fn(),
    cancel: jest.fn(),
    then: jest.fn((onFulfilled) => Promise.resolve(onFulfilled(mockUploadTask.snapshot))),
    catch: jest.fn(() => Promise.resolve()),
  };

  const refMock = jest.fn((_storageInstance, path?: string) => ({
    toString: () => `gs://fake-bucket/${path || 'undefined_path'}`,
    bucket: 'fake-bucket',
    fullPath: path || 'undefined_path',
    name: path ? path.substring(path.lastIndexOf('/') + 1) : 'undefined_filename',
    parent: null,
    root: null,
  }));

  const getDownloadURLMock = jest.fn((ref: { bucket: string; fullPath: string }) =>
    Promise.resolve(`https://fake.storage.googleapis.com/${ref.bucket}/${ref.fullPath}`)
  );
  const uploadBytesResumableMock = jest.fn(() => mockUploadTask);

  return {
    ...actualStorage,
    ref: refMock,
    uploadBytesResumable: uploadBytesResumableMock,
    getDownloadURL: getDownloadURLMock,
    __mockRef: refMock,
    __mockUploadBytesResumable: uploadBytesResumableMock,
    __mockGetDownloadURL: getDownloadURLMock,
    __mockUploadTask_on: mockUploadTask.on,
    __mockUploadTask_snapshot: mockUploadTask.snapshot,
  };
});
// --- End Firebase Storage Mock ---

// --- Firebase Functions Mock ---
const mockHttpsCallableStore: Record<string, jest.Mock> = {};
interface FirebaseFunctionsMock {
  getFunctions: jest.Mock;
  httpsCallable: jest.Mock;
  connectFunctionsEmulator: jest.Mock;
  __mockHttpsCallableGlobal: Record<string, jest.Mock>;
}

jest.mock('firebase/functions', (): FirebaseFunctionsMock => {
  const actualFunctions = jest.requireActual('firebase/functions');
  return {
    ...actualFunctions,
    getFunctions: jest.fn(() => ({})),
    httpsCallable: jest.fn((_functionsInstance, functionName: string) => {
      if (!mockHttpsCallableStore[functionName]) {
        mockHttpsCallableStore[functionName] = jest.fn(() =>
          Promise.resolve({ data: { success: true, message: `Default mock for ${functionName}` } })
        );
      }
      return mockHttpsCallableStore[functionName];
    }),
    connectFunctionsEmulator: jest.fn(),
    __mockHttpsCallableGlobal: mockHttpsCallableStore,
  };
});
// --- End Firebase Functions Mock ---

// --- Firebase Database (RTDB) Mock ---
interface MockRTDBMessage {
  id?: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: number | object;
  isError?: boolean;
}
interface FirebaseDatabaseMock {
  getDatabase: jest.Mock;
  ref: jest.Mock<DatabaseReference, [unknown, string?]>; // unknown for db instance
  onValue: jest.Mock<
    () => void,
    [
      DatabaseReference,
      (snapshot: {
        exists: () => boolean;
        val: () => Record<string, MockRTDBMessage> | null;
      }) => void,
    ]
  >;
  push: jest.Mock<Promise<{ key: string | null }>, [DatabaseReference, Partial<MockRTDBMessage>]>;
  update: jest.Mock<Promise<void>, [DatabaseReference, Partial<MockRTDBMessage>]>;
  serverTimestamp: jest.Mock<object, []>;
  off: jest.Mock<void, [DatabaseReference]>;
  child: jest.Mock<DatabaseReference, [DatabaseReference, string]>;
  __mockGetDatabase: jest.Mock;
  __mockRef: jest.Mock;
  __mockOnValue: jest.Mock;
  __mockPush: jest.Mock;
  __mockUpdate: jest.Mock;
  __mockServerTimestamp: jest.Mock;
  __mockOff: jest.Mock;
  __mockChild: jest.Mock;
}

jest.mock('firebase/database', (): FirebaseDatabaseMock => {
  const actualFirebaseDatabase = jest.requireActual('firebase/database');

  const _getDatabase = jest.fn(() => ({}));
  const _ref = jest.fn(
    (_db, path?) =>
      ({
        path,
        key: path?.split('/').pop() || null,
        toString: () => path || '',
      }) as unknown as DatabaseReference
  );
  const _onValue = jest.fn();
  const _push = jest.fn();
  const _update = jest.fn();
  const _serverTimestamp = jest.fn(() => actualFirebaseDatabase.serverTimestamp());
  const _off = jest.fn();
  const _child = jest.fn(
    (parentRef, childPath) =>
      ({
        ...parentRef,
        path: `${(parentRef as { path: string }).path}/${childPath}`,
        key: childPath,
        toString: () => `${(parentRef as { path: string }).path}/${childPath}`,
      }) as unknown as DatabaseReference
  );

  return {
    ...actualFirebaseDatabase,
    getDatabase: _getDatabase,
    ref: _ref,
    onValue: _onValue,
    push: _push,
    update: _update,
    serverTimestamp: _serverTimestamp,
    off: _off,
    child: _child,
    __mockGetDatabase: _getDatabase,
    __mockRef: _ref,
    __mockOnValue: _onValue,
    __mockPush: _push,
    __mockUpdate: _update,
    __mockServerTimestamp: _serverTimestamp,
    __mockOff: _off,
    __mockChild: _child,
  };
});
// --- End Firebase Database Mock ---

// Mock Next.js router
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: (): Partial<NextRouter> => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    back: jest.fn(),
    prefetch: jest.fn(),
    pathname: '/',
    route: '/',
    query: {},
    asPath: '/',
  }),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  useParams: jest.fn(() => ({})),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => {
  const icons: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {};
  const handler = {
    get: (_target: object, prop: string | symbol): React.FC<React.SVGProps<SVGSVGElement>> => {
      if (prop === '__esModule') return true as unknown as React.FC<React.SVGProps<SVGSVGElement>>; // satisfy TS
      const MockLucideIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
        const { children, ...restProps } = props || {};
        return React.createElement(
          'svg',
          { 'data-lucide-mock': String(prop), ...restProps },
          children
        );
      };
      MockLucideIcon.displayName = `LucideMock(${String(prop)})`;
      return MockLucideIcon;
    },
  };
  return new Proxy(icons, handler);
});

// Mock useToast
const mockToastFn = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToastFn,
  }),
}));

// Mock next-mdx-remote/rsc
jest.mock('next-mdx-remote/rsc', () => ({
  MDXRemote: jest.fn((props: { source: string | object }) => {
    let content = '';
    if (typeof props.source === 'string') {
      content = props.source;
    } else if (props.source && typeof props.source === 'object') {
      content = JSON.stringify(props.source);
    }
    return React.createElement('div', { 'data-testid': 'mock-mdx-remote' }, content);
  }),
}));

// Mock remark plugins
jest.mock('remark-gfm', () => jest.fn());
jest.mock('remark-mermaidjs', () => jest.fn());

// Initialize global mock state objects
global.mockUseAnalysisManagerReturnValue = {
  currentAnalysis: null,
  setCurrentAnalysis: jest.fn((newAnalysis) => {
    act(() => {
      global.mockUseAnalysisManagerReturnValue.currentAnalysis = newAnalysis;
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
  handleDeleteAnalysis: jest.fn((_id, cb) => {
    cb?.();
    return Promise.resolve();
  }),
  handleCancelAnalysis: jest.fn(() => Promise.resolve()),
  downloadReportAsTxt: jest.fn(),
  displayedAnalysisSteps: [],
};

global.mockUseFileUploadManagerReturnValue = {
  fileToUpload: null,
  isUploading: false,
  uploadProgress: 0,
  uploadError: null,
  handleFileSelection: jest.fn(),
  uploadFileAndCreateRecord: jest.fn(() =>
    Promise.resolve({
      analysisId: 'mock-analysis-upload-id',
      fileName: 'mock-file.csv',
      error: null,
    })
  ),
};

jest.mock('@/hooks/useAnalysisManager', () => ({
  useAnalysisManager: jest.fn(() => global.mockUseAnalysisManagerReturnValue),
}));
jest.mock('@/features/file-upload/hooks/useFileUploadManager', () => ({
  useFileUploadManager: jest.fn(() => global.mockUseFileUploadManagerReturnValue),
}));

global.Timestamp = Timestamp;

// JSDOM API Mocks
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

window.matchMedia = jest.fn().mockImplementation((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

global.requestAnimationFrame = jest.fn((cb: FrameRequestCallback) => {
  if (typeof cb === 'function') cb(0);
  return 0;
});
global.cancelAnimationFrame = jest.fn();

if (typeof window !== 'undefined' && !window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    width: number;
    height: number;
    pressure: number;
    tangentialPressure: number;
    tiltX: number;
    tiltY: number;
    twist: number;
    pointerType: string;
    isPrimary: boolean;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId || 0;
      this.width = params.width || 1;
      this.height = params.height || 1;
      this.pressure = params.pressure || 0;
      this.tangentialPressure = params.tangentialPressure || 0;
      this.tiltX = params.tiltX || 0;
      this.tiltY = params.tiltY || 0;
      this.twist = params.twist || 0;
      this.pointerType = params.pointerType || 'mouse';
      this.isPrimary = params.isPrimary === undefined ? true : params.isPrimary;
    }
  }
  window.PointerEvent = PointerEventPolyfill as typeof PointerEvent;
}

if (typeof window !== 'undefined') {
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = (elt, pseudoElt) => {
    try {
      return originalGetComputedStyle(elt, pseudoElt);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        `Original getComputedStyle failed for ${elt.tagName}: ${(e as Error).message}. Using fallback.`
      );
      const properties: Record<string, string> = {
        /* ... common properties ... */
      };
      const mockStyle = {
        ...properties,
        getPropertyValue: (propertyName: string) => properties[propertyName] || '',
        length: Object.keys(properties).length,
        item: (index: number) => Object.keys(properties)[index] || '',
      } as CSSStyleDeclaration;
      return mockStyle;
    }
  };
}

if (typeof document.createRange === 'undefined') {
  global.document.createRange = () => {
    const range = new Range();
    range.getBoundingClientRect = jest.fn(() => ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON: () => ({}),
    }));
    range.getClientRects = jest.fn(() => ({
      item: () => null,
      length: 0,
      [Symbol.iterator]: jest.fn(),
    }));
    return range;
  };
}

if (typeof window !== 'undefined') {
  window.requestIdleCallback =
    window.requestIdleCallback ||
    ((cb) => {
      const start = Date.now();
      return setTimeout(() => {
        cb({
          didTimeout: false,
          timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
        });
      }, 1);
    });
  window.cancelIdleCallback =
    window.cancelIdleCallback ||
    ((id) => {
      clearTimeout(id);
    });
}

beforeEach(() => {
  mockRouterPush.mockClear();
  mockRouterReplace.mockClear();
  mockToastFn.mockClear();

  act(() => {
    global.mockUseAnalysisManagerReturnValue.currentAnalysis = null;
    global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
    global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
    global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps = [];
  });
  global.mockUseAnalysisManagerReturnValue.setCurrentAnalysis.mockClear();
  global.mockUseAnalysisManagerReturnValue.setTagInput.mockClear();
  global.mockUseAnalysisManagerReturnValue.fetchPastAnalyses
    .mockClear()
    .mockResolvedValue(undefined);
  global.mockUseAnalysisManagerReturnValue.startAiProcessing
    .mockClear()
    .mockResolvedValue(undefined);
  global.mockUseAnalysisManagerReturnValue.handleAddTag.mockClear().mockResolvedValue(undefined);
  global.mockUseAnalysisManagerReturnValue.handleRemoveTag.mockClear().mockResolvedValue(undefined);
  global.mockUseAnalysisManagerReturnValue.handleDeleteAnalysis
    .mockClear()
    .mockImplementation((_id, cb) => {
      cb?.();
      return Promise.resolve();
    });
  global.mockUseAnalysisManagerReturnValue.handleCancelAnalysis
    .mockClear()
    .mockResolvedValue(undefined);
  global.mockUseAnalysisManagerReturnValue.downloadReportAsTxt.mockClear();

  act(() => {
    global.mockUseFileUploadManagerReturnValue.fileToUpload = null;
    global.mockUseFileUploadManagerReturnValue.isUploading = false;
    global.mockUseFileUploadManagerReturnValue.uploadProgress = 0;
    global.mockUseFileUploadManagerReturnValue.uploadError = null;
  });
  global.mockUseFileUploadManagerReturnValue.handleFileSelection.mockClear();
  global.mockUseFileUploadManagerReturnValue.uploadFileAndCreateRecord
    .mockClear()
    .mockResolvedValue({
      analysisId: 'mock-analysis-upload-id',
      fileName: 'mock-file.csv',
      error: null,
    });

  const { __mockHttpsCallableGlobal: callableMockStore } = jest.requireMock(
    'firebase/functions'
  ) as FirebaseFunctionsMock;
  Object.keys(callableMockStore).forEach((key) => {
    if (callableMockStore[key] && typeof callableMockStore[key].mockClear === 'function') {
      callableMockStore[key].mockClear();
    }
    // Reset to default implementation if needed, example:
    if (key === 'httpsCreateInitialAnalysisRecord' && callableMockStore[key]) {
      callableMockStore[key].mockImplementation((data: { fileName: string }) =>
        Promise.resolve({ data: { analysisId: `mock-analysis-id-for-${data.fileName}` } })
      );
    }
    // ... (add default mocks for other callable functions as in your previous setup)
    if (callableMockStore.httpsUpdateAnalysisUploadProgress)
      callableMockStore.httpsUpdateAnalysisUploadProgress.mockResolvedValue({
        data: { success: true },
      });
    if (callableMockStore.httpsFinalizeFileUploadRecord)
      callableMockStore.httpsFinalizeFileUploadRecord.mockResolvedValue({
        data: { success: true },
      });
    if (callableMockStore.httpsMarkUploadAsFailed)
      callableMockStore.httpsMarkUploadAsFailed.mockResolvedValue({ data: { success: true } });
    if (callableMockStore.httpsCallableAskOrchestrator) {
      callableMockStore.httpsCallableAskOrchestrator.mockResolvedValue({
        data: {
          success: true,
          aiMessageRtdbKey: 'mock-ai-key-default-callable-cleared',
          reportModified: false,
        },
      });
    }
    if (callableMockStore.httpsCallableAddTag)
      callableMockStore.httpsCallableAddTag.mockResolvedValue({
        data: { success: true, message: 'Tag added (mock callable)' },
      });
    if (callableMockStore.httpsCallableRemoveTag)
      callableMockStore.httpsCallableRemoveTag.mockResolvedValue({
        data: { success: true, message: 'Tag removed (mock callable)' },
      });
    if (callableMockStore.httpsCallableGetPastAnalyses)
      callableMockStore.httpsCallableGetPastAnalyses.mockResolvedValue({ data: { analyses: [] } });
    if (callableMockStore.httpsCallableDeleteAnalysis)
      callableMockStore.httpsCallableDeleteAnalysis.mockResolvedValue({
        data: { success: true, message: 'Deleted (mock callable)' },
      });
    if (callableMockStore.httpsCallableCancelAnalysis)
      callableMockStore.httpsCallableCancelAnalysis.mockResolvedValue({
        data: { success: true, message: 'Cancelled (mock callable)' },
      });
    if (callableMockStore.httpsCallableTriggerProcessing)
      callableMockStore.httpsCallableTriggerProcessing.mockResolvedValue({
        data: { success: true, analysisId: 'mock-analysis-id-triggered' },
      });
    if (callableMockStore.httpsCallableGetAnalysisReport) {
      callableMockStore.httpsCallableGetAnalysisReport.mockResolvedValue({
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
    }
  });

  global.mockFirebaseAuthUserForListener = null;
  if (global.authStateListenerCallback) {
    act(() => {
      if (global.authStateListenerCallback) {
        global.authStateListenerCallback(null);
      }
    });
  }

  const storageMock = jest.requireMock('firebase/storage') as FirebaseStorageMock;
  if (storageMock.__mockRef) storageMock.__mockRef.mockClear();
  if (storageMock.__mockUploadBytesResumable) {
    storageMock.__mockUploadBytesResumable
      .mockClear()
      .mockReturnValue({ on: storageMock.__mockUploadTask_on });
  }
  if (storageMock.__mockGetDownloadURL) {
    storageMock.__mockGetDownloadURL
      .mockClear()
      .mockResolvedValue('https://fake.storage.googleapis.com/mock/path/to/default.csv');
  }
  if (storageMock.__mockUploadTask_on) storageMock.__mockUploadTask_on.mockClear();

  const firebaseDbMock = jest.requireMock('firebase/database') as FirebaseDatabaseMock;
  firebaseDbMock.__mockGetDatabase.mockClear();
  firebaseDbMock.__mockRef.mockClear();
  firebaseDbMock.__mockOnValue.mockClear();
  firebaseDbMock.__mockPush.mockClear();
  firebaseDbMock.__mockUpdate.mockClear();
  firebaseDbMock.__mockServerTimestamp.mockClear();
  firebaseDbMock.__mockOff.mockClear();
  firebaseDbMock.__mockChild.mockClear();

  if (typeof window !== 'undefined' && (window.console.error as jest.Mock)?.mockClear) {
    (window.console.error as jest.Mock).mockClear();
  } else if ((global.console.error as jest.Mock)?.mockClear) {
    (global.console.error as jest.Mock).mockClear();
  }
});

afterEach(() => {
  jest.clearAllMocks();
  global.authStateListenerCallback = null;
});

export const mockAuthContext = (user: User | null, loading = false) => {
  const useAuthActual = jest.requireActual('@/contexts/auth-context');
  jest.spyOn(useAuthActual, 'useAuth').mockReturnValue({ user, loading });
  return useAuthActual;
};

// --- Global Console Mocking ---
if (typeof window !== 'undefined') {
  window.console = { ...window.console, error: jest.fn() };
} else {
  // @ts-expect-error: Overriding global console for test purposes
  global.console = { ...global.console, error: jest.fn() };
}
// --- End Global Console Mocking ---

global.EMULATORS_CONNECTED = !!process.env.FIRESTORE_EMULATOR_HOST;
// eslint-disable-next-line no-console
console.info(`EMULATORS_CONNECTED: ${global.EMULATORS_CONNECTED}`);
if (global.EMULATORS_CONNECTED) {
  // eslint-disable-next-line no-console
  console.info('Jest setup: Firebase SDKs should connect to emulators.');
} else {
  // eslint-disable-next-line no-console
  console.warn(
    'Jest setup: Firebase SDKs will NOT connect to emulators (emulator env vars not set). Some tests may behave differently or fail.'
  );
}

// To deal with "Could not parse CSS stylesheet" from Radix UI in tests
if (typeof window !== 'undefined') {
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = (elt, pseudoElt) => {
    try {
      return originalGetComputedStyle(elt, pseudoElt);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('jsdom.getComputedStyle failed, returning empty CSSStyleDeclaration', error);
      const style = {} as CSSStyleDeclaration;
      return style;
    }
  };
}
