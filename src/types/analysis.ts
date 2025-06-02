
import type { Timestamp } from 'firebase/firestore';
import type { AnalyzeComplianceReportOutput } from '@/ai/flows/analyze-compliance-report'; // Importar o novo tipo

export interface AnalysisStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  details?: string;
  progress?: number;
}

export interface Analysis {
  id: string;
  userId: string;
  fileName: string;
  title?: string; // User-defined title for the analysis
  description?: string; // User-defined description for the analysis
  status: 'uploading' | 'summarizing_data' | 'identifying_regulations' | 'assessing_compliance' | 'completed' | 'error' | 'deleted';
  progress: number; // Progresso geral da análise (0-100)
  uploadProgress?: number; // Progresso específico do upload do arquivo (0-100)
  powerQualityDataUrl?: string;
  powerQualityDataSummary?: string;
  isDataChunked?: boolean;
  identifiedRegulations?: string[];

  // Campos antigos - podem ser mantidos para compatibilidade ou removidos gradualmente
  summary?: string;
  complianceReport?: string;

  // Novo campo para o relatório estruturado
  structuredReport?: AnalyzeComplianceReportOutput;
  mdxReportStoragePath?: string; // Path para o arquivo MDX no Firebase Storage

  errorMessage?: string;
  tags: string[];
  createdAt: string | Timestamp;
  completedAt?: string | Timestamp;
}

// Define the return type for the getAnalysisReportAction
export interface AnalysisReportData {
  mdxContent: string | null;
  fileName: string | null;
  analysisId: string | null;
  error?: string | null;
}

