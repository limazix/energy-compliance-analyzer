/**
 * @fileoverview Firebase Storage mock setup for Jest.
 */
import { act } from '@testing-library/react';

import type {
  FirebaseStorage,
  StorageError,
  StorageReference,
  UploadMetadata,
  UploadTask,
  UploadTaskSnapshot,
  FullMetadata,
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
  pause: jest.Mock<boolean, []>;
  resume: jest.Mock<boolean, []>;
  cancel: jest.Mock<boolean, []>;
}

export interface FirebaseStorageMock {
  getStorage: jest.Mock<FirebaseStorage, []>;
  ref: jest.Mock<StorageReference, [FirebaseStorage | StorageReference, string?]>;
  uploadBytesResumable: jest.Mock<
    UploadTask,
    [StorageReference, Blob | Uint8Array | ArrayBuffer, UploadMetadata?]
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

  // Create a more complete FullMetadata mock
  const mockFullMetadata: FullMetadata = {
    bucket: 'fake-bucket',
    fullPath: 'mock/path/to/file.csv',
    name: 'file.csv',
    size: 100,
    timeCreated: new Date().toISOString(),
    updated: new Date().toISOString(),
    md5Hash: 'mockMd5Hash',
    cacheControl: undefined,
    contentDisposition: undefined,
    contentEncoding: undefined,
    contentLanguage: undefined,
    contentType: 'text/csv',
    customMetadata: undefined,
    // 'type' property was removed as it's not part of FullMetadata
    generation: 'mockGeneration',
    metageneration: 'mockMetageneration',
    downloadTokens: ['mock-token'],
  };

  const mockUploadTaskInternal: MockUploadTask = {
    on: jest.fn(
      (
        event: 'state_changed',
        progressCb?: (snapshot: UploadTaskSnapshot) => void,
        errorCb?: (error: StorageError) => void,
        completeCb?: () => void
      ): (() => void) => {
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
          metadata: mockFullMetadata,
          ref: snapshotRef,
          task: null as unknown as UploadTask, // Will be set below
        };
        progressSnapshot.task = mockUploadTaskInternal; // Circular reference setup

        if (event === 'state_changed' && progressCb) {
          act(() => progressCb({ ...progressSnapshot, bytesTransferred: 0 }));
          act(() => progressCb(progressSnapshot));
          act(() => progressCb({ ...progressSnapshot, bytesTransferred: 100, state: 'success' }));
        }
        if (event === 'state_changed' && completeCb) {
          Promise.resolve().then(() => act(() => completeCb()));
        }
        if (errorCb) {
          // Placeholder - you can simulate errors by calling errorCb
        }
        return jest.fn(); // Returns the unsubscribe function
      }
    ) as MockUploadTask['on'],
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
      metadata: mockFullMetadata,
      task: null as unknown as UploadTask, // Will be set below
    } as UploadTaskSnapshot,
    pause: jest.fn(() => true) as MockUploadTask['pause'],
    resume: jest.fn(() => true) as MockUploadTask['resume'],
    cancel: jest.fn(() => true) as MockUploadTask['cancel'],
    then: jest.fn((onFulfilled) =>
      Promise.resolve(onFulfilled(mockUploadTaskInternal.snapshot))
    ) as unknown as Promise<UploadTaskSnapshot>['then'],
    catch: jest.fn((onRejected) =>
      Promise.reject(onRejected(new Error('Mock Upload Error') as StorageError))
    ) as unknown as Promise<UploadTaskSnapshot>['catch'],
  };
  mockUploadTaskInternal.snapshot.task = mockUploadTaskInternal; // Complete circular reference

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
        parent: null, // Simplified for mock
        root: null, // Simplified for mock
        storage: {} as FirebaseStorage, // Simplified for mock
      } as unknown as StorageReference; // Cast to satisfy the return type
    }
  ) as FirebaseStorageMock['__mockRef'];

  const getDownloadURLMockInternal = jest.fn(
    (refParam: StorageReference): Promise<string> =>
      Promise.resolve(`https://fake.storage.googleapis.com/${refParam.bucket}/${refParam.fullPath}`)
  ) as FirebaseStorageMock['__mockGetDownloadURL'];

  const uploadBytesResumableMockInternal = jest.fn(
    (
      _ref: StorageReference,
      _data: Blob | Uint8Array | ArrayBuffer,
      _metadata?: UploadMetadata
    ): UploadTask => mockUploadTaskInternal
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
