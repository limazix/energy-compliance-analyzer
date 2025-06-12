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

// Import the modularized Genkit agent for chat orchestration
const { chatOrchestratorAgentPrompt } = require('../ai/flows/chatOrchestratorAgent.js');

// Adjusted paths for shared modules
const { convertStructuredReportToMdx } = require('../../lib/shared/lib/reportUtils.js');

// Initialize Firebase Admin SDK if not already done (should be handled by index.js, but good practice).
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const storageAdmin = admin.storage();
const rtdbAdmin = admin.database();

// Genkit 'ai' instance is imported by the chatOrchestratorAgentPrompt module itself.

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
    userId, // userId from data payload
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
      'UID do chamador não corresponde ao UID fornecido no payload.'
    );
  }
  if (!analysisId || !userInputText || !currentStructuredReport || !currentReportMdx) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Parâmetros obrigatórios ausentes (analysisId, userInputText, currentStructuredReport, currentReportMdx).'
    );
  }

  // eslint-disable-next-line no-console
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
    // eslint-disable-next-line no-console
    console.error(
      `[ReportChat_Orchestrator] Failed to push user message to RTDB for ${analysisId}:`,
      dbError
    );
    // Non-fatal for the AI call, but good to log.
  }

  // Create a placeholder for AI response in RTDB to get its key
  const newAiMessageNode = await rtdbAdmin.ref(`chats/${analysisId}`).push();
  const aiMessageRtdbKey = newAiMessageNode.key;

  if (!aiMessageRtdbKey) {
    // eslint-disable-next-line no-console
    console.error(
      `[ReportChat_Orchestrator] Failed to generate RTDB key for AI message for analysis ${analysisId}.`
    );
    throw new functions.https.HttpsError('internal', 'Falha ao gerar ID para mensagem da IA.');
  }

  // Initialize the AI message node.
  await newAiMessageNode.set({
    sender: 'ai',
    text: '', // Will be updated with streamed content
    timestamp: admin.database.ServerValue.TIMESTAMP,
  });

  try {
    const analysisSnap = await analysisDocRef.get();
    let powerQualityDataSummary;
    if (analysisSnap.exists()) {
      powerQualityDataSummary = analysisSnap.data()?.powerQualityDataSummary;
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        `[ReportChat_Orchestrator] Analysis document ${analysisId} not found. Proceeding without its summary.`
      );
    }

    const orchestratorInput = {
      userInputText,
      currentReportMdx,
      currentStructuredReport,
      analysisFileName:
        analysisFileName || analysisSnap.data()?.fileName || 'Nome do arquivo desconhecido',
      powerQualityDataSummary, // Can be undefined
      languageCode: languageCode || 'pt-BR',
    };

    // eslint-disable-next-line no-console
    console.debug(
      `[ReportChat_Orchestrator] Calling chatOrchestratorAgentPrompt.generateStream for AI message key ${aiMessageRtdbKey}.`
    );

    // chatOrchestratorAgentPrompt is already an ai.definePrompt object
    const { stream, response } = chatOrchestratorAgentPrompt.generateStream({
      input: orchestratorInput,
    });

    let streamedText = '';
    for await (const chunk of stream) {
      const textChunk = chunk.text ?? '';
      if (textChunk) {
        streamedText += textChunk;
        // Update the AI message node in RTDB with the new chunk of text.
        await rtdbAdmin
          .ref(`chats/${analysisId}/${aiMessageRtdbKey}`)
          .update({ text: streamedText });
      }
    }
    // eslint-disable-next-line no-console
    console.info(`[ReportChat_Orchestrator] Stream finished for AI message ${aiMessageRtdbKey}.`);

    const finalOutput = (await response)?.output;

    if (!finalOutput) {
      throw new Error(
        'Orquestrador de Chat (Função HTTPS) falhou em gerar uma resposta estruturada final.'
      );
    }

    // Check if the 'callRevisorTool' was used and returned a revised report
    if (finalOutput.revisedStructuredReport) {
      // eslint-disable-next-line no-console
      console.info(
        `[ReportChat_Orchestrator] Ferramenta Revisor usada. Novo relatório estruturado gerado para ${analysisId}.`
      );
      const newMdxContent = convertStructuredReportToMdx(
        finalOutput.revisedStructuredReport,
        orchestratorInput.analysisFileName
      );

      // Determine the MDX file path. Use existing if available, otherwise construct default.
      const mdxFilePath =
        analysisSnap.data()?.mdxReportStoragePath ||
        `user_reports/${userId}/${analysisId}/report.mdx`;

      const mdxFileStorageRef = storageAdmin.bucket().file(mdxFilePath);
      await mdxFileStorageRef.save(newMdxContent, {
        contentType: 'text/markdown',
      });
      // eslint-disable-next-line no-console
      console.info(`[ReportChat_Orchestrator] Novo MDX salvo em ${mdxFilePath}`);

      // Update Firestore with the revised structured report and the path to the (new/overwritten) MDX.
      await analysisDocRef.update({
        structuredReport: finalOutput.revisedStructuredReport,
        mdxReportStoragePath: mdxFilePath, // Ensure this is updated if it was newly constructed
        reportLastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      // eslint-disable-next-line no-console
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

    // If no report modification, just return success and the AI message key
    return {
      success: true,
      aiMessageRtdbKey,
      reportModified: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(
      `[ReportChat_Orchestrator] Erro durante o processamento da Genkit para análise ${analysisId}, mensagem AI ${aiMessageRtdbKey}:`,
      errorMessage,
      error
    );
    try {
      await rtdbAdmin.ref(`chats/${analysisId}/${aiMessageRtdbKey}`).update({
        text: `Desculpe, ocorreu um erro ao processar sua solicitação: ${errorMessage.substring(0, 100)}`,
        isError: true,
      });
    } catch (rtdbError) {
      // eslint-disable-next-line no-console
      console.error(
        `[ReportChat_Orchestrator] Falha ao atualizar RTDB com mensagem de erro para ${aiMessageRtdbKey}:`,
        rtdbError
      );
    }
    // Re-throw as HttpsError to be caught by the client Server Action
    throw new functions.https.HttpsError('internal', errorMessage, {
      originalError: error, // Keep original error for server logs if needed
      aiMessageRtdbKey, // Pass key so client might know which message failed
    });
  }
});
