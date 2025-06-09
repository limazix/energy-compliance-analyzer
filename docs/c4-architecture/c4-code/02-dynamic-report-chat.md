
# C4 Dynamic Diagram: Interação com Chat do Relatório

[<- Voltar para Nível C4 (Código)](./index.md)

Este diagrama ilustra o fluxo de comunicação quando um usuário interage com o agente de IA através da interface de chat de um relatório, incluindo a possibilidade de revisão do relatório.

```mermaid
C4Dynamic
  title Fluxo de Interação do Chat do Relatório

  Person(user, "Usuário", "Interage com a UI do chat.", $sprite="fa:fa-user")
  Container(frontendApp, "Frontend Web App", "Next.js/React", "Interface do relatório e chat.", $sprite="fa:fa-desktop")
  Container(serverActions, "Backend API (Server Actions)", "Next.js", "Orquestra a interação do chat.", $sprite="fa:fa-cogs")
  Component(orchestrationFlow, "`orchestrateReportInteractionFlow`", "Fluxo Genkit (em Server Actions)", "Processa a entrada do usuário, usa IA e ferramentas.", $sprite="fa:fa-brain")
  Component(revisorTool, "`callRevisorTool`", "Ferramenta Genkit", "Invoca fluxo de revisão para modificar relatório.", $sprite="fa:fa-tools")
  Component(reviewFlow, "`reviewComplianceReportFlow`", "Fluxo Genkit", "Revisa/refina o relatório estruturado.", $sprite="fa:fa-clipboard-check")
  ContainerDb(rtdb, "Firebase Realtime DB", "NoSQL", "Armazena mensagens de chat.", $sprite="fa:fa-comments")
  ContainerDb(firestore, "Firebase Firestore", "NoSQL", "Armazena relatório estruturado.", $sprite="fa:fa-database")
  Container(storage, "Firebase Storage", "Blob Storage", "Armazena relatórios MDX.", $sprite="fa:fa-archive")
  System_Ext(googleAI, "Google AI (Gemini)", "LLM para Genkit.", $sprite="fa:fa-robot")

  Rel(user, frontendApp, "1. Envia mensagem de chat (texto, contexto do relatório)")
  Rel(frontendApp, serverActions, "2. Chama `askReportOrchestratorAction`")
  Rel(serverActions, rtdb, "3. Salva mensagem do usuário e placeholder da IA no RTDB")
  Rel(serverActions, orchestrationFlow, "4. Invoca fluxo com dados do relatório e mensagem do usuário")
  
  Rel(orchestrationFlow, googleAI, "5. Processa consulta usando LLM")
  Rel(orchestrationFlow, revisorTool, "6. Opcional: Chama ferramenta `callRevisorTool` se usuário solicitar revisão")
  Rel(revisorTool, reviewFlow, "7. Opcional: Invoca fluxo de revisão `reviewComplianceReportFlow`")
  Rel(reviewFlow, googleAI, "8. Opcional: Usa LLM para revisar relatório estruturado")
  Rel(reviewFlow, revisorTool, "9. Opcional: Retorna relatório estruturado revisado")
  Rel(revisorTool, orchestrationFlow, "10. Opcional: Retorna relatório revisado ao fluxo principal")
  Rel(orchestrationFlow, serverActions, "11. Retorna resposta da IA e (opcionalmente) relatório revisado")

  Rel(serverActions, rtdb, "12. Atualiza/Transmite resposta final da IA (streaming) no RTDB")
  Rel(serverActions, firestore, "13. Opcional: Atualiza relatório estruturado no Firestore se modificado")
  Rel(serverActions, storage, "14. Opcional: Salva novo MDX no Storage se modificado")
  Rel(frontendApp, rtdb, "15. Escuta atualizações no RTDB para exibir mensagens")
  Rel(frontendApp, firestore, "16. Opcional: Escuta atualizações no relatório (MDX/Structured) para re-renderizar")


  UpdateElementStyle(user, $fontColor="white", $bgColor="rgb(13, 105, 184)")
  UpdateElementStyle(frontendApp, $fontColor="white", $bgColor="rgb(43, 135, 209)")
  UpdateElementStyle(serverActions, $fontColor="white", $bgColor="rgb(68, 158, 228)")
  UpdateElementStyle(orchestrationFlow, $fontColor="black", $bgColor="rgb(200, 200, 200)")
  UpdateElementStyle(revisorTool, $fontColor="black", $bgColor="rgb(200, 200, 200)")
  UpdateElementStyle(reviewFlow, $fontColor="black", $bgColor="rgb(200, 200, 200)")
  UpdateElementStyle(rtdb, $fontColor="white", $bgColor="rgb(112, 112, 214)")
  UpdateElementStyle(firestore, $fontColor="white", $bgColor="rgb(112, 112, 214)")
  UpdateElementStyle(storage, $fontColor="white", $bgColor="rgb(112, 112, 214)")
  UpdateElementStyle(googleAI, $fontColor="white", $bgColor="rgb(100, 100, 100)")
```

