
'use server';

import { doc, getDoc, updateDoc, serverTimestamp as firestoreServerTimestamp, Timestamp } from 'firebase/firestore'; // Added Timestamp and firestoreServerTimestamp
import { db, storage } from '@/lib/firebase'; // Added storage
import { ref as storageFileRef, uploadString } from 'firebase/storage'; // Added for saving MDX
import type { Analysis } from '@/types/analysis';
import { orchestrateReportInteraction, type OrchestrateReportInteractionInput, type OrchestrateReportInteractionOutput } from '@/ai/flows/orchestrate-report-interaction';
import { convertStructuredReportToMdx } from '@/lib/reportUtils';
import type { AnalyzeComplianceReportOutput } from '@/ai/prompt-configs/analyze-compliance-report-prompt-config';


const CLIENT_ERROR_MESSAGE_MAX_LENGTH = 300;

interface ReportInteractionResult extends OrchestrateReportInteractionOutput {
  error?: string;
  suggestedMdxChanges?: string; // To send new MDX to client
  revisedStructuredReport?: AnalyzeComplianceReportOutput; // To send revised structured report to client
}

export async function askReportOrchestratorAction(
  userIdInput: string,
  analysisIdInput: string,
  userInputText: string,
  currentReportMdx: string, // MDX is for context, actual revisions happen on structuredReport
  currentStructuredReport: AnalyzeComplianceReportOutput | null, // The structured report for revisions
  analysisFileName: string,
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
  if (!currentStructuredReport) {
    // If the orchestrator and its tools (like revisor) need the structured report,
    // this becomes a critical piece of information.
    const errorMsg = "O relatório estruturado atual é necessário para processar esta solicitação de alteração/revisão.";
    console.error(`[askReportOrchestratorAction] ${errorMsg} Analysis: ${analysisId}`);
    return { aiResponseText: '', error: errorMsg };
  }


  let powerQualityDataSummary: string | undefined = undefined;
  const analysisDocRef = doc(db, 'users', userId, 'analyses', analysisId);

  try {
    const analysisSnap = await getDoc(analysisDocRef);

    if (analysisSnap.exists()) {
      const analysisData = analysisSnap.data() as Analysis;
      powerQualityDataSummary = analysisData.powerQualityDataSummary;
      // If currentStructuredReport was not passed or null, try to get it from Firestore as a fallback
      // const structuredReportForOrchestrator = currentStructuredReport || analysisData.structuredReport || null;
      // No, we must rely on client sending the current state of structuredReport for revisions
      const structuredReportForOrchestrator = currentStructuredReport; 
      
      if (!structuredReportForOrchestrator) {
         const errMsg = "Relatório estruturado não encontrado no cliente nem no Firestore para revisão.";
         console.error(`[askReportOrchestratorAction] ${errMsg} Analysis ID: ${analysisId}`);
         return { aiResponseText: '', error: errMsg };
      }


      const orchestratorInput: OrchestrateReportInteractionInput = {
        userInputText,
        currentReportMdx, // Keep sending current MDX for context to the LLM
        currentStructuredReport: structuredReportForOrchestrator, // Send the structured data for actual revision
        analysisFileName,
        powerQualityDataSummary,
        languageCode,
      };

      console.log(`[askReportOrchestratorAction] Calling orchestrator flow for analysis ${analysisId}`);
      const output = await orchestrateReportInteraction(orchestratorInput);

      if (output.revisedStructuredReport) {
        console.log(`[askReportOrchestratorAction] Revisor tool was used. New structured report generated for ${analysisId}.`);
        const newMdxContent = convertStructuredReportToMdx(output.revisedStructuredReport, analysisFileName);
        
        // Save new MDX to Firebase Storage (overwrite existing)
        const mdxFilePath = analysisSnap.data().mdxReportStoragePath || `user_reports/${userId}/${analysisId}/report.mdx`;
        const mdxFileStorageRef = storageFileRef(storage, mdxFilePath);
        await uploadString(mdxFileStorageRef, newMdxContent, 'raw', { contentType: 'text/markdown' });
        console.log(`[askReportOrchestratorAction] New MDX saved to ${mdxFilePath}`);

        // Update Firestore document with the new structured report and timestamp
        await updateDoc(analysisDocRef, {
          structuredReport: output.revisedStructuredReport,
          mdxReportStoragePath: mdxFilePath, // Ensure path is saved/updated
          reportLastModifiedAt: firestoreServerTimestamp() as Timestamp, // Firestore server timestamp
        });
        console.log(`[askReportOrchestratorAction] Firestore updated with revised report for ${analysisId}.`);

        return { 
          aiResponseText: output.aiResponseText, 
          suggestedMdxChanges: newMdxContent,
          revisedStructuredReport: output.revisedStructuredReport
        };
      }

      // If no revisions were made by a tool, just return the AI's textual response
      return { aiResponseText: output.aiResponseText };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[askReportOrchestratorAction] Error interacting with report orchestrator for analysis ${analysisId}:`, errorMessage, error); // Log full error
    return {
      aiResponseText: '',
      error: `Erro ao processar sua solicitação: ${errorMessage.substring(0, CLIENT_ERROR_MESSAGE_MAX_LENGTH)}`,
    };
  }
}
