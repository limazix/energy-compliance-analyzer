'use server';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';

import { APP_CONFIG } from '@/config/appConfig';
import { storage } from '@/lib/firebase';

const CLIENT_ERROR_MESSAGE_MAX_LENGTH = APP_CONFIG.MAX_CLIENT_SERVER_ACTION_ERROR_MESSAGE_LENGTH;

export async function getFileContentFromStorage(filePath: string): Promise<string> {
  // eslint-disable-next-line no-console
  console.debug(`[getFileContentFromStorage] Attempting to download: ${filePath}`);
  const fileRef = storageRef(storage, filePath);
  let downloadURL;
  try {
    downloadURL = await getDownloadURL(fileRef);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(
      `[getFileContentFromStorage] Failed to get download URL for ${filePath}:`,
      errorMessage
    );
    throw new Error(`Failed to get download URL: ${errorMessage}`);
  }

  let response;
  try {
    response = await fetch(downloadURL);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(
      `[getFileContentFromStorage] Network error fetching ${downloadURL}:`,
      errorMessage
    );
    throw new Error(`Network error fetching file: ${errorMessage}`);
  }

  if (!response.ok) {
    let errorText = 'Could not read error response text.';
    try {
      errorText = await response.text();
    } catch (_e) {
      // Ignore if reading error text fails
    }
    // eslint-disable-next-line no-console
    console.error(
      `[getFileContentFromStorage] Failed to download. Status: ${response.status} ${response.statusText}. Body: ${errorText}`
    );
    throw new Error(
      `Failed to download file from GCS: ${response.statusText}. Details: ${errorText.substring(0, CLIENT_ERROR_MESSAGE_MAX_LENGTH)}`
    );
  }

  let textContent;
  try {
    textContent = await response.text();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(`[getFileContentFromStorage] Error reading response text:`, errorMessage);
    throw new Error(`Error reading file content: ${errorMessage}`);
  }
  return textContent;
}