## Descrição do Fluxo

1.  O **Usuário** digita uma mensagem na interface de chat do **Frontend Web App** e a envia. A mensagem inclui o texto do usuário e o contexto do relatório atual (MDX e estruturado).
2.  O **Frontend Web App** chama a Server Action `askReportOrchestratorAction` (parte do contêiner **Backend API (Server Actions)**).
3.  A **Server Action** salva a mensagem do usuário no **Firebase Realtime Database (RTDB)** e cria um placeholder para a futura resposta da IA.
4.  A **Server Action** invoca o fluxo Genkit **`orchestrateReportInteractionFlow`** (um componente dentro das Server Actions), passando a mensagem do usuário e o contexto do relatório.
5.  O **`orchestrateReportInteractionFlow`** usa o **Google AI (Gemini)** para entender a consulta do usuário.
6.  **Opcional:** Se o usuário solicitar uma revisão ou modificação no relatório, o **`orchestrateReportInteractionFlow`** pode decidir usar a ferramenta Genkit **`callRevisorTool`**.
7.  **Opcional:** A **`callRevisorTool`** invoca outro fluxo Genkit, **`reviewComplianceReportFlow`**.
8.  **Opcional:** O **`reviewComplianceReportFlow`** usa o **Google AI (Gemini)** para revisar e refinar o relatório estruturado (JSON).
9.  **Opcional:** O relatório estruturado revisado é retornado pela **`reviewComplianceReportFlow`** para a **`callRevisorTool`**.
10. **Opcional:** A **`callRevisorTool`** retorna o relatório revisado ao **`orchestrateReportInteractionFlow`**.
11. O **`orchestrateReportInteractionFlow`** formula a resposta final para o usuário (e inclui o relatório revisado, se houver) e a retorna para a **Server Action**.
12. A **Server Action** transmite a resposta da IA (potencialmente em chunks) para o **Firebase Realtime Database**, atualizando o placeholder criado anteriormente.
13. **Opcional:** Se o relatório foi modificado, a **Server Action** atualiza o relatório estruturado (JSON) no **Firebase Firestore**.
14. **Opcional:** Se o relatório foi modificado, a **Server Action** gera um novo MDX e o salva no **Firebase Storage**.
15. O **Frontend Web App** escuta as atualizações no **Firebase Realtime Database** e exibe as novas mensagens (do usuário e da IA) em tempo real.
16. **Opcional:** O **Frontend Web App** também pode escutar alterações no documento do **Firebase Firestore** (para o relatório estruturado e caminho do MDX) e atualizar a visualização do relatório se ele for modificado pela IA.

Este diagrama destaca a colaboração entre o frontend, as server actions, os fluxos Genkit e os serviços Firebase para fornecer uma experiência de chat interativa.
