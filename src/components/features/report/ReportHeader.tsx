/**
 * @fileoverview
 * This module defines the `ReportHeader` component, which displays the
 * header section of the analysis report.
 */

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

interface ReportHeaderProps {
  fileName: string | null;
  analysisId: string | null;
}

/**
 * A component that displays the header of the report page.
 * @param {ReportHeaderProps} props The props for the component.
 * @returns {JSX.Element} The rendered report header component.
 */
export function ReportHeader({ fileName, analysisId }: ReportHeaderProps) {
  return (
    <>
      <div className="mb-6 flex justify-between items-center">
        <Button asChild variant="outline" size="sm">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Análises
          </Link>
        </Button>
      </div>

      <div className="mb-4 p-4 bg-card rounded-lg shadow">
        <h1 className="text-3xl font-bold text-primary">
          {fileName ? `Relatório: ${fileName}` : 'Relatório Detalhado'}
        </h1>
        <p className="text-sm text-muted-foreground">Análise ID: {analysisId}</p>
      </div>
    </>
  );
}
