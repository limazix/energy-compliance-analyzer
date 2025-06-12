// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

/**
 * @fileoverview Jest setup file.
 * This file is executed before each test suite. It's used to configure
 * or set up the testing environment, including mocking global objects,
 * Firebase SDKs, and other utilities to ensure tests run in a consistent
 * and isolated manner.
 */

import '@testing-library/jest-dom';

import { act } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import React from 'react'; // Import React for createElement

// --- Firebase Env Vars are NOT mocked here. ---
// They should be provided by your local .env.test (or similar mechanism)
// or by CI environment variables.
// src/lib/firebase.ts will throw an error if NEXT_PUBLIC_FIREBASE_CONFIG is not set.

// --- Firebase Auth Mock ---
// These variables are module-scoped within this mock's closure.
let mockFirebaseAuthUserForListener = null;
let authStateListenerCallback = null;

jest.mock('firebase/auth', () => {
  const actualFirebaseAuth = jest.requireActual('firebase/auth');

  // Helper function to be exported by the mock
  const __setMockUserForAuthStateChangedListener = (user) => {
    mockFirebaseAuthUserForListener = user;
    if (authStateListenerCallback) {
      // Ensure state updates for listeners are wrapped in act if they cause React updates
      act(() => {
        authStateListenerCallback(mockFirebaseAuthUserForListener);
      });
    }
  };

  return {
    // Spread actualFirebaseAuth first to get all exports like GoogleAuthProvider, etc.
    // and to ensure unmocked functions (like the real getAuth) are available if not overridden.
    ...actualFirebaseAuth,
    // We are NOT mocking getAuth here. src/lib/firebase.ts will use the real getAuth.
    // connectAuthEmulator in src/lib/emulators.ts will thus receive a real Auth object.

    // Mock onAuthStateChanged
    onAuthStateChanged: jest.fn((authInstance, listener) => {
      // authInstance will be the real auth object from src/lib/firebase.ts
      authStateListenerCallback = listener;
      // Simulate initial async call to listener with the current mock user
      act(() => {
        authStateListenerCallback(mockFirebaseAuthUserForListener);
      });
      return jest.fn(); // Return unsubscribe function
    }),

    // Mock other functions as needed for tests
    signInWithPopup: jest.fn(),
    signOut: jest.fn(),
    // GoogleAuthProvider is already available via ...actualFirebaseAuth

    // Export the helper so tests can import it from 'firebase/auth' and use it
    __setMockUserForAuthStateChangedListener,
  };
});
// --- End Firebase Auth Mock ---

// --- Firebase Storage Mock ---
/**
 * @fileoverview Mock for the 'firebase/storage' module.
 * This mock simulates the behavior of Firebase Storage functions like
 * ref, uploadBytesResumable, and getDownloadURL for Jest tests.
 * It includes a mock UploadTask that can simulate progress and completion.
 */
