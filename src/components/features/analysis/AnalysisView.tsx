
'use client';

import type { Analysis, AnalysisStep } from '@/types/analysis';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// import { Button } from '@/components/ui/button'; // Button não é mais usado diretamente aqui se o botão de nova análise for removido
import { AlertTriangle } from 'lucide-react'; // PlusCircle e History não são mais necessários aqui
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
  onNavigateToDashboard: () => void;
  onNavigateToPastAnalyses: () => void;
};

export function AnalysisView({
  analysis,
  analysisSteps,
  onDownloadReport,
  tagInput,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
  onNavigateToDashboard,
  onNavigateToPastAnalyses,
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
        <div className="mb-6 flex items-center space-x-2 text-sm">
          <span
            onClick={onNavigateToDashboard}
            className="text-muted-foreground hover:text-primary cursor-pointer"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onNavigateToDashboard()}
          >
            Dashboard
          </span>
          <span className="text-muted-foreground">/</span>
          <span
            onClick={onNavigateToPastAnalyses}
            className="text-muted-foreground hover:text-primary cursor-pointer"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onNavigateToPastAnalyses()}
          >
            Análises Anteriores
          </span>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold text-foreground truncate max-w-[150px] xs:max-w-[200px] sm:max-w-xs md:max-w-sm lg:max-w-md">
            {analysis.fileName}
          </span>
        </div>

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

        {/* Botão "Iniciar Nova Análise" e "Ver Análises Anteriores" removidos daqui */}
      </CardContent>
    </Card>
  );
}
