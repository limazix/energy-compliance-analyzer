
'use client';

import type { Analysis, AnalysisStep } from '@/types/analysis';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, History, AlertTriangle } from 'lucide-react';
import { AnalysisProgressDisplay } from './AnalysisProgressDisplay';
import { AnalysisResultsDisplay } from './AnalysisResultsDisplay';
import { TagEditor } from './TagEditor';
import { AnalysisStepItem } from './AnalysisStepItem'; // For error state

type AnalysisViewProps = {
  analysis: Analysis;
  analysisSteps: AnalysisStep[];
  onDownloadReport: (reportText: string | undefined, fileName: string) => void;
  tagInput: string;
  onTagInputChange: (value: string) => void;
  onAddTag: (analysisId: string, tag: string) => void;
  onRemoveTag: (analysisId: string, tag: string) => void;
  onStartNewAnalysis: () => void;
  onViewPastAnalyses: () => void;
};

export function AnalysisView({
  analysis,
  analysisSteps,
  onDownloadReport,
  tagInput,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
  onStartNewAnalysis,
  onViewPastAnalyses,
}: AnalysisViewProps) {
  const isCompleted = analysis.status === 'completed';
  const isError = analysis.status === 'error';
  const isInProgress = !isCompleted && !isError;

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-headline text-primary">
          {isCompleted ? 'Resultados da Análise' :
           isError ? 'Erro na Análise' : 'Análise em Andamento'}
        </CardTitle>
        <CardDescription>Arquivo: {analysis.fileName}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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

        <div className="flex flex-wrap gap-4 mt-8">
          <Button onClick={onStartNewAnalysis} size="lg">
            <PlusCircle className="mr-2 h-5 w-5" /> Iniciar Nova Análise
          </Button>
          <Button onClick={onViewPastAnalyses} variant="outline" size="lg">
            <History className="mr-2 h-5 w-5" /> Ver Análises Anteriores
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

    