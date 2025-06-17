'use strict';

/**
 * @fileOverview Firestore-triggered Firebase Function to handle analysis deletion requests.
 * This function is responsible for deleting associated files from Firebase Storage
 * and then updating the analysis document status to 'deleted'.
 *
 * Feature: Analysis Management (Event-Triggered)
 * Component: OnDeleteTrigger
 */
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Change, DocumentSnapshot } from 'firebase-functions/v1/firestore';

import { APP_CONFIG } from '../../lib/shared/config/appConfig';
import { deleteAdminFileFromStorage } from '../utils/storage';

// Initialize Firebase Admin SDK if not already initialized.
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const MAX_ERROR_MSG_LENGTH_FUNC = APP_CONFIG.MAX_SERVER_ERROR_MESSAGE_LENGTH;

/**
 * Handles the actual deletion of analysis data when status is 'pending_deletion'.
 * Triggered when an analysis document is updated to 'pending_deletion'.
 */
export const handleDeleteTrigger = functions
  .region(process.env.GCLOUD_REGION || 'us-central1') // Use env variable for region
  .firestore.document('users/{userId}/analyses/{analysisId}')
  .onUpdate(async (change: Change<DocumentSnapshot>, context: functions.EventContext) => {
    const analysisDataAfter = change.after.data() as {
      status?: string;
      powerQualityDataUrl?: string;
      mdxReportStoragePath?: string;
    };
    const { analysisId, userId } = context.params;

    const analysisRef = db.doc(`users/${userId}/analyses/${analysisId}`);

    // eslint-disable-next-line no-console
    console.info(
      `[Func_handleDeletion] Triggered for analysisId: ${analysisId}, userId: ${userId}. Status After: ${analysisDataAfter?.status}`
    );

    if (analysisDataAfter?.status !== 'pending_deletion') {
      // eslint-disable-next-line no-console
      console.info(
        `[Func_handleDeletion] Analysis ${analysisId} status is not 'pending_deletion' (${analysisDataAfter?.status}). Exiting.`
      );
      return null;
    }

    try {
      const { powerQualityDataUrl, mdxReportStoragePath } = analysisDataAfter;

      if (powerQualityDataUrl) {
        // eslint-disable-next-line no-console
        console.info(
          `[Func_handleDeletion] Deleting CSV from Storage: ${powerQualityDataUrl} for analysis ${analysisId}`
        );
        await deleteAdminFileFromStorage(powerQualityDataUrl);
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          `[Func_handleDeletion] No powerQualityDataUrl found for analysis ${analysisId}. Skipping CSV deletion.`
        );
      }

      if (mdxReportStoragePath) {
        // eslint-disable-next-line no-console
        console.info(
          `[Func_handleDeletion] Deleting MDX from Storage: ${mdxReportStoragePath} for analysis ${analysisId}`
        );
        await deleteAdminFileFromStorage(mdxReportStoragePath);
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          `[Func_handleDeletion] No mdxReportStoragePath found for analysis ${analysisId}. Skipping MDX deletion.`
        );
      }

      // After successful (or attempted) file deletions, update status to 'deleted'
      await analysisRef.update({
        status: 'deleted',
        errorMessage: 'Análise e arquivos associados foram excluídos com sucesso.',
        // Optionally clear out other fields if desired, but status 'deleted' should suffice
        // powerQualityDataUrl: null,
        // mdxReportStoragePath: null,
        // structuredReport: null,
        // powerQualityDataSummary: null,
      });
      // eslint-disable-next-line no-console
      console.info(
        `[Func_handleDeletion] Analysis ${analysisId} successfully processed for deletion. Status set to 'deleted'.`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(
        `[Func_handleDeletion] Error during deletion process for analysis ${analysisId}: ${errorMessage}`,
        error
      );
      try {
        await analysisRef.update({
          status: 'error', // Set to error if deletion process fails
          errorMessage: `Falha no processo de exclusão (Func): ${errorMessage.substring(0, MAX_ERROR_MSG_LENGTH_FUNC)}`,
        });
      } catch (updateError) {
        // eslint-disable-next-line no-console
        console.error(
          `[Func_handleDeletion] CRITICAL: Failed to update Firestore with error state for ${analysisId} after deletion failure:`,
          updateError
        );
      }
    }
    return null;
  });
