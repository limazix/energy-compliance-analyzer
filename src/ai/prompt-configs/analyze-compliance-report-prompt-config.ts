import { z } from 'zod';

export const AnalyzeComplianceReportInputSchema = z.object({
  powerQualityDataSummary: z
    .string()
    .describe('A summary of the power quality data, highlighting key metrics and anomalies.'),
  identifiedRegulations: z
    .string()
    .describe(
      'The identified ANEEL regulations relevant to the data (comma-separated string of resolution numbers/names). These regulations are typically in Portuguese.'
    ),
  fileName: z
    .string()
    .describe('The name of the original file being analyzed, for context in the report.'),
  languageCode: z
    .string()
    .optional()
    .default('pt-BR')
    .describe(
      'The BCP-47 language code for the desired output language of the report (e.g., "en-US", "pt-BR"). Defaults to "pt-BR" if not provided.'
    ),
});
export type AnalyzeComplianceReportInput = z.infer<typeof AnalyzeComplianceReportInputSchema>;

export const ReportSectionSchema = z.object({
  title: z.string().describe('Título da seção temática ou cronológica do relatório.'),
  content: z
    .string()
    .describe(
      'Conteúdo principal da seção, descrevendo os dados, análises e observações de forma técnica, clara e objetiva.'
    ),
  insights: z
    .array(z.string())
    .describe(
      'Lista de insights chave ou problemas específicos detectados e discutidos nesta seção.'
    ),
  relevantNormsCited: z
    .array(z.string())
    .describe(
      "Normas ANEEL (ex: 'Resolução XXX/YYYY, Art. Z') especificamente citadas e usadas como base para os insights desta seção. These should be cited in their original Portuguese form."
    ),
  chartOrImageSuggestion: z
    .string()
    .optional()
    .describe(
      "Sugestão de diagrama em sintaxe Mermaid para ilustrar esta seção, e os dados que ele representaria. Ex: 'graph TA[Tensão Média Diária] --> B{Limite PRODIST}; B --> C[Conforme]; B --> D[Não Conforme];'. Consulte a documentação em https://mermaid.js.org/intro/ para referência."
    ),
  chartUrl: z.string().url().optional().describe('URL pública do gráfico gerado para esta seção.'),
});
export type ReportSection = z.infer<typeof ReportSectionSchema>;

export const BibliographyItemSchema = z.object({
  text: z
    .string()
    .describe(
      'Texto completo da referência bibliográfica (ex: ANEEL - Agência Nacional de Energia Elétrica. Resolução Normativa nº 956/2021. Estabelece os Procedimentos de Distribuição de Energia Elétrica no Sistema Elétrico Nacional – PRODIST – Módulo 8 – Qualidade da Energia Elétrica.). This should be in its original Portuguese form.'
    ),
  link: z
    .string()
    .url()
    .optional()
    .describe('Link para a norma ou documento, se disponível publicamente.'),
});
export type BibliographyItem = z.infer<typeof BibliographyItemSchema>;

