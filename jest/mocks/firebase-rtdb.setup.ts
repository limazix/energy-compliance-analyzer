/**
 * @fileoverview Firebase Realtime Database (RTDB) mock setup for Jest.
 */
import type {
  Database,
  DatabaseReference,
  DataSnapshot,
  Unsubscribe,
  Query,
} from 'firebase/database';

interface MockRTDBMessage {
  id?: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: number | object;
  isError?: boolean;
}

export interface FirebaseDatabaseMock {
  getDatabase: jest.Mock<Database, []>; // Explicitly type as taking no arguments
  ref: jest.Mock<DatabaseReference, [Database, string?]>;
  onValue: jest.Mock<Unsubscribe, [Query, (snapshot: DataSnapshot) => void]>; // Query instead of DatabaseReference
  push: jest.Mock<DatabaseReference, [DatabaseReference, Partial<MockRTDBMessage>]>; // Promise<DatabaseReference> not needed as per firebase v9+ push returns ref sync
  update: jest.Mock<Promise<void>, [DatabaseReference, Partial<MockRTDBMessage>]>;
  serverTimestamp: jest.Mock<object, []>; // Explicitly type as taking no arguments
  off: jest.Mock<
    void,
    [Query, string?, ((a: DataSnapshot | null) => unknown)?] // Query instead of DatabaseReference
  >;
  child: jest.Mock<DatabaseReference, [DatabaseReference, string]>;
  // Expose mock instances for test manipulation
  __mockGetDatabase: jest.Mock<Database, []>;
  __mockRef: jest.Mock<DatabaseReference, [Database, string?]>;
  __mockOnValue: jest.Mock<Unsubscribe, [Query, (snapshot: DataSnapshot) => void]>;
  __mockPush: jest.Mock<DatabaseReference, [DatabaseReference, Partial<MockRTDBMessage>]>;
  __mockUpdate: jest.Mock<Promise<void>, [DatabaseReference, Partial<MockRTDBMessage>]>;
  __mockServerTimestamp: jest.Mock<object, []>;
  __mockOff: jest.Mock<void, [Query, string?, ((a: DataSnapshot | null) => unknown)?]>;
  __mockChild: jest.Mock<DatabaseReference, [DatabaseReference, string]>;
}

// Define mock functions *within* the factory scope
const mockGetDatabaseInternal = jest.fn(
  () => ({}) as Database
) as FirebaseDatabaseMock['getDatabase'];
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
) as FirebaseDatabaseMock['ref'];

const mockOnValueInternal = jest.fn() as FirebaseDatabaseMock['onValue'];
const mockPushInternal = jest.fn() as FirebaseDatabaseMock['push'];
const mockUpdateInternal = jest.fn() as FirebaseDatabaseMock['update'];
const mockServerTimestampInternal = jest.fn() as FirebaseDatabaseMock['serverTimestamp'];
const mockOffInternal = jest.fn() as FirebaseDatabaseMock['off'];
const mockChildInternal = jest.fn(
  (parentRef: DatabaseReference, childPath: string): DatabaseReference =>
    ({
      ...parentRef,
      path: `${(parentRef as { path: string }).path}/${childPath}`,
      key: childPath,
      toString: () => `${(parentRef as { path: string }).path}/${childPath}`,
    }) as unknown as DatabaseReference
) as FirebaseDatabaseMock['child'];

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
