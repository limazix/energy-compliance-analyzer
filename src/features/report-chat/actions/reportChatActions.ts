
'use server';

import { doc, getDoc, updateDoc, serverTimestamp as firestoreServerTimestamp, type Timestamp } from 'firebase/firestore';
import { ref as storageFileRef, uploadString } from 'firebase/storage';
import { rtdb, db, storage } from '@/lib/firebase';
import { ref as rtdbRef, update as rtdbUpdate, serverTimestamp as rtdbServerTimestamp, push as rtdbPush, child as rtdbChild } from 'firebase/database';

import type { Analysis } from '@/types/analysis';
import { 
  interactionPrompt, // Import the prompt object directly
  type OrchestrateReportInteractionInput, 
  type OrchestrateReportInteractionOutput,
  type OrchestrateReportInteractionInputSchema, // For type hints if needed
} from '@/ai/flows/orchestrate-report-interaction';
import { convertStructuredReportToMdx } from '@/lib/reportUtils';
import type { AnalyzeComplianceReportOutput } from '@/ai/prompt-configs/analyze-compliance-report-prompt-config';


const CLIENT_ERROR_MESSAGE_MAX_LENGTH = 300;

interface ReportInteractionServerResult {
  success: boolean;
  error?: string;
  aiMessageRtdbKey?: string; // Key of the AI's message in RTDB
  reportModified?: boolean; // Flag if the report content (MDX/Structured) was changed
  revisedStructuredReport?: AnalyzeComplianceReportOutput; // The new structured report if modified
  newMdxContent?: string; // The new MDX content if modified
}

