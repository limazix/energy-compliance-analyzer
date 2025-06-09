
# C4 Model: Nível 2 - Visão Geral dos Contêineres - Energy Compliance Analyzer

Este diagrama detalha os principais contêineres (aplicações, armazenamentos de dados, etc.) que compõem o sistema Energy Compliance Analyzer. Cada contêiner é uma unidade implantável ou um armazenamento de dados significativo.

```mermaid
C4Container
  title Diagrama de Contêineres para o Energy Compliance Analyzer

  Actor_Ext(user, "Usuário", "Interage com o sistema via frontend.", $sprite="fa:fa-user")

  System_Boundary(c1, "Energy Compliance Analyzer") {
    Container(frontendApp, "Frontend Web App", "Next.js, React, ShadCN UI, TailwindCSS", "Interface do usuário para login, upload de arquivos, visualização de análises, relatórios e chat interativo. Hospedado no Firebase App Hosting.", $sprite="fa:fa-desktop")
    Container(serverActions, "Backend API", "Next.js Server Actions, Node.js, Genkit", "Lida com uploads de arquivos, dispara o processamento, orquestra o chat do relatório e interage com serviços Firebase. Executa no Firebase App Hosting.", $sprite="fa:fa-cogs")
    Container(firebaseFunctions, "Processamento em Background", "Firebase Functions, Node.js, TypeScript, Genkit", "Executa a pipeline principal de análise de IA (agentes especializados) para dados de CSV e gera relatórios estruturados.", $sprite="fa:fa-bolt")
    ContainerDb(firestore, "Banco de Dados Principal", "Firebase Firestore (NoSQL, Document DB)", "Armazena metadados das análises, status, tags, e o relatório estruturado (JSON).", $sprite="fa:fa-database")
    ContainerDb(rtdb, "Banco de Dados de Chat", "Firebase Realtime Database (NoSQL, Realtime JSON DB)", "Armazena o histórico das conversas do chat interativo do relatório.", $sprite="fa:fa-comments")
    Container(storage, "Armazenamento de Arquivos", "Firebase Storage (Blob Storage)", "Armazena os arquivos CSV enviados pelos usuários e os relatórios MDX gerados.", $sprite="fa:fa-archive")
    Container(auth, "Serviço de Autenticação", "Firebase Authentication (OAuth, Identity Management)", "Gerencia a autenticação de usuários via Google Sign-In.", $sprite="fa:fa-key")
  }

  System_Ext(googleAI, "Google AI (Gemini)", "Modelos de Linguagem Generativa (LLMs) para IA.", $sprite="fa:fa-brain")

  Rel(user, frontendApp, "Usa", "HTTPS")
  Rel(frontendApp, serverActions, "Envia requisições para", "HTTPS/Server Actions")
  Rel(frontendApp, auth, "Autentica com", "Firebase SDK")
  Rel(frontendApp, rtdb, "Sincroniza mensagens de chat com", "Firebase SDK, WebSockets")

  Rel(serverActions, firestore, "Lê/Escreve metadados e relatórios em", "Firebase SDK")
  Rel(serverActions, storage, "Gerencia informações de upload para", "Firebase SDK")
  Rel(serverActions, googleAI, "Interage com Agente Orquestrador para chat via", "Genkit API Call")
  Rel(serverActions, firebaseFunctions, "Dispara (indiretamente via Firestore)", "Firestore Trigger")
  Rel(serverActions, rtdb, "Salva mensagens de chat e atualiza relatório via", "Firebase Admin SDK (indireto, via Functions ou Server Actions)")

  Rel(firebaseFunctions, storage, "Lê CSVs e Salva relatórios MDX em", "Firebase Admin SDK")
  Rel(firebaseFunctions, firestore, "Lê/Atualiza status e salva relatório estruturado em", "Firebase Admin SDK")
  Rel(firebaseFunctions, googleAI, "Executa pipeline de IA (agentes especialistas) via", "Genkit API Call")

  UpdateElementStyle(user, $fontColor="white", $bgColor="rgb(13, 105, 184)", $borderColor="rgb(13, 105, 184)")
  UpdateElementStyle(frontendApp, $fontColor="white", $bgColor="rgb(43, 135, 209)", $borderColor="rgb(43, 135, 209)")
  UpdateElementStyle(serverActions, $fontColor="white", $bgColor="rgb(43, 135, 209)", $borderColor="rgb(43, 135, 209)")
  UpdateElementStyle(firebaseFunctions, $fontColor="white", $bgColor="rgb(43, 135, 209)", $borderColor="rgb(43, 135, 209)")
  UpdateElementStyle(firestore, $fontColor="white", $bgColor="rgb(112, 112, 214)", $borderColor="rgb(112, 112, 214)")
  UpdateElementStyle(rtdb, $fontColor="white", $bgColor="rgb(112, 112, 214)", $borderColor="rgb(112, 112, 214)")
  UpdateElementStyle(storage, $fontColor="white", $bgColor="rgb(112, 112, 214)", $borderColor="rgb(112, 112, 214)")
  UpdateElementStyle(auth, $fontColor="white", $bgColor="rgb(112, 112, 214)", $borderColor="rgb(112, 112, 214)")
  UpdateElementStyle(googleAI, $fontColor="white", $bgColor="rgb(100, 100, 100)", $borderColor="rgb(100, 100, 100)")

```

## Detalhes dos Contêineres

Clique em um contêiner abaixo para ver mais detalhes sobre suas responsabilidades, tecnologias e interações:

*   [Frontend Web App](./frontend-app.md)
*   [Backend API (Next.js Server Actions)](./server-actions.md)
*   [Processamento em Background (Firebase Functions)](./firebase-functions.md)
*   [Banco de Dados Principal (Firebase Firestore)](./firestore-db.md)
*   [Banco de Dados de Chat (Firebase Realtime Database)](./rtdb.md)
*   [Armazenamento de Arquivos (Firebase Storage)](./storage.md)
*   [Serviço de Autenticação (Firebase Authentication)](./auth.md)

[<- Voltar para: Contexto do Sistema (C1)](../c1-context.md)
[Próximo Nível: Diagrama de Componentes (C3)](../c3-components/index.md)
