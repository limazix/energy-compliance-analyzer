/**
 * @fileoverview
 * This module defines the `ReportContent` component, which is responsible for
 * rendering the main body of the analysis report using MDX.
 */

import { Suspense } from 'react';

import { Loader2 } from 'lucide-react';
import { MDXRemote } from 'next-mdx-remote';
import remarkGfm from 'remark-gfm';
import remarkMermaid from 'remark-mermaidjs';

import type { AnalyzeComplianceReportOutput } from '@/ai/prompt-configs/analyze-compliance-report-prompt-config';
import Chart from '@/components/Chart';

interface ChartProps {
  title: string;
  src: string;
  alt: string;
}

interface ReportContentProps {
  mdxContent: string;
  structuredReport: AnalyzeComplianceReportOutput | null;
}

/**
 * A component that renders the MDX content of the report.
 * @param {ReportContentProps} props The props for the component.
 * @returns {JSX.Element} The rendered report content component.
 */
export function ReportContent({ mdxContent, structuredReport }: ReportContentProps) {
  const components = {
    Chart: (props: ChartProps) => {
      if (structuredReport) {
        const section = structuredReport.analysisSections.find((s) => s.title === props.title);
        if (section && section.chartUrl) {
          return <Chart src={section.chartUrl} alt={section.title} />;
        }
      }
      return null;
    },
  };

  return (
    <article className="prose prose-slate lg:prose-xl max-w-none bg-card p-6 sm:p-8 md:p-10 rounded-lg shadow-lg">
      <Suspense
        fallback={
          <div className="text-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /> Carregando
            relatório...
          </div>
        }
      >
        <MDXRemote
          source={mdxContent}
          options={{
            mdxOptions: {
              remarkPlugins: [remarkGfm, remarkMermaid],
            },
          }}
          components={components}
        />
      </Suspense>
    </article>
  );
}
