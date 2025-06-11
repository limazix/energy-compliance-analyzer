// @ts-check
'use strict';

/**
 * @fileOverview HTTPS Callable Firebase Function for orchestrating user interaction with compliance reports via chat.
 * This function handles Genkit AI flow execution for chat responses, including report revisions.
 * Feature: Report Interaction (Chat)
 * Component: Orchestrator (HTTPS Callable)
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { genkit, ZodString } = require('genkit'); // ZodString for simpler schema if needed, or full zod
const { googleAI } = require('@genkit-ai/googleai');
const { z } = require('zod'); // Full Zod for complex schemas

// Adjusted paths for shared modules
const {
  orchestrateReportInteractionPromptConfig,
  OrchestrateReportInteractionInputSchema,
  AnalyzeComplianceReportOutputSchema, // Used by the Revisor tool and overall interaction output
} = require('../../lib/shared/ai/prompt-configs/orchestrate-report-interaction-prompt-config.js');
const {
  reviewComplianceReportPromptConfig,
  ReviewComplianceReportInputSchema,
  // ReviewComplianceReportOutputSchema is AnalyzeComplianceReportOutputSchema
} = require('../../lib/shared/ai/prompt-configs/review-compliance-report-prompt-config.js');
const { convertStructuredReportToMdx } = require('../../lib/shared/lib/reportUtils.js');

// Initialize Firebase Admin SDK if not already done (should be handled by index.js, but good practice).
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const storageAdmin = admin.storage();
const rtdbAdmin = admin.database();

// Initialize Genkit
const firebaseRuntimeConfig = functions.config();
const geminiApiKeyFromConfig =
  firebaseRuntimeConfig && firebaseRuntimeConfig.gemini
    ? firebaseRuntimeConfig.gemini.api_key
    : undefined;
const geminiApiKey =
  process.env.GEMINI_API_KEY || geminiApiKeyFromConfig || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

if (!geminiApiKey) {
  console.error(
    '[ReportChat_Orchestrator] CRITICAL: GEMINI_API_KEY not found. Genkit AI calls WILL FAIL.'
  );
}
const ai = genkit({
  plugins: [googleAI({ apiKey: geminiApiKey })],
});

// --- Define Genkit Flows and Tools within this Firebase Function's context ---

// Define the Revisor Flow (using the shared prompt config)
const reviewComplianceReportFlow = ai.defineFlow(
  {
    name: 'reviewComplianceReportFlow_Chat', // Unique name for this context
    inputSchema: ReviewComplianceReportInputSchema,
    outputSchema: AnalyzeComplianceReportOutputSchema, // Output is the revised full report
  },
  async (input) => {
    const reviewPrompt = ai.definePrompt(reviewComplianceReportPromptConfig);
    const { output } = await reviewPrompt(input);
    if (!output) {
      throw new Error('AI failed to review and refine the compliance report (Chat Orchestrator).');
    }
    return output;
  }
);

// Define the Revisor Tool (using the shared schemas)
const callRevisorTool_Chat = ai.defineTool(
  {
    name: 'callRevisorTool_Chat',
    description:
      'Reviews and refines a given structured compliance report. Use this if the user asks for rephrasing, grammar checks, structural adjustments, or overall improvement of the report content. This tool will return the entire revised structured report.',
    inputSchema: z.object({
      structuredReportToReview: AnalyzeComplianceReportOutputSchema,
      languageCode: OrchestrateReportInteractionInputSchema.shape.languageCode,
    }),
    outputSchema: AnalyzeComplianceReportOutputSchema,
  },
  async (toolInput) => {
    if (!toolInput.structuredReportToReview) {
      throw new Error('Structured report is required for the Revisor tool (Chat Orchestrator).');
    }
    const revisedReport = await reviewComplianceReportFlow(toolInput);
    return revisedReport;
  }
);

// Define the Main Interaction Prompt (using shared config and the Firebase-defined tool)
const interactionPrompt_Chat = ai.definePrompt({
  ...orchestrateReportInteractionPromptConfig,
  name: 'orchestrateReportInteractionPrompt_Chat',
  tools: [callRevisorTool_Chat],
});

// --- HTTPS Callable Function ---

/**
 * Orchestrates user interaction with a compliance report via chat.
 * @type {functions.HttpsFunction}
 * @param {object} data - Data sent from the client Server Action.
 * @param {string} data.userId - The ID of the authenticated user.
 * @param {string} data.analysisId - The ID of the analysis being discussed.
 * @param {string} data.userInputText - The user's message.
 * @param {string} data.currentReportMdx - Current MDX content of the report.
 * @param {import('../../lib/shared/ai/prompt-configs/analyze-compliance-report-prompt-config.js').AnalyzeComplianceReportOutput} data.currentStructuredReport - Current structured report.
 * @param {string} data.analysisFileName - Original filename of the analysis.
 * @param {string} data.languageCode - BCP-47 language code for the interaction.
 * @param {functions.https.CallableContext} context - The context of the call (contains auth).
 * @returns {Promise<{success: boolean, error?: string, aiMessageRtdbKey?: string, reportModified?: boolean, revisedStructuredReport?: import('../../lib/shared/ai/prompt-configs/analyze-compliance-report-prompt-config.js').AnalyzeComplianceReportOutput, newMdxContent?: string}>}
 */
