'use client';

import { AlertTriangle, FileText as FileTextIcon, Info, Trash2, XCircle } from 'lucide-react';

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
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Analysis, AnalysisStep } from '@/types/analysis';

import { AnalysisProgressDisplay } from './AnalysisProgressDisplay';
import { AnalysisResultsDisplay } from './AnalysisResultsDisplay';
import { AnalysisStepItem } from './AnalysisStepItem';
import { TagEditor } from './TagEditor';

type AnalysisViewProps = {
  analysis: Analysis;
  analysisSteps: AnalysisStep[];
  onDownloadReport: (analysisData: Analysis | null) => void;
  tagInput: string;
  onTagInputChange: (value: string) => void;
  onAddTag: (analysisId: string, tag: string) => void;
  onRemoveTag: (analysisId: string, tag: string) => void;
  onDeleteAnalysis: (analysisId: string) => void;
  onCancelAnalysis: (analysisId: string) => void;
};

export function AnalysisView({
  analysis,
  analysisSteps,
  onDownloadReport,
  tagInput,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
  onDeleteAnalysis,
  onCancelAnalysis,
}: AnalysisViewProps) {
  const isCompleted = analysis.status === 'completed';
  const isError = analysis.status === 'error';
  const isTerminalState =
    analysis.status === 'cancelled' ||
    analysis.status === 'cancelling' ||
    analysis.status === 'deleted' ||
    analysis.status === 'pending_deletion';

  const isInProgress = !isCompleted && !isError && !isTerminalState;

  const isDeletionPending = analysis.status === 'pending_deletion';
  const isBeingCancelled = analysis.status === 'cancelling';

  return (
    <div className="space-y-6">
      <Card className="border-primary/30 shadow-md">
        <CardHeader>
          <CardTitle className="text-xl text-primary flex items-center">
            <FileTextIcon className="mr-3 h-6 w-6" />
            {analysis.title || analysis.fileName}
          </CardTitle>
          {analysis.description && (
            <CardDescription className="pt-1 text-base text-foreground/80">
              {analysis.description}
            </CardDescription>
          )}
          <CardDescription className="text-xs">
            Nome do arquivo original: {analysis.fileName}
          </CardDescription>
        </CardHeader>
      </Card>

      {isInProgress && (
        <>
          <AnalysisProgressDisplay analysisSteps={analysisSteps} />
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCancelAnalysis(analysis.id)}
              disabled={isBeingCancelled || isDeletionPending}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancelar Análise
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              Solicitar o cancelamento da análise. O processo será interrompido o mais breve
              possível.
            </p>
          </div>
        </>
      )}

      {isCompleted && (
        <AnalysisResultsDisplay
          analysis={analysis}
          onDownloadReport={() => onDownloadReport(analysis)}
        />
      )}

      {(isBeingCancelled || analysis.status === 'cancelled' || isDeletionPending) && (
        <div className="p-4 bg-yellow-500/10 rounded-md border border-yellow-500">
          <h3 className="text-xl font-semibold mb-2 text-yellow-600 flex items-center">
            <Info className="mr-2" />
            {isDeletionPending
              ? 'Exclusão em Andamento'
              : isBeingCancelled
                ? 'Cancelamento em Andamento'
                : 'Análise Cancelada'}
          </h3>
          <p className="text-yellow-700">
            {isDeletionPending
              ? 'A solicitação de exclusão desta análise está sendo processada.'
              : isBeingCancelled
                ? 'O cancelamento desta análise está em andamento...'
                : 'Esta análise foi cancelada pelo usuário.'}
          </p>
          {analysis.errorMessage && analysis.status === 'cancelled' && (
            <p className="text-sm mt-1">
              <strong>Motivo:</strong> {analysis.errorMessage}
            </p>
          )}
          {analysisSteps.find(
            (s) => s.status === 'cancelled' || s.status === 'pending_deletion' // Treat pending_deletion steps visually
          ) && (
            <ul className="space-y-3 mt-4">
              {analysisSteps.map((step, index) => (
                <AnalysisStepItem key={index} step={step} />
              ))}
            </ul>
          )}
        </div>
      )}

      {isError && (
        <div className="p-4 bg-destructive/10 rounded-md border border-destructive">
          <h3 className="text-xl font-semibold mb-2 text-destructive flex items-center">
            <AlertTriangle className="mr-2" />
            Ocorreu um Erro
          </h3>
          <p className="text-destructive-foreground">Não foi possível completar a análise.</p>
          <p className="text-sm mt-1">
            <strong>Detalhes:</strong> {analysis.errorMessage || 'Erro desconhecido.'}
          </p>
          {analysisSteps.find((s) => s.status === 'error') && (
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
            <Button
              variant="destructive"
              size="sm"
              disabled={isInProgress || isBeingCancelled || isDeletionPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir Análise
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza de que deseja excluir a análise &quot;
                {analysis.title || analysis.fileName}&quot;? Esta ação não pode ser desfeita e todos
                os dados associados, incluindo o relatório e o arquivo original, serão removidos.
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
          A exclusão removerá os arquivos associados e marcará o registro como excluído.
        </p>
      </div>
    </div>
  );
}
