import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { genkit, type GenerativeAIError } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'genkit/zod';

// Ensure admin is initialized (idempotent)
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Configure Genkit (IMPORTANT: API Key should be from Firebase Functions secrets/env vars)
// Example: const geminiApiKey = functions.config().gemini?.apikey;
// For local testing, you might use process.env.NEXT_PUBLIC_GEMINI_API_KEY if also set in .env for functions
const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!geminiApiKey) {
  console.warn("GEMINI_API_KEY not found in environment variables for Firebase Functions. Genkit AI calls will likely fail.");
}

const ai = genkit({
  plugins: [googleAI({ apiKey: geminiApiKey })],
});

// Schemas (should match those in your Next.js app)
const SummarizePowerQualityDataInputSchema = z.object({
  powerQualityDataCsv: z.string().describe('CSV chunk'),
  languageCode: z.string().optional().default('pt-BR'),
});
const SummarizePowerQualityDataOutputSchema = z.object({
  dataSummary: z.string().describe('Summary of the chunk'),
});

const IdentifyAEEEResolutionsInputSchema = z.object({
  powerQualityDataSummary: z.string().describe('Summary of power quality data'),
  languageCode: z.string().optional().default('pt-BR'),
});
const IdentifyAEEEResolutionsOutputSchema = z.object({
  relevantResolutions: z.array(z.string()).describe('List of relevant ANEEL resolutions'),
});

const AnalyzeComplianceReportInputSchema = z.object({
  powerQualityDataSummary: z.string().describe('Summary of power quality data'),
  identifiedRegulations: z.string().describe('Identified ANEEL regulations'),
  fileName: z.string().describe('Original file name'),
  languageCode: z.string().optional().default('pt-BR'),
});
const AnalyzeComplianceReportOutputSchema = z.object({
  reportMetadata: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    author: z.string(),
    generatedDate: z.string(),
  }),
  tableOfContents: z.array(z.string()).optional(),
  introduction: z.object({
    objective: z.string(),
    overallResultsSummary: z.string(),
    usedNormsOverview: z.string(),
  }),
  analysisSections: z.array(z.object({
    title: z.string(),
    content: z.string(),
    insights: z.array(z.string()),
    relevantNormsCited: z.array(z.string()),
    chartOrImageSuggestion: z.string().optional(),
  })),
  finalConsiderations: z.string(),
  bibliography: z.array(z.object({
    text: z.string(),
    link: z.string().url().optional(),
  })).optional(),
});


const db = admin.firestore();
const storage = admin.storage();

const CHUNK_SIZE = 100000; // 100KB per chunk for summarization
const OVERLAP_SIZE = 10000; // 10KB overlap

// Progress constants (relative to function steps, not overall client view)
const PROGRESS_FILE_READ = 10;
const PROGRESS_SUMMARIZATION_CHUNK_COMPLETE_BASE = 15; // Base after first chunk setup
const PROGRESS_SUMMARIZATION_TOTAL_SPAN = 35; // Summarization takes 35% (from 15 to 50)
const PROGRESS_IDENTIFY_REGULATIONS_COMPLETE = 65;
const PROGRESS_ANALYZE_COMPLIANCE_COMPLETE = 90;
const PROGRESS_FINAL_COMPLETE = 100;

const MAX_ERROR_MSG_LENGTH = 1000;


async function getFileContentFromStorage(filePath: string): Promise<string> {
  const bucketName = storage.bucket().name; // Or your specific bucket name if not default
  console.log(`[Function_getFileContent] Reading from bucket: ${bucketName}, path: ${filePath}`);
  const file = storage.bucket(bucketName).file(filePath);
  
  try {
    const [content] = await file.download();
    return content.toString('utf-8');
  } catch (error) {
    console.error(`[Function_getFileContent] Error downloading file ${filePath}:`, error);
    throw new functions.https.HttpsError('internal', `Failed to download file from storage: ${filePath}`, error);
  }
}

async function checkCancellation(analysisRef: admin.firestore.DocumentReference): Promise<boolean> {
  const currentSnap = await analysisRef.get();
  if (currentSnap.exists) {
    const data = currentSnap.data();
    if (data?.status === 'cancelling' || data?.status === 'cancelled') {
      console.log(`[Function_checkCancellation] Cancellation detected for ${analysisRef.id}. Status: ${data.status}.`);
      if (data.status === 'cancelling') {
        await analysisRef.update({ status: 'cancelled', errorMessage: 'Análise cancelada pelo usuário (detectado na Function).', progress: data.progress || 0 });
      }
      return true;
    }
  }
  return false;
}

