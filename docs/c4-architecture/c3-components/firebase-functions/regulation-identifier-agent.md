
# C3: Componente - Agente: Identificador de Resoluções (`regulationIdentifierAgent`)

[<- Voltar para Componentes das Firebase Functions](./../03-firebase-functions-components.md)

## Descrição

O **Agente Identificador de Resoluções** é um fluxo Genkit (`identifyAEEEResolutionsFlow` definido em `functions/src/processAnalysis.js` e usando o prompt de `src/ai/prompt-configs/identify-aneel-resolutions-prompt-config.ts`) que atua como um especialista em regulamentações elétricas brasileiras. Sua função é analisar o sumário dos dados de qualidade de energia (fornecido pelo `dataSummarizerAgent`) e identificar as Resoluções Normativas da ANEEL pertinentes.

## Responsabilidades (Comportamentos)

*   **Análise de Sumário:**
    *   Recebe o sumário textual agregado dos dados de qualidade de energia como entrada.
    *   Interpreta as métricas chave, anomalias e tendências descritas no sumário.
*   **Identificação de Normas:**
    *   Com base na análise do sumário, determina quais Resoluções Normativas da ANEEL (Agência Nacional de Energia Elétrica) são relevantes para os fenômenos observados nos dados.
    *   Prioriza a precisão na identificação das resoluções corretas (ex: PRODIST Módulo 8, REN específicas).
*   **Formato de Saída:**
    *   Retorna uma lista de nomes ou números das resoluções ANEEL identificadas.
    *   Os nomes/números das resoluções devem ser mantidos em sua forma original em Português, enquanto o texto descritivo ao redor da lista deve estar no idioma especificado.

## Tecnologias e Aspectos Chave

*   **Genkit:**
    *   Definido como um `ai.definePrompt`.
    *   Utiliza o prompt configurado em `identifyAEEEResolutionsPromptConfig`.
*   **Google AI (Gemini):** O modelo de linguagem que realiza a inferência para identificar as resoluções com base no sumário.
*   **Input/Output Schemas (Zod):** Utiliza schemas Zod (`IdentifyAEEEResolutionsInputSchema`, `IdentifyAEEEResolutionsOutputSchema`) para a estrutura de entrada (sumário dos dados, código de idioma) e saída (lista de resoluções).
*   **Conhecimento Especializado (Simulado):** O prompt é crucial para guiar o modelo Gemini a agir como um especialista em normas da ANEEL.

## Interações

*   **Chamado por:** Orquestrador da Pipeline (`processAnalysisFn`).
*   **Usa:** Google AI (Gemini) via Genkit.
*   **Entrada:** Sumário agregado dos dados de qualidade de energia, código de idioma.
*   **Saída:** Objeto contendo a lista `relevantResolutions`.
