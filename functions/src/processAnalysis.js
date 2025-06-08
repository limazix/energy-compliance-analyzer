
// @ts-check
'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { genkit } = require('genkit');
const { googleAI } = require('@genkit-ai/googleai');

// Importar configurações de prompt da pasta '../lib/shared' (onde serão compilados os .ts)
const {
  summarizePowerQualityDataPromptConfig,
} = require('../lib/shared/ai/prompt-configs/summarize-power-quality-data-prompt-config.js');
const {
  identifyAEEEResolutionsPromptConfig,
} = require('../lib/shared/ai/prompt-configs/identify-aneel-resolutions-prompt-config.js');
const {
  analyzeComplianceReportPromptConfig,
} = require('../lib/shared/ai/prompt-configs/analyze-compliance-report-prompt-config.js');
const {
  reviewComplianceReportPromptConfig,
} = require('../lib/shared/ai/prompt-configs/review-compliance-report-prompt-config.js');

const { convertStructuredReportToMdx } = require('../lib/shared/lib/reportUtils.js');


if (admin.apps.length === 0) {
  admin.initializeApp();
}

const firebaseRuntimeConfig = functions.config();
const geminiApiKeyFromConfig = firebaseRuntimeConfig && firebaseRuntimeConfig.gemini ? firebaseRuntimeConfig.gemini.apikey : undefined;

const geminiApiKey = process.env.GEMINI_API_KEY ||
                     geminiApiKeyFromConfig ||
                     process.env.NEXT_PUBLIC_GEMINI_API_KEY;

if (!geminiApiKey) {
  console.error("CRITICAL: GEMINI_API_KEY not found for Firebase Functions. Genkit AI calls WILL FAIL.");
}

const ai = genkit({
  plugins: [googleAI({ apiKey: geminiApiKey })],
});

const summarizeDataChunkFlow = ai.definePrompt(summarizePowerQualityDataPromptConfig);
const identifyResolutionsFlow = ai.definePrompt(identifyAEEEResolutionsPromptConfig);
const analyzeReportFlow = ai.definePrompt(analyzeComplianceReportPromptConfig);
const reviewReportFlow = ai.definePrompt(reviewComplianceReportPromptConfig);


const db = admin.firestore();
const storageAdmin = admin.storage(); // Renomeado de 'storage' para 'storageAdmin'
const rtdbAdmin = admin.database(); // Adicionado: Inicialização do RTDB com Admin SDK

console.info('[Function_processAnalysis] Admin SDK for RTDB initialized, root URL (if configured for emulators/prod):', rtdbAdmin.ref().toString());

const CHUNK_SIZE = 100000;
const OVERLAP_SIZE = 10000;

const PROGRESS_FILE_READ = 10;
const PROGRESS_SUMMARIZATION_CHUNK_COMPLETE_BASE = 15;
const PROGRESS_SUMMARIZATION_TOTAL_SPAN = 30; // 15 + 30 = 45
const PROGRESS_IDENTIFY_REGULATIONS_COMPLETE = PROGRESS_SUMMARIZATION_CHUNK_COMPLETE_BASE + PROGRESS_SUMMARIZATION_TOTAL_SPAN + 15; // 45 + 15 = 60
const PROGRESS_ANALYZE_COMPLIANCE_COMPLETE = PROGRESS_IDENTIFY_REGULATIONS_COMPLETE + 15; // 60 + 15 = 75
const PROGRESS_REVIEW_REPORT_COMPLETE = PROGRESS_ANALYZE_COMPLIANCE_COMPLETE + 15; // 75 + 15 = 90
const PROGRESS_FINAL_COMPLETE = 100;

const MAX_ERROR_MSG_LENGTH = 1000;


async function getFileContentFromStorage(filePath) {
  const bucketName = storageAdmin.bucket().name; // Usando storageAdmin
  console.debug(`[Function_getFileContent] Reading from bucket: ${bucketName}, path: ${filePath}`);
  const file = storageAdmin.bucket(bucketName).file(filePath); // Usando storageAdmin

  try {
    const [content] = await file.download();
    return content.toString('utf-8');
  } catch (error) {
    console.error(`[Function_getFileContent] Error downloading file ${filePath}:`, error);
    throw new functions.https.HttpsError('internal', `Failed to download file from storage: ${filePath}`, error);
  }
}

async function checkCancellation(analysisRef) {
  const currentSnap = await analysisRef.get();
  if (currentSnap.exists) {
    const data = currentSnap.data();
    if (data?.status === 'cancelling' || data?.status === 'cancelled') {
      console.info(`[Function_checkCancellation] Cancellation detected for ${analysisRef.id}. Status: ${data.status}.`);
      if (data.status === 'cancelling') {
        await analysisRef.update({ status: 'cancelled', errorMessage: 'Análise cancelada pelo usuário (detectado na Function).', progress: data.progress || 0 });
      }
      return true;
    }
  }
  return false;
}