// Define Genkit Prompts/Flows conceptually here or invoke deployed flows
// For simplicity, we'll simulate direct ai.generate calls
const summarizeDataChunkFlow = ai.definePrompt({
  name: 'summarizePowerQualityDataChunkInFunction',
  input: { schema: SummarizePowerQualityDataInputSchema },
  output: { schema: SummarizePowerQualityDataOutputSchema },
  prompt: `You are an expert power systems analyst... (full prompt as in Next.js app, adapted for language: {{languageCode}})

Power Quality CSV Data CHUNK:
{{powerQualityDataCsv}}
`,
});

const identifyResolutionsFlow = ai.definePrompt({
  name: 'identifyAEEEResolutionsInFunction',
  input: {schema: IdentifyAEEEResolutionsInputSchema},
  output: {schema: IdentifyAEEEResolutionsOutputSchema},
  prompt: `You are an expert in Brazilian electrical regulations... (full prompt as in Next.js app, for language: {{languageCode}})

Power Quality Data Summary:
{{powerQualityDataSummary}}`,
});

const analyzeReportFlow = ai.definePrompt({
  name: 'generateStructuredComplianceReportInFunction',
  input: {schema: AnalyzeComplianceReportInputSchema},
  output: {schema: AnalyzeComplianceReportOutputSchema},
  prompt: `Você é um especialista em engenharia elétrica... (full prompt as in Next.js app, for language: {{languageCode}})
Contexto:
- Arquivo: {{fileName}}
- Sumário: {{powerQualityDataSummary}}
- Resoluções: {{identifiedRegulations}}
`,
});


