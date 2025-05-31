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
  status: 'uploading' | 'identifying_regulations' | 'assessing_compliance' | 'completed' | 'error' | 'deleted';
  progress: number; // Overall progress or current step's progress
  powerQualityDataUrl?: string;
  powerQualityDataPreview?: string; // First few lines of CSV for context
  identifiedRegulations?: string[];
  summary?: string;
  complianceReport?: string;
  errorMessage?: string;
  tags: string[];
  createdAt: string | Timestamp; // ISO string on client, Timestamp from server
  completedAt?: string | Timestamp; // ISO string on client, Timestamp from server
}
