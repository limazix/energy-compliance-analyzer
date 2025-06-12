/**
 * @fileoverview Firebase Authentication mock setup for Jest.
 */
import { act } from '@testing-library/react';

import type { Auth, User } from 'firebase/auth';

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
  GoogleAuthProvider: typeof import('firebase/auth').GoogleAuthProvider;
  __setMockUserForAuthStateChangedListener: (user: User | null) => void;
  getAuth: jest.Mock<Auth>;
  onAuthStateChanged: jest.Mock<() => void, [Auth, (user: User | null) => void]>;
  signInWithPopup: jest.Mock<Promise<{ user: User }>, [Auth, unknown]>;
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
        return jest.fn();
      }
    ),
    signInWithPopup: jest.fn(),
    signOut: jest.fn(),
    __setMockUserForAuthStateChangedListener,
  };
});