exports.httpsCallableAskOrchestrator = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'A função deve ser chamada por um usuário autenticado.'
    );
  }
  const callingUserId = context.auth.uid;
  const {
    userId,
    analysisId,
    userInputText,
    currentReportMdx,
    currentStructuredReport,
    analysisFileName,
    languageCode,
  } = data;

  if (callingUserId !== userId) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'UID do chamador não corresponde ao UID fornecido.'
    );
  }
  if (!analysisId || !userInputText || !currentStructuredReport || !currentReportMdx) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Parâmetros obrigatórios ausentes (analysisId, userInputText, currentStructuredReport, currentReportMdx).'
    );
  }

  console.info(
    `[ReportChat_Orchestrator] User: ${userId}, Analysis: ${analysisId}. Query: "${userInputText.substring(0, 50)}..."`
  );

  const analysisDocRef = db.collection('users').doc(userId).collection('analyses').doc(analysisId);
  const chatRootRef = rtdbAdmin.ref(`chats/${analysisId}`);

  const userMessageForRtdb = {
    sender: 'user',
    text: userInputText,
    timestamp: admin.database.ServerValue.TIMESTAMP,
  };
  try {
    await rtdbAdmin.ref(`chats/${analysisId}`).push(userMessageForRtdb);
  } catch (dbError) {
    console.error(
      `[ReportChat_Orchestrator] Failed to push user message to RTDB for ${analysisId}:`,
      dbError
    );
  }

  const newAiMessageNode = await rtdbAdmin.ref(`chats/${analysisId}`).push();
  const aiMessageRtdbKey = newAiMessageNode.key;
  if (!aiMessageRtdbKey) {
    console.error(`[ReportChat_Orchestrator] Failed to generate RTDB key for AI message.`);
    throw new functions.https.HttpsError('internal', 'Falha ao gerar ID para mensagem da IA.');
  }
  await newAiMessageNode.set({
    sender: 'ai',
    text: '',
    timestamp: admin.database.ServerValue.TIMESTAMP,
  });

  try {
    const analysisSnap = await analysisDocRef.get();
    let powerQualityDataSummary;
    if (analysisSnap.exists()) {
      powerQualityDataSummary = analysisSnap.data()?.powerQualityDataSummary;
    }

    const orchestratorInput = {
      userInputText,
      currentReportMdx,
      currentStructuredReport,
      analysisFileName:
        analysisFileName || analysisSnap.data()?.fileName || 'Nome do arquivo desconhecido',
      powerQualityDataSummary,
      languageCode: languageCode || 'pt-BR',
    };

    console.debug(
      `[ReportChat_Orchestrator] Calling interactionPrompt_Chat.generateStream for AI message key ${aiMessageRtdbKey}.`
    );
    const { stream, response } = interactionPrompt_Chat.generateStream({
      input: orchestratorInput,
    });

    let streamedText = '';
    for await (const chunk of stream) {
      const textChunk = chunk.text ?? '';
      if (textChunk) {
        streamedText += textChunk;
        await rtdbAdmin
          .ref(`chats/${analysisId}/${aiMessageRtdbKey}`)
          .update({ text: streamedText });
      }
    }
    console.info(`[ReportChat_Orchestrator] Stream finished for AI message ${aiMessageRtdbKey}.`);

    const finalOutput = (await response)?.output;

    if (!finalOutput) {
      throw new Error(
        'Orquestrador (Chat Function) falhou em gerar uma resposta estruturada final.'
      );
    }

    if (finalOutput.revisedStructuredReport) {
      console.info(
        `[ReportChat_Orchestrator] Ferramenta Revisor usada. Novo relatório estruturado gerado para ${analysisId}.`
      );
      const newMdxContent = convertStructuredReportToMdx(
        finalOutput.revisedStructuredReport,
        orchestratorInput.analysisFileName
      );

      const mdxFilePath =
        analysisSnap.data()?.mdxReportStoragePath ||
        `user_reports/${userId}/${analysisId}/report.mdx`;
      const mdxFileStorageRef = storageAdmin.bucket().file(mdxFilePath);
      await mdxFileStorageRef.save(newMdxContent, { contentType: 'text/markdown' });
      console.info(`[ReportChat_Orchestrator] Novo MDX salvo em ${mdxFilePath}`);

      await analysisDocRef.update({
        structuredReport: finalOutput.revisedStructuredReport,
        mdxReportStoragePath: mdxFilePath,
        reportLastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.info(
        `[ReportChat_Orchestrator] Firestore atualizado com relatório revisado para ${analysisId}.`
      );

      return {
        success: true,
        aiMessageRtdbKey,
        reportModified: true,
        revisedStructuredReport: finalOutput.revisedStructuredReport,
        newMdxContent: newMdxContent,
      };
    }

    return {
      success: true,
      aiMessageRtdbKey,
      reportModified: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[ReportChat_Orchestrator] Erro para análise ${analysisId}, mensagem AI ${aiMessageRtdbKey}:`,
      errorMessage,
      error
    );
    try {
      await rtdbAdmin.ref(`chats/${analysisId}/${aiMessageRtdbKey}`).update({
        text: `Desculpe, ocorreu um erro ao processar sua solicitação: ${errorMessage.substring(0, 100)}`,
        isError: true,
      });
    } catch (rtdbError) {
      console.error(
        `[ReportChat_Orchestrator] Falha ao atualizar RTDB com mensagem de erro para ${aiMessageRtdbKey}:`,
        rtdbError
      );
    }
    throw new functions.https.HttpsError('internal', errorMessage, {
      originalError: error,
      aiMessageRtdbKey,
    });
  }
});
