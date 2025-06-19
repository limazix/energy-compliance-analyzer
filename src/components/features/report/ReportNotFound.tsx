/**
 * @fileoverview
 * This module defines the `ReportNotFound` component, which displays a
 * full-page message indicating that the report could not be found.
 */

import { ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

import { AppFooter } from '@/components/app-footer';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';

interface ReportNotFoundProps {
  analysisId: string | null;
  fileName: string | null;
  onRetry: () => void;
}

/**
 * A component that displays a full-page "not found" message with retry and back buttons.
 * @param {ReportNotFoundProps} props The props for the component.
 * @returns {JSX.Element} The rendered "not found" state component.
 */
export function ReportNotFound({ analysisId, fileName, onRetry }: ReportNotFoundProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto py-8 px-4 flex-1">
        <div className="text-center py-10">
          <h1 className="text-2xl font-bold text-destructive">Relatório Não Encontrado</h1>
          <p className="text-muted-foreground mt-2">
            O conteúdo do relatório para a análise com ID: {analysisId || 'desconhecido'} não pôde
            ser carregado ou não existe.
          </p>
          {fileName && <p className="text-sm text-muted-foreground mt-1">Arquivo: {fileName}</p>}
          <div className="mt-6 space-x-2">
            <Button onClick={onRetry}>
              <RefreshCw className="mr-2 h-4 w-4" /> Tentar Novamente
            </Button>
            <Button asChild variant="outline">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Página Inicial
              </Link>
            </Button>
          </div>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