jest.mock('firebase/storage', () => {
  const actualStorage = jest.requireActual('firebase/storage');

  // Define a mock UploadTask
  const mockUploadTask = {
    on: jest.fn((event, progressCb, errorCb, completeCb) => {
      // Simulate some progress updates
      if (event === 'state_changed' && progressCb) {
        act(() =>
          progressCb({
            bytesTransferred: 0,
            totalBytes: 100,
            state: 'running',
            ref: mockUploadTask.snapshot.ref, // Provide the ref here
          })
        );
        act(() =>
          progressCb({
            bytesTransferred: 50,
            totalBytes: 100,
            state: 'running',
            ref: mockUploadTask.snapshot.ref,
          })
        );
        act(() =>
          progressCb({
            bytesTransferred: 100,
            totalBytes: 100,
            state: 'running',
            ref: mockUploadTask.snapshot.ref,
          })
        );
      }
      // Simulate successful completion almost immediately for tests
      if (event === 'state_changed' && completeCb) {
        Promise.resolve().then(() => act(() => completeCb(mockUploadTask.snapshot)));
      }
      return jest.fn(); // Return an unsubscribe function
    }),
    snapshot: {
      ref: { toString: () => 'gs://fake-bucket/mock/path/to/file.csv', name: 'file.csv' }, // Mock ref
      bytesTransferred: 100,
      totalBytes: 100,
      state: 'success', // Default to success
      metadata: { fullPath: 'mock/path/to/file.csv' }, // Mock metadata
      task: null, // Filled by actual UploadTask, can be null for mock
    },
    pause: jest.fn(),
    resume: jest.fn(),
    cancel: jest.fn(),
    then: jest.fn((onFulfilled, _onRejected) =>
      // Simulate successful completion for promise resolution
      Promise.resolve(onFulfilled(mockUploadTask.snapshot))
    ),
    catch: jest.fn((_onRejected) => Promise.resolve()), // Simulate no error for catch by default
  };

  // Mock for storage.ref()
  const refMock = jest.fn((_storageInstance, path) => ({
    toString: () => `gs://fake-bucket/${path || 'undefined_path'}`,
    bucket: 'fake-bucket',
    fullPath: path || 'undefined_path',
    name: path ? path.substring(path.lastIndexOf('/') + 1) : 'undefined_filename',
    parent: null, // Simplified mock
    root: null, // Simplified mock
  }));

  // Mock for getDownloadURL()
  const getDownloadURLMock = jest.fn((ref) =>
    Promise.resolve(`https://fake.storage.googleapis.com/${ref.bucket}/${ref.fullPath}`)
  );
  // Mock for uploadBytesResumable()
  const uploadBytesResumableMock = jest.fn(() => mockUploadTask); // Return our mockUploadTask

  const mockModule = {
    ...actualStorage, // Spread actual module to get non-mocked parts
    ref: refMock,
    uploadBytesResumable: uploadBytesResumableMock,
    getDownloadURL: getDownloadURLMock,
    // Expose mock instances for test manipulation if needed
    __mockRef: refMock,
    __mockUploadBytesResumable: uploadBytesResumableMock,
    __mockGetDownloadURL: getDownloadURLMock,
    __mockUploadTask_on: mockUploadTask.on, // Expose .on from the task
    __mockUploadTask_snapshot: mockUploadTask.snapshot, // Expose snapshot
  };

  return mockModule;
});
// --- End Firebase Storage Mock ---

// --- Firebase Functions Mock ---
/**
 * @fileoverview Mock for the 'firebase/functions' module.
 * This mock simulates `getFunctions` and `httpsCallable` to allow testing
 * of Server Actions that invoke HTTPS Callable Firebase Functions IF THOSE ACTIONS ARE NOT MOCKED THEMSELVES.
 * Individual callable functions can be mocked by name.
 */
const mockHttpsCallableStore = {}; // This will store mocks keyed by function name
jest.mock('firebase/functions', () => {
  const actualFunctions = jest.requireActual('firebase/functions');
  return {
    ...actualFunctions,
    getFunctions: jest.fn(() => ({
      // Mock the FirebaseFunctions instance if needed for connectFunctionsEmulator
      // For now, a simple object suffices as connectFunctionsEmulator is also mocked.
    })),
    httpsCallable: jest.fn((functionsInstance, functionName) => {
      // Store the mock function per functionName to allow specific mock implementations
      if (!mockHttpsCallableStore[functionName]) {
        // Default mock if a specific one isn't set up by a test
        mockHttpsCallableStore[functionName] = jest.fn(() =>
          Promise.resolve({ data: { success: true, message: `Default mock for ${functionName}` } })
        );
      }
      // Return the specific mock for this function name
      return mockHttpsCallableStore[functionName];
    }),
    connectFunctionsEmulator: jest.fn(), // Mock connectFunctionsEmulator
    // Expose the generic mock store for manipulation in tests if needed for all callables
    __mockHttpsCallableGlobal: mockHttpsCallableStore,
  };
});
// --- End Firebase Functions Mock ---

