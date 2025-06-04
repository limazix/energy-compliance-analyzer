
// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { Timestamp } from 'firebase/firestore';

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
  useParams: jest.fn(() => ({})), // Mock useParams, useful for dynamic routes like report/[analysisId]
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => {
    const icons = {};
    const handler = {
        get: (target, prop) => {
            if (prop === '__esModule') return true;
            // Return a mock component for any icon name
            return (props) => {
              const { children, ...restProps } = props || {};
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const Tag = 'svg'; // Removed :any type annotation
              return <Tag data-lucide-mock={String(prop)} {...restProps}>{children}</Tag>;
            }
        }
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

// Firebase SDKs will auto-connect to emulators when tests are run via `firebase emulators:exec`.
// So, we typically DON'T mock the core SDK methods (getDoc, addDoc, onValue, push, etc.) here.
// We let src/lib/firebase.ts initialize and connect to emulators.

// Server Actions Mocks (kept for isolating component logic if needed, or can be unmocked for full integration tests)
jest.mock('@/features/analysis-listing/actions/analysisListingActions', () => ({
  getPastAnalysesAction: jest.fn(() => Promise.resolve([])),
}));
jest.mock('@/features/analysis-management/actions/analysisManagementActions', () => ({
  deleteAnalysisAction: jest.fn((userId, analysisId) => Promise.resolve()),
  cancelAnalysisAction: jest.fn((userId, analysisId) => Promise.resolve({ success: true })),
}));
jest.mock('@/features/analysis-processing/actions/analysisProcessingActions', () => ({
  processAnalysisFile: jest.fn(() => Promise.resolve({ success: true, analysisId: 'mock-analysis-id' })),
}));
jest.mock('@/features/file-upload/actions/fileUploadActions', () => ({
  createInitialAnalysisRecordAction: jest.fn((userId, fileName, title, description, lang) => Promise.resolve({ analysisId: `mock-analysis-id-for-${fileName}` })),
  updateAnalysisUploadProgressAction: jest.fn(() => Promise.resolve({ success: true })),
  finalizeFileUploadRecordAction: jest.fn(() => Promise.resolve({ success: true })),
  markUploadAsFailedAction: jest.fn(() => Promise.resolve({ success: true })),
}));
jest.mock('@/features/report-chat/actions/reportChatActions', () => ({
  askReportOrchestratorAction: jest.fn(() => Promise.resolve({ success: true, aiMessageRtdbKey: 'mock-ai-key' })),
}));
jest.mock('@/features/report-viewing/actions/reportViewingActions', () => ({
  getAnalysisReportAction: jest.fn(() => Promise.resolve({ mdxContent: '# Mock Report', fileName: 'mock-report.csv', analysisId: 'mock-analysis-id', error: null })),
}));
jest.mock('@/features/tag-management/actions/tagActions', () => ({
    addTagToAction: jest.fn(() => Promise.resolve()),
    removeTagAction: jest.fn(() => Promise.resolve()),
}));


// Mock useAnalysisManager
const mockSetCurrentAnalysis = jest.fn();
const mockFetchPastAnalyses = jest.fn(() => Promise.resolve());
const mockStartAiProcessing = jest.fn(() => Promise.resolve());
const mockHandleDeleteAnalysis = jest.fn((id, cb) => { cb?.(); return Promise.resolve(); });
const mockHandleCancelAnalysis = jest.fn(() => Promise.resolve());

global.mockUseAnalysisManagerReturnValue = {
  currentAnalysis: null,
  setCurrentAnalysis: mockSetCurrentAnalysis,
  pastAnalyses: [],
  isLoadingPastAnalyses: false,
  tagInput: '',
  setTagInput: jest.fn(),
  fetchPastAnalyses: mockFetchPastAnalyses,
  startAiProcessing: mockStartAiProcessing,
  handleAddTag: jest.fn(() => Promise.resolve()),
  handleRemoveTag: jest.fn(() => Promise.resolve()),
  handleDeleteAnalysis: mockHandleDeleteAnalysis,
  handleCancelAnalysis: mockHandleCancelAnalysis,
  downloadReportAsTxt: jest.fn(),
  displayedAnalysisSteps: [],
};

jest.mock('@/hooks/useAnalysisManager', () => ({
  useAnalysisManager: jest.fn(() => global.mockUseAnalysisManagerReturnValue),
}));


// Mock useFileUploadManager
const mockUploadFileAndCreateRecord = jest.fn(() => Promise.resolve({ analysisId: 'mock-analysis-upload-id', fileName: 'mock-file.csv', error: null }));
global.mockUseFileUploadManagerReturnValue = {
  fileToUpload: null,
  isUploading: false,
  uploadProgress: 0,
  uploadError: null,
  handleFileSelection: jest.fn(),
  uploadFileAndCreateRecord: mockUploadFileAndCreateRecord,
};
jest.mock('@/features/file-upload/hooks/useFileUploadManager', () => ({
  useFileUploadManager: jest.fn(() => global.mockUseFileUploadManagerReturnValue),
}));

// Firebase/Firestore direct usage mocks (like in page.tsx for getDoc, or ReportPage for RTDB)
// These are now commented out or removed to allow emulators to be hit by the actual SDK.
// If specific components directly use SDK methods AND you don't want them to hit emulators in certain tests,
// you might mock them on a per-test-suite basis.

// Example: If you still needed to mock getDoc for a specific test file, you could do:
// jest.mock('firebase/firestore', () => ({
//   ...jest.requireActual('firebase/firestore'), // Import and retain default behavior
//   getDoc: jest.fn(() => Promise.resolve({ exists: () => false, data: () => ({}), id: 'mock-doc-id' })),
//   doc: jest.fn(),
// }));
// However, for emulator testing, we want the real getDoc.

global.Timestamp = Timestamp; // Make Firebase Timestamp globally available if needed


// Clear all mocks before each test
beforeEach(() => {
  mockRouterPush.mockClear();
  mockRouterReplace.mockClear();
  mockToastFn.mockClear();
  mockSetCurrentAnalysis.mockClear();
  mockFetchPastAnalyses.mockClear();
  mockStartAiProcessing.mockClear();
  mockHandleDeleteAnalysis.mockClear();
  mockHandleCancelAnalysis.mockClear();
  mockUploadFileAndCreateRecord.mockClear();

  // Reset return values for custom hooks
  global.mockUseAnalysisManagerReturnValue = {
    currentAnalysis: null,
    setCurrentAnalysis: mockSetCurrentAnalysis,
    pastAnalyses: [],
    isLoadingPastAnalyses: false,
    tagInput: '',
    setTagInput: jest.fn(),
    fetchPastAnalyses: mockFetchPastAnalyses,
    startAiProcessing: mockStartAiProcessing,
    handleAddTag: jest.fn(() => Promise.resolve()),
    handleRemoveTag: jest.fn(() => Promise.resolve()),
    handleDeleteAnalysis: mockHandleDeleteAnalysis,
    handleCancelAnalysis: mockHandleCancelAnalysis,
    downloadReportAsTxt: jest.fn(),
    displayedAnalysisSteps: [],
  };
  global.mockUseFileUploadManagerReturnValue = {
    fileToUpload: null,
    isUploading: false,
    uploadProgress: 0,
    uploadError: null,
    handleFileSelection: jest.fn(),
    uploadFileAndCreateRecord: mockUploadFileAndCreateRecord,
  };

  // Reset server action mocks
  jest.requireMock('@/features/analysis-listing/actions/analysisListingActions').getPastAnalysesAction.mockResolvedValue([]);
  jest.requireMock('@/features/file-upload/actions/fileUploadActions').createInitialAnalysisRecordAction.mockImplementation(
    (userId, fileName) => Promise.resolve({ analysisId: `mock-analysis-id-for-${fileName}` })
  );
   jest.requireMock('@/features/report-viewing/actions/reportViewingActions').getAnalysisReportAction.mockResolvedValue(
     { mdxContent: '# Mock Report Default', fileName: 'mock-report-default.csv', analysisId: 'default-mock-analysis-id', error: null }
   );
   jest.requireMock('@/features/report-chat/actions/reportChatActions').askReportOrchestratorAction.mockResolvedValue(
     { success: true, aiMessageRtdbKey: 'mock-ai-key-default' }
   );


});
afterEach(() => {
  jest.clearAllMocks();
});

// Helper to provide mock context for useAuth
export const mockAuthContext = (user, loading = false) => {
  const useAuthActual = jest.requireActual('@/contexts/auth-context');
  jest.spyOn(useAuthActual, 'useAuth').mockReturnValue({ user, loading });
  return useAuthActual;
};

// Global flag to indicate if emulators are connected (tests can check this)
// This would typically be set by an environment variable via firebase emulators:exec
global.EMULATORS_CONNECTED = !!process.env.FIRESTORE_EMULATOR_HOST;

// Mock for RTDB `onValue` and `push` if needed for tests not hitting emulators,
// but for emulator tests, we want the real SDK.
// jest.mock('firebase/database', () => {
//   const actualDb = jest.requireActual('firebase/database');
//   return {
//     ...actualDb,
//     ref: jest.fn(),
//     onValue: jest.fn((ref, callback) => {
//       // Simulate initial data or no data
//       // callback({ exists: () => false, val: () => null });
//       return jest.fn(); // unsubscribe function
//     }),
//     push: jest.fn(() => Promise.resolve({ key: 'mock-pushed-key' })),
//     serverTimestamp: jest.fn(() => Date.now()),
//     off: jest.fn(),
//   };
// });

console.log(`EMULATORS_CONNECTED: ${global.EMULATORS_CONNECTED}`);
if (global.EMULATORS_CONNECTED) {
  console.log('Jest setup: Firebase SDKs should connect to emulators.');
} else {
  console.warn('Jest setup: Firebase SDKs will NOT connect to emulators (emulator env vars not set). Some tests may behave differently or fail.');
}

// To deal with "Could not parse CSS stylesheet" from Radix UI in tests
// See: https://github.com/radix-ui/primitives/issues/2269
if (typeof window !== 'undefined') {
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = (elt, pseudoElt) => {
    try {
      return originalGetComputedStyle(elt, pseudoElt);
    } catch (error) {
      // Fallback for environments where getComputedStyle might fail with certain elements
      console.warn('jsdom.getComputedStyle failed, returning empty CSSStyleDeclaration', error);
      const style = {}; // Removed 'as CSSStyleDeclaration'
      // Populate with some common properties if necessary, or just return empty
      return style as CSSStyleDeclaration; // Keep cast for return type if needed by TS, but JS object is plain
    }
  };
}
