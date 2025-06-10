// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { Timestamp } from 'firebase/firestore';
import React from 'react'; // Import React for createElement
import { act } from '@testing-library/react';

// --- Mock Firebase Env Vars for Jest ---
process.env.NEXT_PUBLIC_FIREBASE_CONFIG = JSON.stringify({
  apiKey: 'test-api-key',
  authDomain: 'test-project.firebaseapp.com',
  projectId: 'test-project',
  storageBucket: 'test-project.appspot.com',
  messagingSenderId: '1234567890',
  appId: 'test-app-id',
  measurementId: 'test-measurement-id',
  databaseURL: 'https://test-project-default-rtdb.firebaseio.com',
});
process.env.NEXT_PUBLIC_GEMINI_API_KEY = 'test-gemini-api-key';
// --- End Mock Firebase Env Vars ---

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

// Server Actions Mocks
jest.mock('@/features/analysis-listing/actions/analysisListingActions', () => ({
  getPastAnalysesAction: jest.fn(() => Promise.resolve([])),
}));
jest.mock('@/features/analysis-management/actions/analysisManagementActions', () => ({
  deleteAnalysisAction: jest.fn((userId, analysisId) => Promise.resolve()),
  cancelAnalysisAction: jest.fn((userId, analysisId) => Promise.resolve({ success: true })),
}));
jest.mock('@/features/analysis-processing/actions/analysisProcessingActions', () => ({
  processAnalysisFile: jest.fn(() =>
    Promise.resolve({ success: true, analysisId: 'mock-analysis-id' })
  ),
}));
jest.mock('@/features/file-upload/actions/fileUploadActions', () => ({
  createInitialAnalysisRecordAction: jest.fn((userId, fileName, title, description, lang) =>
    Promise.resolve({ analysisId: `mock-analysis-id-for-${fileName}` })
  ),
  updateAnalysisUploadProgressAction: jest.fn(() => Promise.resolve({ success: true })),
  finalizeFileUploadRecordAction: jest.fn(() => Promise.resolve({ success: true })),
  markUploadAsFailedAction: jest.fn(() => Promise.resolve({ success: true })),
}));
jest.mock('@/features/report-chat/actions/reportChatActions', () => ({
  askReportOrchestratorAction: jest.fn(() =>
    Promise.resolve({ success: true, aiMessageRtdbKey: 'mock-ai-key' })
  ),
}));
jest.mock('@/features/report-viewing/actions/reportViewingActions', () => ({
  getAnalysisReportAction: jest.fn(() =>
    Promise.resolve({
      mdxContent: '# Mock Report',
      fileName: 'mock-report.csv',
      analysisId: 'mock-analysis-id',
      error: null,
    })
  ),
}));
jest.mock('@/features/tag-management/actions/tagActions', () => ({
  addTagToAction: jest.fn(() => Promise.resolve()),
  removeTagAction: jest.fn(() => Promise.resolve()),
}));

// Mock useAnalysisManager
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
    useAnalysisManager: jest.fn(() => {
      // Return a new object (shallow copy) each time to better mimic React's re-render on hook output change
      return { ...global.mockUseAnalysisManagerReturnValue };
    }),
  };
});

// Mock useFileUploadManager
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
  useFileUploadManager: jest.fn(() => ({ ...global.mockUseFileUploadManagerReturnValue })), // Also return a shallow copy
}));

global.Timestamp = Timestamp;

// JSDOM API Mocks for Radix UI and other libraries
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

