import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
// Removed unused Change, DocumentSnapshot, EventContext, QueryDocumentSnapshot
// import {
//  DocumentSnapshot,
//  Change,
//  EventContext,
// } from 'firebase-functions/lib/v1/providers/firestore';
// import { QueryDocumentSnapshot } from 'firebase-functions/lib/v1/providers/firestore';

// Import modularized agent flows
import { analyzeReportFlow } from '@/ai/agents/complianceAnalyzerAgent'; // Assuming correct path
import { identifyResolutionsFlow } from '@/ai/agents/regulationIdentifierAgent'; // Assuming correct path
import { reviewReportFlow } from '@/ai/agents/reportReviewerAgent'; // Assuming correct path
import { summarizeDataChunkFlow } from '@/ai/agents/summarizerAgent'; // Assuming correct path

// Type imports
import type {
  AnalyzeComplianceReportInput,
  AnalyzeComplianceReportOutput,
} from '@/ai/prompt-configs/analyze-compliance-report-prompt-config'; // Adjust path if necessary
import type {
  IdentifyAEEEResolutionsInput,
  IdentifyAEEEResolutionsOutput,
} from '@/ai/prompt-configs/identify-aneel-resolutions-prompt-config'; // Adjust path if necessary
import type {
  ReviewComplianceReportInput,
  ReviewComplianceReportOutput,
} from '@/ai/prompt-configs/review-compliance-report-prompt-config'; // Adjust path if necessary
import type {
  SummarizePowerQualityDataInput,
  SummarizePowerQualityDataOutput,
} from '@/ai/prompt-configs/summarize-power-quality-data-prompt-config'; // Adjust path if necessary
import { APP_CONFIG } from '@/config/appConfig'; // Assuming appConfig.ts is in the correct path
import { convertStructuredReportToMdx } from '@/lib/reportUtils'; // Assuming correct path
import { getAdminFileContentFromStorage } from '@/utils/storage'; // Assuming correct path

interface AnalysisData {
  userId: string;
  fileName: string;
  fileType?: string; // Make optional if not always present
  status:
    | 'initial'
    | 'uploading'
    | 'processing'
    | 'summarizing_data'
    | 'identifying_regulations'
    | 'assessing_compliance'
    | 'reviewing_report'
    | 'completed'
    | 'failed' // Changed from 'error' to 'failed' for consistency if needed, or add 'failed'
    | 'error' // Keep 'error' if used
    | 'cancelling'
    | 'cancelled'
    | 'deleted' // Add 'deleted'
    | 'pending_deletion'; // Add 'pending_deletion'
  createdAt: admin.firestore.FieldValue | admin.firestore.Timestamp | string; // Allow string for ISO
  updatedAt?: admin.firestore.FieldValue | admin.firestore.Timestamp | string; // Allow string for ISO
  powerQualityDataUrl?: string;
  progress?: number;
  isDataChunked?: boolean;
  powerQualityDataSummary?: string;
  identifiedRegulations?: string[];
  structuredReport?: AnalyzeComplianceReportOutput;
  summary?: string;
  mdxReportStoragePath?: string;
  completedAt?: admin.firestore.FieldValue | admin.firestore.Timestamp | string; // Allow string for ISO
  errorMessage?: string | null;
  languageCode?: string;
}

// Initialize Firebase Admin SDK if not already done.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Firestore and Storage admin instances.
const db = admin.firestore();
const storageAdmin = admin.storage();

const CHUNK_SIZE = APP_CONFIG.ANALYSIS_CSV_CHUNK_SIZE_BYTES;
const OVERLAP_SIZE = APP_CONFIG.ANALYSIS_CSV_OVERLAP_SIZE_BYTES;

// Progress constants using APP_CONFIG
const PROGRESS_FILE_READ: number = APP_CONFIG.ANALYSIS_PROGRESS_STAGES.FILE_READ;
const PROGRESS_SUMMARIZATION_CHUNK_COMPLETE_BASE =
  APP_CONFIG.ANALYSIS_PROGRESS_STAGES.SUMMARIZATION_BASE;
const PROGRESS_SUMMARIZATION_TOTAL_SPAN = APP_CONFIG.ANALYSIS_PROGRESS_STAGES.SUMMARIZATION_SPAN;

