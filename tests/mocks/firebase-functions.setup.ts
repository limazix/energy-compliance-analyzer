/**
 * @fileoverview Firebase Functions mock setup for Jest.
 */
import type { FirebaseApp } from 'firebase/app';
import type { FirebaseFunctions, HttpsCallable, HttpsCallableResult } from 'firebase/functions';

// This object will store mocks keyed by function name for httpsCallable
export const mockHttpsCallableStore: Record<
  string,
  jest.Mock<Promise<HttpsCallableResult<unknown>>, [unknown?]>
> = {};

export interface FirebaseFunctionsMock {
  getFunctions: jest.Mock<FirebaseFunctions, [FirebaseApp?, string?]>;
  httpsCallable: jest.Mock<HttpsCallable<unknown, unknown>, [FirebaseFunctions, string]>;
  connectFunctionsEmulator: jest.Mock<void, [FirebaseFunctions, string, number]>;
  __mockHttpsCallableStore: typeof mockHttpsCallableStore; // Expose for clearing
}

jest.mock('firebase/functions', (): FirebaseFunctionsMock => {
  const actualFunctions =
    jest.requireActual<typeof import('firebase/functions')>('firebase/functions');

  const httpsCallableMock = jest.fn(
    (
      _functionsInstance: FirebaseFunctions,
      functionName: string
    ): HttpsCallable<unknown, unknown> => {
      if (!mockHttpsCallableStore[functionName]) {
        // Default mock implementation
        mockHttpsCallableStore[functionName] = jest.fn((_data?: unknown) =>
          Promise.resolve({
            data: { success: true, message: `Default mock for ${functionName}` },
          } as HttpsCallableResult<unknown>)
        );
      }
      // Return the specific mock function for this callable name
      return mockHttpsCallableStore[functionName] as HttpsCallable<unknown, unknown>;
    }
  ) as FirebaseFunctionsMock['httpsCallable'];

  return {
    ...actualFunctions,
    getFunctions: jest.fn(() => ({}) as FirebaseFunctions),
    httpsCallable: httpsCallableMock,
    connectFunctionsEmulator: jest.fn(),
    __mockHttpsCallableStore: mockHttpsCallableStore,
  };
});
