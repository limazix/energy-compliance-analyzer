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

// Define a custom type for our mock DatabaseReference that includes _databaseInstance
export interface MockDatabaseReference extends DatabaseReference {
  _databaseInstance: Database;
}

export interface FirebaseDatabaseMock {
  getDatabase: jest.Mock<Database, []>;
  ref: jest.Mock<MockDatabaseReference, [Database, string?]>;
  onValue: jest.Mock<Unsubscribe, [Query, (snapshot: DataSnapshot) => void]>;
  push: jest.Mock<MockDatabaseReference, [DatabaseReference, Partial<MockRTDBMessage>]>;
  update: jest.Mock<Promise<void>, [DatabaseReference, Partial<MockRTDBMessage>]>;
  serverTimestamp: jest.Mock<object, []>;
  off: jest.Mock<void, [Query, string?, ((a: DataSnapshot | null) => unknown)?]>;
  child: jest.Mock<MockDatabaseReference, [DatabaseReference, string]>;
  // Expose mock instances for test manipulation
  __mockGetDatabase: jest.Mock<Database, []>;
  __mockRef: jest.Mock<MockDatabaseReference, [Database, string?]>;
  __mockOnValue: jest.Mock<Unsubscribe, [Query, (snapshot: DataSnapshot) => void]>;
  __mockPush: jest.Mock<MockDatabaseReference, [DatabaseReference, Partial<MockRTDBMessage>]>;
  __mockUpdate: jest.Mock<Promise<void>, [DatabaseReference, Partial<MockRTDBMessage>]>;
  __mockServerTimestamp: jest.Mock<object, []>;
  __mockOff: jest.Mock<void, [Query, string?, ((a: DataSnapshot | null) => unknown)?]>;
  __mockChild: jest.Mock<MockDatabaseReference, [DatabaseReference, string]>;
}

// Define mock functions *within* the factory scope
const mockGetDatabaseInternal = jest.fn(
  () => ({}) as Database
) as FirebaseDatabaseMock['getDatabase'];

const mockRefInternal = jest.fn(
  (db: Database, path?: string): MockDatabaseReference =>
    ({
      key: path?.split('/').pop() || null,
      parent: null, // Simplified
      root: null, // Simplified
      _databaseInstance: db, // Store the Database instance
      // Implement toString to return the path for the mock
      toString: () => path || 'mock-db-path',
      // Add other DatabaseReference properties/methods if needed by tests
      // For example, a basic toJSON:
      toJSON: () => ({ path }),
    }) as unknown as MockDatabaseReference // Cast to our extended type
) as FirebaseDatabaseMock['ref'];

const mockOnValueInternal = jest.fn() as FirebaseDatabaseMock['onValue'];
const mockPushInternal = jest.fn() as FirebaseDatabaseMock['push'];
const mockUpdateInternal = jest.fn() as FirebaseDatabaseMock['update'];
const mockServerTimestampInternal = jest.fn() as FirebaseDatabaseMock['serverTimestamp'];
const mockOffInternal = jest.fn() as FirebaseDatabaseMock['off'];

const mockChildInternal = jest.fn(
  (parentRef: DatabaseReference, childPath: string): MockDatabaseReference =>
    ({
      ...(parentRef as object), // Spread parent properties
      key: childPath,
      // Construct child path correctly using parent's toString()
      toString: () => `${parentRef.toString()}/${childPath}`,
      // Other child ref properties as needed
      _databaseInstance: (parentRef as MockDatabaseReference)._databaseInstance, // Inherit database instance
      parent: parentRef, // Set parent
    }) as unknown as MockDatabaseReference // Cast to our extended type
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