const PROGRESS_IDENTIFY_REGULATIONS_COMPLETE =
  (PROGRESS_SUMMARIZATION_CHUNK_COMPLETE_BASE as number) +
  (PROGRESS_SUMMARIZATION_TOTAL_SPAN as number) +
  (APP_CONFIG.ANALYSIS_PROGRESS_STAGES.IDENTIFY_REGULATIONS_INCREMENT as number);

const PROGRESS_ANALYZE_COMPLIANCE_COMPLETE: number =
  (PROGRESS_IDENTIFY_REGULATIONS_COMPLETE as number) +
  (APP_CONFIG.ANALYSIS_PROGRESS_STAGES.ANALYZE_COMPLIANCE_INCREMENT as number);

const PROGRESS_REVIEW_REPORT_COMPLETE: number =
  (PROGRESS_ANALYZE_COMPLIANCE_COMPLETE as number) +
  (APP_CONFIG.ANALYSIS_PROGRESS_STAGES.REVIEW_REPORT_INCREMENT as number);

const PROGRESS_FINAL_COMPLETE: number = APP_CONFIG.PROGRESS_PERCENTAGE_FINAL_COMPLETE;
const MAX_ERROR_MSG_LENGTH: number = APP_CONFIG.MAX_SERVER_ERROR_MESSAGE_LENGTH;

/**
 * Checks if an analysis has been requested for cancellation.
 * If cancellation is detected and status was 'cancelling', updates status to 'cancelled'.
 * @async
 * @param {FirebaseFirestore.DocumentReference<AnalysisData>} analysisRef - Firestore document reference for the analysis.
 * @returns {Promise<boolean>} True if cancellation is detected and processed, false otherwise.
 */
