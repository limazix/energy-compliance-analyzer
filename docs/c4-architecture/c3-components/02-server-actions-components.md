
# C3: Componentes das Next.js Server Actions (Contêiner)

Este diagrama detalha os principais componentes que compõem o contêiner "Backend API (Next.js Server Actions)" do Energy Compliance Analyzer.

[<- Voltar para Visão Geral dos Componentes (C3)](./index.md)
[<- Voltar para Visão Geral dos Contêineres (C2)](../c2-containers/index.md)

```mermaid
C4Component
  title Componentes das Next.js Server Actions (Contêiner)

  System_Ext(firestoreExt, "Firebase Firestore", "Serviço de banco de dados Firestore", $sprite="fa:fa-database")
  System_Ext(storageExt, "Firebase Storage", "Serviço de armazenamento de arquivos", $sprite="fa:fa-archive")
  System_Ext(rtdbExt, "Firebase Realtime DB", "Serviço de banco de dados para chat", $sprite="fa:fa-comments")
  System_Ext(genkitSA, "Genkit (em Server Actions)", "Framework e SDK para IA", $sprite="fa:fa-robot")

  Container_Boundary(serverActionsContainer, "Backend API (Next.js Server Actions)") {
    Component(fileUploadActions, "Ações de Upload de Arquivo", "TypeScript (`fileUploadActions.ts`)", "Cria registro inicial no Firestore, gerencia progresso, finaliza upload no Storage.", $sprite="fa:fa-file-upload")
    Component(analysisMgmtActions, "Ações de Gerenciamento de Análise", "TypeScript (`analysisManagementActions.ts`)", "Exclui ou cancela análises (atualiza Firestore, remove do Storage).", $sprite="fa:fa-tasks")
    Component(analysisListActions, "Ações de Listagem de Análise", "TypeScript (`analysisListingActions.ts`)", "Busca análises do usuário no Firestore.", $sprite="fa:fa-history")
    Component(tagActions, "Ações de Gerenciamento de Tags", "TypeScript (`tagActions.ts`)", "Adiciona/Remove tags de análises no Firestore.", $sprite="fa:fa-tags")
    Component(reportViewActions, "Ações de Visualização de Relatório", "TypeScript (`reportViewingActions.ts`)", "Busca caminho do MDX no Firestore e conteúdo do Storage.", $sprite="fa:fa-file-invoice")
    Component(reportChatActions, "Ações de Chat do Relatório", "TypeScript (`reportChatActions.ts`), Genkit", "Recebe mensagem do usuário, chama fluxo Genkit (`orchestrateReportInteractionFlow`), salva mensagens no RTDB, atualiza relatório no Firestore/Storage se modificado.", $sprite="fa:fa-headset")
    Component(analysisProcessingActions, "Ações de Processamento de Análise", "TypeScript (`analysisProcessingActions.ts`)", "Prepara análise para ser processada pela Firebase Function (atualiza status no Firestore).", $sprite="fa:fa-cogs")
  }

  Rel(fileUploadActions, firestoreExt, "Cria/Atualiza registros em")
  Rel(fileUploadActions, storageExt, "Gerencia informações de upload para")
  Rel(analysisMgmtActions, firestoreExt, "Atualiza registros em")
  Rel(analysisMgmtActions, storageExt, "Remove arquivos de")
  Rel(analysisListActions, firestoreExt, "Lê registros de")
  Rel(tagActions, firestoreExt, "Atualiza tags em")
  Rel(reportViewActions, firestoreExt, "Lê metadados de")
  Rel(reportViewActions, storageExt, "Lê conteúdo MDX de")
  Rel(reportChatActions, rtdbExt, "Salva histórico de chat em")
  Rel(reportChatActions, firestoreExt, "Atualiza relatório estruturado em")
  Rel(reportChatActions, storageExt, "Salva novo MDX em")
  Rel(reportChatActions, genkitSA, "Chama fluxo do Agente Orquestrador")
  Rel(analysisProcessingActions, firestoreExt, "Atualiza status para iniciar processamento por Functions")

  UpdateElementStyle(fileUploadActions, $fontColor="white", $bgColor="rgb(68, 158, 228)", $borderColor="rgb(68, 158, 228)")
  UpdateElementStyle(analysisMgmtActions, $fontColor="white", $bgColor="rgb(68, 158, 228)", $borderColor="rgb(68, 158, 228)")
  UpdateElementStyle(analysisListActions, $fontColor="white", $bgColor="rgb(68, 158, 228)", $borderColor="rgb(68, 158, 228)")
  UpdateElementStyle(tagActions, $fontColor="white", $bgColor="rgb(68, 158, 228)", $borderColor="rgb(68, 158, 228)")
  UpdateElementStyle(reportViewActions, $fontColor="white", $bgColor="rgb(68, 158, 228)", $borderColor="rgb(68, 158, 228)")
  UpdateElementStyle(reportChatActions, $fontColor="white", $bgColor="rgb(68, 158, 228)", $borderColor="rgb(68, 158, 228)")
  UpdateElementStyle(analysisProcessingActions, $fontColor="white", $bgColor="rgb(68, 158, 228)", $borderColor="rgb(68, 158, 228)")
  UpdateElementStyle(firestoreExt, $fontColor="white", $bgColor="rgb(100, 100, 100)", $borderColor="rgb(100, 100, 100)")
  UpdateElementStyle(storageExt, $fontColor="white", $bgColor="rgb(100, 100, 100)", $borderColor="rgb(100, 100, 100)")
  UpdateElementStyle(rtdbExt, $fontColor="white", $bgColor="rgb(100, 100, 100)", $borderColor="rgb(100, 100, 100)")
  UpdateElementStyle(genkitSA, $fontColor="white", $bgColor="rgb(100, 100, 100)", $borderColor="rgb(100, 100, 100)")
```

## Detalhes dos Componentes das Server Actions

A seguir, uma lista dos principais componentes (módulos de actions) identificados no diagrama acima. Cada um terá sua própria página de detalhamento.

*   **Ações de Upload de Arquivo (`fileUploadActions`)**:
    *   [Detalhes](./server-actions/file-upload-actions.md)
*   **Ações de Gerenciamento de Análise (`analysisMgmtActions`)**:
    *   [Detalhes](./server-actions/analysis-mgmt-actions.md)
*   **Ações de Listagem de Análise (`analysisListActions`)**:
    *   [Detalhes](./server-actions/analysis-list-actions.md)
*   **Ações de Gerenciamento de Tags (`tagActions`)**:
    *   [Detalhes](./server-actions/tag-actions.md)
*   **Ações de Visualização de Relatório (`reportViewActions`)**:
    *   [Detalhes](./server-actions/report-view-actions.md)
*   **Ações de Chat do Relatório (`reportChatActions`)**:
    *   [Detalhes](./server-actions/report-chat-actions.md)
*   **Ações de Processamento de Análise (`analysisProcessingActions`)**:
    *   [Detalhes](./server-actions/analysis-processing-actions.md)

[Anterior: Componentes do Frontend](./01-frontend-app-components.md)
[Próximo: Componentes das Firebase Functions](./03-firebase-functions-components.md)
