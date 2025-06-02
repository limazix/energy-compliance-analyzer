
import type { AnalyzeComplianceReportOutput, ReportSectionSchema, BibliographyItemSchema } from '@/ai/flows/analyze-compliance-report';

function sanitizeForMdx(text: string | undefined): string {
  if (!text) return '';
  // Adicionar mais sanitizações conforme necessário.
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function convertStructuredReportToMdx(
  report: AnalyzeComplianceReportOutput | undefined,
  fileName: string
): string {
  try {
    if (!report) {
      console.warn('[convertStructuredReportToMdx] Report data is undefined. Returning default MDX.');
      return "# Relatório Indisponível\n\nOs dados para este relatório não foram encontrados ou estão incompletos.";
    }

    const { reportMetadata, tableOfContents, introduction, analysisSections, finalConsiderations, bibliography } = report;

    // Defensive checks for main sections and their properties
    const meta = reportMetadata || {};
    const intro = introduction || {};
    const sections = analysisSections || [];
    const biblio = bibliography || [];
    const toc = tableOfContents || [];

    let mdx = `---
title: "${sanitizeForMdx(meta.title) || 'Relatório de Conformidade'}"
subtitle: "${sanitizeForMdx(meta.subtitle) || `Análise de ${sanitizeForMdx(fileName)}`}"
author: "${sanitizeForMdx(meta.author) || 'Energy Compliance Analyzer'}"
generatedDate: "${sanitizeForMdx(meta.generatedDate) || new Date().toISOString().split('T')[0]}"
fileName: "${sanitizeForMdx(fileName)}"
---

# ${sanitizeForMdx(meta.title) || 'Relatório de Conformidade'}

**Subtítulo:** ${sanitizeForMdx(meta.subtitle) || `Análise de ${sanitizeForMdx(fileName)}`}
**Autor:** ${sanitizeForMdx(meta.author) || 'Energy Compliance Analyzer'}
**Data de Geração:** ${sanitizeForMdx(meta.generatedDate) || new Date().toISOString().split('T')[0]}
**Arquivo Analisado:** ${sanitizeForMdx(fileName)}
`;

    if (toc.length > 0) {
      mdx += `\n## Sumário\n`;
      toc.forEach(item => {
        mdx += `- ${sanitizeForMdx(item)}\n`;
      });
    }

    mdx += `\n## Introdução\n`;
    mdx += `**Objetivo:** ${sanitizeForMdx(intro.objective) || 'Não disponível.'}\n\n`;
    mdx += `**Resumo dos Resultados:** ${sanitizeForMdx(intro.overallResultsSummary) || 'Não disponível.'}\n\n`;
    mdx += `**Visão Geral das Normas Utilizadas:** ${sanitizeForMdx(intro.usedNormsOverview) || 'Não disponível.'}\n`;

    if (sections.length > 0) {
      sections.forEach((section: ReportSectionSchema) => {
        // Ensure section is not null/undefined if the array could somehow contain them
        const sec = section || {}; 
        mdx += `\n## ${sanitizeForMdx(sec.title) || 'Seção Sem Título'}\n`;
        mdx += `${sanitizeForMdx(sec.content) || 'Conteúdo não disponível.'}\n`;
        
        const insights = sec.insights || [];
        if (insights.length > 0) {
          mdx += `\n**Insights Chave:**\n`;
          insights.forEach(insight => mdx += `- ${sanitizeForMdx(insight)}\n`);
        }
        
        const normsCited = sec.relevantNormsCited || [];
        if (normsCited.length > 0) {
          mdx += `\n**Normas Citadas nesta Seção:**\n`;
          normsCited.forEach(norm => mdx += `- ${sanitizeForMdx(norm)}\n`);
        }
        
        if (sec.chartOrImageSuggestion) {
          mdx += `\n<div style={{padding: '1rem', backgroundColor: '#f0f0f0', border: '1px solid #ddd', borderRadius: '4px', margin: '1rem 0'}}>`;
          mdx += `  <strong>Sugestão de Gráfico/Imagem:</strong> ${sanitizeForMdx(sec.chartOrImageSuggestion)}`;
          mdx += `</div>\n`;
        }
      });
    }

    if (finalConsiderations) {
      mdx += `\n## Considerações Finais\n`;
      mdx += `${sanitizeForMdx(finalConsiderations)}\n`;
    }

    if (biblio.length > 0) {
      mdx += `\n## Referências Bibliográficas\n`;
      biblio.forEach((refItem: BibliographyItemSchema) => {
        // Ensure refItem is not null/undefined
        const item = refItem || {}; 
        mdx += `- ${sanitizeForMdx(item.text)}`;
        if (item.link) mdx += ` ([link](${sanitizeForMdx(item.link)}))`;
        mdx += `\n`;
      });
    }
    return mdx;

  } catch (error) {
    console.error('[convertStructuredReportToMdx] Erro crítico durante a conversão do relatório para MDX:', error);
    // Retorna um MDX de fallback indicando o erro de conversão
    return `# Erro na Conversão do Relatório para MDX\n\nOcorreu um erro interno ao tentar formatar o relatório. Detalhes do erro foram registrados no servidor.\n\nArquivo Analisado: ${sanitizeForMdx(fileName)}`;
  }
}
