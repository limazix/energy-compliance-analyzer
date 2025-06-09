
# C3: Componente - Agente: Revisor de Relatório (`reportReviewerAgent`)

[<- Voltar para Componentes das Firebase Functions](./../03-firebase-functions-components.md)

## Descrição

O **Agente Revisor de Relatório** é um fluxo Genkit (`reviewReportFlow` definido em `functions/src/processAnalysis.js` e usando o prompt de `src/ai/prompt-configs/review-compliance-report-prompt-config.ts`). Ele atua como um revisor meticuloso especializado em documentos técnicos de engenharia elétrica e conformidade regulatória da ANEEL. Sua função é refinar o relatório estruturado (JSON) gerado pelo `complianceAnalyzerAgent`.

## Responsabilidades (Comportamentos)

*   **Revisão de Conteúdo:**
    *   Recebe o relatório estruturado (JSON) e o código de idioma como entrada.
    *   Realiza correção gramatical e sintática em todo o texto do relatório, no idioma especificado.
    *   Garante que a linguagem seja clara, concisa, formal e profissional.
*   **Verificação de Referências:**
    *   Verifica a precisão e completude das citações às normas ANEEL nas seções `relevantNormsCited` e na `bibliography`.
    *   Assegura que nomes de resoluções e textos normativos da ANEEL sejam mantidos em Português.
    *   Confirma que todas as normas citadas estejam listadas na bibliografia.
*   **Melhoria da Coesão e Clareza:**
    *   Aprimora a fluidez e a lógica do texto.
    *   Elimina redundâncias e ambiguidades.
    *   Verifica se os insights são bem fundamentados pelo conteúdo das seções.
*   **Consistência da Estrutura:**
    *   Valida se o sumário (`tableOfContents`) reflete com precisão os títulos das seções.
    *   Assegura que todos os campos obrigatórios do schema de saída estejam presentes e preenchidos.
*   **Formato de Saída:**
    *   Retorna o objeto JSON completo do relatório, seguindo o schema `AnalyzeComplianceReportOutputSchema`, com todas as revisões e melhorias incorporadas.

## Tecnologias e Aspectos Chave

*   **Genkit:**
    *   Definido como um `ai.definePrompt`.
    *   Utiliza o prompt configurado em `reviewComplianceReportPromptConfig`.
*   **Google AI (Gemini):** O modelo de linguagem que realiza a revisão e o refinamento.
*   **Input/Output Schemas (Zod):**
    *   `ReviewComplianceReportInputSchema` para a entrada (relatório estruturado, código de idioma).
    *   `ReviewComplianceReportOutputSchema` (que é o mesmo que `AnalyzeComplianceReportOutputSchema`) para a saída.
*   **Foco na Qualidade:** Este agente é crucial para garantir a qualidade, precisão e profissionalismo do relatório final antes da conversão para MDX.

## Interações

*   **Chamado por:** Orquestrador da Pipeline (`processAnalysisFn`).
*   **Usa:** Google AI (Gemini) via Genkit.
*   **Entrada:** Relatório estruturado (JSON) a ser revisado, código de idioma.
*   **Saída:** O objeto do relatório de conformidade estruturado (JSON) revisado.
