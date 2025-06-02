
'use client';

import { CheckCircle2, FileText, Download, FileJson } from 'lucide-react';
import type { Analysis } from '@/types/analysis';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
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
          O relatório estruturado foi gerado. Você pode visualizar um resumo abaixo ou baixar o conteúdo completo.
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
                <h4 className="text-md font-semibold mb-2">Seções da Análise:</h4>
                <Accordion type="single" collapsible className="w-full">
                  {structuredReport.analysisSections.map((section, index) => (
                    <AccordionItem value={`section-${index}`} key={index} className="border-b border-border/50">
                      <AccordionTrigger className="text-sm hover:bg-muted/50 py-3 px-2">
                        {section.title || `Seção ${index + 1}`}
                      </AccordionTrigger>
                      <AccordionContent className="p-3 space-y-2 text-xs bg-background rounded-b-md">
                        <p className="whitespace-pre-wrap">{section.content}</p>
                        {section.insights && section.insights.length > 0 && (
                            <>
                                <strong className="block mt-2">Insights Chave:</strong>
                                <ul className="list-disc list-inside pl-2">
                                    {section.insights.map((insight, i) => <li key={i}>{insight}</li>)}
                                </ul>
                            </>
                        )}
                        {section.relevantNormsCited && section.relevantNormsCited.length > 0 && (
                             <>
                                <strong className="block mt-2">Normas Citadas:</strong>
                                <ul className="list-disc list-inside pl-2">
                                    {section.relevantNormsCited.map((norm, i) => <li key={i}>{norm}</li>)}
                                </ul>
                            </>
                        )}
                        {section.chartOrImageSuggestion && (
                            <p className="mt-2 italic text-muted-foreground"><strong>Sugestão de Gráfico/Imagem:</strong> {section.chartOrImageSuggestion}</p>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}

            <div>
              <h4 className="text-md font-semibold mb-1">Considerações Finais:</h4>
              <p className="text-sm whitespace-pre-wrap text-foreground/80">
                {structuredReport.finalConsiderations || 'Não disponível.'}
              </p>
            </div>
            
            {/* Opcional: Mostrar Bibliografia se for curta, ou deixar apenas para download */}
            {/* <div>
              <h4 className="text-md font-semibold mb-1">Referências Bibliográficas:</h4>
              <Textarea
                readOnly
                value={structuredReport.bibliography?.map(b => `- ${b.text}${b.link ? ` (${b.link})` : ''}`).join('\n') || 'Não disponível.'}
                className="h-32 text-xs bg-background"
                aria-label="Referências Bibliográficas"
              />
            </div> */}

          </CardContent>
        </Card>
      ) : (
        <p className="text-muted-foreground">O relatório estruturado ainda não está disponível.</p>
      )}

      <div className="flex flex-wrap gap-2 mt-4">
        <Button
          onClick={() => onDownloadReport(analysis)}
          className="mt-2"
          variant="default"
          disabled={!structuredReport}
        >
          <Download className="mr-2 h-4 w-4" /> Baixar Relatório (TXT Formatado)
        </Button>
        <Button
          onClick={downloadJsonReport}
          className="mt-2"
          variant="outline"
          disabled={!structuredReport}
        >
          <FileJson className="mr-2 h-4 w-4" /> Baixar Relatório (JSON)
        </Button>
      </div>
    </div>
  );
}
