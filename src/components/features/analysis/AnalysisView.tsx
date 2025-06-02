
'use client';

import type { Analysis, AnalysisStep } from '@/types/analysis';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { AnalysisProgressDisplay } from './AnalysisProgressDisplay';
import { AnalysisResultsDisplay } from './AnalysisResultsDisplay';
import { TagEditor } from './TagEditor';
import { AnalysisStepItem } from './AnalysisStepItem';

type AnalysisViewProps = {
  analysis: Analysis;
  analysisSteps: AnalysisStep[];
  onDownloadReport: (reportText: string | undefined, fileName: string) => void;
  tagInput: string;
  onTagInputChange: (value: string) => void;
  onAddTag: (analysisId: string, tag: string) => void;
  onRemoveTag: (analysisId: string, tag: string) => void;
  // onNavigateToDashboard e onNavigateToPastAnalyses não são mais necessários aqui
};

export function AnalysisView({
  analysis,
  analysisSteps,
  onDownloadReport,
  tagInput,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
}: AnalysisViewProps) {
  const isCompleted = analysis.status === 'completed';
  const isError = analysis.status === 'error';
  const isInProgress = !isCompleted && !isError;

  // Não é mais um Card principal, mas o conteúdo interno.
  // A remoção de Card, CardHeader, CardContent e CardTitle aqui
  // pressupõe que o AccordionContent fornecerá o encapsulamento.
  // Ou, mantemos um Card interno para consistência de padding/estilo se necessário.
  // Por ora, manterei a estrutura interna do conteúdo.
  return (
    <div className="space-y-6">
      {/* CardHeader e CardDescription são agora parte do AccordionTrigger, não aqui */}
      {/* Breadcrumbs removidos */}

      {isInProgress && (
        <AnalysisProgressDisplay analysisSteps={analysisSteps} />
      )}

      {isCompleted && (
        <AnalysisResultsDisplay analysis={analysis} onDownloadReport={onDownloadReport} />
      )}

      {isError && (
        <div className="p-4 bg-destructive/10 rounded-md border border-destructive">
          <h3 className="text-xl font-semibold mb-2 text-destructive flex items-center">
            <AlertTriangle className="mr-2" />Ocorreu um Erro
          </h3>
          <p className="text-destructive-foreground">Não foi possível completar a análise.</p>
          <p className="text-sm mt-1"><strong>Detalhes:</strong> {analysis.errorMessage || 'Erro desconhecido.'}</p>
          {analysisSteps.find(s => s.status === 'error') && (
            <ul className="space-y-3 mt-4">
              {analysisSteps.map((step, index) => (
                <AnalysisStepItem key={index} step={step} />
              ))}
            </ul>
          )}
        </div>
      )}

      <TagEditor
        analysisId={analysis.id}
        tags={analysis.tags || []}
        tagInput={tagInput}
        onTagInputChange={onTagInputChange}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
      />
    </div>
  );
}
