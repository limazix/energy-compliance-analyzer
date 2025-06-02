
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
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => {
    const icons = {};
    const handler = {
        get: (target, prop) => {
            if (prop === '__esModule') return true;
            // Return a mock component for any icon name
            return (props) => {
              // Ensure props is always an object
              const { children, ...restProps } = props || {};
              return <svg data-lucide-mock={String(prop)} {...restProps}>{children}</svg>;
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

// Mock Firebase services (basic stubs)
jest.mock('@/lib/firebase', () => ({
  auth: {
    onAuthStateChanged: jest.fn((auth, callback) => {
      const unsubscribe = jest.fn();
      // Simulate no user initially or pass a mock user if needed by default
      callback(null);
      return unsubscribe;
    }),
    signInWithPopup: jest.fn(() => Promise.resolve({ user: { uid: 'mock-uid' }})),
    signOut: jest.fn(() => Promise.resolve()),
  },
  db: {}, // Firestore instance mock for server actions
  storage: {}, // Storage instance mock for server actions
  googleProvider: {},
  initializeApp: jest.fn(),
  getApps: jest.fn(() => []),
  getApp: jest.fn(),
  getAuth: jest.fn(() => ({
     onAuthStateChanged: jest.fn((auth, callback) => {
      const unsubscribe = jest.fn();
      callback(null);
      return unsubscribe;
    }),
    signInWithPopup: jest.fn(() => Promise.resolve({ user: { uid: 'mock-uid' }})),
    signOut: jest.fn(() => Promise.resolve()),
  })),
  getFirestore: jest.fn(() => ({})), // Mock for client-side direct Firestore usage if any
  getStorage: jest.fn(),
  connectAuthEmulator: jest.fn(),
  connectFirestoreEmulator: jest.fn(),
  connectStorageEmulator: jest.fn(),
}));


// Mock Server Actions
jest.mock('@/app/actions', () => ({
  processAnalysisFile: jest.fn(() => Promise.resolve()),
  getPastAnalysesAction: jest.fn(() => Promise.resolve([])),
  addTagToAction: jest.fn(() => Promise.resolve()),
  removeTagAction: jest.fn(() => Promise.resolve()),
  deleteAnalysisAction: jest.fn((userId, analysisId) => Promise.resolve()),
}));

jest.mock('@/features/file-upload/actions/fileUploadActions', () => ({
  createInitialAnalysisRecordAction: jest.fn((userId, fileName) => Promise.resolve({ analysisId: `mock-analysis-id-for-${fileName}` })),
  updateAnalysisUploadProgressAction: jest.fn(() => Promise.resolve({ success: true })),
  finalizeFileUploadRecordAction: jest.fn(() => Promise.resolve({ success: true })),
  markUploadAsFailedAction: jest.fn(() => Promise.resolve({ success: true })),
}));

// Mock useAnalysisManager
const mockSetCurrentAnalysis = jest.fn();
const mockFetchPastAnalyses = jest.fn(() => Promise.resolve());
const mockStartAiProcessing = jest.fn(() => Promise.resolve());
const mockHandleDeleteAnalysis = jest.fn((id, cb) => { cb?.(); return Promise.resolve(); });

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

// Mock firebase/firestore functions used directly in components if any (like page.tsx for getDoc)
const mockActualFirestore = jest.requireActual('firebase/firestore');
global.mockFirestoreGetDoc = jest.fn(() => Promise.resolve({
  exists: () => false,
  data: () => ({}),
  id: 'mock-doc-id'
}));
global.mockFirestoreDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  ...mockActualFirestore,
  getDoc: global.mockFirestoreGetDoc,
  doc: global.mockFirestoreDoc,
  Timestamp: mockActualFirestore.Timestamp, // Keep actual Timestamp
  serverTimestamp: mockActualFirestore.serverTimestamp,
  collection: mockActualFirestore.collection,
  query: mockActualFirestore.query,
  orderBy: mockActualFirestore.orderBy,
  where: mockActualFirestore.where,
  getDocs: jest.fn(() => Promise.resolve({ docs: [] })), // For getPastAnalyses if it were client-side
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  onSnapshot: jest.fn(() => jest.fn()), // Returns an unsubscribe function
}));


// Clear all mocks before each test
beforeEach(() => {
  mockRouterPush.mockClear();
  mockRouterReplace.mockClear();
  mockToastFn.mockClear();
  mockSetCurrentAnalysis.mockClear();
  mockFetchPastAnalyses.mockClear();
  mockStartAiProcessing.mockClear();
  mockHandleDeleteAnalysis.mockClear();
  mockUploadFileAndCreateRecord.mockClear();
  global.mockFirestoreGetDoc.mockClear().mockResolvedValue({ exists: () => false, data: () => ({}), id: 'mock-doc-id' });
  global.mockFirestoreDoc.mockClear();

  // Reset return values for hooks if they were changed in a test
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
  jest.requireMock('@/app/actions').getPastAnalysesAction.mockResolvedValue([]);
  jest.requireMock('@/features/file-upload/actions/fileUploadActions').createInitialAnalysisRecordAction.mockImplementation(
    (userId, fileName) => Promise.resolve({ analysisId: `mock-analysis-id-for-${fileName}` })
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
