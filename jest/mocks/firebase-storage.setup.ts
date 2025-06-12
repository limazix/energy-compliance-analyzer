/**
 * @fileoverview Firebase Storage mock setup for Jest.
 */
import { act } from '@testing-library/react';

import type {
  FirebaseStorage,
  StorageReference,
  UploadTaskSnapshot,
  UploadTask,
  StorageError,
  UploadMetadata,
} from 'firebase/storage';

export interface MockUploadTask extends UploadTask {
  // jest.Mock is generic, need to provide types for args and return of 'on'
  on: jest.Mock<
    () => void, // unsubscribe function
    [
      'state_changed',
      ((snapshot: UploadTaskSnapshot) => void)?,
      ((error: StorageError) => void)?,
      (() => void)?, // complete callback
    ]
  >;
  snapshot: UploadTaskSnapshot; // Already part of UploadTask
  pause: jest.Mock<boolean, []>; // Updated return type based on actual API
  resume: jest.Mock<boolean, []>; // Updated return type based on actual API
  cancel: jest.Mock<boolean, []>; // Updated return type based on actual API
}

export interface FirebaseStorageMock {
  getStorage: jest.Mock<FirebaseStorage, []>; // Explicitly type as taking no arguments
  ref: jest.Mock<StorageReference, [FirebaseStorage | StorageReference, string?]>;
  uploadBytesResumable: jest.Mock<
    UploadTask, // Use UploadTask as base, specific methods will be jest.Mock
    [StorageReference, Blob | Uint8Array | ArrayBuffer, UploadMetadata?] // Corrected type
  >;
  getDownloadURL: jest.Mock<Promise<string>, [StorageReference]>;
  // Expose mock instances for test manipulation
  __mockRef: jest.Mock<StorageReference, [FirebaseStorage | StorageReference, string?]>;
  __mockUploadBytesResumable: jest.Mock<
    UploadTask,
    [StorageReference, Blob | Uint8Array | ArrayBuffer, UploadMetadata?]
  >;
  __mockGetDownloadURL: jest.Mock<Promise<string>, [StorageReference]>;
  __mockUploadTask: MockUploadTask;
}

jest.mock('firebase/storage', (): FirebaseStorageMock => {
  const actualStorage = jest.requireActual<typeof import('firebase/storage')>('firebase/storage');

  const mockUploadTaskInternal: MockUploadTask = {
    on: jest.fn(
      (
        event: 'state_changed',
        progressCb?: (snapshot: UploadTaskSnapshot) => void,
        errorCb?: (error: StorageError) => void, // errorCb added
        completeCb?: () => void // completeCb added
      ): (() => void) => {
        // Simulate progress
        const snapshotRef = {
          toString: () => 'gs://fake-bucket/mock/path/to/file.csv',
          name: 'file.csv',
          bucket: 'fake-bucket',
          fullPath: 'mock/path/to/file.csv',
        } as StorageReference;

        const progressSnapshot: UploadTaskSnapshot = {
          bytesTransferred: 50,
          totalBytes: 100,
          state: 'running',
          metadata: { fullPath: 'mock/path/to/file.csv' } as UploadMetadata, // Cast to UploadMetadata
          ref: snapshotRef,
          task: mockUploadTaskInternal, // Reference to itself
        };
        const completeSnapshot: UploadTaskSnapshot = {
          bytesTransferred: 100,
          totalBytes: 100,
          state: 'success',
          metadata: { fullPath: 'mock/path/to/file.csv' } as UploadMetadata, // Cast to UploadMetadata
          ref: snapshotRef,
          task: mockUploadTaskInternal, // Reference to itself
        };

        if (event === 'state_changed' && progressCb) {
          act(() => progressCb({ ...progressSnapshot, bytesTransferred: 0 }));
          act(() => progressCb(progressSnapshot));
          act(() => progressCb({ ...progressSnapshot, bytesTransferred: 100 }));
        }
        if (event === 'state_changed' && completeCb) {
          // Simulate completion after some progress
          Promise.resolve().then(() => act(() => completeCb()));
        }
        if (errorCb) {
          // This is just a placeholder; real error simulation would be more complex
        }
        return jest.fn(); // Return unsubscribe function
      }
    ) as MockUploadTask['on'], // Cast to the more specific jest.Mock type
    snapshot: {
      ref: {
        toString: () => 'gs://fake-bucket/mock/path/to/file.csv',
        name: 'file.csv',
        bucket: 'fake-bucket',
        fullPath: 'mock/path/to/file.csv',
      } as StorageReference,
      bytesTransferred: 100,
      totalBytes: 100,
      state: 'success',
      metadata: { fullPath: 'mock/path/to/file.csv' } as UploadMetadata, // Cast
      task: null as unknown as UploadTask, // Will be set below
    } as UploadTaskSnapshot, // Initial snapshot
    pause: jest.fn(() => true) as MockUploadTask['pause'],
    resume: jest.fn(() => true) as MockUploadTask['resume'],
    cancel: jest.fn(() => true) as MockUploadTask['cancel'],
    then: jest.fn((onFulfilled) =>
      Promise.resolve(onFulfilled(mockUploadTaskInternal.snapshot))
    ) as unknown as Promise<UploadTaskSnapshot>['then'], // Cast 'then'
    catch: jest.fn((onRejected) =>
      Promise.reject(onRejected(new Error('Mock Upload Error') as StorageError))
    ) as unknown as Promise<UploadTaskSnapshot>['catch'], // Cast 'catch'
  };
  mockUploadTaskInternal.snapshot.task = mockUploadTaskInternal; // Self-reference

  const refMockInternal = jest.fn(
    (instanceOrRef: FirebaseStorage | StorageReference, path?: string): StorageReference => {
      const basePath =
        typeof (instanceOrRef as StorageReference).fullPath === 'string'
          ? (instanceOrRef as StorageReference).fullPath
          : '';
      const fullPath = path ? `${basePath}/${path}`.replace(/^\/+/, '') : basePath;

      return {
        toString: () => `gs://fake-bucket/${fullPath || 'undefined_path'}`,
        bucket: 'fake-bucket',
        fullPath: fullPath || 'undefined_path',
        name: fullPath ? fullPath.substring(fullPath.lastIndexOf('/') + 1) : 'undefined_filename',
        parent: null, // Simplified
        root: null, // Simplified
        storage: {} as FirebaseStorage, // Dummy storage
      } as unknown as StorageReference;
    }
  ) as FirebaseStorageMock['__mockRef'];

  const getDownloadURLMockInternal = jest.fn(
    (refParam: StorageReference): Promise<string> =>
      Promise.resolve(`https://fake.storage.googleapis.com/${refParam.bucket}/${refParam.fullPath}`)
  ) as FirebaseStorageMock['__mockGetDownloadURL'];

  const uploadBytesResumableMockInternal = jest.fn(
    (): UploadTask => mockUploadTaskInternal
  ) as FirebaseStorageMock['__mockUploadBytesResumable'];

  return {
    ...actualStorage,
    getStorage: jest.fn(() => ({}) as FirebaseStorage),
    ref: refMockInternal,
    uploadBytesResumable: uploadBytesResumableMockInternal,
    getDownloadURL: getDownloadURLMockInternal,
    __mockRef: refMockInternal,
    __mockUploadBytesResumable: uploadBytesResumableMockInternal,
    __mockGetDownloadURL: getDownloadURLMockInternal,
    __mockUploadTask: mockUploadTaskInternal,
  };
});