exports.processAnalysisOnUpdate = functions
  .region(process.env.GCLOUD_REGION || 'us-central1') // Default region if not set
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB', // Pode ser ajustado conforme necessário
  })
  .firestore.document('users/{userId}/analyses/{analysisId}')
  .onUpdate(async (change, context) => {
    const analysisDataAfter = change.after.data();
    const analysisDataBefore = change.before.data();
    const analysisId = context.params.analysisId;
    const userId = context.params.userId;
    const analysisRef = db.doc(`users/${userId}/analyses/${analysisId}`);

    console.info(`[Function_processAnalysis] Triggered for analysisId: ${analysisId}, userId: ${userId}`);
    console.debug(`[Function_processAnalysis] Status Before: ${analysisDataBefore?.status}, Status After: ${analysisDataAfter?.status}`);
    console.debug(`[Function_processAnalysis] Progress Before: ${analysisDataBefore?.progress}, Progress After: ${analysisDataAfter?.progress}`);

    if (
      analysisDataAfter?.status !== 'summarizing_data' ||
      (analysisDataBefore?.status !== 'uploading' && analysisDataBefore?.status !== 'error')
    ) {
      if (analysisDataAfter?.status === 'summarizing_data' &&
        analysisDataBefore?.status === 'summarizing_data' &&
        analysisDataBefore?.progress < analysisDataAfter?.progress) {
        // Allow if progress is being made within summarizing_data
      } else {
        console.info(`[Function_processAnalysis] No action needed for status change from ${analysisDataBefore?.status} to ${analysisDataAfter?.status}. Exiting.`);
        return null;
      }
    }

    if (analysisDataBefore?.status === 'completed' && analysisDataAfter?.status === 'summarizing_data') {
      console.info(`[Function_processAnalysis] Analysis ${analysisId} was 'completed' but reset to 'summarizing_data'. Reprocessing allowed.`);
    } else if (analysisDataBefore?.status === 'completed') {
      console.info(`[Function_processAnalysis] Analysis ${analysisId} already completed. Exiting.`);
      return null;
    }

    if (['completed', 'error', 'cancelled'].includes(analysisDataBefore?.status || '')) {
      if (!(analysisDataBefore?.status === 'error' && analysisDataAfter?.status === 'summarizing_data')) {
        console.info(`[Function_processAnalysis] Analysis ${analysisId} was in a terminal state '${analysisDataBefore?.status}' and not reset from error. Exiting.`);
        return null;
      }
    }

    try {
      const filePath = analysisDataAfter.powerQualityDataUrl;
      const originalFileName = analysisDataAfter.fileName;
      const languageCode = analysisDataAfter.languageCode || 'pt-BR';

      if (!filePath) {
        await analysisRef.update({ status: 'error', errorMessage: 'URL do arquivo de dados não encontrada na Function.', progress: 0 });
        return null;
      }

      if (await checkCancellation(analysisRef)) return null;

      console.debug(`[Function_processAnalysis] Reading file: ${filePath}`);
      await analysisRef.update({ progress: 5 });
      const powerQualityDataCsv = await getFileContentFromStorage(filePath);
      console.debug(`[Function_processAnalysis] File content read. Size: ${powerQualityDataCsv.length}.`);
      await analysisRef.update({ progress: PROGRESS_FILE_READ });

      if (await checkCancellation(analysisRef)) return null;
      const chunks = [];
      if (powerQualityDataCsv.length > CHUNK_SIZE) {
        for (let i = 0; i < powerQualityDataCsv.length; i += (CHUNK_SIZE - OVERLAP_SIZE)) {
          chunks.push(powerQualityDataCsv.substring(i, Math.min(i + CHUNK_SIZE, powerQualityDataCsv.length)));
        }
      } else {
        chunks.push(powerQualityDataCsv);
      }
      await analysisRef.update({ isDataChunked: chunks.length > 1, progress: PROGRESS_SUMMARIZATION_CHUNK_COMPLETE_BASE - 1 });

      let aggregatedSummary = "";
      for (let i = 0; i < chunks.length; i++) {
        if (await checkCancellation(analysisRef)) return null;
        const chunk = chunks[i];
        console.debug(`[Function_processAnalysis] Summarizing ${analysisId}, chunk ${i + 1}/${chunks.length}.`);

        if (chunk.trim() === "") {
          console.warn(`[Function_processAnalysis] Chunk ${i + 1} for ${analysisId} is empty. Skipping.`);
        } else {
          const summarizeInput = { powerQualityDataCsv: chunk, languageCode };
          const { output } = await summarizeDataChunkFlow(summarizeInput);
          if (!output?.dataSummary) throw new Error(`AI failed to summarize chunk ${i + 1}.`);
          aggregatedSummary += (output.dataSummary || "") + "\n\n";
        }
        const currentChunkProgress = (i + 1) / chunks.length;
        await analysisRef.update({ progress: PROGRESS_SUMMARIZATION_CHUNK_COMPLETE_BASE + Math.round(currentChunkProgress * PROGRESS_SUMMARIZATION_TOTAL_SPAN) });
      }
      const finalPowerQualityDataSummary = aggregatedSummary.trim();
      await analysisRef.update({
        powerQualityDataSummary: finalPowerQualityDataSummary,
        status: 'identifying_regulations',
        progress: PROGRESS_SUMMARIZATION_CHUNK_COMPLETE_BASE + PROGRESS_SUMMARIZATION_TOTAL_SPAN,
      });
      console.info(`[Function_processAnalysis] Summarization complete for ${analysisId}.`);

      if (await checkCancellation(analysisRef)) return null;

      console.debug(`[Function_processAnalysis] Identifying regulations for ${analysisId}.`);
      const identifyInput = { powerQualityDataSummary: finalPowerQualityDataSummary, languageCode };
      const { output: resolutionsOutput } = await identifyResolutionsFlow(identifyInput);
      if (!resolutionsOutput?.relevantResolutions) throw new Error("AI failed to identify resolutions.");
      const identifiedRegulations = resolutionsOutput.relevantResolutions;
      await analysisRef.update({
        identifiedRegulations,
        status: 'assessing_compliance',
        progress: PROGRESS_IDENTIFY_REGULATIONS_COMPLETE,
      });
      console.info(`[Function_processAnalysis] Regulations identified for ${analysisId}.`);

      if (await checkCancellation(analysisRef)) return null;

      console.debug(`[Function_processAnalysis] Analyzing compliance for ${analysisId}.`);
      const reportInput = {
        powerQualityDataSummary: finalPowerQualityDataSummary,
        identifiedRegulations: identifiedRegulations.join(', '),
        fileName: originalFileName,
        languageCode
      };
      const { output: initialStructuredReport } = await analyzeReportFlow(reportInput);
      if (!initialStructuredReport) throw new Error("AI failed to generate initial compliance report.");

      await analysisRef.update({
        status: 'reviewing_report',
        progress: PROGRESS_ANALYZE_COMPLIANCE_COMPLETE,
      });
      console.info(`[Function_processAnalysis] Initial compliance analysis complete for ${analysisId}. Report ready for review.`);

      if (await checkCancellation(analysisRef)) return null;

      console.debug(`[Function_processAnalysis] Reviewing structured report for ${analysisId}.`);
      const reviewInput = {
        structuredReportToReview: initialStructuredReport,
        languageCode: languageCode,
      };
      const { output: reviewedStructuredReport } = await reviewReportFlow(reviewInput);
      if (!reviewedStructuredReport) {
        console.warn(`[Function_processAnalysis] AI review failed. Using pre-review report for ${analysisId}.`);
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
      console.info(`[Function_processAnalysis] Report review complete for ${analysisId}.`);

      if (await checkCancellation(analysisRef)) return null;

      const finalReportForMdx = reviewedStructuredReport || initialStructuredReport;

      const mdxContent = convertStructuredReportToMdx(finalReportForMdx, originalFileName);
      const mdxFilePath = `user_reports/${userId}/${analysisId}/report.mdx`;
      await storageAdmin.bucket().file(mdxFilePath).save(mdxContent, { contentType: 'text/markdown' }); // Usando storageAdmin
      await analysisRef.update({ mdxReportStoragePath: mdxFilePath });

      await analysisRef.update({
        status: 'completed',
        progress: PROGRESS_FINAL_COMPLETE,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        errorMessage: null,
      });
      console.info(`[Function_processAnalysis] Analysis ${analysisId} completed successfully.`);

    } catch (error) {
      console.error(`[Function_processAnalysis] Error processing analysis ${analysisId}:`, error);
      let errorMessage = 'Erro desconhecido no processamento em segundo plano.';
      if (error && typeof error === 'object' && 'isGenerativeAIError' in error && error.isGenerativeAIError === true) {
        const msg = error.message ? String(error.message) : 'Detalhes do erro da IA não disponíveis';
        const stat = error.status ? String(error.status) : 'Status da IA não disponível';
        const cd = error.code ? String(error.code) : 'N/A';
        errorMessage = `AI Error: ${msg} (Status: ${stat}, Code: ${cd})`;
      } else if (error instanceof functions.https.HttpsError) {
        errorMessage = `Function Error: ${error.code} - ${error.message}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      try {
        const currentSnap = await analysisRef.get();
        if (currentSnap.exists()) {
          const data = currentSnap.data();
          if (data?.status !== 'cancelling' && data?.status !== 'cancelled') {
            await analysisRef.update({
              status: 'error',
              errorMessage: `Falha (Function): ${errorMessage.substring(0, MAX_ERROR_MSG_LENGTH)}`,
            });
          }
        }
      } catch (updateError) {
        console.error(`[Function_processAnalysis] CRITICAL: Failed to update Firestore with error state for ${analysisId}:`, updateError);
      }
    }
    return null;
  });


    