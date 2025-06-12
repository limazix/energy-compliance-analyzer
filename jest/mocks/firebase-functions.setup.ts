/**
 * @fileoverview Firebase Functions mock setup for Jest.
 */
import type { FirebaseApp } from 'firebase/app';
import type { FirebaseFunctions, HttpsCallable } from 'firebase/functions';

// This object will store mocks keyed by function name for httpsCallable
export const mockHttpsCallableStore: Record<string, jest.Mock> = {};

export interface FirebaseFunctionsMock {
  getFunctions: jest.Mock<FirebaseFunctions, [FirebaseApp?, string?]>;
  httpsCallable: jest.Mock<HttpsCallable<unknown, unknown>, [FirebaseFunctions, string]>;
  connectFunctionsEmulator: jest.Mock<void, [FirebaseFunctions, string, number]>;
  __mockHttpsCallableStore: Record<string, jest.Mock>; // Expose for clearing
}

jest.mock('firebase/functions', (): FirebaseFunctionsMock => {
  const actualFunctions =
    jest.requireActual<typeof import('firebase/functions')>('firebase/functions');
  return {
    ...actualFunctions,
    getFunctions: jest.fn(() => ({}) as FirebaseFunctions),
    httpsCallable: jest.fn(
      (_functionsInstance: FirebaseFunctions, functionName: string): jest.Mock => {
        if (!mockHttpsCallableStore[functionName]) {
          mockHttpsCallableStore[functionName] = jest.fn((_data?: unknown) =>
            Promise.resolve({
              data: { success: true, message: `Default mock for ${functionName}` },
            })
          );
        }
        return mockHttpsCallableStore[functionName];
      }
    ) as jest.Mock<HttpsCallable<unknown, unknown>, [FirebaseFunctions, string]>,
    connectFunctionsEmulator: jest.fn(),
    __mockHttpsCallableStore: mockHttpsCallableStore,
  };
});
