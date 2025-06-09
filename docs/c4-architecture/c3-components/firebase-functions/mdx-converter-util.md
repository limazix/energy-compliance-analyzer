
# C3: Componente - Utilitário de Conversão para MDX (`mdxConverterUtil`)

[<- Voltar para Componentes das Firebase Functions](./../03-firebase-functions-components.md)

## Descrição

O **Utilitário de Conversão para MDX** é um módulo TypeScript (`src/lib/reportUtils.ts`, especificamente a função `convertStructuredReportToMdx`) responsável por transformar o relatório de conformidade estruturado (em formato JSON, após revisão pelo `reportReviewerAgent`) em um formato MDX (Markdown com JSX). Este arquivo MDX é então salvo no Firebase Storage e usado para exibição na interface do usuário.

## Responsabilidades (Comportamentos)

*   **Transformação de JSON para MDX:**
    *   Recebe o objeto JSON do relatório estruturado final e o nome do arquivo original como entrada.
    *   Itera sobre a estrutura do objeto JSON (metadados, introdução, seções de análise, considerações finais, bibliografia).
    *   Converte cada parte do relatório em sua representação Markdown equivalente.
    *   Formata títulos, subtítulos, listas, texto em negrito/itálico e outros elementos Markdown.
*   **Inclusão de Metadados (Frontmatter):**
    *   Gera um bloco de frontmatter YAML no início do arquivo MDX, contendo metadados como título, subtítulo, autor, data de geração e nome do arquivo.
*   **Incorporação de Diagramas Mermaid:**
    *   Se as seções do relatório estruturado contiverem sugestões de diagramas na sintaxe Mermaid (`chartOrImageSuggestion`), este utilitário as inclui no MDX de forma que possam ser renderizadas (geralmente dentro de blocos de código com a linguagem `mermaid`).
*   **Sanitização de Conteúdo:**
    *   Realiza uma sanitização básica do texto para garantir que caracteres especiais (como `<`, `>`) sejam escapados corretamente para MDX/HTML, prevenindo problemas de renderização ou XSS.
*   **Formato de Saída:**
    *   Produz uma string contendo o conteúdo completo do relatório em formato MDX.

## Tecnologias e Aspectos Chave

*   **TypeScript:** Para a lógica de conversão.
*   **Manipulação de Strings e Objetos:** A função realiza extensive manipulação de strings para construir o documento MDX e navega pela estrutura do objeto JSON do relatório.
*   **MDX (Markdown com JSX):** O formato de saída alvo, que combina a simplicidade do Markdown com a capacidade de incorporar componentes React (embora este utilitário foque principalmente na geração de Markdown padrão e inclusão de blocos Mermaid).
*   **Mermaid.js:** Suporta a inclusão de sintaxe Mermaid para diagramas.

## Interações

*   **Chamado por:** Orquestrador da Pipeline (`processAnalysisFn`).
*   **Usa:** Nenhum serviço externo; é uma função de transformação de dados pura.
*   **Entrada:** Objeto JSON do relatório estruturado revisado, nome do arquivo original.
*   **Saída:** String contendo o relatório em formato MDX.
