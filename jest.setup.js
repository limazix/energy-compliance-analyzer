
// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
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
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
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
  db: {}, // Add basic mocks for Firestore functions if needed globally
  storage: {}, // Add basic mocks for Storage functions if needed globally
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
  getFirestore: jest.fn(),
  getStorage: jest.fn(),
  connectAuthEmulator: jest.fn(),
  connectFirestoreEmulator: jest.fn(),
  connectStorageEmulator: jest.fn(),
}));
