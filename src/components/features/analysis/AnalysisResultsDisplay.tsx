
'use client';

import Link from 'next/link';
import { CheckCircle2, FileText, Download, FileJson, Eye } from 'lucide-react';
import type { Analysis } from '@/types/analysis';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type AnalysisResultsDisplayProps = {
  analysis: Analysis;
  onDownloadReport: (analysisData: Analysis | null) => void; // Passa a análise completa
};

export function AnalysisResultsDisplay({ analysis, onDownloadReport }: AnalysisResultsDisplayProps) {
  const { structuredReport } = analysis;

  const downloadJsonReport = () => {
    if (!structuredReport) return;
    const jsonString = JSON.stringify(structuredReport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${analysis.fileName.replace(/\.[^/.]+$/, "")}_structured_report.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };


  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2 text-green-600 flex items-center">
          <CheckCircle2 className="mr-2" />
          Análise Concluída com Sucesso!
        </h3>
        <p className="text-sm text-muted-foreground">
          O relatório estruturado foi gerado. Você pode visualizar um resumo abaixo, baixar o conteúdo completo ou ver o relatório detalhado em uma nova página.
        </p>
      </div>

      {structuredReport ? (
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-lg">{structuredReport.reportMetadata?.title || 'Relatório de Conformidade'}</CardTitle>
            {structuredReport.reportMetadata?.subtitle && <CardDescription>{structuredReport.reportMetadata.subtitle}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-md font-semibold mb-1">Introdução:</h4>
              <p className="text-sm whitespace-pre-wrap text-foreground/80">
                <strong>Objetivo:</strong> {structuredReport.introduction?.objective || 'Não disponível.'}
              </p>
              <p className="text-sm whitespace-pre-wrap mt-1 text-foreground/80">
                <strong>Resumo dos Resultados:</strong> {structuredReport.introduction?.overallResultsSummary || 'Não disponível.'}
              </p>
            </div>
            
            {structuredReport.analysisSections && structuredReport.analysisSections.length > 0 && (
              <div>
                <h4 className="text-md font-semibold mb-2">Seções da Análise (Prévia):</h4>
                <Accordion type="single" collapsible className="w-full max-h-60 overflow-y-auto">
                  {structuredReport.analysisSections.slice(0, 3).map((section, index) => ( // Mostrar prévia de até 3 seções
                    <AccordionItem value={`section-${index}`} key={index} className="border-b border-border/50">
                      <AccordionTrigger className="text-sm hover:bg-muted/50 py-3 px-2 text-left">
                        {section.title || `Seção ${index + 1}`}
                      </AccordionTrigger>
                      <AccordionContent className="p-3 space-y-2 text-xs bg-background rounded-b-md">
                        <p className="whitespace-pre-wrap line-clamp-3">{section.content}</p>
                        {/* Outros detalhes da seção podem ser omitidos na prévia para economizar espaço */}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
                {structuredReport.analysisSections.length > 3 && <p className="text-xs text-muted-foreground mt-1">Mais seções disponíveis no relatório detalhado.</p>}
              </div>
            )}

            <div>
              <h4 className="text-md font-semibold mb-1">Considerações Finais (Prévia):</h4>
              <p className="text-sm whitespace-pre-wrap text-foreground/80 line-clamp-3">
                {structuredReport.finalConsiderations || 'Não disponível.'}
              </p>
            </div>
            
          </CardContent>
        </Card>
      ) : (
        <p className="text-muted-foreground">O relatório estruturado ainda não está disponível.</p>
      )}

      <div className="flex flex-wrap gap-2 mt-4">
        <Button asChild variant="default" disabled={!structuredReport}>
          <Link href={`/report/${analysis.id}`}>
            <Eye className="mr-2 h-4 w-4" /> Visualizar Relatório Detalhado
          </Link>
        </Button>
        <Button
          onClick={() => onDownloadReport(analysis)}
          variant="outline"
          disabled={!structuredReport}
        >
          <Download className="mr-2 h-4 w-4" /> Baixar (TXT Formatado)
        </Button>
        <Button
          onClick={downloadJsonReport}
          variant="outline"
          disabled={!structuredReport}
        >
          <FileJson className="mr-2 h-4 w-4" /> Baixar (JSON)
        </Button>
      </div>
    </div>
  );
}
