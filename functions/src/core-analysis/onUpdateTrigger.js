// @ts-check
'use strict';

/**
 * @fileOverview Cloud Function for processing energy analysis data.
 * This function is triggered by Firestore updates and uses Genkit AI flows
 * to analyze power quality data, identify regulations, and generate reports.
 * Feature: Core Analysis
 * Component: onUpdateTrigger (Firestore Event-Triggered)
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Import modularized agent flows
const { summarizeDataChunkFlow } = require('../ai/agents/summarizerAgent.js');
const { identifyResolutionsFlow } = require('../ai/agents/regulationIdentifierAgent.js');
const { analyzeReportFlow } = require('../ai/agents/complianceAnalyzerAgent.js');
const { reviewReportFlow } = require('../ai/agents/reportReviewerAgent.js');

// Adjusted paths for shared modules (reportUtils is not an agent config)
const { convertStructuredReportToMdx } = require('../../lib/shared/lib/reportUtils.js');
const { getAdminFileContentFromStorage } = require('../utils/storage.js');

// Initialize Firebase Admin SDK if not already done.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Firestore, Storage, and RTDB admin instances.
const db = admin.firestore();
const storageAdmin = admin.storage();
const rtdbAdmin = admin.database();

// eslint-disable-next-line no-console
console.info(
  '[CoreAnalysis_OnUpdate] Admin SDK for RTDB initialized, root URL (if configured for emulators/prod):',
  rtdbAdmin.ref().toString()
);

/**
 * @constant {number} CHUNK_SIZE - Size of data chunks in bytes for processing large files.
 */
const CHUNK_SIZE = 100000;
/**
 * @constant {number} OVERLAP_SIZE - Size of overlap in bytes between data chunks.
 */
const OVERLAP_SIZE = 10000;

// Constants for tracking progress percentages at different stages of analysis.
const PROGRESS_FILE_READ = 10;
const PROGRESS_SUMMARIZATION_CHUNK_COMPLETE_BASE = 15;
const PROGRESS_SUMMARIZATION_TOTAL_SPAN = 30; // 15 + 30 = 45
const PROGRESS_IDENTIFY_REGULATIONS_COMPLETE =
  PROGRESS_SUMMARIZATION_CHUNK_COMPLETE_BASE + PROGRESS_SUMMARIZATION_TOTAL_SPAN + 15; // 45 + 15 = 60
const PROGRESS_ANALYZE_COMPLIANCE_COMPLETE = PROGRESS_IDENTIFY_REGULATIONS_COMPLETE + 15; // 60 + 15 = 75
const PROGRESS_REVIEW_REPORT_COMPLETE = PROGRESS_ANALYZE_COMPLIANCE_COMPLETE + 15; // 75 + 15 = 90
const PROGRESS_FINAL_COMPLETE = 100;

/**
 * @constant {number} MAX_ERROR_MSG_LENGTH - Maximum length for error messages stored in Firestore.
 */
const MAX_ERROR_MSG_LENGTH = 1000;

/**
 * Checks if an analysis has been requested for cancellation.
 * If cancellation is detected and status was 'cancelling', updates status to 'cancelled'.
 * @async
 * @param {FirebaseFirestore.DocumentReference} analysisRef - Firestore document reference for the analysis.
 * @returns {Promise<boolean>} True if cancellation is detected, false otherwise.
 */
async function checkCancellation(analysisRef) {
  const currentSnap = await analysisRef.get();
  if (currentSnap.exists) {
    const data = currentSnap.data();
    if (data?.status === 'cancelling' || data?.status === 'cancelled') {
      // eslint-disable-next-line no-console
      console.info(
        `[CoreAnalysis_CheckCancellation] Cancellation detected for ${analysisRef.id}. Status: ${data.status}.`
      );
      if (data.status === 'cancelling') {
        await analysisRef.update({
          status: 'cancelled',
          errorMessage: 'Análise cancelada pelo usuário (detectado na Function).',
          progress: data.progress || 0,
        });
      }
      return true;
    }
  }
  return false;
}

/**
 * Cloud Function triggered by updates to analysis documents in Firestore.
 * It orchestrates the AI-driven analysis pipeline.
 * @type {functions.CloudFunction<functions.Change<functions.firestore.DocumentSnapshot>>}
 */
