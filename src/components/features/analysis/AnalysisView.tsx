
'use client';

import type { Analysis, AnalysisStep } from '@/types/analysis';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { AnalysisProgressDisplay } from './AnalysisProgressDisplay';
import { AnalysisResultsDisplay } from './AnalysisResultsDisplay';
import { TagEditor } from './TagEditor';
import { AnalysisStepItem } from './AnalysisStepItem';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type AnalysisViewProps = {
  analysis: Analysis;
  analysisSteps: AnalysisStep[];
  onDownloadReport: (reportText: string | undefined, fileName: string) => void;
  tagInput: string;
  onTagInputChange: (value: string) => void;
  onAddTag: (analysisId: string, tag: string) => void;
  onRemoveTag: (analysisId: string, tag: string) => void;
  onDeleteAnalysis: (analysisId: string) => void; // Nova prop
};

export function AnalysisView({
  analysis,
  analysisSteps,
  onDownloadReport,
  tagInput,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
  onDeleteAnalysis, // Nova prop
}: AnalysisViewProps) {
  const isCompleted = analysis.status === 'completed';
  const isError = analysis.status === 'error';
  const isInProgress = !isCompleted && !isError;

  return (
    <div className="space-y-6">
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

      <div className="mt-8 pt-6 border-t">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir Análise
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza de que deseja excluir a análise do arquivo "{analysis.fileName}"? Esta ação não pode ser desfeita e todos os dados associados, incluindo o relatório e o arquivo original, serão removidos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDeleteAnalysis(analysis.id)}>
                Confirmar Exclusão
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <p className="text-xs text-muted-foreground mt-2">
          A exclusão removerá o registro do Firestore e os arquivos do Storage.
        </p>
      </div>
    </div>
  );
}