export const processAnalysisOnUpdate = functions
  .region('southamerica-east1') // Example region
  .runWith({
    timeoutSeconds: 540, // Max for gen1 HTTP, background can be longer
    memory: '1GB',    // Adjust as needed
  })
  .firestore.document('users/{userId}/analyses/{analysisId}')
  .onUpdate(async (change, context) => {
    const analysisDataAfter = change.after.data();
    const analysisDataBefore = change.before.data();
    const analysisId = context.params.analysisId;
    const userId = context.params.userId;
    const analysisRef = db.doc(`users/${userId}/analyses/${analysisId}`);

    console.log(`[Function_processAnalysis] Triggered for analysisId: ${analysisId}, userId: ${userId}`);
    console.log(`[Function_processAnalysis] Status Before: ${analysisDataBefore?.status}, Status After: ${analysisDataAfter?.status}`);
    console.log(`[Function_processAnalysis] Progress Before: ${analysisDataBefore?.progress}, Progress After: ${analysisDataAfter?.progress}`);


    if (
        analysisDataAfter?.status !== 'summarizing_data' ||
        (analysisDataBefore?.status !== 'uploading' && analysisDataBefore?.status !== 'error')
    ) {
        // Allow if status is 'summarizing_data' and it's a legitimate progress update by this function itself
        if (analysisDataAfter?.status === 'summarizing_data' &&
            analysisDataBefore?.status === 'summarizing_data' &&
            analysisDataBefore?.progress < analysisDataAfter?.progress) {
             // This is a continuation of processing by this function, allow it.
        } else {
            console.log(`[Function_processAnalysis] No action needed for status change from ${analysisDataBefore?.status} to ${analysisDataAfter?.status}. Exiting.`);
            return null;
        }
    }
    
    if (analysisDataBefore?.status === 'completed' && analysisDataAfter?.status === 'summarizing_data') {
        console.log(`[Function_processAnalysis] Analysis ${analysisId} was 'completed' but reset to 'summarizing_data'. Reprocessing allowed.`);
    } else if (analysisDataBefore?.status === 'completed') {
        console.log(`[Function_processAnalysis] Analysis ${analysisId} already completed. Exiting.`);
        return null;
    }


    // Ensure no processing occurs if already in a terminal state from this function's perspective
    if (['completed', 'error', 'cancelled'].includes(analysisDataBefore?.status || '')) {
        // If it was reset to 'summarizing_data' from 'error', allow reprocessing.
        if (!(analysisDataBefore?.status === 'error' && analysisDataAfter?.status === 'summarizing_data')) {
            console.log(`[Function_processAnalysis] Analysis ${analysisId} was in a terminal state '${analysisDataBefore?.status}' and not reset from error. Exiting.`);
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

      console.log(`[Function_processAnalysis] Reading file: ${filePath}`);
      await analysisRef.update({ progress: 5 }); // Indicate start of file reading
      const powerQualityDataCsv = await getFileContentFromStorage(filePath);
      console.log(`[Function_processAnalysis] File content read. Size: ${powerQualityDataCsv.length}.`);
      await analysisRef.update({ progress: PROGRESS_FILE_READ });


      if (await checkCancellation(analysisRef)) return null;
      const chunks: string[] = [];
      if (powerQualityDataCsv.length > CHUNK_SIZE) {
        for (let i = 0; i < powerQualityDataCsv.length; i += (CHUNK_SIZE - OVERLAP_SIZE)) {
          chunks.push(powerQualityDataCsv.substring(i, Math.min(i + CHUNK_SIZE, powerQualityDataCsv.length)));
        }
      } else {
        chunks.push(powerQualityDataCsv);
      }
      await analysisRef.update({ isDataChunked: chunks.length > 1, progress: PROGRESS_SUMMARIZATION_CHUNK_COMPLETE_BASE -1 });

      let aggregatedSummary = "";
      for (let i = 0; i < chunks.length; i++) {
        if (await checkCancellation(analysisRef)) return null;
        const chunk = chunks[i];
        console.log(`[Function_processAnalysis] Summarizing ${analysisId}, chunk ${i + 1}/${chunks.length}.`);
        
        if (chunk.trim() === "") {
            console.warn(`[Function_processAnalysis] Chunk ${i + 1} for ${analysisId} is empty. Skipping.`);
        } else {
            const summarizeInput = { powerQualityDataCsv: chunk, languageCode };
            const { output } = await summarizeDataChunkFlow(summarizeInput);
            if (!output?.dataSummary) throw new Error(`AI failed to summarize chunk ${i+1}.`);
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
      console.log(`[Function_processAnalysis] Summarization complete.`);

      if (await checkCancellation(analysisRef)) return null;

      console.log(`[Function_processAnalysis] Identifying regulations.`);
      const identifyInput = { powerQualityDataSummary: finalPowerQualityDataSummary, languageCode };
      const { output: resolutionsOutput } = await identifyResolutionsFlow(identifyInput);
      if (!resolutionsOutput?.relevantResolutions) throw new Error("AI failed to identify resolutions.");
      const identifiedRegulations = resolutionsOutput.relevantResolutions;
      await analysisRef.update({
        identifiedRegulations,
        status: 'assessing_compliance',
        progress: PROGRESS_IDENTIFY_REGULATIONS_COMPLETE,
      });
      console.log(`[Function_processAnalysis] Regulations identified.`);

      if (await checkCancellation(analysisRef)) return null;

      console.log(`[Function_processAnalysis] Analyzing compliance.`);
      const reportInput = {
        powerQualityDataSummary: finalPowerQualityDataSummary,
        identifiedRegulations: identifiedRegulations.join(', '),
        fileName: originalFileName,
        languageCode
      };
      const { output: structuredReportOutput } = await analyzeReportFlow(reportInput);
      if (!structuredReportOutput) throw new Error("AI failed to generate compliance report.");

      await analysisRef.update({
        structuredReport: structuredReportOutput,
        summary: structuredReportOutput.introduction?.overallResultsSummary,
        progress: PROGRESS_ANALYZE_COMPLIANCE_COMPLETE,
      });
      console.log(`[Function_processAnalysis] Compliance analysis complete.`);
      
      if (await checkCancellation(analysisRef)) return null;

      // MDX generation and upload (placeholder, you might do this in Next.js or here)
      // For now, we'll skip direct MDX generation in the function to simplify
      // const mdxContent = convertStructuredReportToMdx(structuredReportOutput, originalFileName); // If you move this util
      // const mdxFilePath = `user_reports/${userId}/${analysisId}/report.mdx`;
      // await storage.bucket().file(mdxFilePath).save(mdxContent, { contentType: 'text/markdown' });
      // await analysisRef.update({ mdxReportStoragePath: mdxFilePath });

      await analysisRef.update({
        status: 'completed',
        progress: PROGRESS_FINAL_COMPLETE,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        errorMessage: null,
      });
      console.log(`[Function_processAnalysis] Analysis ${analysisId} completed successfully.`);

    } catch (error: any) {
      console.error(`[Function_processAnalysis] Error processing analysis ${analysisId}:`, error);
      let errorMessage = 'Erro desconhecido no processamento em segundo plano.';
      if (error instanceof functions.https.HttpsError) {
        errorMessage = `Function Error: ${error.code} - ${error.message}`;
      } else if (error.isGenerativeAIError) { // Check if it's a Genkit error
        const genkitError = error as GenerativeAIError;
        errorMessage = `AI Error: ${genkitError.message} (Status: ${genkitError.status}, Code: ${genkitError.code || 'N/A'})`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      try {
        const currentSnap = await analysisRef.get();
        if (currentSnap.exists()) {
          const data = currentSnap.data();
          // Only update to error if not already cancelled or cancelling
          if (data?.status !== 'cancelling' && data?.status !== 'cancelled') {
            await analysisRef.update({
                status: 'error',
                errorMessage: `Falha (Function): ${errorMessage.substring(0, MAX_ERROR_MSG_LENGTH)}`,
                // progress: analysisDataAfter?.progress || 0 // Keep current progress or reset
            });
          }
        }
      } catch (updateError) {
          console.error(`[Function_processAnalysis] CRITICAL: Failed to update Firestore with error state for ${analysisId}:`, updateError);
      }
    }
    return null;
  });
