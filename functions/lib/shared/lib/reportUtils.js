"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertStructuredReportToMdx = convertStructuredReportToMdx;
exports.formatStructuredReportToTxt = formatStructuredReportToTxt;
function sanitizeForMdx(text) {
    if (!text)
        return '';
    return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function convertStructuredReportToMdx(report, fileNameInput) {
    const fileName = fileNameInput || "Nome de arquivo não disponível";
    try {
        if (!report) {
            console.warn('[convertStructuredReportToMdx] Report data is undefined. Returning default MDX.');
            return `# Relatório Indisponível\n\nOs dados para este relatório (arquivo: ${sanitizeForMdx(fileName)}) não foram encontrados ou estão incompletos.`;
        }
        const { reportMetadata, tableOfContents, introduction, analysisSections, finalConsiderations, bibliography } = report;
        const meta = reportMetadata || { title: 'Relatório de Conformidade', author: 'Energy Compliance Analyzer', generatedDate: new Date().toISOString().split('T')[0] };
        const intro = introduction || { objective: 'Não disponível.', overallResultsSummary: 'Não disponível.', usedNormsOverview: 'Não disponível.' };
        const sections = analysisSections || [];
        const biblio = bibliography || [];
        const tocFromReport = tableOfContents || []; // Renomeado para evitar conflito com a variável 'toc' abaixo
        let mdx = `---
title: "${sanitizeForMdx(meta.title)}"
subtitle: "${sanitizeForMdx(meta.subtitle) || `Análise de ${sanitizeForMdx(fileName)}`}"
author: "${sanitizeForMdx(meta.author)}"
generatedDate: "${sanitizeForMdx(meta.generatedDate)}"
fileName: "${sanitizeForMdx(fileName)}"
---

# ${sanitizeForMdx(meta.title)}

**Subtítulo:** ${sanitizeForMdx(meta.subtitle) || `Análise de ${sanitizeForMdx(fileName)}`}
**Autor:** ${sanitizeForMdx(meta.author)}
**Data de Geração:** ${sanitizeForMdx(meta.generatedDate)}
**Arquivo Analisado:** ${sanitizeForMdx(fileName)}
`;
        if (tocFromReport.length > 0) {
            mdx += `\n## Sumário\n`;
            tocFromReport.forEach((item) => {
                mdx += `- ${sanitizeForMdx(item)}\n`;
            });
        }
        mdx += `\n## Introdução\n`;
        mdx += `**Objetivo:** ${sanitizeForMdx(intro.objective)}\n\n`;
        mdx += `**Resumo dos Resultados:** ${sanitizeForMdx(intro.overallResultsSummary)}\n\n`;
        mdx += `**Visão Geral das Normas Utilizadas:** ${sanitizeForMdx(intro.usedNormsOverview)}\n`;
        if (sections.length > 0) {
            sections.forEach((section) => {
                const sec = section || { title: 'Seção Sem Título', content: 'Conteúdo não disponível.', insights: [], relevantNormsCited: [] };
                mdx += `\n## ${sanitizeForMdx(sec.title)}\n`;
                mdx += `${sanitizeForMdx(sec.content)}\n`;
                const insights = sec.insights || [];
                if (insights.length > 0) {
                    mdx += `\n**Insights Chave:**\n`;
                    insights.forEach((insight) => mdx += `- ${sanitizeForMdx(insight)}\n`);
                }
                const normsCited = sec.relevantNormsCited || [];
                if (normsCited.length > 0) {
                    mdx += `\n**Normas Citadas nesta Seção:**\n`;
                    normsCited.forEach((norm) => mdx += `- ${sanitizeForMdx(norm)}\n`);
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
            biblio.forEach((refItem) => {
                const item = refItem || { text: 'Referência não disponível' };
                mdx += `- ${sanitizeForMdx(item.text)}`;
                if (item.link)
                    mdx += ` ([link](${sanitizeForMdx(item.link)}))`;
                mdx += `\n`;
            });
        }
        return mdx;
    }
    catch (error) {
        console.error('[convertStructuredReportToMdx] Erro crítico durante a conversão do relatório para MDX:', error);
        return `# Erro na Conversão do Relatório para MDX\n\nOcorreu um erro interno ao tentar formatar o relatório. Detalhes do erro foram registrados no servidor.\n\nArquivo Analisado: ${sanitizeForMdx(fileName)}`;
    }
}
function formatStructuredReportToTxt(report, fileNameInput) {
    const fileName = fileNameInput || "Nome de arquivo não disponível";
    if (!report) {
        return "Relatório estruturado não disponível.";
    }
    const { reportMetadata, tableOfContents, introduction, analysisSections, finalConsiderations, bibliography } = report;
    const meta = reportMetadata || { title: 'Relatório de Conformidade', author: 'Energy Compliance Analyzer', generatedDate: new Date().toISOString().split('T')[0] };
    const intro = introduction || { objective: 'Não disponível.', overallResultsSummary: 'Não disponível.', usedNormsOverview: 'Não disponível.' };
    const sections = analysisSections || [];
    const biblio = bibliography || [];
    const toc = tableOfContents || []; // Variável 'toc' não estava sendo usada, mas pode ser útil aqui
    let txt = `RELATÓRIO DE CONFORMIDADE\n`;
    txt += `==================================================\n\n`;
    txt += `Título: ${meta.title}\n`;
    txt += `Subtítulo: ${meta.subtitle || `Análise de ${fileName}`}\n`;
    txt += `Autor: ${meta.author}\n`;
    txt += `Data de Geração: ${meta.generatedDate}\n`;
    txt += `Arquivo Analisado: ${fileName}\n\n`;
    if (toc.length > 0) { // Adicionando TOC ao TXT se disponível
        txt += `--------------------------------------------------\n`;
        txt += `SUMÁRIO\n`;
        txt += `--------------------------------------------------\n`;
        toc.forEach((item) => {
            txt += `- ${item}\n`;
        });
        txt += `\n`;
    }
    txt += `--------------------------------------------------\n`;
    txt += `INTRODUÇÃO\n`;
    txt += `--------------------------------------------------\n`;
    txt += `Objetivo: ${intro.objective}\n\n`;
    txt += `Resumo dos Resultados: ${intro.overallResultsSummary}\n\n`;
    txt += `Visão Geral das Normas Utilizadas: ${intro.usedNormsOverview}\n\n`;
    if (sections.length > 0) {
        sections.forEach((section, index) => {
            const sec = section || { title: 'Seção Sem Título', content: 'Não disponível.', insights: [], relevantNormsCited: [] };
            txt += `--------------------------------------------------\n`;
            txt += `SEÇÃO ${index + 1}: ${sec.title}\n`;
            txt += `--------------------------------------------------\n`;
            txt += `Conteúdo:\n${sec.content}\n\n`;
            const insights = sec.insights || [];
            if (insights.length > 0) {
                txt += `Insights Chave:\n`;
                insights.forEach((insight) => txt += `  - ${insight}\n`);
                txt += `\n`;
            }
            const normsCited = sec.relevantNormsCited || [];
            if (normsCited.length > 0) {
                txt += `Normas Citadas nesta Seção:\n`;
                normsCited.forEach((norm) => txt += `  - ${norm}\n`);
                txt += `\n`;
            }
            if (sec.chartOrImageSuggestion) {
                txt += `Sugestão de Gráfico/Imagem: ${sec.chartOrImageSuggestion}\n\n`;
            }
        });
    }
    else {
        txt += `Nenhuma seção de análise detalhada foi gerada.\n\n`;
    }
    if (finalConsiderations) {
        txt += `--------------------------------------------------\n`;
        txt += `CONSIDERAÇÕES FINAIS\n`;
        txt += `--------------------------------------------------\n`;
        txt += `${finalConsiderations}\n\n`;
    }
    else {
        txt += `Nenhuma consideração final foi gerada.\n\n`;
    }
    if (biblio.length > 0) {
        txt += `--------------------------------------------------\n`;
        txt += `REFERÊNCIAS BIBLIOGRÁFICAS\n`;
        txt += `--------------------------------------------------\n`;
        biblio.forEach((refItem) => {
            const item = refItem || { text: 'Referência não disponível' };
            txt += `- ${item.text}`;
            if (item.link)
                txt += ` (Disponível em: ${item.link})`;
            txt += `\n`;
        });
        txt += `\n`;
    }
    else {
        txt += `Nenhuma referência bibliográfica foi incluída.\n\n`;
    }
    return txt;
}
