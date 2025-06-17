'use strict';

/**
 * @fileOverview Utility functions for Firebase Admin SDK to interact with Firebase Storage.
 * These are intended for use within Firebase Functions.
 * Feature: Utils
 * Component: Storage
 */

import * as admin from 'firebase-admin';

// Ensure Firebase Admin is initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const storageAdmin = admin.storage();
const MAX_ERROR_MSG_LENGTH_STORAGE = 250;

/**
 * Retrieves the content of a file from Firebase Storage using the Admin SDK.
 * @async
 * @param {string} filePath - The full path to the file in Firebase Storage.
 * @returns {Promise<string>} A promise that resolves with the file content as a UTF-8 string.
 * @throws {Error} If downloading or reading the file fails.
 */
export async function getAdminFileContentFromStorage(filePath: string): Promise<string> {
  if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
    // eslint-disable-next-line no-console
    console.error('[Utils_Storage_getContent] Invalid filePath provided:', filePath);
    throw new Error('File path is invalid or missing for storage read.');
  }
  const bucket = storageAdmin.bucket(); // Default bucket
  const file = bucket.file(filePath);

  // eslint-disable-next-line no-console
  console.debug(
    `[Utils_Storage_getContent] Reading from bucket: ${bucket.name}, path: ${filePath}`
  );

  try {
    const [exists] = await file.exists();
    if (!exists) {
      // eslint-disable-next-line no-console
      console.warn(`[Utils_Storage_getContent] File does not exist at path: ${filePath}`);
      throw new Error(`File not found at path: ${filePath}`);
    }
    const [content] = await file.download();
    return content.toString('utf-8');
  } catch (error: unknown) {
    // Changed from any to unknown
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(
      `[Utils_Storage_getContent] Error downloading file ${filePath}:`,
      errorMessage,
      error
    );
    throw new Error(
      `Failed to download file from storage (${filePath}): ${errorMessage.substring(
        0,
        MAX_ERROR_MSG_LENGTH_STORAGE
      )}`
    );
  }
}

/**
 * Deletes a file from Firebase Storage using the Admin SDK.
 * @async
 * @param {string} filePath - The full path to the file in Firebase Storage.
 * @returns {Promise<void>} A promise that resolves when the file is deleted.
 * @throws {Error} If deleting the file fails.
 */
export async function deleteAdminFileFromStorage(filePath: string): Promise<void> {
  if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
    // eslint-disable-next-line no-console
    console.warn('[Utils_Storage_deleteFile] Invalid filePath provided for deletion:', filePath);
    return;
  }
  const bucket = storageAdmin.bucket(); // Default bucket
  const file = bucket.file(filePath);

  // eslint-disable-next-line no-console
  console.info(
    `[Utils_Storage_deleteFile] Attempting to delete file from bucket: ${bucket.name}, path: ${filePath}`
  );

  try {
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
      // eslint-disable-next-line no-console
      console.info(`[Utils_Storage_deleteFile] File deleted successfully: ${filePath}`);
    } else {
      // eslint-disable-next-line no-console
      console.warn(`[Utils_Storage_deleteFile] File not found, cannot delete: ${filePath}`);
    }
  } catch (error: unknown) {
    // Changed from any to unknown
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(
      `[Utils_Storage_deleteFile] Error deleting file ${filePath}:`,
      errorMessage,
      error
    );
    // Do not throw an error for file deletion failures to allow Firestore status update to proceed
    // The error is logged, and the main operation (e.g., marking analysis as deleted) should still attempt to complete.
  }
}
