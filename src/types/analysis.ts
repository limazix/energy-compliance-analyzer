import type { Timestamp } from 'firebase/firestore';

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
  powerQualityDataSummary?: string; // Sumário gerado pela IA
  powerQualityDataPreview?: string; // Removido pois o sumário é mais relevante
  identifiedRegulations?: string[];
  summary?: string; // Sumário da conformidade final
  complianceReport?: string;
  errorMessage?: string;
  tags: string[];
  createdAt: string | Timestamp;
  completedAt?: string | Timestamp;
}