export const AnalyzeComplianceReportOutputSchema = z.object({
  reportMetadata: z
    .object({
      title: z
        .string()
        .describe(
          "Título principal do relatório. Ex: 'Relatório de Conformidade da Qualidade de Energia Elétrica'."
        ),
      subtitle: z
        .string()
        .optional()
        .describe(
          "Subtítulo do relatório. Ex: 'Análise do arquivo [Nome do Arquivo]' ou 'Período de DD/MM/AAAA a DD/MM/AAAA'."
        ),
      author: z
        .string()
        .describe("Autor do relatório. Pode ser 'Energy Compliance Analyzer' ou um nome genérico."),
      generatedDate: z.string().describe('Data de geração do relatório no formato YYYY-MM-DD.'),
    })
    .describe('Metadados para a capa do relatório.'),

  tableOfContents: z
    .array(z.string())
    .describe(
      'Sumário gerado listando os títulos das seções principais (Introdução, cada seção temática, Considerações Finais, Referências Bibliográficas).'
    ),

  introduction: z
    .object({
      objective: z
        .string()
        .describe('Breve descrição sobre o objetivo principal deste relatório de conformidade.'),
      overallResultsSummary: z
        .string()
        .describe(
          'Um breve resumo dos principais resultados e do estado geral de conformidade encontrado.'
        ),
      usedNormsOverview: z
        .string()
        .describe(
          'Menção geral às principais normas ANEEL (which are in Portuguese) que foram consideradas como base para a análise e este relatório.'
        ),
    })
    .describe('Sessão introdutória do relatório.'),

  analysisSections: z
    .array(ReportSectionSchema)
    .describe(
      'Lista de seções detalhadas do relatório. Devem ser ordenadas por temas em comum e, se possível, de forma cronológica. Cada seção deve apresentar e respaldar os insights encontrados e seus respectivos detalhamentos.'
    ),

  finalConsiderations: z
    .string()
    .describe(
      'Considerações finais e as principais observações e recomendações (takeouts) do relatório.'
    ),

  bibliography: z
    .array(BibliographyItemSchema)
    .describe(
      'Lista de todas as referências bibliográficas e normas citadas ao longo do relatório, com o máximo de detalhes disponíveis (nome completo, link se houver). Norms should be in original Portuguese.'
    ),
});
export type AnalyzeComplianceReportOutput = z.infer<typeof AnalyzeComplianceReportOutputSchema>;

