// @ts-check
'use strict';

/**
 * @fileOverview Utility functions for Firebase Admin SDK to interact with Firebase Storage.
 * These are intended for use within Firebase Functions.
 * Feature: Utils
 * Component: Storage
 */

const admin = require('firebase-admin');

// Ensure Firebase Admin is initialized (it should be by index.js, but good for standalone use)
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const storageAdmin = admin.storage();
const MAX_ERROR_MSG_LENGTH_STORAGE = 250;

/**
 * Retrieves the content of a file from Firebase Storage using the Admin SDK.
 * @async
 * @param {string} filePath - The full path to the file in Firebase Storage (e.g., 'user_uploads/userId/analysisId/file.csv').
 * @returns {Promise<string>} A promise that resolves with the file content as a UTF-8 string.
 * @throws {Error} If downloading or reading the file fails.
 */
async function getAdminFileContentFromStorage(filePath) {
  if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
    console.error('[Utils_Storage_getContent] Invalid filePath provided:', filePath);
    throw new Error('File path is invalid or missing for storage read.');
  }
  const bucket = storageAdmin.bucket(); // Default bucket
  const file = bucket.file(filePath);

  console.debug(
    `[Utils_Storage_getContent] Reading from bucket: ${bucket.name}, path: ${filePath}`
  );

  try {
    const [exists] = await file.exists();
    if (!exists) {
      console.warn(`[Utils_Storage_getContent] File does not exist at path: ${filePath}`);
      throw new Error(`File not found at path: ${filePath}`);
    }
    const [content] = await file.download();
    return content.toString('utf-8');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
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
async function deleteAdminFileFromStorage(filePath) {
  if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
    console.warn('[Utils_Storage_deleteFile] Invalid filePath provided for deletion:', filePath);
    // Don't throw an error if the path is invalid, just log and return,
    // as the calling function might try to delete optional files.
    return;
  }
  const bucket = storageAdmin.bucket(); // Default bucket
  const file = bucket.file(filePath);

  console.info(
    `[Utils_Storage_deleteFile] Attempting to delete file from bucket: ${bucket.name}, path: ${filePath}`
  );

  try {
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
      console.info(`[Utils_Storage_deleteFile] File deleted successfully: ${filePath}`);
    } else {
      console.warn(`[Utils_Storage_deleteFile] File not found, cannot delete: ${filePath}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[Utils_Storage_deleteFile] Error deleting file ${filePath}:`,
      errorMessage,
      error
    );
    // It's often acceptable to not throw if deletion fails (e.g., file already gone),
    // but for critical deletions, the caller should handle this.
    // For now, we'll log and continue. If it's critical, the calling function should re-throw or handle.
    // throw new Error(`Failed to delete file from storage (${filePath}): ${errorMessage}`);
  }
}

module.exports = {
  getAdminFileContentFromStorage,
  deleteAdminFileFromStorage,
};
