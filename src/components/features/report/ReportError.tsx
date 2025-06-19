/**
 * @fileoverview
 * This module defines the `ReportError` component, which displays a
 * full-page error message.
 */

import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

import { AppFooter } from '@/components/app-footer';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';

interface ReportErrorProps {
  fileName: string | null;
  error: string;
  onRetry: () => void;
}

/**
 * A component that displays a full-page error message with retry and back buttons.
 * @param {ReportErrorProps} props The props for the component.
 * @returns {JSX.Element} The rendered error state component.
 */
export function ReportError({ fileName, error, onRetry }: ReportErrorProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto py-8 px-4 flex-1">
        <div className="text-center py-10 bg-destructive/10 border border-destructive rounded-md p-6">
          <h1 className="text-2xl font-bold text-destructive flex items-center justify-center">
            <AlertTriangle className="mr-2 h-7 w-7" /> Falha ao Carregar Relatório
          </h1>
          {fileName && <p className="text-sm text-muted-foreground mt-1">Arquivo: {fileName}</p>}
          <p className="text-destructive-foreground mt-2">{error}</p>
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
