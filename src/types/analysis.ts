import type { Timestamp } from 'firebase/firestore';

export interface AnalysisStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  details?: string;
  progress?: number;
}

// Adicionando 'uploading_file' e 'processing_queued' para maior clareza no processo refatorado.
// 'uploading' será o status geral durante o upload e configuração inicial.
// 'identifying_regulations', 'assessing_compliance' continuam como etapas do processamento AI.
export interface Analysis {
  id: string;
  userId: string;
  fileName: string;
  status: 'uploading' | 'identifying_regulations' | 'assessing_compliance' | 'completed' | 'error' | 'deleted';
  progress: number; // Progresso geral da análise (0-100)
  uploadProgress?: number; // Progresso específico do upload do arquivo (0-100), gerenciado por useFileUploadManager
  powerQualityDataUrl?: string;
  powerQualityDataPreview?: string;
  identifiedRegulations?: string[];
  summary?: string;
  complianceReport?: string;
  errorMessage?: string;
  tags: string[];
  createdAt: string | Timestamp;
  completedAt?: string | Timestamp;
}
