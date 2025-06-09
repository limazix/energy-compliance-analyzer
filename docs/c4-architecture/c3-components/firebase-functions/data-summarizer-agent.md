
# C3: Componente - Agente: Analista de Dados (Sumarizador) (`dataSummarizerAgent`)

[<- Voltar para Componentes das Firebase Functions](./../03-firebase-functions-components.md)

## Descrição

O **Agente Analista de Dados (Sumarizador)** é um fluxo Genkit (`summarizePowerQualityDataFlow` definido em `functions/src/processAnalysis.js` e usando o prompt de `src/ai/prompt-configs/summarize-power-quality-data-prompt-config.ts`) responsável pela primeira etapa de processamento de IA na pipeline. Sua principal função é ler um chunk de dados de qualidade de energia em formato CSV, realizar uma análise inicial e gerar um sumário textual conciso.

## Responsabilidades (Comportamentos)

*   **Análise de Dados CSV:**
    *   Recebe um chunk de dados CSV de qualidade de energia como entrada.
    *   Identifica e extrai métricas chave como estatísticas de tensão, corrente, fator de potência e frequência (mínimo, máximo, média).
    *   Detecta anomalias ou eventos notáveis dentro do chunk de dados (ex: sags, swells, interrupções, distorções harmônicas).
*   **Geração de Sumário Textual:**
    *   Produz um sumário textual abrangente do chunk de dados analisado, no idioma especificado.
    *   O sumário inclui as métricas chave identificadas, anomalias, e tendências gerais de qualidade.
*   **Sugestões para Análise de Engenharia:**
    *   Com base na análise do chunk, sugere transformações de dados (ex: cálculo de THD) ou enriquecimentos (ex: correlação com dados externos) que seriam benéficos para uma avaliação detalhada de conformidade regulatória.
*   **Ideias Preliminares para Visualização:**
    *   Sugere tipos de gráficos ou visualizações que poderiam representar efetivamente as características ou anomalias encontradas no chunk.
*   **Redução de Token:**
    *   O sumário gerado deve ser significativamente menor que os dados CSV de entrada, visando otimizar o uso de tokens em etapas subsequentes da pipeline de IA.

## Tecnologias e Aspectos Chave

*   **Genkit:**
    *   Definido como um `ai.definePrompt` (anteriormente `ai.defineFlow` que envolvia um prompt).
    *   Utiliza o prompt configurado em `summarizePowerQualityDataPromptConfig`.
*   **Google AI (Gemini):** O modelo de linguagem subjacente que executa a análise e geração do sumário.
*   **Processamento em Chunks:** Projetado para processar dados em segmentos, permitindo o manejo de arquivos CSV grandes que excederiam os limites de token de uma única chamada de IA.
*   **Input/Output Schemas (Zod):** Utiliza schemas Zod (`SummarizePowerQualityDataInputSchema`, `SummarizePowerQualityDataOutputSchema`) para definir a estrutura dos dados de entrada e saída, garantindo a consistência.
*   **Prompt Engineering:** A qualidade do sumário depende fortemente da clareza e especificidade do prompt fornecido ao modelo Gemini.

## Interações

*   **Chamado por:** Orquestrador da Pipeline (`processAnalysisFn`).
*   **Usa:** Google AI (Gemini) via Genkit.
*   **Entrada:** Chunk de dados CSV, código de idioma.
*   **Saída:** Objeto contendo o `dataSummary` textual.