// Mock Next.js router
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
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
  const icons = {};
  const handler = {
    get: (_target, prop) => {
      if (prop === '__esModule') return true;
      const MockLucideIcon = (props) => {
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
jest.mock('next-mdx-remote/rsc', () => {
  return {
    MDXRemote: jest.fn((props) => {
      let content = '';
      if (typeof props.source === 'string') {
        content = props.source;
      } else if (props.source && typeof props.source === 'object') {
        content = JSON.stringify(props.source);
      }
      return React.createElement('div', { 'data-testid': 'mock-mdx-remote' }, content);
    }),
  };
});

// Mock remark plugins that are ESM-only
jest.mock('remark-gfm', () => jest.fn());
jest.mock('remark-mermaidjs', () => jest.fn());

// --- Server Actions Mocks ---
// REMOVED jest.mock blocks for specific server actions.
// Test files are now responsible for mocking these server actions if needed.

// Mock useAnalysisManager
/**
 * @global
 * @type {object}
 * @description Global mock return value for the useAnalysisManager hook.
 * Tests can modify this object to control the hook's output.
 */
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
  handleDeleteAnalysis: jest.fn((id, cb) => {
    cb?.();
    return Promise.resolve();
  }),
  handleCancelAnalysis: jest.fn(() => Promise.resolve()),
  downloadReportAsTxt: jest.fn(),
  displayedAnalysisSteps: [],
};

jest.mock('@/hooks/useAnalysisManager', () => {
  const actualHookModule = jest.requireActual('@/hooks/useAnalysisManager');
  return {
    ...actualHookModule,
    // Return the global object directly, not a copy
    useAnalysisManager: jest.fn(() => global.mockUseAnalysisManagerReturnValue),
  };
});

// Mock useFileUploadManager
/**
 * @global
 * @type {object}
 * @description Global mock return value for the useFileUploadManager hook.
 */
const mockUploadFileAndCreateRecord = jest.fn(() =>
  Promise.resolve({ analysisId: 'mock-analysis-upload-id', fileName: 'mock-file.csv', error: null })
);
global.mockUseFileUploadManagerReturnValue = {
  fileToUpload: null,
  isUploading: false,
  uploadProgress: 0,
  uploadError: null,
  handleFileSelection: jest.fn(),
  uploadFileAndCreateRecord: mockUploadFileAndCreateRecord,
};
jest.mock('@/features/file-upload/hooks/useFileUploadManager', () => ({
  // Return the global object directly, not a copy
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

global.requestAnimationFrame = jest.fn((cb) => {
  if (typeof cb === 'function') cb(0);
  return 0;
});
global.cancelAnimationFrame = jest.fn();

if (typeof window !== 'undefined' && !window.PointerEvent) {
  class PointerEvent extends MouseEvent {
    constructor(type, params = {}) {
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
  window.PointerEvent = PointerEvent;
}

if (typeof window !== 'undefined') {
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = (elt, pseudoElt) => {
    let style;
    try {
      style = originalGetComputedStyle(elt, pseudoElt);
      if (style && typeof style.getPropertyValue === 'function') {
        return style;
      }
    } catch (e) {
      // console.warn(`Original getComputedStyle failed for ${elt.tagName}: ${e.message}. Using fallback.`);
    }
    const properties = {
      display: 'block',
      opacity: '1',
      visibility: 'visible',
      position: 'static',
      pointerEvents: 'auto',
      animationName: 'none',
      transitionProperty: 'none',
      width: 'auto',
      height: 'auto',
      margin: '0px',
      padding: '0px',
      border: '0px none rgb(0, 0, 0)',
      overflow: 'visible',
    };
    const mockStyle = {
      ...properties,
      getPropertyValue: (propertyName) => {
        const camelCaseProperty = propertyName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        return properties[camelCaseProperty] || '';
      },
      length: Object.keys(properties).length,
      item: (index) => Object.keys(properties)[index] || '',
      setProperty: (propertyName, value, priority) => {
        const camelCaseProperty = propertyName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        properties[camelCaseProperty] = value;
        mockStyle.length = Object.keys(properties).length;
      },
      removeProperty: (propertyName) => {
        const camelCaseProperty = propertyName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        const oldValue = properties[camelCaseProperty];
        delete properties[camelCaseProperty];
        mockStyle.length = Object.keys(properties).length;
        return oldValue || '';
      },
    };
    for (let i = 0; i < mockStyle.length; i++) {
      const key = mockStyle.item(i);
      if (key) {
        mockStyle[i] = key;
      }
    }
    return mockStyle;
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
    function (cb) {
      const start = Date.now();
      return setTimeout(function () {
        cb({
          didTimeout: false,
          timeRemaining: function () {
            return Math.max(0, 50 - (Date.now() - start));
          },
        });
      }, 1);
    };
  window.cancelIdleCallback =
    window.cancelIdleCallback ||
    function (id) {
      clearTimeout(id);
    };
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
    .mockImplementation((id, cb) => {
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

  // Clear and reset mocks for httpsCallable functions
  const { __mockHttpsCallableGlobal: callableMockClearStore } =
    jest.requireMock('firebase/functions');

  // File Upload Functions
  if (callableMockClearStore.httpsCreateInitialAnalysisRecord)
    callableMockClearStore.httpsCreateInitialAnalysisRecord
      .mockClear()
      .mockImplementation((data) =>
        Promise.resolve({ data: { analysisId: `mock-analysis-id-for-${data.fileName}` } })
      );
  if (callableMockClearStore.httpsUpdateAnalysisUploadProgress)
    callableMockClearStore.httpsUpdateAnalysisUploadProgress
      .mockClear()
      .mockResolvedValue({ data: { success: true } });
  if (callableMockClearStore.httpsFinalizeFileUploadRecord)
    callableMockClearStore.httpsFinalizeFileUploadRecord
      .mockClear()
      .mockResolvedValue({ data: { success: true } });
  if (callableMockClearStore.httpsMarkUploadAsFailed)
    callableMockClearStore.httpsMarkUploadAsFailed
      .mockClear()
      .mockResolvedValue({ data: { success: true } });

  // Report Chat Function
  if (callableMockClearStore.httpsCallableAskOrchestrator) {
    callableMockClearStore.httpsCallableAskOrchestrator.mockClear().mockResolvedValue({
      data: {
        success: true,
        aiMessageRtdbKey: 'mock-ai-key-default-callable-cleared',
        reportModified: false,
      },
    });
  }
  // Tag Management Functions
  if (callableMockClearStore.httpsCallableAddTag) {
    callableMockClearStore.httpsCallableAddTag.mockClear().mockResolvedValue({
      data: { success: true, message: 'Tag added (mock callable)' },
    });
  }
  if (callableMockClearStore.httpsCallableRemoveTag) {
    callableMockClearStore.httpsCallableRemoveTag.mockClear().mockResolvedValue({
      data: { success: true, message: 'Tag removed (mock callable)' },
    });
  }
  // Analysis HTTPS Functions
  if (callableMockClearStore.httpsCallableGetPastAnalyses) {
    callableMockClearStore.httpsCallableGetPastAnalyses.mockClear().mockResolvedValue({
      data: { analyses: [] },
    });
  }
  if (callableMockClearStore.httpsCallableDeleteAnalysis) {
    callableMockClearStore.httpsCallableDeleteAnalysis.mockClear().mockResolvedValue({
      data: { success: true, message: 'Deleted (mock callable)' },
    });
  }
  if (callableMockClearStore.httpsCallableCancelAnalysis) {
    callableMockClearStore.httpsCallableCancelAnalysis.mockClear().mockResolvedValue({
      data: { success: true, message: 'Cancelled (mock callable)' },
    });
  }
  if (callableMockClearStore.httpsCallableTriggerProcessing) {
    callableMockClearStore.httpsCallableTriggerProcessing.mockClear().mockResolvedValue({
      data: { success: true, analysisId: 'mock-analysis-id-triggered' },
    });
  }
  if (callableMockClearStore.httpsCallableGetAnalysisReport) {
    callableMockClearStore.httpsCallableGetAnalysisReport.mockClear().mockResolvedValue({
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

  mockFirebaseAuthUserForListener = null;
  if (authStateListenerCallback) {
    act(() => {
      authStateListenerCallback(null);
    });
  }

  const storageMock = jest.requireMock('firebase/storage');
  if (storageMock.__mockRef) storageMock.__mockRef.mockClear();
  if (storageMock.__mockUploadBytesResumable)
    storageMock.__mockUploadBytesResumable
      .mockClear()
      .mockReturnValue(storageMock.__mockUploadTask_on); // This was mockUploadTask, changed to the .on part of the task
  if (storageMock.__mockGetDownloadURL)
    storageMock.__mockGetDownloadURL
      .mockClear()
      .mockResolvedValue('https://fake.storage.googleapis.com/mock/path/to/default.csv');
  if (storageMock.__mockUploadTask_on) storageMock.__mockUploadTask_on.mockClear();

  if (typeof window !== 'undefined' && window.console.error?.mockClear) {
    window.console.error.mockClear();
  } else if (global.console.error?.mockClear) {
    global.console.error.mockClear();
  }
});

afterEach(() => {
  jest.clearAllMocks();
  authStateListenerCallback = null;
});

export const mockAuthContext = (user, loading = false) => {
  const useAuthActual = jest.requireActual('@/contexts/auth-context');
  jest.spyOn(useAuthActual, 'useAuth').mockReturnValue({ user, loading });
  return useAuthActual;
};

// --- Global Console Mocking ---
if (typeof window !== 'undefined') {
  window.console = { ...window.console, error: jest.fn() };
} else {
  global.console = { ...global.console, error: jest.fn() };
}
// --- End Global Console Mocking ---

global.EMULATORS_CONNECTED = !!process.env.FIRESTORE_EMULATOR_HOST;
console.log(`EMULATORS_CONNECTED: ${global.EMULATORS_CONNECTED}`);
if (global.EMULATORS_CONNECTED) {
  console.log('Jest setup: Firebase SDKs should connect to emulators.');
} else {
  console.warn(
    'Jest setup: Firebase SDKs will NOT connect to emulators (emulator env vars not set). Some tests may behave differently or fail.'
  );
}
