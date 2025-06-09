
# C3: Componente - Interface de Chat do Relatório (reportChatUI)

[<- Voltar para Componentes do Frontend](./../01-frontend-app-components.md)

## Descrição

A **Interface de Chat do Relatório**, parte integrante da `ReportPage.tsx`, permite ao usuário interagir com um agente de IA (Agente Orquestrador) para discutir, esclarecer ou solicitar modificações no relatório de conformidade exibido.

## Responsabilidades (Comportamentos)

*   **Exibição de Mensagens:**
    *   Renderiza o histórico da conversa entre o usuário e o agente de IA.
    *   Diferencia visualmente as mensagens do usuário e do agente.
    *   Mostra avatares e timestamps para cada mensagem.
*   **Entrada de Mensagem do Usuário:**
    *   Fornece um campo de texto (`Textarea`) para o usuário digitar suas perguntas ou solicitações.
    *   Permite o envio da mensagem através de um botão ou pressionando Enter.
*   **Comunicação com Backend (Server Action):**
    *   Ao enviar uma mensagem, chama a Server Action `askReportOrchestratorAction`.
    *   Envia o texto do usuário, o conteúdo MDX atual do relatório, o objeto do relatório estruturado (JSON), o nome do arquivo e o código de idioma para a action.
*   **Sincronização com Firebase Realtime Database (RTDB):**
    *   Escuta (`onValue`) o nó do RTDB correspondente ao chat da análise atual (`chats/{analysisId}`).
    *   Atualiza a UI com novas mensagens (do usuário ou da IA) assim que elas chegam ao RTDB.
    *   Envia as mensagens do usuário para o RTDB para persistência e para que a Server Action possa registrar a resposta da IA.
    *   A Server Action `askReportOrchestratorAction` é responsável por escrever a mensagem do usuário e a resposta da IA (ou seu placeholder inicial e atualizações de streaming) no RTDB.
*   **Feedback de Resposta da IA:**
    *   Indica quando o agente de IA está processando uma resposta (`isAiResponding`).
    *   Exibe a resposta da IA (potencialmente em streaming, se o RTDB for atualizado por chunks).
    *   Se a IA modificar o relatório, a `ReportPage` (componente pai) é notificada e atualiza o MDX e o `structuredReport`.
*   **Gerenciamento de Erros no Chat:**
    *   Exibe mensagens de erro se a comunicação com o agente de IA falhar ou se a Server Action retornar um erro.

## Tecnologias e Aspectos Chave

*   **React Components:** Lógica de UI dentro de `ReportPage.tsx`.
*   **ShadCN UI:** `Textarea`, `Button`, `ScrollArea`, `Avatar`, `Badge` para construir a interface do chat.
*   **Firebase SDK (Realtime Database):** `ref`, `onValue`, `push`, `serverTimestamp`, `off`, `child`, `update` para comunicação em tempo real.
*   **Server Actions:** `askReportOrchestratorAction` para interagir com o Agente Orquestrador de IA.
*   **State Management:** `useState`, `useEffect`, `useCallback`, `useRef` (para scroll) para gerenciar o estado das mensagens, entrada do usuário e status da IA.
*   **Lucide-react:** Ícones para botões e avatares de fallback.
*   **Toast Notifications:** `useToast` para notificar sobre atualizações de relatório ou erros.
