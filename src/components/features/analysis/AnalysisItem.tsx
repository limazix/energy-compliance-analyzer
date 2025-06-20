// src/components/features/analysis/AnalysisItem.tsx
'use client';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Loader2 } from 'lucide-react'; // Removed Inbox as it's likely not needed here

import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AnalysisView } from '@/components/features/analysis/AnalysisView';
import type { Analysis } from '@/types/analysis';

/**
 * Props for the AnalysisItem component.
 */
// Consider refining type for displayedAnalysisSteps
interface AnalysisItemProps {
  analysisItem: Analysis;
  expandedAnalysisId: string | null;
  currentAnalysis: Analysis | null;
  onAccordionChange: (value: string | undefined) => void; // Keeping this prop for potential future use if needed to manage expansion externally
  displayedAnalysisSteps: any; // Consider defining a more specific type
  onDownloadReport: (analysis: Analysis) => void;
  tagInput: string;
  onTagInputChange: (value: string) => void;
  onAddTag: (analysisId: string, tag: string) => void;
  onRemoveTag: (analysisId: string, tag: string) => void;
  onDeleteAnalysis: (analysisId: string, afterDelete?: () => void) => void; // Added optional callback
  onCancelAnalysis: (analysisId: string) => void;
  onRetryAnalysis: (analysisId: string) => void;
}

/**
 * Determines the badge variant based on analysis status for styling.
 * @param status The status of the analysis.
 * @returns The corresponding badge variant string.
 */
const getStatusBadgeVariant = (status: Analysis['status']) => {
  switch (status) {
    case 'completed':
      return 'default'; // Will be styled green by custom CSS
    case 'error':
      return 'destructive';
    case 'cancelled':
    case 'cancelling':
    case 'pending_deletion': // Added
      return 'outline'; // Will be styled yellow by custom CSS
    case 'reviewing_report':
      return 'default'; // Will be styled blue by custom CSS
    default:
      return 'secondary';
  }
};

/**
 * Returns a human-readable label for the analysis status.
 * @param status The status of the analysis.
 * @returns The corresponding status label string.
 */
const getStatusLabel = (status: Analysis['status']) => {
  switch (status) {
    case 'uploading':
      return 'Enviando';
    case 'summarizing_data':
      return 'Sumarizando Dados';
    case 'identifying_regulations':
      return 'Identificando Resoluções';
    case 'assessing_compliance':
      return 'Analisando Conformidade';
    case 'reviewing_report':
      return 'Revisando Relatório';
    case 'completed':
      return 'Concluída';
    case 'error':
      return 'Erro';
    case 'deleted':
      return 'Excluída';
    case 'cancelling':
      return 'Cancelando...';
    case 'cancelled':
      return 'Cancelada';
    case 'pending_deletion': // Added
      return 'Excluindo...';
    default:
      return status;
  }
};

/**
 * Renders a single analysis item within an Accordion.
 * Displays analysis details and status, and provides actions when expanded.
 */
export default function AnalysisItem({
  analysisItem,
  expandedAnalysisId,
  currentAnalysis,
  onAccordionChange, // Keeping but not used internally in this structure
  displayedAnalysisSteps,
  onDownloadReport,
  tagInput,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
  onDeleteAnalysis,
  onCancelAnalysis,
  onRetryAnalysis,
}: AnalysisItemProps) {
  const isExpanded = expandedAnalysisId === analysisItem.id;

  return (
    <AccordionItem value={analysisItem.id} key={analysisItem.id} className="border-b">
      <AccordionTrigger className="w-full px-2 py-4 text-left hover:bg-muted/50">
        <div className="flex w-full flex-col md:flex-row md:items-center md:justify-between">
          <span className="max-w-[200px] truncate font-medium text-foreground sm:max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl">
            {analysisItem.title || analysisItem.fileName}
          </span>
          <div className="mt-1 flex flex-col text-sm text-muted-foreground md:mt-0 md:ml-4 md:flex-row md:items-center md:space-x-3 md:space-y-0">
            <span>
              {analysisItem.createdAt
                ? format(new Date(analysisItem.createdAt as string), 'dd/MM/yy HH:mm', {
                    locale: ptBR,
                  })
                : 'Data N/A'}
            </span>
            <Badge
              variant={getStatusBadgeVariant(analysisItem.status)}
              className={`
                ${analysisItem.status === 'completed' ? 'bg-green-600 text-white' : ''}
                ${analysisItem.status === 'error' ? 'bg-red-600 text-white' : ''}
                ${analysisItem.status === 'cancelled' || analysisItem.status === 'cancelling' || analysisItem.status === 'pending_deletion' ? 'bg-yellow-500 text-white' : ''}
                ${analysisItem.status === 'reviewing_report' ? 'bg-blue-500 text-white' : ''}
              `}
            >
              {getStatusLabel(analysisItem.status)}
            </Badge>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="bg-background p-4">
        {isExpanded && currentAnalysis && currentAnalysis.id === analysisItem.id ? (
          <AnalysisView
            analysis={currentAnalysis}
            analysisSteps={displayedAnalysisSteps}
            onDownloadReport={() => onDownloadReport(currentAnalysis)}
            tagInput={tagInput}
            onTagInputChange={onTagInputChange}
            onAddTag={(tag) => onAddTag(currentAnalysis.id, tag)}
            onRemoveTag={(tag) => onRemoveTag(currentAnalysis.id, tag)}
            onDeleteAnalysis={
              () => onDeleteAnalysis(currentAnalysis.id) // Passing the ID
            }
            onCancelAnalysis={() => onCancelAnalysis(currentAnalysis.id)}
            onRetryAnalysis={() => onRetryAnalysis(currentAnalysis.id)}
          />
        ) : isExpanded &&
          analysisItem.status === 'error' &&
          analysisItem.id.startsWith('error-') ? (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Ocorreu um Erro</AlertTitle>
            <AlertDescription>
              Não foi possível carregar ou processar esta análise.
              <br />
              <strong>Detalhes:</strong> {analysisItem.errorMessage || 'Erro desconhecido.'}
            </AlertDescription>
          </Alert>
        ) : isExpanded ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" /> Carregando detalhes...
          </div>
        ) : null}
      </AccordionContent>
    </AccordionItem>
  );
}
