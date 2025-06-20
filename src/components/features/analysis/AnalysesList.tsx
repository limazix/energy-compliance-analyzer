// src/components/features/analysis/AnalysesList.tsx
'use client';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnalysisItem } from './AnalysisItem';
import type { Analysis } from '@/types/analysis';
import type { AnalyzeComplianceReportOutput } from '@/ai/prompt-configs/analyze-compliance-report-prompt-config';

/**
 * Props for the AnalysesList component.
 */
interface AnalysesListProps {
  analyses: Analysis[];
  isLoadingPastAnalyses: boolean;
  isLoadingMoreAnalyses: boolean;
  hasMoreAnalyses: boolean;
  fetchPastAnalyses: (loadMore?: boolean) => Promise<void>;
  expandedAnalysisId: string | null;
  onAccordionChange: (value: string | undefined) => void;
  currentAnalysis: Analysis | null;
  displayedAnalysisSteps: ReturnType<
    typeof import('@/features/analysis-processing/utils/analysisStepsUtils').calculateDisplayedAnalysisSteps
  >; // Use correct inferred type
  onDownloadReport: (analysis: Analysis) => void;
  tagInput: string;
  onTagInputChange: (value: string) => void;
  onAddTag: (analysisId: string, tag: string) => void;
  onRemoveTag: (analysisId: string, tag: string) => void;
  onDeleteAnalysis: (analysisId: string, afterDelete?: () => void) => Promise<void>;
  onCancelAnalysis: (
    analysisId: string
  ) => Promise<{ success: boolean; message?: string } | undefined>;
  onRetryAnalysis: (
    analysisId: string
  ) => Promise<{ success: boolean; error?: string } | undefined>;
  afterDeleteAnalysis: () => Promise<void>;
}

/**
 * Component that renders the list of analyses with an accordion and pagination (load more) functionality.
 * It receives the list of analyses, loading states, pagination function, and handlers as props.
 */
export function AnalysesList({
  analyses,
  isLoadingPastAnalyses,
  isLoadingMoreAnalyses,
  hasMoreAnalyses,
  fetchPastAnalyses,
  expandedAnalysisId,
  onAccordionChange,
  currentAnalysis,
  displayedAnalysisSteps,
  onDownloadReport,
  tagInput,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
  onDeleteAnalysis,
  onCancelAnalysis,
  onRetryAnalysis,
  afterDeleteAnalysis,
}: AnalysesListProps) {
  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-headline text-primary">
          Suas Análises Anteriores
        </CardTitle>
        <CardDescription>
          Veja o histórico de suas análises ou inicie uma nova no botão acima.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingPastAnalyses && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        )}
        {!isLoadingPastAnalyses && analyses.length === 0 && (
          <div className="py-10 text-center text-muted-foreground">
            <Inbox className="mx-auto mb-4 h-12 w-12" />
            <p className="text-lg">Nenhuma análise anterior encontrada.</p>
            <p>Clique em &quot;Nova Análise&quot; para começar.</p>
          </div>
        )}
        {!isLoadingPastAnalyses && analyses.length > 0 && (
          <Accordion
            type="single"
            collapsible
            value={expandedAnalysisId || undefined}
            onValueChange={onAccordionChange}
            className="w-full"
          >
            {analyses.map((analysisItem) => (
              <AnalysisItem
                key={analysisItem.id}
                analysisItem={analysisItem}
                expandedAnalysisId={expandedAnalysisId}
                currentAnalysis={currentAnalysis}
                onAccordionChange={onAccordionChange}
                displayedAnalysisSteps={displayedAnalysisSteps}
                onDownloadReport={onDownloadReport}
                tagInput={tagInput}
                onTagInputChange={onTagInputChange}
                onAddTag={onAddTag}
                onRemoveTag={onRemoveTag}
                onDeleteAnalysis={onDeleteAnalysis}
                onCancelAnalysis={onCancelAnalysis}
                onRetryAnalysis={onRetryAnalysis}
                afterDeleteAnalysis={afterDeleteAnalysis}
              />
            ))}
          </Accordion>
        )}
        {/* Load More Button */}
        {hasMoreAnalyses && !isLoadingPastAnalyses && (
          <div className="flex justify-center py-4">
            <Button
              onClick={() => fetchPastAnalyses(true)}
              disabled={isLoadingMoreAnalyses}
              variant="outline"
            >
              {isLoadingMoreAnalyses ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Carregar Mais Análises
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
