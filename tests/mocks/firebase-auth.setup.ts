/**
 * @fileoverview Firebase Authentication mock setup for Jest.
 */
import { act } from '@testing-library/react';

import type { Auth, AuthProvider, User, UserCredential } from 'firebase/auth';

// --- TypeScript Global Augmentation for custom properties on globalThis ---
declare global {
  // eslint-disable-next-line no-var
  var mockFirebaseAuthUserForListener: User | null;
  // eslint-disable-next-line no-var
  var authStateListenerCallback: ((user: User | null) => void) | null;
}

// Initialize global variables
globalThis.mockFirebaseAuthUserForListener = null;
globalThis.authStateListenerCallback = null;

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

  return {
    GoogleAuthProvider: actualFirebaseAuth.GoogleAuthProvider,
    getAuth: jest.fn(() => ({}) as Auth),
    onAuthStateChanged: jest.fn(
      (_authInstance: Auth, listener: (user: User | null) => void): (() => void) => {
        globalThis.authStateListenerCallback = listener;
        act(() => {
          if (globalThis.authStateListenerCallback) {
            globalThis.authStateListenerCallback(globalThis.mockFirebaseAuthUserForListener);
          }
        });
        return jest.fn(); // Returns the unsubscribe function
      }
    ),
    signInWithPopup: jest.fn() as jest.Mock<Promise<UserCredential>, [Auth, AuthProvider]>, // Cast to specific mock type
    signOut: jest.fn() as jest.Mock<Promise<void>, [Auth]>, // Cast to specific mock type
    __setMockUserForAuthStateChangedListener,
  };
});
