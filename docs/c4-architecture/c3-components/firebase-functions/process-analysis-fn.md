
# C3: Componente - Orquestrador da Pipeline (`processAnalysisFn`)

[<- Voltar para Componentes das Firebase Functions](./../03-firebase-functions-components.md)

## Descrição

O **Orquestrador da Pipeline** (`processAnalysis` em `functions/src/processAnalysis.js`) é a função principal dentro da Firebase Function `processAnalysisOnUpdate`. Ela é acionada pelo `trigger` do Firestore e é responsável por coordenar a execução sequencial dos diferentes agentes de IA e utilitários que compõem a pipeline de análise de dados e geração de relatórios.

## Responsabilidades (Comportamentos)

*   **Orquestração da Pipeline:**
    1.  **Recebe Contexto:** Obtém dados da análise (ID, caminho do arquivo CSV, idioma) do gatilho.
    2.  **Lê Arquivo CSV:** Chama o `gcsUtil` para buscar o conteúdo do arquivo CSV do Firebase Storage.
    3.  **Divide em Chunks (se necessário):** Se o arquivo CSV for grande, divide-o em chunks menores para processamento pela IA, para evitar exceder limites de token.
    4.  **Sumariza Dados:** Para cada chunk (ou para o arquivo inteiro se não for dividido), chama o `dataSummarizerAgent` para gerar um sumário textual. Agrega os sumários dos chunks.
    5.  **Identifica Resoluções:** Chama o `regulationIdentifierAgent` com o sumário agregado para obter a lista de resoluções ANEEL pertinentes.
    6.  **Gera Relatório Inicial:** Chama o `complianceAnalyzerAgent` com o sumário e as resoluções para gerar o relatório de conformidade estruturado (JSON) inicial.
    7.  **Revisa Relatório:** Chama o `reportReviewerAgent` com o relatório estruturado inicial para refinamento e correções.
    8.  **Converte para MDX:** Chama o `mdxConverterUtil` para converter o relatório JSON revisado para o formato MDX.
    9.  **Salva MDX no Storage:** Utiliza o Firebase Admin SDK para salvar o arquivo MDX gerado no Firebase Storage.
*   **Atualização de Status e Progresso:**
    *   Ao longo da pipeline, chama o `statusUpdaterUtil` para atualizar o documento da análise no Firestore com o status atual, progresso percentual e, eventualmente, mensagens de erro ou os resultados finais (relatório estruturado, caminho do MDX).
*   **Tratamento de Erros:**
    *   Implementa blocos try-catch para capturar erros de qualquer etapa da pipeline (leitura de arquivo, chamadas de IA, escrita no Firestore/Storage).
    *   Em caso de erro, utiliza o `statusUpdaterUtil` para marcar a análise como "error" no Firestore e registrar a mensagem de erro.
*   **Gerenciamento de Cancelamento:**
    *   Periodicamente verifica (via `checkCancellation` que lê o status no Firestore) se uma solicitação de cancelamento foi feita para a análise. Se sim, interrompe a pipeline e atualiza o status para "cancelled".

## Tecnologias e Aspectos Chave

*   **Firebase Functions SDK:** A função em si é uma Firebase Function.
*   **Firebase Admin SDK:** Para interagir com Firestore e Storage.
*   **Genkit:** Para invocar os fluxos de IA (agentes).
*   **JavaScript (Node.js):** A linguagem de implementação da função.
*   **Lógica de Controle de Fluxo:** Gerencia a sequência de chamadas assíncronas e a passagem de dados entre os componentes da pipeline.
*   **Resiliência:** O tratamento de erros e o mecanismo de cancelamento são importantes para a robustez da função.

## Interações

*   **Chamado por:** Gatilho do Firestore (`trigger`).
*   **Chama:**
    *   `gcsUtil` (para ler CSV).
    *   `dataSummarizerAgent`.
    *   `regulationIdentifierAgent`.
    *   `complianceAnalyzerAgent`.
    *   `reportReviewerAgent`.
    *   `mdxConverterUtil`.
    *   `statusUpdaterUtil` (múltiplas vezes).
    *   Firebase Admin SDK (para salvar MDX no Storage).
*   **Entrada:** Dados do evento do Firestore.
*   **Saída:** Efeitos colaterais (atualizações no Firestore, salvamento de arquivo no Storage). Retorna `null` ou uma promessa resolvida para o runtime da Firebase Function.
