import type { AnalyzeComplianceReportOutput } from '@/ai/prompt-configs/analyze-compliance-report-prompt-config'; // Importar o novo tipo

import type { Timestamp } from 'firebase/firestore';

export interface AnalysisStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error' | 'cancelled'; // Added 'cancelled'
  details?: string;
  progress?: number;
}

export interface Analysis {
  id: string;
  userId: string;
  fileName: string;
  title?: string; // User-defined title for the analysis
  description?: string; // User-defined description for the analysis
  languageCode?: string; // BCP-47 language code
  status:
    | 'uploading'
    | 'summarizing_data'
    | 'identifying_regulations'
    | 'assessing_compliance'
    | 'reviewing_report'
    | 'completed'
    | 'error'
    | 'deleted'
    | 'cancelling'
    | 'cancelled'; // Added reviewing_report & new statuses
  progress: number; // Progresso geral da análise (0-100)
  uploadProgress?: number; // Progresso específico do upload do arquivo (0-100)
  powerQualityDataUrl?: string;
  powerQualityDataSummary?: string;
  isDataChunked?: boolean;
  identifiedRegulations?: string[];

  // Campos antigos - podem ser mantidos para compatibilidade ou removidos gradualmente
  summary?: string;
  complianceReport?: string; // Legacy, if used by older data.

  // Novo campo para o relatório estruturado
  structuredReport?: AnalyzeComplianceReportOutput | null; // Can be null if not generated
  mdxReportStoragePath?: string; // Path para o arquivo MDX no Firebase Storage

  errorMessage?: string;
  tags: string[];
  createdAt: string | Timestamp; // ISO string on client, Timestamp from Firestore
  completedAt?: string | Timestamp; // ISO string on client, Timestamp from Firestore
  reportLastModifiedAt?: string | Timestamp; // For chat revisions
}

// Define the return type for the getAnalysisReportAction (and its HTTPS Function counterpart)
export interface AnalysisReportData {
  mdxContent: string | null;
  fileName: string | null;
  analysisId: string | null;
  error?: string | null;
  structuredReport?: AnalyzeComplianceReportOutput | null; // Added to provide context for chat
}