window.matchMedia = jest.fn().mockImplementation((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(), // deprecated
  removeListener: jest.fn(), // deprecated
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

global.requestAnimationFrame = jest.fn((cb) => {
  if (typeof cb === 'function') cb(0);
  return 0; // return a number
});
global.cancelAnimationFrame = jest.fn();

// Mock PointerEvent for Radix UI in JSDOM
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

// To deal with "Could not parse CSS stylesheet" from Radix UI in tests
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

// Mock for document.createRange, sometimes needed by positioning libraries
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

// Mock requestIdleCallback for Next.js Link prefetching
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

// Clear all mocks before each test
beforeEach(() => {
  mockRouterPush.mockClear();
  mockRouterReplace.mockClear();
  mockToastFn.mockClear();

  // Reset global useAnalysisManager mock state
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

  // Reset global useFileUploadManager mock state
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

  // Reset server action mocks
  jest
    .requireMock('@/features/analysis-listing/actions/analysisListingActions')
    .getPastAnalysesAction.mockClear()
    .mockResolvedValue([]);
  jest
    .requireMock('@/features/file-upload/actions/fileUploadActions')
    .createInitialAnalysisRecordAction.mockClear()
    .mockImplementation((userId, fileName) =>
      Promise.resolve({ analysisId: `mock-analysis-id-for-${fileName}` })
    );
  jest
    .requireMock('@/features/report-viewing/actions/reportViewingActions')
    .getAnalysisReportAction.mockClear()
    .mockResolvedValue({
      mdxContent: '# Mock Report Default',
      fileName: 'mock-report-default.csv',
      analysisId: 'default-mock-analysis-id',
      error: null,
    });
  jest
    .requireMock('@/features/report-chat/actions/reportChatActions')
    .askReportOrchestratorAction.mockClear()
    .mockResolvedValue({ success: true, aiMessageRtdbKey: 'mock-ai-key-default' });
  jest
    .requireMock('@/features/analysis-management/actions/analysisManagementActions')
    .deleteAnalysisAction.mockClear()
    .mockResolvedValue(undefined);
  jest
    .requireMock('@/features/analysis-management/actions/analysisManagementActions')
    .cancelAnalysisAction.mockClear()
    .mockResolvedValue({ success: true });
  jest
    .requireMock('@/features/analysis-processing/actions/analysisProcessingActions')
    .processAnalysisFile.mockClear()
    .mockResolvedValue({ success: true, analysisId: 'mock-analysis-id' });
  jest
    .requireMock('@/features/tag-management/actions/tagActions')
    .addTagToAction.mockClear()
    .mockResolvedValue(undefined);
  jest
    .requireMock('@/features/tag-management/actions/tagActions')
    .removeTagAction.mockClear()
    .mockResolvedValue(undefined);

  // This ensures each test starts with a clean slate for what onAuthStateChanged reports
  // by directly manipulating the module-scoped variables within the mock factory.
  mockFirebaseAuthUserForListener = null;
  if (authStateListenerCallback) {
    act(() => {
      authStateListenerCallback(null);
    });
  }

  // Clear the global console.error mock (if it was set up)
  if (typeof window !== 'undefined' && window.console.error?.mockClear) {
    window.console.error.mockClear();
  } else if (global.console.error?.mockClear) {
    global.console.error.mockClear();
  }
});

afterEach(() => {
  jest.clearAllMocks();
  // Clean up authStateListenerCallback to prevent leaks between test files if AuthProvider isn't unmounted
  authStateListenerCallback = null;
});

// Helper to provide mock context for useAuth
export const mockAuthContext = (user, loading = false) => {
  const useAuthActual = jest.requireActual('@/contexts/auth-context');
  jest.spyOn(useAuthActual, 'useAuth').mockReturnValue({ user, loading });
  return useAuthActual;
};

// --- Global Console Mocking for JSDOM environment ---
// This ensures that `console.error` used by components is a Jest mock function.
if (typeof window !== 'undefined') {
  // This check ensures we are in a JSDOM-like environment where 'window' is defined.
  // console.log('Jest setup: Mocking window.console.error'); // For debugging
  window.console = {
    ...window.console, // Preserve other console methods like log, warn, info
    error: jest.fn(), // Replace 'error' with a Jest mock function
    // Optionally mock other console methods if they interfere with test output or assertions
    // warn: jest.fn(),
    // log: jest.fn(), // Be careful mocking log, it's used by test runners too
  };
} else {
  // Fallback for environments where 'window' might not be defined (e.g. pure Node for some tests)
  // This branch is less likely to be hit for React component tests using JSDOM.
  // console.log('Jest setup: Mocking global.console.error (window undefined)'); // For debugging
  global.console = {
    ...global.console,
    error: jest.fn(),
  };
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
