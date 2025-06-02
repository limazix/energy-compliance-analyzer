
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

  errorMessage?: string;
  tags: string[];
  createdAt: string | Timestamp;
  completedAt?: string | Timestamp;
}
