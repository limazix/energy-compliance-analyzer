// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { Timestamp } from 'firebase/firestore';
import React from 'react'; // Import React

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
        get: (_target, prop) => { // _target é o objeto proxy, prop é o nome do ícone
            if (prop === '__esModule') return true;
            // Retorna um componente funcional mockado para qualquer ícone
            const MockLucideIcon = (props) => {
              const { children, ...restProps } = props || {};
              // Usar React.createElement para criar o elemento SVG
              return React.createElement(
                'svg', // tipo do elemento
                { 'data-lucide-mock': String(prop), ...restProps }, // propriedades
                children // filhos
              );
            };
            MockLucideIcon.displayName = `LucideMock(${String(prop)})`; // Útil para debugging
            return MockLucideIcon;
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

// Mock next-mdx-remote/rsc
// This will prevent Jest from trying to parse its ESM code.
jest.mock('next-mdx-remote/rsc', () => {
  // const React = require('react'); // React já está importado no topo
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
global.mockUseAnalysisManagerReturnValue = {
  currentAnalysis: null,
  setCurrentAnalysis: jest.fn((newAnalysis) => {
    global.mockUseAnalysisManagerReturnValue.currentAnalysis = newAnalysis;
  }),
  pastAnalyses: [],
  isLoadingPastAnalyses: false,
  tagInput: '',
  setTagInput: jest.fn(),
  fetchPastAnalyses: jest.fn(() => Promise.resolve()),
  startAiProcessing: jest.fn(() => Promise.resolve()),
  handleAddTag: jest.fn(() => Promise.resolve()),
  handleRemoveTag: jest.fn(() => Promise.resolve()),
  handleDeleteAnalysis: jest.fn((id, cb) => { cb?.(); return Promise.resolve(); }),
  handleCancelAnalysis: jest.fn(() => Promise.resolve()),
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


global.Timestamp = Timestamp;


// Clear all mocks before each test
beforeEach(() => {
  mockRouterPush.mockClear();
  mockRouterReplace.mockClear();
  mockToastFn.mockClear();

  // Reset global useAnalysisManager mock state
  global.mockUseAnalysisManagerReturnValue.currentAnalysis = null;
  global.mockUseAnalysisManagerReturnValue.pastAnalyses = [];
  global.mockUseAnalysisManagerReturnValue.isLoadingPastAnalyses = false;
  global.mockUseAnalysisManagerReturnValue.displayedAnalysisSteps = [];
  (global.mockUseAnalysisManagerReturnValue.setCurrentAnalysis).mockClear();
  (global.mockUseAnalysisManagerReturnValue.setTagInput).mockClear();
  (global.mockUseAnalysisManagerReturnValue.fetchPastAnalyses).mockClear().mockResolvedValue(undefined);
  (global.mockUseAnalysisManagerReturnValue.startAiProcessing).mockClear().mockResolvedValue(undefined);
  (global.mockUseAnalysisManagerReturnValue.handleAddTag).mockClear().mockResolvedValue(undefined);
  (global.mockUseAnalysisManagerReturnValue.handleRemoveTag).mockClear().mockResolvedValue(undefined);
  (global.mockUseAnalysisManagerReturnValue.handleDeleteAnalysis).mockClear().mockImplementation((id, cb) => { cb?.(); return Promise.resolve(); });
  (global.mockUseAnalysisManagerReturnValue.handleCancelAnalysis).mockClear().mockResolvedValue(undefined);
  (global.mockUseAnalysisManagerReturnValue.downloadReportAsTxt).mockClear();


  // Reset global useFileUploadManager mock state
   global.mockUseFileUploadManagerReturnValue.fileToUpload = null;
   global.mockUseFileUploadManagerReturnValue.isUploading = false;
   global.mockUseFileUploadManagerReturnValue.uploadProgress = 0;
   global.mockUseFileUploadManagerReturnValue.uploadError = null;
  (global.mockUseFileUploadManagerReturnValue.handleFileSelection).mockClear();
  (global.mockUseFileUploadManagerReturnValue.uploadFileAndCreateRecord).mockClear().mockResolvedValue({ analysisId: 'mock-analysis-upload-id', fileName: 'mock-file.csv', error: null });


  // Reset server action mocks
  (jest.requireMock('@/features/analysis-listing/actions/analysisListingActions').getPastAnalysesAction).mockClear().mockResolvedValue([]);
  (jest.requireMock('@/features/file-upload/actions/fileUploadActions').createInitialAnalysisRecordAction).mockClear().mockImplementation(
    (userId, fileName) => Promise.resolve({ analysisId: `mock-analysis-id-for-${fileName}` })
  );
   (jest.requireMock('@/features/report-viewing/actions/reportViewingActions').getAnalysisReportAction).mockClear().mockResolvedValue(
     { mdxContent: '# Mock Report Default', fileName: 'mock-report-default.csv', analysisId: 'default-mock-analysis-id', error: null }
   );
   (jest.requireMock('@/features/report-chat/actions/reportChatActions').askReportOrchestratorAction).mockClear().mockResolvedValue(
     { success: true, aiMessageRtdbKey: 'mock-ai-key-default' }
   );
   (jest.requireMock('@/features/analysis-management/actions/analysisManagementActions').deleteAnalysisAction).mockClear().mockResolvedValue(undefined);
   (jest.requireMock('@/features/analysis-management/actions/analysisManagementActions').cancelAnalysisAction).mockClear().mockResolvedValue({ success: true });
   (jest.requireMock('@/features/analysis-processing/actions/analysisProcessingActions').processAnalysisFile).mockClear().mockResolvedValue({ success: true, analysisId: 'mock-analysis-id' });
   (jest.requireMock('@/features/tag-management/actions/tagActions').addTagToAction).mockClear().mockResolvedValue(undefined);
   (jest.requireMock('@/features/tag-management/actions/tagActions').removeTagAction).mockClear().mockResolvedValue(undefined);

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

global.EMULATORS_CONNECTED = !!process.env.FIRESTORE_EMULATOR_HOST;

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
      const style = {};
      // Populate with some common properties if necessary, or just return empty
      return style;
    }
  };
}