exports.processAnalysisOnUpdate = functions
  .region(process.env.GCLOUD_REGION || 'us-central1') // Default region if not set
  .runWith({
    timeoutSeconds: 540, // Maximum execution time for the function.
    memory: '1GB', // Memory allocated to the function.
  })
  .firestore.document('users/{userId}/analyses/{analysisId}')
  .onUpdate(async (change, context) => {
    const analysisDataAfter = change.after.data();
    const analysisDataBefore = change.before.data();
    const analysisId = context.params.analysisId;
    const userId = context.params.userId;
    const analysisRef = db.doc(`users/${userId}/analyses/${analysisId}`);

    // eslint-disable-next-line no-console
    console.info(
      `[CoreAnalysis_OnUpdate] Triggered for analysisId: ${analysisId}, userId: ${userId}`
    );
    // eslint-disable-next-line no-console
    console.debug(
      `[CoreAnalysis_OnUpdate] Status Before: ${analysisDataBefore?.status}, Status After: ${analysisDataAfter?.status}`
    );
    // eslint-disable-next-line no-console
    console.debug(
      `[CoreAnalysis_OnUpdate] Progress Before: ${analysisDataBefore?.progress}, Progress After: ${analysisDataAfter?.progress}`
    );

    // Condition to check if the function should proceed based on status changes.
    if (
      analysisDataAfter?.status !== 'summarizing_data' ||
      (analysisDataBefore?.status !== 'uploading' && analysisDataBefore?.status !== 'error')
    ) {
      if (
        analysisDataAfter?.status === 'summarizing_data' &&
        analysisDataBefore?.status === 'summarizing_data' &&
        analysisDataBefore?.progress < analysisDataAfter?.progress
      ) {
        // Allow if progress is being made within summarizing_data (e.g., if function was restarted by Firebase)
      } else {
        // eslint-disable-next-line no-console
        console.info(
          `[CoreAnalysis_OnUpdate] No action needed for status change from ${analysisDataBefore?.status} to ${analysisDataAfter?.status}. Exiting.`
        );
        return null;
      }
    }

    // Allow reprocessing if reset from 'completed' to 'summarizing_data'.
    if (
      analysisDataBefore?.status === 'completed' &&
      analysisDataAfter?.status === 'summarizing_data'
    ) {
      // eslint-disable-next-line no-console
      console.info(
        `[CoreAnalysis_OnUpdate] Analysis ${analysisId} was 'completed' but reset to 'summarizing_data'. Reprocessing allowed.`
      );
    } else if (analysisDataBefore?.status === 'completed') {
      // eslint-disable-next-line no-console
      console.info(`[CoreAnalysis_OnUpdate] Analysis ${analysisId} already completed. Exiting.`);
      return null;
    }

    // Prevent reprocessing if in a terminal state, unless specifically reset from 'error'.
    if (['completed', 'error', 'cancelled'].includes(analysisDataBefore?.status || '')) {
      if (
        !(
          analysisDataBefore?.status === 'error' && analysisDataAfter?.status === 'summarizing_data'
        )
      ) {
        // eslint-disable-next-line no-console
        console.info(
          `[CoreAnalysis_OnUpdate] Analysis ${analysisId} was in a terminal state '${analysisDataBefore?.status}' and not reset from error. Exiting.`
        );
        return null;
      }
    }

    try {
      const filePath = analysisDataAfter.powerQualityDataUrl;
      const originalFileName = analysisDataAfter.fileName;
      const languageCode = analysisDataAfter.languageCode || 'pt-BR';

      if (!filePath) {
        await analysisRef.update({
          status: 'error',
          errorMessage: 'URL do arquivo de dados não encontrada na Function.',
          progress: 0,
        });
        return null;
      }

      if (await checkCancellation(analysisRef)) return null;

      // eslint-disable-next-line no-console
      console.debug(`[CoreAnalysis_OnUpdate] Reading file: ${filePath}`);
      await analysisRef.update({ progress: 5 }); // Initial progress update
      const powerQualityDataCsv = await getAdminFileContentFromStorage(filePath); // Use renamed utility
      // eslint-disable-next-line no-console
      console.debug(
        `[CoreAnalysis_OnUpdate] File content read. Size: ${powerQualityDataCsv.length}.`
      );
      await analysisRef.update({ progress: PROGRESS_FILE_READ });

      if (await checkCancellation(analysisRef)) return null;

      // Chunking data for large files
      const chunks = [];
      if (powerQualityDataCsv.length > CHUNK_SIZE) {
        for (let i = 0; i < powerQualityDataCsv.length; i += CHUNK_SIZE - OVERLAP_SIZE) {
          chunks.push(
            powerQualityDataCsv.substring(i, Math.min(i + CHUNK_SIZE, powerQualityDataCsv.length))
          );
        }
      } else {
        chunks.push(powerQualityDataCsv);
      }
      await analysisRef.update({
        isDataChunked: chunks.length > 1,
        progress: PROGRESS_SUMMARIZATION_CHUNK_COMPLETE_BASE - 1,
      });

      // Summarize data chunks
      let aggregatedSummary = '';
      for (let i = 0; i < chunks.length; i++) {
        if (await checkCancellation(analysisRef)) return null;
        const chunk = chunks[i];
        // eslint-disable-next-line no-console
        console.debug(
          `[CoreAnalysis_OnUpdate] Summarizing ${analysisId}, chunk ${i + 1}/${chunks.length}.`
        );

        if (chunk.trim() === '') {
          // eslint-disable-next-line no-console
          console.warn(
            `[CoreAnalysis_OnUpdate] Chunk ${i + 1} for ${analysisId} is empty. Skipping.`
          );
        } else {
          const summarizeInput = { powerQualityDataCsv: chunk, languageCode };
          const { output } = await summarizeDataChunkFlow(summarizeInput);
          if (!output?.dataSummary) throw new Error(`AI failed to summarize chunk ${i + 1}.`);
          aggregatedSummary += (output.dataSummary || '') + '\\n\\n';
        }
        const currentChunkProgress = (i + 1) / chunks.length;
        await analysisRef.update({
          progress:
            PROGRESS_SUMMARIZATION_CHUNK_COMPLETE_BASE +
            Math.round(currentChunkProgress * PROGRESS_SUMMARIZATION_TOTAL_SPAN),
        });
      }
      const finalPowerQualityDataSummary = aggregatedSummary.trim();
      await analysisRef.update({
        powerQualityDataSummary: finalPowerQualityDataSummary,
        status: 'identifying_regulations',
        progress: PROGRESS_SUMMARIZATION_CHUNK_COMPLETE_BASE + PROGRESS_SUMMARIZATION_TOTAL_SPAN,
      });
      // eslint-disable-next-line no-console
      console.info(`[CoreAnalysis_OnUpdate] Summarization complete for ${analysisId}.`);

      if (await checkCancellation(analysisRef)) return null;

      // Identify relevant regulations
      // eslint-disable-next-line no-console
      console.debug(`[CoreAnalysis_OnUpdate] Identifying regulations for ${analysisId}.`);
      const identifyInput = { powerQualityDataSummary: finalPowerQualityDataSummary, languageCode };
      const { output: resolutionsOutput } = await identifyResolutionsFlow(identifyInput);
      if (!resolutionsOutput?.relevantResolutions)
        throw new Error('AI failed to identify resolutions.');
      const identifiedRegulations = resolutionsOutput.relevantResolutions;
      await analysisRef.update({
        identifiedRegulations,
        status: 'assessing_compliance',
        progress: PROGRESS_IDENTIFY_REGULATIONS_COMPLETE,
      });
      // eslint-disable-next-line no-console
      console.info(`[CoreAnalysis_OnUpdate] Regulations identified for ${analysisId}.`);

      if (await checkCancellation(analysisRef)) return null;

      // Generate initial compliance report
      // eslint-disable-next-line no-console
      console.debug(`[CoreAnalysis_OnUpdate] Analyzing compliance for ${analysisId}.`);
      const reportInput = {
        powerQualityDataSummary: finalPowerQualityDataSummary,
        identifiedRegulations: identifiedRegulations.join(', '),
        fileName: originalFileName,
        languageCode,
      };
      const { output: initialStructuredReport } = await analyzeReportFlow(reportInput);
      if (!initialStructuredReport)
        throw new Error('AI failed to generate initial compliance report.');

      await analysisRef.update({
        status: 'reviewing_report',
        progress: PROGRESS_ANALYZE_COMPLIANCE_COMPLETE,
      });
      // eslint-disable-next-line no-console
      console.info(
        `[CoreAnalysis_OnUpdate] Initial compliance analysis complete for ${analysisId}. Report ready for review.`
      );

      if (await checkCancellation(analysisRef)) return null;

      // Review the structured report
      // eslint-disable-next-line no-console
      console.debug(`[CoreAnalysis_OnUpdate] Reviewing structured report for ${analysisId}.`);
      const reviewInput = {
        structuredReportToReview: initialStructuredReport,
        languageCode: languageCode,
      };
      const { output: reviewedStructuredReport } = await reviewReportFlow(reviewInput);
      if (!reviewedStructuredReport) {
        // eslint-disable-next-line no-console
        console.warn(
          `[CoreAnalysis_OnUpdate] AI review failed. Using pre-review report for ${analysisId}.`
        );
        await analysisRef.update({
          structuredReport: initialStructuredReport,
          summary: initialStructuredReport.introduction?.overallResultsSummary,
          progress: PROGRESS_REVIEW_REPORT_COMPLETE,
        });
      } else {
        await analysisRef.update({
          structuredReport: reviewedStructuredReport,
          summary: reviewedStructuredReport.introduction?.overallResultsSummary,
          progress: PROGRESS_REVIEW_REPORT_COMPLETE,
        });
      }
      // eslint-disable-next-line no-console
      console.info(`[CoreAnalysis_OnUpdate] Report review complete for ${analysisId}.`);

      if (await checkCancellation(analysisRef)) return null;

      // Convert report to MDX and save to Storage
      const finalReportForMdx = reviewedStructuredReport || initialStructuredReport;

      const mdxContent = convertStructuredReportToMdx(finalReportForMdx, originalFileName);
      const mdxFilePath = `user_reports/${userId}/${analysisId}/report.mdx`;
      await storageAdmin
        .bucket()
        .file(mdxFilePath)
        .save(mdxContent, { contentType: 'text/markdown' });
      await analysisRef.update({ mdxReportStoragePath: mdxFilePath });

      // Finalize analysis in Firestore
      await analysisRef.update({
        status: 'completed',
        progress: PROGRESS_FINAL_COMPLETE,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        errorMessage: null,
      });
      // eslint-disable-next-line no-console
      console.info(`[CoreAnalysis_OnUpdate] Analysis ${analysisId} completed successfully.`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[CoreAnalysis_OnUpdate] Error processing analysis ${analysisId}:`, error);
      let errorMessage = 'Erro desconhecido no processamento em segundo plano.';
      // @ts-ignore - Check if error is a GenerativeAIError
      if (
        error &&
        typeof error === 'object' &&
        'isGenerativeAIError' in error &&
        error.isGenerativeAIError === true
      ) {
        // @ts-ignore
        const msg = error.message
          ? String(error.message)
          : 'Detalhes do erro da IA não disponíveis';
        // @ts-ignore
        const stat = error.status ? String(error.status) : 'Status da IA não disponível';
        // @ts-ignore
        const cd = error.code ? String(error.code) : 'N/A';
        errorMessage = `AI Error: ${msg} (Status: ${stat}, Code: ${cd})`;
      } else if (error instanceof functions.https.HttpsError) {
        errorMessage = `Function Error: ${error.code} - ${error.message}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      // Attempt to update Firestore with error state, avoiding race conditions with cancellation.
      try {
        const currentSnap = await analysisRef.get();
        if (currentSnap.exists()) {
          const data = currentSnap.data();
          if (data?.status !== 'cancelling' && data?.status !== 'cancelled') {
            await analysisRef.update({
              status: 'error',
              errorMessage: `Falha (OnUpdate): ${errorMessage.substring(0, MAX_ERROR_MSG_LENGTH)}`,
              // Do not reset progress here, let it reflect where it failed.
            });
          }
        }
      } catch (updateError) {
        // eslint-disable-next-line no-console
        console.error(
          `[CoreAnalysis_OnUpdate] CRITICAL: Failed to update Firestore with error state for ${analysisId}:`,
          updateError
        );
      }
    }
    return null; // Firestore onUpdate functions should return null or a Promise.
  });
