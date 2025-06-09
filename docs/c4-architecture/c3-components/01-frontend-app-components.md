
# C3: Componentes do Frontend Web App (Contêiner)

Este diagrama detalha os principais componentes que compõem o contêiner "Frontend Web App" do Energy Compliance Analyzer.

[<- Voltar para Visão Geral dos Componentes (C3)](./index.md)
[<- Voltar para Visão Geral dos Contêineres (C2)](../c2-containers/index.md)

```mermaid
C4Component
  title Componentes do Frontend Web App (Contêiner)

  Container_Boundary(frontendContainer, "Frontend Web App") {
    Component(authUI, "Componentes de Autenticação", "React Components, Firebase SDK", "Interface para login/logout (AuthButton), exibição de perfil, utiliza AuthProvider.", $sprite="fa:fa-sign-in-alt")
    Component(fileUploadUI, "Componentes de Upload", "React Components (NewAnalysisForm), ShadCN UI, useFileUploadManager Hook", "Formulário para seleção de arquivo CSV, título, descrição, e lógica de upload.", $sprite="fa:fa-upload")
    Component(analysisListUI, "Listagem de Análises", "React Components (Accordion), ShadCN UI", "Exibe análises passadas, com status e tags. Utiliza useAnalysisManager.", $sprite="fa:fa-list-alt")
    Component(analysisViewUI, "Visualização de Análise", "React Components (AnalysisView, AnalysisProgressDisplay, AnalysisResultsDisplay), ShadCN UI", "Mostra o progresso de análises em andamento e resultados de análises concluídas. Utiliza useAnalysisManager.", $sprite="fa:fa-eye")
    Component(reportViewUI, "Visualização de Relatório", "React Component (ReportPage), next-mdx-remote", "Renderiza o conteúdo do relatório MDX e a interface de chat.", $sprite="fa:fa-file-alt")
    Component(reportChatUI, "Interface de Chat do Relatório", "React Components, ShadCN UI, Firebase RTDB SDK", "Permite ao usuário interagir com o agente orquestrador sobre o relatório. Utiliza ReportPage.", $sprite="fa:fa-comments")
    Component(stateMgmt, "Gerenciamento de Estado e Lógica de UI", "React Contexts (AuthProvider), Custom Hooks (useAuth, useAnalysisManager, useFileUploadManager, useToast)", "Gerencia o estado da aplicação, autenticação, dados de análise e notificações.", $sprite="fa:fa-project-diagram")
    Component(routing, "Roteamento", "Next.js App Router", "Gerencia a navegação entre páginas (Login, Home, Relatório).", $sprite="fa:fa-route")
    Component(uiComponents, "Componentes de UI Reutilizáveis", "ShadCN UI, TailwindCSS", "Botões, Cards, Inputs, etc., usados em toda a aplicação.", $sprite="fa:fa-puzzle-piece")
    Component(firebaseClient, "Cliente Firebase", "Firebase SDK (`firebase.ts`)", "Inicializa e configura o SDK do Firebase para o cliente.", $sprite="fa:fa-plug")
  }

  System_Ext(serverActions, "Next.js Server Actions", "Backend API para interações com dados e IA.", $sprite="fa:fa-cogs")
  System_Ext(firebaseAuthExt, "Firebase Authentication", "Serviço de autenticação externo.", $sprite="fa:fa-key")
  System_Ext(firebaseRtdbExt, "Firebase Realtime DB", "Serviço de banco de dados para chat.", $sprite="fa:fa-comments")

  Rel(authUI, firebaseAuthExt, "Usa para autenticar")
  Rel(authUI, stateMgmt, "Atualiza estado de autenticação")
  Rel(fileUploadUI, stateMgmt, "Usa/Atualiza estado de upload")
  Rel(fileUploadUI, serverActions, "Chama ações para criar registro e finalizar upload")
  Rel(analysisListUI, stateMgmt, "Usa estado de análises")
  Rel(analysisListUI, serverActions, "Chama ações para buscar/gerenciar análises")
  Rel(analysisViewUI, stateMgmt, "Usa estado da análise atual")
  Rel(reportViewUI, serverActions, "Chama ação para buscar relatório MDX")
  Rel(reportChatUI, serverActions, "Chama ação do orquestrador de chat")
  Rel(reportChatUI, firebaseRtdbExt, "Sincroniza mensagens de chat")
  Rel(routing, authUI, "Controla acesso baseado em autenticação")
  Rel(routing, reportViewUI, "Navega para")
  Rel(stateMgmt, firebaseClient, "Utiliza instância Firebase")
  Rel(uiComponents, "*", "Usado por diversos componentes de UI")

  UpdateElementStyle(authUI, $fontColor="white", $bgColor="rgb(68, 158, 228)", $borderColor="rgb(68, 158, 228)")
  UpdateElementStyle(fileUploadUI, $fontColor="white", $bgColor="rgb(68, 158, 228)", $borderColor="rgb(68, 158, 228)")
  UpdateElementStyle(analysisListUI, $fontColor="white", $bgColor="rgb(68, 158, 228)", $borderColor="rgb(68, 158, 228)")
  UpdateElementStyle(analysisViewUI, $fontColor="white", $bgColor="rgb(68, 158, 228)", $borderColor="rgb(68, 158, 228)")
  UpdateElementStyle(reportViewUI, $fontColor="white", $bgColor="rgb(68, 158, 228)", $borderColor="rgb(68, 158, 228)")
  UpdateElementStyle(reportChatUI, $fontColor="white", $bgColor="rgb(68, 158, 228)", $borderColor="rgb(68, 158, 228)")
  UpdateElementStyle(stateMgmt, $fontColor="black", $bgColor="rgb(200, 200, 200)", $borderColor="rgb(150,150,150)")
  UpdateElementStyle(routing, $fontColor="black", $bgColor="rgb(200, 200, 200)", $borderColor="rgb(150,150,150)")
  UpdateElementStyle(uiComponents, $fontColor="black", $bgColor="rgb(200, 200, 200)", $borderColor="rgb(150,150,150)")
  UpdateElementStyle(firebaseClient, $fontColor="black", $bgColor="rgb(200, 200, 200)", $borderColor="rgb(150,150,150)")
  UpdateElementStyle(serverActions, $fontColor="white", $bgColor="rgb(100, 100, 100)", $borderColor="rgb(100, 100, 100)")
  UpdateElementStyle(firebaseAuthExt, $fontColor="white", $bgColor="rgb(100, 100, 100)", $borderColor="rgb(100, 100, 100)")
  UpdateElementStyle(firebaseRtdbExt, $fontColor="white", $bgColor="rgb(100, 100, 100)", $borderColor="rgb(100, 100, 100)")
```

