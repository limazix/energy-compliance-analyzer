/**
 * @fileoverview Frontend-specific Jest setup.
 * This file contains mocks and configurations that are only relevant to the frontend
 * test environment, especially those involving React components or hooks that
 * might import .tsx files (which would cause issues in the backend test env).
 */

import type { User } from 'firebase/auth';
import type { User } from 'firebase/auth';

// Import the custom-hooks setup for its global type declarations and variable initializations
// This file (frontend-specific) will be responsible for actually mocking the hooks.
import './custom-hooks.setup';
import type {
  MockAnalysisManagerReturnValue,
  MockFileUploadManagerReturnValue,
} from './custom-hooks.setup'; // Keep type imports grouped
// Import JSDOM polyfills specifically for the frontend environment
import './jsdom-polyfills.setup';
import './next-headers.setup';

// --- mockAuthContext Helper ---
interface UseAuthMockReturnValue {
  user: User | null;
  loading: boolean;
}

/**
 * Helper to mock the useAuth hook for specific tests.
 * @param {User | null} user - The mock user object or null.
 * @param {boolean} [loading=false] - The mock loading state.
 * @returns {typeof import('@/contexts/auth-context')} The mocked module.
 */
export const mockAuthContext = (
  user: User | null,
  loading = false
): typeof import('@/contexts/auth-context') => {
  const useAuthActual =
    jest.requireActual<typeof import('@/contexts/auth-context')>('@/contexts/auth-context');
  jest.spyOn(useAuthActual, 'useAuth').mockReturnValue({ user, loading } as UseAuthMockReturnValue);
  return useAuthActual;
};

// Mock useAuth (from @/contexts/auth-context)
// This mock is frontend-specific because auth-context.tsx is a .tsx file.
jest.mock('@/contexts/auth-context', () => {
  const actualAuthContext = jest.requireActual('@/contexts/auth-context');
  return {
    ...actualAuthContext,
    useAuth: jest.fn(() => ({
      // Default mock implementation
      user: (globalThis as { [key: string]: User | null }).mockFirebaseAuthUserForListener, // Use the global var for consistency
      loading: false,
    })),
  };
});

// Mock useAnalysisManager
jest.mock('@/hooks/useAnalysisManager', () => ({
  useAnalysisManager: jest.fn(
    (): MockAnalysisManagerReturnValue =>
      (
        globalThis as {
          [key: string]: MockAnalysisManagerReturnValue;
        }
      ).mockUseAnalysisManagerReturnValue
  ),
}));

// Mock useFileUploadManager
jest.mock('@/features/file-upload/hooks/useFileUploadManager', () => ({
  useFileUploadManager: jest.fn(
    (): MockFileUploadManagerReturnValue =>
      (
        globalThis as {
          [key: string]: MockFileUploadManagerReturnValue;
        }
      ).mockUseFileUploadManagerReturnValue
  ),
}));
