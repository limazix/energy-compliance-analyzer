/**
 * @fileoverview Firebase Authentication mock setup for Jest.
 * This file sets up mocks for Firebase Auth SDK functions.
 * The mockAuthContext helper (which depends on .tsx files) has been moved
 * to frontend-specific.setup.ts to avoid JSX compilation issues in the backend test environment.
 */
import { act } from '@testing-library/react';

import type { Auth, AuthProvider, User, UserCredential } from 'firebase/auth';

// --- TypeScript Global Augmentation for custom properties on globalThis ---
// These are now primarily managed in custom-hooks.setup.ts where they are defined.
// We still need to ensure they are declared if this file somehow uses them before custom-hooks runs.
declare global {
  // eslint-disable-next-line no-var
  var mockFirebaseAuthUserForListener: User | null;
  // eslint-disable-next-line no-var
  var authStateListenerCallback: ((user: User | null) => void) | null;
}

// Initialize global variables if they haven't been by custom-hooks.setup.ts (though it should run first)
if (typeof globalThis.mockFirebaseAuthUserForListener === 'undefined') {
  globalThis.mockFirebaseAuthUserForListener = null;
}
if (typeof globalThis.authStateListenerCallback === 'undefined') {
  globalThis.authStateListenerCallback = null;
}
// --- End TypeScript Global Augmentation ---

// --- Firebase Auth Mock ---
export interface FirebaseAuthMock {
  GoogleAuthProvider: new () => AuthProvider; // Constructor type
  __setMockUserForAuthStateChangedListener: (user: User | null) => void;
  getAuth: jest.Mock<Auth, []>; // Explicitly type as taking no arguments
  onAuthStateChanged: jest.Mock<() => void, [Auth, (user: User | null) => void]>;
  signInWithPopup: jest.Mock<Promise<UserCredential>, [Auth, AuthProvider]>; // Updated type
  signOut: jest.Mock<Promise<void>, [Auth]>;
}

jest.mock('firebase/auth', (): FirebaseAuthMock => {
  const actualFirebaseAuth = jest.requireActual<typeof import('firebase/auth')>('firebase/auth');

  const __setMockUserForAuthStateChangedListener = (user: User | null): void => {
    globalThis.mockFirebaseAuthUserForListener = user;
    if (globalThis.authStateListenerCallback) {
      act(() => {
        if (globalThis.authStateListenerCallback) {
          globalThis.authStateListenerCallback(globalThis.mockFirebaseAuthUserForListener);
        }
      });
    }
  };

  const mockAuth = {
    currentUser: null,
    onAuthStateChanged: jest.fn(),
  } as unknown as Auth;

  return {
    GoogleAuthProvider: actualFirebaseAuth.GoogleAuthProvider,
    getAuth: jest.fn(() => mockAuth),
    onAuthStateChanged: jest.fn(
      (_authInstance: Auth, listener: (user: User | null) => void): (() => void) => {
        globalThis.authStateListenerCallback = listener;
        // Ensure initial state is propagated if listener is attached after user is set
        // This is typically handled by custom-hooks.setup.ts initializing the global var first.
        // Adding a check here to be safe.
        if (
          globalThis.authStateListenerCallback &&
          globalThis.mockFirebaseAuthUserForListener !== undefined
        ) {
          act(() => {
            if (globalThis.authStateListenerCallback) {
              // Double check due to act()
              globalThis.authStateListenerCallback(globalThis.mockFirebaseAuthUserForListener);
            }
          });
        }
        return jest.fn(); // Returns the unsubscribe function
      }
    ),
    signInWithPopup: jest.fn() as jest.Mock<Promise<UserCredential>, [Auth, AuthProvider]>, // Cast to specific mock type
    signOut: jest.fn() as jest.Mock<Promise<void>, [Auth]>, // Cast to specific mock type
    __setMockUserForAuthStateChangedListener,
  };
});
