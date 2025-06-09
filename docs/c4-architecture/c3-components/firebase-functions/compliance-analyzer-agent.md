
# C3: Componente - Agente: Engenheiro de Conformidade (Relator Inicial) (`complianceAnalyzerAgent`)

[<- Voltar para Componentes das Firebase Functions](./../03-firebase-functions-components.md)

## Descrição

O **Agente Engenheiro de Conformidade (Relator Inicial)** é um fluxo Genkit (`analyzeReportFlow` definido em `functions/src/processAnalysis.js` e usando o prompt de `src/ai/prompt-configs/analyze-compliance-report-prompt-config.ts`). Este agente atua como um engenheiro elétrico especializado que gera a primeira versão do relatório de conformidade estruturado (em formato JSON).

## Responsabilidades (Comportamentos)

*   **Análise de Dados e Normas:**
    *   Recebe como entrada o sumário agregado dos dados de qualidade de energia (do `dataSummarizerAgent`) e a lista de resoluções ANEEL pertinentes (do `regulationIdentifierAgent`).
    *   Também considera o nome do arquivo original e o código de idioma desejado para o relatório.
*   **Geração de Relatório Estruturado:**
    *   Produz um relatório de conformidade detalhado e bem estruturado em formato JSON, seguindo o schema `AnalyzeComplianceReportOutputSchema`.
    *   O relatório inclui:
        *   Metadados (título, autor, data).
        *   Sumário executivo.
        *   Introdução com objetivos e visão geral das normas.
        *   Múltiplas seções de análise detalhada, onde cada seção:
            *   Descreve os dados e análises relevantes.
            *   Apresenta insights e problemas específicos.
            *   Cita as normas ANEEL específicas (em Português) que fundamentam os achados.
            *   Opcionalmente, sugere diagramas Mermaid para visualização.
        *   Considerações finais.
        *   Bibliografia das normas citadas (em Português).
*   **Linguagem e Formato:**
    *   Gera o conteúdo principal do relatório no idioma especificado (`languageCode`).
    *   Mantém nomes de resoluções e textos normativos da ANEEL em Português.
    *   Adere rigorosamente ao schema JSON de saída.

## Tecnologias e Aspectos Chave

*   **Genkit:**
    *   Definido como um `ai.definePrompt`.
    *   Utiliza o prompt configurado em `analyzeComplianceReportPromptConfig`.
*   **Google AI (Gemini):** O modelo de linguagem que sintetiza as informações e gera o relatório estruturado.
*   **Input/Output Schemas (Zod):**
    *   `AnalyzeComplianceReportInputSchema` para a entrada (sumário dos dados, resoluções, nome do arquivo, idioma).
    *   `AnalyzeComplianceReportOutputSchema` para a saída (o relatório JSON estruturado completo).
*   **Prompt Engineering:** O prompt detalhado guia o Gemini a produzir um relatório técnico, formal e preciso, com todas as seções necessárias e aderência ao schema.
*   **Mermaid Syntax:** Tem a capacidade de sugerir diagramas usando a sintaxe Mermaid.

## Interações

*   **Chamado por:** Orquestrador da Pipeline (`processAnalysisFn`).
*   **Usa:** Google AI (Gemini) via Genkit.
*   **Entrada:** Sumário dos dados, lista de resoluções, nome do arquivo, código de idioma.
*   **Saída:** O objeto do relatório de conformidade estruturado (JSON) inicial.
