/**
 * @fileoverview Firebase Storage mock setup for Jest.
 */
import { act } from '@testing-library/react';

import type { FirebaseStorage, StorageReference, UploadTaskSnapshot } from 'firebase/storage';

export interface MockUploadTask {
  on: jest.Mock;
  snapshot: Partial<UploadTaskSnapshot>;
  pause: jest.Mock<void, []>;
  resume: jest.Mock<void, []>;
  cancel: jest.Mock<void, []>;
  then: jest.Mock<
    Promise<UploadTaskSnapshot>,
    [(value: UploadTaskSnapshot) => void, (reason: Error) => void]
  >;
  catch: jest.Mock<Promise<void>, [(reason: Error) => void]>;
}

export interface FirebaseStorageMock {
  getStorage: jest.Mock<FirebaseStorage>;
  ref: jest.Mock<StorageReference, [FirebaseStorage | StorageReference, string?]>;
  uploadBytesResumable: jest.Mock<
    MockUploadTask,
    [StorageReference, Blob | Uint8Array | ArrayBuffer, unknown?]
  >;
  getDownloadURL: jest.Mock<Promise<string>, [StorageReference]>;
  // Expose mock instances for test manipulation
  __mockRef: jest.Mock;
  __mockUploadBytesResumable: jest.Mock;
  __mockGetDownloadURL: jest.Mock;
  __mockUploadTask: MockUploadTask;
}

jest.mock('firebase/storage', (): FirebaseStorageMock => {
  const actualStorage = jest.requireActual<typeof import('firebase/storage')>('firebase/storage');

  const mockUploadTaskInternal: MockUploadTask = {
    on: jest.fn(
      (
        event: string,
        progressCb?: (snapshot: Partial<UploadTaskSnapshot>) => void,
        _errorCb?: (error: Error) => void, // Marked as unused
        completeCb?: (snapshot: Partial<UploadTaskSnapshot>) => void
      ) => {
        const snapshotRef = {
          toString: () => 'gs://fake-bucket/mock/path/to/file.csv',
          name: 'file.csv',
        } as StorageReference;
        const progressSnapshot: Partial<UploadTaskSnapshot> = {
          bytesTransferred: 50,
          totalBytes: 100,
          state: 'running',
          ref: snapshotRef,
        };
        const completeSnapshot: Partial<UploadTaskSnapshot> = {
          bytesTransferred: 100,
          totalBytes: 100,
          state: 'success',
          ref: snapshotRef,
          metadata: { fullPath: 'mock/path/to/file.csv' },
        };

        if (event === 'state_changed' && progressCb) {
          act(() => progressCb({ ...progressSnapshot, bytesTransferred: 0 }));
          act(() => progressCb(progressSnapshot));
          act(() => progressCb({ ...progressSnapshot, bytesTransferred: 100 }));
        }
        if (event === 'state_changed' && completeCb) {
          Promise.resolve().then(() => act(() => completeCb(completeSnapshot)));
        }
        return jest.fn();
      }
    ),
    snapshot: {
      ref: {
        toString: () => 'gs://fake-bucket/mock/path/to/file.csv',
        name: 'file.csv',
      } as StorageReference,
      bytesTransferred: 100,
      totalBytes: 100,
      state: 'success',
      metadata: { fullPath: 'mock/path/to/file.csv' },
    },
    pause: jest.fn(),
    resume: jest.fn(),
    cancel: jest.fn(),
    then: jest.fn((onFulfilled) =>
      Promise.resolve(onFulfilled(mockUploadTaskInternal.snapshot as UploadTaskSnapshot))
    ),
    catch: jest.fn(() => Promise.resolve()),
  };

  const refMockInternal = jest.fn(
    (instanceOrRef: FirebaseStorage | StorageReference, path?: string): StorageReference => {
      // Determine base path if instanceOrRef is a StorageReference
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
      } as unknown as StorageReference;
    }
  );

  const getDownloadURLMockInternal = jest.fn(
    (refParam: StorageReference): Promise<string> =>
      Promise.resolve(`https://fake.storage.googleapis.com/${refParam.bucket}/${refParam.fullPath}`)
  );
  const uploadBytesResumableMockInternal = jest.fn((): MockUploadTask => mockUploadTaskInternal);

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
