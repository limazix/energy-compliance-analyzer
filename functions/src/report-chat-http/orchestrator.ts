'use strict';

/**
 * @fileOverview HTTPS Callable Firebase Function for orchestrating user interaction with compliance reports via chat.
 * This function handles Genkit AI flow execution for chat responses, including report revisions.
 * Feature: Report Interaction (Chat)
 * Component: Orchestrator (HTTPS Callable)
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

// Import the modularized Genkit agent for chat orchestration
import { chatOrchestratorAgentPrompt } from '@/ai/flows/chatOrchestratorAgent'; // Adjusted to use @/
import type {
  AnalyzeComplianceReportOutput,
  OrchestrateReportInteractionInput,
} from '@/ai/prompt-configs/orchestrate-report-interaction-prompt-config'; // Path to compiled shared
import { convertStructuredReportToMdx } from '@/lib/reportUtils'; // Adjusted to use @/

// Initialize Firebase Admin SDK if not already done.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const storageAdmin = admin.storage();
const rtdbAdmin = admin.database();

interface RequestData {
  userId: string;
  analysisId: string;
  userInputText: string;
  currentReportMdx: string;
  currentStructuredReport: AnalyzeComplianceReportOutput;
  analysisFileName: string;
  languageCode: string;
}

interface ResponseData {
  success: boolean;
  error?: string;
  aiMessageRtdbKey?: string;
  reportModified?: boolean;
  revisedStructuredReport?: AnalyzeComplianceReportOutput;
  newMdxContent?: string;
}

/**
 * Orchestrates user interaction with a compliance report via chat.
 * @param {RequestData} data - Data sent from the client Server Action.
 * @param {functions.https.CallableContext} context - The context of the call (contains auth).
 * @returns {Promise<ResponseData>}
 */
export const httpsCallableAskOrchestrator = functions.https.onCall(
  async (data: RequestData, context: functions.https.CallableContext): Promise<ResponseData> => {
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
      `[ReportChat_Orchestrator] User: ${userId}, Analysis: ${analysisId}. Query: "${userInputText.substring(
        0,
        50
      )}..."`
    );

    const analysisDocRef = db
      .collection('users')
      .doc(userId)
      .collection('analyses')
      .doc(analysisId);
    const rtdbChatRef = rtdbAdmin.ref(`chats/${analysisId}`); // Use this ref for push

    const userMessageForRtdb = {
      sender: 'user',
      text: userInputText,
      timestamp: admin.database.ServerValue.TIMESTAMP,
    };
    try {
      await rtdbChatRef.push(userMessageForRtdb);
    } catch (dbError: unknown) {
      // Changed from any to unknown
      // eslint-disable-next-line no-console
      console.error(
        `[ReportChat_Orchestrator] Failed to push user message to RTDB for ${analysisId}:`,
        dbError
      );
    }

    const newAiMessageNode = await rtdbChatRef.push(); // Push to the chat root
    const aiMessageRtdbKey = newAiMessageNode.key;

    if (!aiMessageRtdbKey) {
      // eslint-disable-next-line no-console
      console.error(
        `[ReportChat_Orchestrator] Failed to generate RTDB key for AI message for analysis ${analysisId}.`
      );
      throw new functions.https.HttpsError('internal', 'Falha ao gerar ID para mensagem da IA.');
    }

    await newAiMessageNode.set({
      sender: 'ai',
      text: '',
      timestamp: admin.database.ServerValue.TIMESTAMP,
    });

    try {
      const analysisSnap = await analysisDocRef.get();
      let powerQualityDataSummary: string | undefined;
      if (analysisSnap.exists) {
        powerQualityDataSummary = analysisSnap.data()?.powerQualityDataSummary as
          | string
          | undefined;
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          `[ReportChat_Orchestrator] Analysis document ${analysisId} not found. Proceeding without its summary.`
        );
      }

      const orchestratorInput: OrchestrateReportInteractionInput = {
        userInputText,
        currentReportMdx,
        currentStructuredReport,
        analysisFileName:
          analysisFileName ||
          (analysisSnap.data()?.fileName as string | undefined) ||
          'Nome do arquivo desconhecido',
        powerQualityDataSummary,
        languageCode: languageCode || 'pt-BR',
      };

      // eslint-disable-next-line no-console
      console.debug(
        `[ReportChat_Orchestrator] Calling chatOrchestratorAgentPrompt.generateStream for AI message key ${aiMessageRtdbKey}.`
      );

      const { stream, response } = chatOrchestratorAgentPrompt.generateStream({
        input: orchestratorInput,
      });

      let streamedText = '';
      for await (const chunk of stream) {
        const textChunk = chunk.text ?? '';
        if (textChunk) {
          streamedText += textChunk;
          await newAiMessageNode.update({ text: streamedText }); // Update the specific node
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

      if (finalOutput.revisedStructuredReport) {
        // eslint-disable-next-line no-console
        console.info(
          `[ReportChat_Orchestrator] Ferramenta Revisor usada. Novo relatório estruturado gerado para ${analysisId}.`
        );
        const newMdxContent = convertStructuredReportToMdx(
          finalOutput.revisedStructuredReport,
          orchestratorInput.analysisFileName
        );

        const mdxFilePath =
          (analysisSnap.data()?.mdxReportStoragePath as string | undefined) ||
          `user_reports/${userId}/${analysisId}/report.mdx`;

        const mdxFileStorageRef = storageAdmin.bucket().file(mdxFilePath);
        await mdxFileStorageRef.save(newMdxContent, {
          contentType: 'text/markdown',
        });
        // eslint-disable-next-line no-console
        console.info(`[ReportChat_Orchestrator] Novo MDX salvo em ${mdxFilePath}`);

        await analysisDocRef.update({
          structuredReport: finalOutput.revisedStructuredReport,
          mdxReportStoragePath: mdxFilePath,
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

      return {
        success: true,
        aiMessageRtdbKey,
        reportModified: false,
      };
    } catch (error: unknown) {
      // Changed from any to unknown
      const errorMessage = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(
        `[ReportChat_Orchestrator] Erro durante o processamento da Genkit para análise ${analysisId}, mensagem AI ${aiMessageRtdbKey}:`,
        errorMessage,
        error
      );
      try {
        await newAiMessageNode.update({
          // Update the specific node
          text: `Desculpe, ocorreu um erro ao processar sua solicitação: ${errorMessage.substring(
            0,
            100
          )}`,
          isError: true,
        });
      } catch (rtdbError: unknown) {
        // Changed from any to unknown
        // eslint-disable-next-line no-console
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
  }
);
