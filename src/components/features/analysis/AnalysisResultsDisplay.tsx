
'use client';

import { CheckCircle2, FileText } from 'lucide-react';
import type { Analysis } from '@/types/analysis';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

type AnalysisResultsDisplayProps = {
  analysis: Analysis;
  onDownloadReport: (reportText: string | undefined, fileName: string) => void;
};

export function AnalysisResultsDisplay({ analysis, onDownloadReport }: AnalysisResultsDisplayProps) {
  return (
    <>
      <div>
        <h3 className="text-xl font-semibold mb-2 text-green-600 flex items-center">
          <CheckCircle2 className="mr-2" />
          Análise Concluída com Sucesso!
        </h3>
      </div>
      <div>
        <h4 className="text-lg font-semibold mb-1">Sumário da Conformidade:</h4>
        <Card className="bg-background p-4">
          <p className="text-sm whitespace-pre-wrap">{analysis.summary || 'Sumário não disponível.'}</p>
        </Card>
      </div>
      <div>
        <h4 className="text-lg font-semibold mb-1">Relatório Detalhado:</h4>
        <Textarea
          readOnly
          value={analysis.complianceReport || 'Relatório detalhado não disponível.'}
          className="h-64 text-sm bg-background"
          aria-label="Relatório Detalhado"
        />
        <Button
          onClick={() => onDownloadReport(analysis.complianceReport, analysis.fileName)}
          className="mt-2"
          variant="outline"
        >
          <FileText className="mr-2 h-4 w-4" /> Baixar Relatório (TXT)
        </Button>
      </div>
    </>
  );
}

    