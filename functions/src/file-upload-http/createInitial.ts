'use strict';

/**
 * @fileOverview HTTPS Callable Firebase Function for creating an initial analysis entry.
 * Feature: File Upload (HTTPS Callable)
 * Component: CreateInitial
 */
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

import { APP_CONFIG } from '@/config/appConfig'; // Path from functions/src to project root/src

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

const MAX_ERROR_MESSAGE_LENGTH = APP_CONFIG.MAX_SERVER_ERROR_MESSAGE_LENGTH;

interface RequestData {
  fileName: string;
  title?: string;
  description?: string;
  fileSize: number;
  fileType: string;
  languageCode?: string;
}

interface ResponseData {
  analysisId: string;
  signedUrl: string;
}

/**
 * Creates an initial analysis entry in Firestore and generates a signed URL for file upload.
 * @param {RequestData} data - The data object sent from the client.
 * @param {functions.https.CallableContext} context - The context of the call, containing auth information.
 * @returns {Promise<ResponseData>} A promise that resolves with the ID of the created analysis document and signed URL.
 * @throws {functions.https.HttpsError} If the user is not authenticated, arguments are invalid, or a Firestore/Storage error occurs.
 */
export const createInitialAnalysisEntry = functions.https.onCall(
  // Renamed to avoid conflict if exported differently for testing
  async (data: RequestData, context: functions.https.CallableContext): Promise<ResponseData> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'A função deve ser chamada por um usuário autenticado.'
      );
    }

    const userId = context.auth.uid;
    const { fileName, title, description, fileSize, fileType, languageCode } = data;

    if (!fileName || !fileType || typeof fileSize !== 'number' || fileSize <= 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required fields (fileName, fileType, fileSize must be > 0).'
      );
    }

    const trimmedFileName = fileName.trim();
    const finalTitle = title?.trim() || trimmedFileName;
    const finalDescription = description?.trim() || '';
    const finalLanguageCode = languageCode?.trim() || APP_CONFIG.DEFAULT_LANGUAGE_CODE;

    if (!trimmedFileName) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Nome do arquivo não pode ser vazio.'
      );
    }

    try {
      const analysisCollectionRef = db.collection('users').doc(userId).collection('analyses');
      const analysisRef = analysisCollectionRef.doc(); // Firestore generates a unique ID
      const analysisId = analysisRef.id;

      const storageFilePath = `user_uploads/${userId}/${analysisId}/${trimmedFileName}`;

      const bucket = admin.storage().bucket();
      const file = bucket.file(storageFilePath);

      const options: admin.storage.GetSignedUrlConfig = {
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000, // URL expires in 15 minutes
        contentType: fileType,
      };

      const [url] = await file.getSignedUrl(options);

      const initialAnalysisData: Record<string, unknown> = {
        // Changed from any to unknown
        userId: userId,
        fileName: trimmedFileName,
        title: finalTitle,
        description: finalDescription,
        languageCode: finalLanguageCode,
        fileSize: fileSize,
        fileType: fileType,
        storageFilePath: storageFilePath,
        status: 'uploading' as const,
        progress: 0,
        uploadProgress: 0,
        isDataChunked: false,
        tags: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        powerQualityDataUrl: null,
        powerQualityDataSummary: null,
        identifiedRegulations: null,
        structuredReport: null,
        mdxReportStoragePath: null,
        errorMessage: null,
        completedAt: null,
      };

      await analysisRef.set(initialAnalysisData);
      // eslint-disable-next-line no-console
      console.info(
        `[FileUpload_CreateInitial_Func] Created initial analysis entry ${analysisId} for user ${userId} with storage path ${storageFilePath}`
      );

      return { analysisId: analysisId, signedUrl: url };
    } catch (error: unknown) {
      // Changed from any to unknown
      const errorMessage = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(
        `[FileUpload_CreateInitial_Func] Firestore/Storage error for user ${userId}: ${errorMessage}`,
        error
      );
      throw new functions.https.HttpsError(
        'internal',
        `Falha ao criar registro inicial: ${errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH)}`
      );
    }
  }
);
export const httpsCreateInitialAnalysisRecord = createInitialAnalysisEntry; // Keep exported name if tests use it
