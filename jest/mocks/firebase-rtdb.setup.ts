/**
 * @fileoverview Firebase Realtime Database (RTDB) mock setup for Jest.
 */
import type { Database, DatabaseReference, DataSnapshot, Unsubscribe } from 'firebase/database';

interface MockRTDBMessage {
  id?: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: number | object;
  isError?: boolean;
}

export interface FirebaseDatabaseMock {
  getDatabase: jest.Mock<Database>;
  ref: jest.Mock<DatabaseReference, [Database, string?]>;
  onValue: jest.Mock<Unsubscribe, [DatabaseReference, (snapshot: DataSnapshot) => void]>;
  push: jest.Mock<Promise<DatabaseReference>, [DatabaseReference, Partial<MockRTDBMessage>]>;
  update: jest.Mock<Promise<void>, [DatabaseReference, Partial<MockRTDBMessage>]>;
  serverTimestamp: jest.Mock<object>;
  off: jest.Mock<void, [DatabaseReference, string?, ((a: DataSnapshot | null) => unknown)?]>;
  child: jest.Mock<DatabaseReference, [DatabaseReference, string]>;
  // Expose mock instances for test manipulation
  __mockGetDatabase: jest.Mock;
  __mockRef: jest.Mock;
  __mockOnValue: jest.Mock;
  __mockPush: jest.Mock;
  __mockUpdate: jest.Mock;
  __mockServerTimestamp: jest.Mock;
  __mockOff: jest.Mock;
  __mockChild: jest.Mock;
}

// Define mock functions *within* the factory scope
const mockGetDatabaseInternal = jest.fn(() => ({}) as Database);
const mockRefInternal = jest.fn(
  (db: Database, path?: string): DatabaseReference =>
    ({
      key: path?.split('/').pop() || null,
      path,
      toJSON: () => ({ path }), // Basic toJSON
      toString: () => path || '', // Basic toString
      parent: null, // Simplified
      root: null, // Simplified
      database: db, // Reference to the database instance
    }) as unknown as DatabaseReference
);
const mockOnValueInternal = jest.fn();
const mockPushInternal = jest.fn();
const mockUpdateInternal = jest.fn();
const mockServerTimestampInternal = jest.fn();
const mockOffInternal = jest.fn();
const mockChildInternal = jest.fn(
  (parentRef: DatabaseReference, childPath: string): DatabaseReference =>
    ({
      ...parentRef,
      path: `${(parentRef as { path: string }).path}/${childPath}`,
      key: childPath,
      toString: () => `${(parentRef as { path: string }).path}/${childPath}`,
    }) as unknown as DatabaseReference
);

jest.mock('firebase/database', (): FirebaseDatabaseMock => {
  const actualFirebaseDatabase =
    jest.requireActual<typeof import('firebase/database')>('firebase/database');

  // Initialize serverTimestamp with the actual Firebase value if possible, or a mock placeholder
  mockServerTimestampInternal.mockImplementation(() => actualFirebaseDatabase.serverTimestamp());

  return {
    ...actualFirebaseDatabase,
    getDatabase: mockGetDatabaseInternal,
    ref: mockRefInternal,
    onValue: mockOnValueInternal,
    push: mockPushInternal,
    update: mockUpdateInternal,
    serverTimestamp: mockServerTimestampInternal,
    off: mockOffInternal,
    child: mockChildInternal,
    __mockGetDatabase: mockGetDatabaseInternal,
    __mockRef: mockRefInternal,
    __mockOnValue: mockOnValueInternal,
    __mockPush: mockPushInternal,
    __mockUpdate: mockUpdateInternal,
    __mockServerTimestamp: mockServerTimestampInternal,
    __mockOff: mockOffInternal,
    __mockChild: mockChildInternal,
  };
});