## Detalhes dos Componentes do Frontend

A seguir, uma lista dos principais componentes identificados no diagrama acima. Cada componente terá sua própria página de detalhamento (a ser criada).

*   **Componentes de Autenticação (`authUI`)**:
    *   [Detalhes](./frontend/auth-ui.md) *(link a ser criado)*
*   **Componentes de Upload (`fileUploadUI`)**:
    *   [Detalhes](./frontend/file-upload-ui.md) *(link a ser criado)*
*   **Listagem de Análises (`analysisListUI`)**:
    *   [Detalhes](./frontend/analysis-list-ui.md) *(link a ser criado)*
*   **Visualização de Análise (`analysisViewUI`)**:
    *   [Detalhes](./frontend/analysis-view-ui.md) *(link a ser criado)*
*   **Visualização de Relatório (`reportViewUI`)**:
    *   [Detalhes](./frontend/report-view-ui.md) *(link a ser criado)*
*   **Interface de Chat do Relatório (`reportChatUI`)**:
    *   [Detalhes](./frontend/report-chat-ui.md) *(link a ser criado)*
*   **Gerenciamento de Estado e Lógica de UI (`stateMgmt`)**:
    *   [Detalhes](./frontend/state-mgmt.md) *(link a ser criado)*
*   **Roteamento (`routing`)**:
    *   [Detalhes](./frontend/routing.md) *(link a ser criado)*
*   **Componentes de UI Reutilizáveis (`uiComponents`)**:
    *   [Detalhes](./frontend/ui-components.md) *(link a ser criado)*
*   **Cliente Firebase (`firebaseClient`)**:
    *   [Detalhes](./frontend/firebase-client.md) *(link a ser criado)*

[Próximo: Componentes das Server Actions](./02-server-actions-components.md)
