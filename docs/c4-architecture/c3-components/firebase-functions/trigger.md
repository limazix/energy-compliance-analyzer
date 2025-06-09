
# C3: Componente - Gatilho do Firestore (`trigger`)

[<- Voltar para Componentes das Firebase Functions](./../03-firebase-functions-components.md)

## Descrição

O componente **Gatilho do Firestore** (`processAnalysisOnUpdate` em `functions/src/index.js`) é o ponto de entrada para a pipeline de processamento de análise em background. Ele é uma Firebase Function acionada por eventos de atualização (especificamente `onUpdate`) em documentos dentro de uma coleção específica no Firebase Firestore.

## Responsabilidades (Comportamentos)

*   **Observação de Eventos:**
    *   Monitora a coleção `users/{userId}/analyses/{analysisId}` no Firestore.
    *   É configurado para ser disparado quando um documento nesta coleção é atualizado e o campo `status` transita para um valor específico, como "summarizing_data".
*   **Extração de Contexto:**
    *   Ao ser acionado, recebe o snapshot do documento antes e depois da atualização, bem como os parâmetros do contexto (como `userId` e `analysisId`).
    *   Extrai informações relevantes do documento atualizado, como o caminho do arquivo CSV no Firebase Storage (`powerQualityDataUrl`), o nome do arquivo (`fileName`), o ID do usuário e o ID da análise.
*   **Invocação da Lógica de Processamento:**
    *   Chama a função principal de orquestração da pipeline (`processAnalysisFn` em `functions/src/processAnalysis.js`), passando os dados extraídos.
*   **Filtragem de Eventos:**
    *   Pode incluir lógica para evitar reprocessamento desnecessário, verificando o estado anterior e atual do documento (ex: não reprocessar se o status já for "completed" ou "error", a menos que seja um reinício explícito).

## Tecnologias e Aspectos Chave

*   **Firebase Functions SDK:**
    *   `functions.firestore.document().onUpdate()` para definir o gatilho.
    *   Objeto `change` (com `change.before` e `change.after`) para acessar os dados do documento.
    *   Objeto `context` para obter parâmetros como `context.params.userId`.
*   **Firebase Admin SDK (Firestore):** Indiretamente, pois interage com os dados fornecidos pelo gatilho, que são do Firestore.
*   **Event-Driven Architecture:** Componente fundamental em uma arquitetura orientada a eventos, reagindo a mudanças de estado nos dados.
*   **Configuração:**
    *   Definido no arquivo `functions/src/index.js` e exportado para deploy.
    *   Pode ter configurações de runtime (região, timeout, memória) definidas em `firebase.json` ou durante o deploy.
*   **Idempotência (Consideração):** Idealmente, a lógica acionada deve ser idempotente ou ter mecanismos para lidar com múltiplas invocações para o mesmo evento (embora as Functions geralmente garantam entrega "pelo menos uma vez").
