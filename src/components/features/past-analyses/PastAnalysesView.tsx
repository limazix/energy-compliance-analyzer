
'use client';

import type { Analysis } from '@/types/analysis';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PastAnalysisCard } from './PastAnalysisCard';

type PastAnalysesViewProps = {
  analyses: Analysis[];
  isLoading: boolean;
  onViewDetails: (analysis: Analysis) => void;
  onDeleteAnalysis: (analysisId: string) => void;
  onBackToDashboard: () => void;
};

export function PastAnalysesView({
  analyses,
  isLoading,
  onViewDetails,
  onDeleteAnalysis,
  onBackToDashboard,
}: PastAnalysesViewProps) {
  return (
    <>
      <div className="mb-4 flex items-center space-x-2 text-sm">
        <span
          onClick={onBackToDashboard}
          className="text-muted-foreground hover:text-primary cursor-pointer"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onBackToDashboard()}
        >
          Dashboard
        </span>
        <span className="text-muted-foreground">/</span>
        <span className="font-semibold text-foreground">Análises Anteriores</span>
      </div>
      <Card className="shadow-xl relative">
        <CardHeader>
          <CardTitle className="text-2xl font-headline text-primary">Análises Anteriores</CardTitle>
          <Button variant="outline" onClick={onBackToDashboard} className="absolute top-6 right-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Dashboard
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading && <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />}
          {!isLoading && analyses.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Nenhuma análise anterior encontrada.</p>
          )}
          {!isLoading && analyses.length > 0 && (
            <ul className="space-y-4">
              {analyses.map(analysis => (
                <PastAnalysisCard
                  key={analysis.id}
                  analysis={analysis}
                  onViewDetails={onViewDetails}
                  onDeleteAnalysis={onDeleteAnalysis}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

    