export const analyzeComplianceReportPromptConfig = {
  name: 'generateStructuredComplianceReportShared',
  input: { schema: AnalyzeComplianceReportInputSchema },
  output: { schema: AnalyzeComplianceReportOutputSchema },
  prompt: `
Você é um especialista em engenharia elétrica e regulamentações da ANEEL, encarregado de gerar um relatório técnico de conformidade detalhado e bem estruturado.
O relatório DEVE ser gerado no idioma especificado por '{{languageCode}}' (o padrão é Português do Brasil - pt-BR - se não especificado ou se o idioma não for bem suportado para esta tarefa técnica).
As citações diretas de nomes de resoluções, artigos da ANEEL ou textos de normas devem permanecer em Português, mesmo que o restante do relatório esteja em outro idioma.

**Contexto da Análise:**
- Arquivo de Dados Analisado: {{fileName}}
- Sumário dos Dados de Qualidade de Energia: {{powerQualityDataSummary}}
- Resoluções ANEEL Identificadas como Pertinentes (em Português): {{identifiedRegulations}}
- Idioma do Relatório: {{languageCode}}

**Sua Tarefa:**
Gerar um relatório de conformidade completo no idioma '{{languageCode}}', seguindo RIGOROSAMENTE a estrutura de saída JSON definida. O relatório deve ser técnico, claro, objetivo e pronto para ser a base de um documento PDF profissional.

**Diretrizes Detalhadas para Cada Parte do Relatório (a serem geradas no idioma '{{languageCode}}'):**

1.  **reportMetadata:**
    *   \`title\`: Crie um título formal, como "Relatório de Análise de Conformidade da Qualidade de Energia Elétrica".
    *   \`subtitle\`: Opcional. Pode incluir o nome do arquivo: "Análise referente ao arquivo '{{fileName}}'".
    *   \`author\`: Use "Energy Compliance Analyzer".
    *   \`generatedDate\`: Use a data atual no formato YYYY-MM-DD.

2.  **tableOfContents:**
    *   Liste os títulos das seções principais que você criará (Ex: "Introdução", títulos de \`analysisSections\`, "Considerações Finais", "Referências Bibliográficas").

3.  **introduction:**
    *   \`objective\`: Descreva o propósito do relatório (ex: analisar a conformidade dos dados de '{{fileName}}' com as resoluções ANEEL).
    *   \`overallResultsSummary\`: Forneça um breve panorama dos achados (ex: se a maioria dos parâmetros está conforme, ou se há violações significativas).
    *   \`usedNormsOverview\`: Mencione de forma geral as principais resoluções ANEEL (da lista {{identifiedRegulations}}, mantendo os nomes das resoluções em Português) que fundamentaram a análise.

4.  **analysisSections (Array):** Esta é a parte principal. Crie múltiplas seções.
    *   **Ordenação:** Organize as seções por temas comuns (ex: "Análise de Tensão", "Análise de Frequência", "Desequilíbrio de Tensão", "Harmônicos") e, dentro dos temas, se possível, de forma cronológica caso os dados no sumário permitam identificar eventos com data/hora.
    *   Para cada \`ReportSectionSchema\` no array:
        *   \`title\`: Um título claro e descritivo para a seção (ex: "Análise dos Níveis de Tensão em Regime Permanente").
        *   \`content\`: Detalhe a análise dos parâmetros relevantes para esta seção, baseado no \`powerQualityDataSummary\`. Seja técnico, mas claro. Compare os valores observados com os limites regulatórios.
        *   \`insights\`: Liste os principais insights, observações ou problemas detectados nesta seção específica. Cada insight deve ser uma frase concisa.
        *   \`relevantNormsCited\`: Para cada insight ou problema, **explicite a norma ANEEL e o artigo/item específico em Português** que o respalda (ex: "Resolução XXX/YYYY, Art. Z, Inciso W", ou "PRODIST Módulo 8, item 3.2.1"). Seja preciso.
        *   \`chartOrImageSuggestion\`: (OPCIONAL, MAS RECOMENDADO) Gere uma sugestão de diagrama visual em **sintaxe Mermaid** que poderia ilustrar os achados da seção. Ex: para um gráfico de pizza, \`pie title Título do Gráfico "Seção A": 30 "Seção B": 70\`; para um gráfico de barras, \`xychart-beta title "Variação da Tensão" x-axis "Tempo" y-axis "Tensão (V)" bar [10, 12, 15, 11]\`. **Consulte a documentação oficial do Mermaid.js em https://mermaid.js.org/intro/ para referência da sintaxe.** A sintaxe Mermaid DEVE ser fornecida diretamente neste campo.
        *   \`chartUrl\`: (OPCIONAL) Este campo será preenchido posteriormente com a URL de um gráfico gerado. Não preencha este campo.

5.  **finalConsiderations:**
    *   Resuma as principais conclusões da análise.
    *   Destaque os pontos mais críticos de não conformidade, se houver.
    *   Pode incluir recomendações gerais (se o sumário de dados permitir inferi-las).

6.  **bibliography (Array):**
    *   Para cada norma ANEEL que foi CITADA em \`relevantNormsCited\` em qualquer \`analysisSections\`:
        *   Crie um item \`BibliographyItemSchema\`.
        *   \`text\`: Forneça a referência completa da norma **em Português** (ex: "Agência Nacional de Energia Elétrica (ANEEL). Resolução Normativa nº 956, de 7 de dezembro de 2021. Estabelece os Procedimentos de Distribuição de Energia Elétrica no Sistema Elétrico Nacional – PRODIST."). Se for um módulo específico, cite-o (ex: "ANEEL. PRODIST Módulo 8 - Qualidade da Energia Elétrica. Revisão 2023.").
        *   \`link\`: Se você souber de um link oficial para a norma, inclua-o. Caso contrário, pode omitir.

**Importante:**
*   O conteúdo principal do relatório deve ser gerado no idioma '{{languageCode}}'.
*   Nomes de resoluções, artigos e textos normativos da ANEEL DEVEM ser mantidos em Português.
*   Seja o mais detalhado e preciso possível, baseando-se estritamente nas informações do \`powerQualityDataSummary\` e nas \`identifiedRegulations\`.
*   Se o sumário for limitado, reconheça isso em suas análises (ex: "Com base nos dados sumarizados, não foi possível avaliar X em detalhe...").
*   A qualidade da estruturação, a precisão das referências às normas e a validade da sintaxe Mermaid são cruciais.
*   Garanta que a saída seja um JSON válido que corresponda ao schema \`AnalyzeComplianceReportOutputSchema\`.
`,
};