async function checkCancellation(
  analysisRef: FirebaseFirestore.DocumentReference<AnalysisData>
): Promise<boolean> {
  const currentSnap = await analysisRef.get();
  if (currentSnap.exists) {
    const data = currentSnap.data() as AnalysisData | undefined;
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
 */
export const processAnalysisOnUpdate = functions
  .region(process.env.GCLOUD_REGION || 'us-central1') // Default region if not set
  .runWith({
    timeoutSeconds: 540, // Maximum execution time for the function.
    memory: '1GB', // Memory allocated to the function.
    // Allow function to access other Google services like AI Platform
    serviceAccount: process.env.FIREBASE_CONFIG
      ? undefined
      : 'core-analysis-onupdate@your-project-id.iam.gserviceaccount.com', // Replace with your service account if needed outside Firebase project default
  })
  .firestore.document('users/{userId}/analyses/{analysisId}')
  .onUpdate(async (change, context) => {
    const analysisDataAfter = change.after.data() as AnalysisData;
    const analysisDataBefore = change.before.data() as AnalysisData;
    const analysisId = context.params.analysisId;
    const userId = context.params.userId;
    const analysisRef = db.doc(
      `users/${userId}/analyses/${analysisId}`
    ) as FirebaseFirestore.DocumentReference<AnalysisData>; // Cast for type safety
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

    if (
      analysisDataAfter.status !== 'summarizing_data' ||
      (analysisDataBefore.status !== 'uploading' && analysisDataBefore.status !== 'error')
    ) {
      if (
        analysisDataAfter?.status === 'summarizing_data' &&
        analysisDataBefore?.status === 'summarizing_data' &&
        (analysisDataBefore?.progress ?? 0) < (analysisDataAfter?.progress ?? 0)
      ) {
        // Allow if progress is being made within summarizing_data
      } else {
        // eslint-disable-next-line no-console
        console.info(
          `[CoreAnalysis_OnUpdate] No action needed for status change from ${analysisDataBefore?.status} to ${analysisDataAfter?.status}. Exiting.`
        );
        return null;
      }
    } else if (
      analysisDataBefore.status === 'completed' &&
      analysisDataAfter.status === 'summarizing_data'
    ) {
      // eslint-disable-next-line no-console
      console.info(
        `[CoreAnalysis_OnUpdate] Analysis ${analysisId} was 'completed' but reset to 'summarizing_data'. Reprocessing allowed.`
      );
    } else if (analysisDataBefore.status === 'completed') {
      // eslint-disable-next-line no-console
      console.info(`[CoreAnalysis_OnUpdate] Analysis ${analysisId} already completed. Exiting.`);
      return null;
    }

    if (['completed', 'error', 'cancelled', 'failed'].includes(analysisDataBefore?.status || '')) {
      // Added 'failed'
      // Allow reprocessing if explicitly reset from an 'error' state to 'summarizing_data'
      // This provides a mechanism to retry failed analyses without manual database edits.
      // Ensure the client or another process handles the status update to 'summarizing_data'
      // for a retry.
      // Otherwise, do not re-process if the analysis was already in a terminal state.
      if (
        !(
          (
            (analysisDataBefore?.status === 'error' || analysisDataBefore?.status === 'failed') &&
            analysisDataAfter?.status === 'summarizing_data'
          ) // Added 'failed'
        )
      ) {
        // eslint-disable-next-line no-console
        console.info(
          `[CoreAnalysis_OnUpdate] Analysis ${analysisId} was in a terminal state '${analysisDataBefore?.status}' and not reset from error/failed. Exiting.`
        );
        return null;
      }
    }

    try {
      const filePath = analysisDataAfter.powerQualityDataUrl;
      const originalFileName = analysisDataAfter.fileName as string;
      const languageCode =
        analysisDataAfter.languageCode || (APP_CONFIG.DEFAULT_LANGUAGE_CODE as string);

      if (!filePath) {
        await analysisRef.update({
          status: 'error',
          errorMessage: 'URL do arquivo de dados não encontrada na Function.',
          progress: 0,
        });
        return null;
      }
      // Check for cancellation request early
      if (await checkCancellation(analysisRef)) return null;

      // eslint-disable-next-line no-console
      console.debug(`[CoreAnalysis_OnUpdate] Reading file: ${filePath}`);
      await analysisRef.update({ progress: 5 });
      const powerQualityDataCsv = await getAdminFileContentFromStorage(filePath as string);
      // eslint-disable-next-line no-console
      console.debug(
        `[CoreAnalysis_OnUpdate] File content read. Size: ${powerQualityDataCsv.length}.`
      );
      await analysisRef.update({ progress: PROGRESS_FILE_READ });

      if (await checkCancellation(analysisRef)) return null;

      const chunks: string[] = []; // Initialize chunks as an empty array of strings
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
          const summarizeInput: SummarizePowerQualityDataInput = {
            powerQualityDataCsv: chunk,
            languageCode,
          };
          const result = await summarizeDataChunkFlow.call(summarizeInput);
          // Check if result has an output property and is of the expected type
          const output: SummarizePowerQualityDataOutput | undefined = (
            result as { output?: SummarizePowerQualityDataOutput }
          ).output;

          if (!output?.dataSummary) throw new Error(`AI failed to summarize chunk ${i + 1}.`);
          aggregatedSummary += (output.dataSummary || '') + '\n\n';
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
        status: 'identifying_regulations', // Type-safe status update
        progress: PROGRESS_SUMMARIZATION_CHUNK_COMPLETE_BASE + PROGRESS_SUMMARIZATION_TOTAL_SPAN,
      });
      // eslint-disable-next-line no-console
      console.info(`[CoreAnalysis_OnUpdate] Summarization complete for ${analysisId}.`);

      if (await checkCancellation(analysisRef)) return null;

      // eslint-disable-next-line no-console
      console.debug(`[CoreAnalysis_OnUpdate] Identifying regulations for ${analysisId}.`);
      const identifyInput: IdentifyAEEEResolutionsInput = {
        powerQualityDataSummary: finalPowerQualityDataSummary,
        languageCode,
      }; // Type-safe input
      const resolutionsResult = await identifyResolutionsFlow.call(identifyInput);
      const resolutionsOutput: IdentifyAEEEResolutionsOutput | undefined = (
        resolutionsResult as { output?: IdentifyAEEEResolutionsOutput }
      ).output;

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

      // eslint-disable-next-line no-console
      console.debug(`[CoreAnalysis_OnUpdate] Analyzing compliance for ${analysisId}.`);
      const reportInput: AnalyzeComplianceReportInput = {
        powerQualityDataSummary: finalPowerQualityDataSummary,
        identifiedRegulations: identifiedRegulations.join(', '),
        fileName: originalFileName,
        languageCode,
      };
      const analyzeResult = await analyzeReportFlow.call(reportInput);
      const initialStructuredReport: AnalyzeComplianceReportOutput | undefined = (
        analyzeResult as { output?: AnalyzeComplianceReportOutput }
      ).output;

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

      // eslint-disable-next-line no-console
      console.debug(`[CoreAnalysis_OnUpdate] Reviewing structured report for ${analysisId}.`);
      const reviewInput: ReviewComplianceReportInput = {
        structuredReportToReview: initialStructuredReport, // Ensure type compatibility
        languageCode: languageCode,
      };
      const reviewResult = await reviewReportFlow.call(reviewInput);
      const reviewedStructuredReport: ReviewComplianceReportOutput | undefined = (
        reviewResult as { output?: ReviewComplianceReportOutput }
      ).output;

      if (!reviewedStructuredReport) {
        // eslint-disable-next-line no-console
        console.warn(
          // Log warning if the AI review failed
          // Fallback to using the initial report
          `[CoreAnalysis_OnUpdate] AI review failed. Using pre-review report for ${analysisId}.`
        );
        await analysisRef.update({
          structuredReport: initialStructuredReport,
          summary: (initialStructuredReport as AnalyzeComplianceReportOutput).introduction
            ?.overallResultsSummary,
          progress: PROGRESS_REVIEW_REPORT_COMPLETE,
        });
      } else {
        await analysisRef.update({
          structuredReport: reviewedStructuredReport,
          summary: (reviewedStructuredReport as AnalyzeComplianceReportOutput).introduction
            ?.overallResultsSummary,
          progress: PROGRESS_REVIEW_REPORT_COMPLETE,
        });
      }
      // eslint-disable-next-line no-console
      console.info(`[CoreAnalysis_OnUpdate] Report review complete for ${analysisId}.`);

      if (await checkCancellation(analysisRef)) return null;

      const finalReportForMdx =
        (reviewedStructuredReport as AnalyzeComplianceReportOutput | undefined) ||
        initialStructuredReport; // Use reviewed if available, otherwise initial

      const mdxContent = convertStructuredReportToMdx(finalReportForMdx, originalFileName);
      const mdxFilePath = `user_reports/${userId}/${analysisId}/report.mdx`;
      await storageAdmin
        .bucket()
        .file(mdxFilePath)
        .save(mdxContent, { contentType: 'text/markdown' });
      await analysisRef.update({ mdxReportStoragePath: mdxFilePath });

      await analysisRef.update({
        status: 'completed',
        progress: PROGRESS_FINAL_COMPLETE,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        errorMessage: null,
      });
      // eslint-disable-next-line no-console
      console.info(`[CoreAnalysis_OnUpdate] Analysis ${analysisId} completed successfully.`);
    } catch (error: unknown) {
      // Changed from any to unknown
      // eslint-disable-next-line no-console
      console.error(`[CoreAnalysis_OnUpdate] Error processing analysis ${analysisId}:`, error);
      let errorMessage = 'Erro desconhecido no processamento em segundo plano.';
      // Check if the error is a Genkit AI error or a standard Error
      if (
        error &&
        typeof error === 'object' &&
        (error as { isGenkitError?: boolean }).isGenkitError
      ) {
        // Type assertion
        const msg = (error as Error).message
          ? String((error as Error).message)
          : 'Detalhes do erro da IA não disponíveis';
        const stat = (error as { status?: string }).status
          ? String((error as { status?: string }).status)
          : 'Status da IA não disponível';
        const cd = (error as { code?: string }).code
          ? String((error as { code?: string }).code)
          : 'N/A';
        errorMessage = `AI Error: ${msg} (Status: ${stat}, Code: ${cd})`;
      } else if (error instanceof functions.https.HttpsError) {
        errorMessage = `Function Error: ${error.code} - ${error.message}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      try {
        // Attempt to get the latest state to avoid overwriting a cancellation status
        const currentSnap = await analysisRef.get(); // Get the latest snapshot
        if (currentSnap.exists) {
          const data = currentSnap.data(); // Get the data from the latest snapshot
          if (data?.status !== 'cancelling' && data?.status !== 'cancelled') {
            await analysisRef.update({
              status: 'error',
              errorMessage: `Falha (OnUpdate): ${errorMessage.substring(0, MAX_ERROR_MSG_LENGTH)}`,
            });
          }
        }
      } catch (updateError: unknown) {
        // Changed from any to unknown
        // eslint-disable-next-line no-console
        console.error(
          `[CoreAnalysis_OnUpdate] CRITICAL: Failed to update Firestore with error state for ${analysisId}:`,
          updateError
        ); // Use a separate console error for the update failure
      }
    }
    return null;
  });
