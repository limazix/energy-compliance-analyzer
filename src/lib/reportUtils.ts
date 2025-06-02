
import type { AnalyzeComplianceReportOutput, ReportSectionSchema, BibliographyItemSchema } from '@/ai/flows/analyze-compliance-report';

function sanitizeForMdx(text: string | undefined): string {
  if (!text) return '';
  // Adicionar mais sanitizações conforme necessário.
  // Por exemplo, escapar caracteres especiais do Markdown/MDX se eles vierem do conteúdo da IA.
  // Por enquanto, apenas um escape básico de crases, se necessário (já feito no prompt).
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function convertStructuredReportToMdx(
  report: AnalyzeComplianceReportOutput | undefined,
  fileName: string
): string {
  if (!report) return "# Relatório Indisponível\n\nOs dados para este relatório não foram encontrados ou estão incompletos.";

  let mdx = `---
title: "${sanitizeForMdx(report.reportMetadata?.title) || 'Relatório de Conformidade'}"
subtitle: "${sanitizeForMdx(report.reportMetadata?.subtitle) || `Análise de ${fileName}`}"
author: "${sanitizeForMdx(report.reportMetadata?.author) || 'Energy Compliance Analyzer'}"
generatedDate: "${sanitizeForMdx(report.reportMetadata?.generatedDate) || new Date().toISOString().split('T')[0]}"
fileName: "${sanitizeForMdx(fileName)}"
---

# ${sanitizeForMdx(report.reportMetadata?.title) || 'Relatório de Conformidade'}

**Subtítulo:** ${sanitizeForMdx(report.reportMetadata?.subtitle) || `Análise de ${fileName}`}
**Autor:** ${sanitizeForMdx(report.reportMetadata?.author) || 'Energy Compliance Analyzer'}
**Data de Geração:** ${sanitizeForMdx(report.reportMetadata?.generatedDate) || new Date().toISOString().split('T')[0]}
**Arquivo Analisado:** ${sanitizeForMdx(fileName)}

`;

  if (report.tableOfContents && report.tableOfContents.length > 0) {
    mdx += `\n## Sumário\n`;
    report.tableOfContents.forEach(item => {
      mdx += `- ${sanitizeForMdx(item)}\n`;
    });
  }

  if (report.introduction) {
    mdx += `\n## Introdução\n`;
    mdx += `**Objetivo:** ${sanitizeForMdx(report.introduction.objective) || 'Não disponível.'}\n\n`;
    mdx += `**Resumo dos Resultados:** ${sanitizeForMdx(report.introduction.overallResultsSummary) || 'Não disponível.'}\n\n`;
    mdx += `**Visão Geral das Normas Utilizadas:** ${sanitizeForMdx(report.introduction.usedNormsOverview) || 'Não disponível.'}\n`;
  }

  if (report.analysisSections && report.analysisSections.length > 0) {
    report.analysisSections.forEach((section: ReportSectionSchema) => {
      mdx += `\n## ${sanitizeForMdx(section.title) || 'Seção Sem Título'}\n`;
      mdx += `${sanitizeForMdx(section.content) || 'Conteúdo não disponível.'}\n`;
      
      if (section.insights && section.insights.length > 0) {
        mdx += `\n**Insights Chave:**\n`;
        section.insights.forEach(insight => mdx += `- ${sanitizeForMdx(insight)}\n`);
      }
      
      if (section.relevantNormsCited && section.relevantNormsCited.length > 0) {
        mdx += `\n**Normas Citadas nesta Seção:**\n`;
        section.relevantNormsCited.forEach(norm => mdx += `- ${sanitizeForMdx(norm)}\n`);
      }
      
      if (section.chartOrImageSuggestion) {
        mdx += `\n<div style={{padding: '1rem', backgroundColor: '#f0f0f0', border: '1px solid #ddd', borderRadius: '4px', margin: '1rem 0'}}>`;
        mdx += `  <strong>Sugestão de Gráfico/Imagem:</strong> ${sanitizeForMdx(section.chartOrImageSuggestion)}`;
        mdx += `</div>\n`;
      }
    });
  }

  if (report.finalConsiderations) {
    mdx += `\n## Considerações Finais\n`;
    mdx += `${sanitizeForMdx(report.finalConsiderations)}\n`;
  }

  if (report.bibliography && report.bibliography.length > 0) {
    mdx += `\n## Referências Bibliográficas\n`;
    report.bibliography.forEach((ref: BibliographyItemSchema) => {
      mdx += `- ${sanitizeForMdx(ref.text)}`;
      if (ref.link) mdx += ` ([link](${sanitizeForMdx(ref.link)}))`;
      mdx += `\n`;
    });
  }

  return mdx;
}