export async function askReportOrchestratorAction(
  userIdInput: string,
  analysisIdInput: string,
  userInputText: string,
  currentReportMdx: string,
  currentStructuredReport: AnalyzeComplianceReportOutput | null,
  analysisFileName: string,
  languageCode: string
): Promise<ReportInteractionServerResult> {
  const userId = userIdInput?.trim();
  const analysisId = analysisIdInput?.trim();

  if (!userId || !analysisId) {
    const errorMsg = "User ID e Analysis ID são obrigatórios para interação.";
    console.error(`[askReportOrchestratorAction] ${errorMsg} User: ${userIdInput}, Analysis: ${analysisIdInput}`);
    return { success: false, error: errorMsg };
  }
  if (!userInputText.trim()) {
    return { success: false, error: "Entrada do usuário vazia." };
  }
  if (!currentStructuredReport) {
    const errorMsg = "O relatório estruturado atual é necessário para processar esta solicitação.";
    console.error(`[askReportOrchestratorAction] ${errorMsg} Analysis: ${analysisId}`);
    return { success: false, error: errorMsg };
  }
  if (!currentReportMdx) {
      const errorMsg = "O conteúdo MDX do relatório atual é necessário para fornecer contexto à IA.";
      console.error(`[askReportOrchestratorAction] ${errorMsg} Analysis: ${analysisId}`);
      return { success: false, error: errorMsg };
  }


  const analysisDocRef = doc(db, 'users', userId, 'analyses', analysisId);
  const chatRootRef = rtdbRef(rtdb, `chats/${analysisId}`);
  const newAiMessageRef = rtdbPush(chatRootRef); // Generate a unique key for the AI message
  const aiMessageRtdbKey = newAiMessageRef.key;

  if (!aiMessageRtdbKey) {
    const errorMsg = "Falha ao gerar ID para mensagem da IA no RTDB.";
    console.error(`[askReportOrchestratorAction] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  try {
    const analysisSnap = await getDoc(analysisDocRef);
    let powerQualityDataSummary: string | undefined = undefined;
    if (analysisSnap.exists()) {
      const analysisData = analysisSnap.data() as Analysis;
      powerQualityDataSummary = analysisData.powerQualityDataSummary;
    } else {
      console.warn(`[askReportOrchestratorAction] Analysis document ${analysisId} not found for fetching summary. Proceeding without it.`);
    }

    // Push initial placeholder for AI message
    const initialAiMessage = {
      sender: 'ai',
      text: '', // Start with empty text, will be appended by chunks
      timestamp: rtdbServerTimestamp(),
    };
    await rtdbUpdate(newAiMessageRef, initialAiMessage);

    const orchestratorInput: OrchestrateReportInteractionInput = {
      userInputText,
      currentReportMdx,
      currentStructuredReport,
      analysisFileName,
      powerQualityDataSummary,
      languageCode,
    };

    console.info(`[askReportOrchestratorAction] Calling orchestrator prompt.generateStream for analysis ${analysisId}, AI message key ${aiMessageRtdbKey}`);
    
    const { stream, response } = interactionPrompt.generateStream({
      input: orchestratorInput,
    });

    let streamedText = "";
    for await (const chunk of stream) {
      const textChunk = chunk.text ?? '';
      if (textChunk) {
        streamedText += textChunk;
        // Update the text field of the existing AI message in RTDB
        await rtdbUpdate(rtdbChild(chatRootRef, aiMessageRtdbKey), { text: streamedText });
      }
    }
    console.info(`[askReportOrchestratorAction] Stream finished for AI message ${aiMessageRtdbKey}.`);

    const finalOutput = (await response)?.output; // Access the structured output

    if (!finalOutput) {
      throw new Error("AI Orchestrator failed to generate a final structured response.");
    }

    // The finalOutput.aiResponseText might be redundant if we streamed everything,
    // but good to debug or compare. The streamedText is what's in RTDB.
    // The critical part is finalOutput.revisedStructuredReport.

    if (finalOutput.revisedStructuredReport) {
      console.info(`[askReportOrchestratorAction] Revisor tool was used. New structured report generated for ${analysisId}.`);
      const newMdxContent = convertStructuredReportToMdx(finalOutput.revisedStructuredReport, analysisFileName);
      
      const mdxFilePath = analysisSnap.exists() ? (analysisSnap.data().mdxReportStoragePath || `user_reports/${userId}/${analysisId}/report.mdx`) : `user_reports/${userId}/${analysisId}/report.mdx`;
      const mdxFileStorageRef = storageFileRef(storage, mdxFilePath);
      await uploadString(mdxFileStorageRef, newMdxContent, 'raw', { contentType: 'text/markdown' });
      console.info(`[askReportOrchestratorAction] New MDX saved to ${mdxFilePath}`);

      if (analysisSnap.exists()) {
        await updateDoc(analysisDocRef, {
          structuredReport: finalOutput.revisedStructuredReport,
          mdxReportStoragePath: mdxFilePath,
          reportLastModifiedAt: firestoreServerTimestamp() as Timestamp,
        });
        console.info(`[askReportOrchestratorAction] Firestore updated with revised report for ${analysisId}.`);
      }

      return { 
        success: true,
        aiMessageRtdbKey,
        reportModified: true,
        revisedStructuredReport: finalOutput.revisedStructuredReport,
        newMdxContent: newMdxContent,
      };
    }

    // If no revisions, just confirm success of streaming text
    return { 
      success: true, 
      aiMessageRtdbKey,
      reportModified: false, // No structural changes to report
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[askReportOrchestratorAction] Error for analysis ${analysisId}, AI message ${aiMessageRtdbKey}:`, errorMessage, error);
    // Update the AI message in RTDB with an error
    try {
      await rtdbUpdate(rtdbChild(chatRootRef, aiMessageRtdbKey), { 
        text: `Desculpe, ocorreu um erro ao processar sua solicitação: ${errorMessage.substring(0, 100)}`,
        isError: true // Custom flag
      });
    } catch (rtdbError) {
      console.error(`[askReportOrchestratorAction] Failed to update RTDB with error message for ${aiMessageRtdbKey}:`, rtdbError);
    }
    return {
      success: false,
      error: `Erro ao processar sua solicitação: ${errorMessage.substring(0, CLIENT_ERROR_MESSAGE_MAX_LENGTH)}`,
      aiMessageRtdbKey,
    };
  }
}


    