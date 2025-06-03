
'use server';

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Analysis } from '@/types/analysis';
import { orchestrateReportInteraction, type OrchestrateReportInteractionInput } from '@/ai/flows/orchestrate-report-interaction';
import type { OrchestrateReportInteractionOutput } from '@/ai/prompt-configs/orchestrate-report-interaction-prompt-config';

const CLIENT_ERROR_MESSAGE_MAX_LENGTH = 300;

interface ReportInteractionResult extends OrchestrateReportInteractionOutput {
  error?: string;
}

export async function askReportOrchestratorAction(
  userIdInput: string,
  analysisIdInput: string,
  userInputText: string,
  currentReportMdx: string,
  analysisFileName: string, // Added to pass to AI
  languageCode: string
): Promise<ReportInteractionResult> {
  const userId = userIdInput?.trim();
  const analysisId = analysisIdInput?.trim();

  if (!userId || !analysisId) {
    const errorMsg = "User ID e Analysis ID são obrigatórios para interação.";
    console.error(`[askReportOrchestratorAction] ${errorMsg} User: ${userIdInput}, Analysis: ${analysisIdInput}`);
    return { aiResponseText: '', error: errorMsg };
  }
  if (!userInputText.trim()) {
    return { aiResponseText: "Por favor, insira uma pergunta ou comando.", error: "Entrada do usuário vazia." };
  }

  let powerQualityDataSummary: string | undefined = undefined;

  try {
    // Fetch the analysis document to get powerQualityDataSummary for context
    const analysisDocRef = doc(db, 'users', userId, 'analyses', analysisId);
    const analysisSnap = await getDoc(analysisDocRef);

    if (analysisSnap.exists()) {
      const analysisData = analysisSnap.data() as Analysis;
      powerQualityDataSummary = analysisData.powerQualityDataSummary;
    } else {
      console.warn(`[askReportOrchestratorAction] Analysis document ${analysisId} not found for user ${userId}. Proceeding without data summary.`);
    }

    const orchestratorInput: OrchestrateReportInteractionInput = {
      userInputText,
      currentReportMdx,
      analysisFileName,
      powerQualityDataSummary,
      languageCode,
    };

    console.log(`[askReportOrchestratorAction] Calling orchestrator flow for analysis ${analysisId}`);
    const output = await orchestrateReportInteraction(orchestratorInput);

    return { aiResponseText: output.aiResponseText };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[askReportOrchestratorAction] Error interacting with report orchestrator for analysis ${analysisId}:`, errorMessage);
    return {
      aiResponseText: '',
      error: `Erro ao processar sua solicitação: ${errorMessage.substring(0, CLIENT_ERROR_MESSAGE_MAX_LENGTH)}`,
    };
  }
}
