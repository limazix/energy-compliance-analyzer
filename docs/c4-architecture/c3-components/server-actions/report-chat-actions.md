
# C3: Componente - Ações de Chat do Relatório (`reportChatActions`)

[<- Voltar para Componentes das Server Actions](./../02-server-actions-components.md)

## Descrição

O componente **Ações de Chat do Relatório** (`src/features/report-chat/actions/reportChatActions.ts`) é um módulo de Server Actions que orquestra a interação do usuário com o relatório de análise através de uma interface de chat. Ele utiliza Genkit e o modelo Gemini para processar as mensagens do usuário e gerar respostas.

## Responsabilidades (Comportamentos)

*   **Processamento de Mensagem do Usuário (`askReportOrchestratorAction`):**
    *   Recebe o ID do usuário, ID da análise, texto da mensagem do usuário, o conteúdo MDX atual do relatório, o objeto do relatório estruturado (JSON), o nome do arquivo original e o código de idioma.
    *   Valida as entradas.
    *   Salva a mensagem do usuário no Firebase Realtime Database (RTDB) no nó de chat correspondente à análise (`chats/{analysisId}`).
    *   Cria um placeholder ou mensagem inicial para a IA no RTDB.
    *   Invoca o fluxo Genkit `orchestrateReportInteractionFlow` (definido em `src/ai/flows/orchestrate-report-interaction.ts`).
        *   Este fluxo recebe o contexto (mensagem do usuário, MDX, relatório estruturado, nome do arquivo, resumo dos dados de qualidade, idioma).
        *   Utiliza o modelo Gemini para gerar uma resposta textual.
        *   Pode usar a ferramenta `callRevisorTool` se o usuário solicitar modificações no relatório. A ferramenta, por sua vez, chama o fluxo `reviewComplianceReportFlow`.
    *   Transmite a resposta da IA (em chunks, se aplicável) de volta para o cliente, atualizando a mensagem da IA no RTDB.
    *   **Se o relatório for modificado pela IA (via `callRevisorTool`):**
        *   Atualiza o objeto do relatório estruturado (JSON) no documento da análise no Firebase Firestore.
        *   Gera um novo arquivo MDX a partir do relatório estruturado revisado (usando `convertStructuredReportToMdx`).
        *   Salva o novo arquivo MDX no Firebase Storage, substituindo ou versionando o anterior.
        *   Retorna uma indicação de que o relatório foi modificado, junto com o novo conteúdo (ou caminhos), para que o frontend possa atualizar a visualização.
    *   Retorna um objeto indicando o sucesso da operação, o ID da mensagem da IA no RTDB e se o relatório foi modificado.

## Tecnologias e Aspectos Chave

*   **TypeScript:** Para tipagem dos dados de entrada/saída e lógica da ação.
*   **Next.js Server Actions:** Para fornecer o endpoint seguro para a interface de chat.
*   **Genkit:**
    *   Invoca o `interactionPrompt` (que usa o `orchestrateReportInteractionFlow`).
    *   Gerencia o uso de ferramentas (como `callRevisorTool`).
*   **Google AI (Gemini):** Utilizado pelos fluxos Genkit para processamento de linguagem natural e geração de respostas.
*   **Firebase Realtime Database:**
    *   `push` para adicionar novas mensagens (usuário e IA).
    *   `update` para transmitir respostas da IA em chunks para a mensagem placeholder.
    *   `serverTimestamp` para registrar o tempo das mensagens.
*   **Firebase Firestore:**
    *   `updateDoc` para salvar o relatório estruturado revisado se a IA o modificar.
*   **Firebase Storage:**
    *   `uploadString` (ou similar) para salvar o novo arquivo MDX se o relatório for modificado.
*   **Utilitários:**
    *   `convertStructuredReportToMdx` para gerar o MDX a partir do relatório estruturado.
*   **Streaming de Respostas:** A ação é projetada para suportar o streaming de respostas da IA para o RTDB, permitindo que o frontend exiba a resposta à medida que ela é gerada.
*   **Tratamento de Erros:** Gerencia erros de comunicação com a IA, Firebase ou outros problemas de processamento.
