
# C4 Deployment Diagram: Energy Compliance Analyzer

[<- Voltar para Nível C4 (Código)](./index.md)

Este diagrama descreve como os contêineres do sistema Energy Compliance Analyzer são implantados na infraestrutura do Firebase e Google Cloud Platform (GCP) para um ambiente de produção típico.

```mermaid
C4Deployment
  title Diagrama de Implantação - Energy Compliance Analyzer (Produção)

  Deployment_Node(userDevice, "Dispositivo do Usuário", "Desktop/Mobile Browser", $sprite="fa:fa-desktop") {
    Container_Instance(browser, "Navegador Web", "Aplicação Cliente (Next.js/React)", "Executa o Frontend Web App baixado do App Hosting.")
  }

  Deployment_Node(gcp, "Google Cloud Platform (GCP)", "Infraestrutura e Serviços Gerenciados do Google", $sprite="fa:fa-cloud") {
    Deployment_Node(appHosting, "Firebase App Hosting", "Serviço de hospedagem gerenciado para aplicações web", "Região: us-central1 (configurável)") {
      Container_Instance(nextJsAppInstance, frontendApp, "Frontend Web App & Server Actions", "Next.js v15+, Node.js v20+")
    }

    Deployment_Node(cloudFunctions, "Firebase Functions", "Plataforma Serverless para código de backend", "Região: us-central1 (configurável)") {
      Container_Instance(analysisProcessorInstance, firebaseFunctions, "Processamento em Background (Pipeline de IA)", "Node.js v20+, Genkit, Gemini API")
    }

    Deployment_Node(firebaseCoreServices, "Serviços Firebase (Core)", "Serviços de backend totalmente gerenciados", $sprite="fa:fa-firebase") {
      ContainerDb_Instance(firestoreInstance, firestore, "Banco de Dados Principal", "Firestore NoSQL Database (Multi-Região ou Regional)")
      ContainerDb_Instance(rtdbInstance, rtdb, "Banco de Dados de Chat", "Realtime NoSQL Database (Regional)")
      Container_Instance(storageInstance, storage, "Armazenamento de Arquivos", "Firebase Storage (Buckets GCS Multi-Regionais ou Regionais)")
      Container_Instance(authInstance, auth, "Serviço de Autenticação", "Firebase Authentication Service (Global)")
    }
  }

  System_Ext(googleAI, "Google AI (Gemini)", "Serviços de Modelos de Linguagem Generativa (LLMs) para IA.", $sprite="fa:fa-brain")

  Rel(browser, nextJsAppInstance, "Acessa (HTTPS)")
  Rel(nextJsAppInstance, firestoreInstance, "Lê/Escreve (Firebase SDK)", "HTTPS/gRPC")
  Rel(nextJsAppInstance, rtdbInstance, "Lê/Escreve (Firebase SDK)", "WebSockets")
  Rel(nextJsAppInstance, storageInstance, "Upload/Download (Firebase SDK)", "HTTPS")
  Rel(nextJsAppInstance, authInstance, "Autentica via (Firebase SDK)", "HTTPS")
  Rel(nextJsAppInstance, googleAI, "Chama para IA do chat (Genkit API Call)", "HTTPS")
  
  Rel(firestoreInstance, analysisProcessorInstance, "Aciona (via Eventarc/Firestore Triggers)")
  Rel(analysisProcessorInstance, firestoreInstance, "Lê/Escreve (Firebase Admin SDK)", "HTTPS/gRPC")
  Rel(analysisProcessorInstance, storageInstance, "Lê/Escreve (Firebase Admin SDK)", "HTTPS")
  Rel(analysisProcessorInstance, googleAI, "Chama para pipeline de IA (Genkit API Call)", "HTTPS")

  %% Alias para referenciar elementos definidos no Nível C2
  Component_Ext(frontendApp, "Frontend Web App", "Contêiner do Nível C2")
  Component_Ext(firebaseFunctions, "Processamento em Background", "Contêiner do Nível C2")
  ComponentDb_Ext(firestore, "Banco de Dados Principal (Firestore)", "Contêiner do Nível C2")
  ComponentDb_Ext(rtdb, "Banco de Dados de Chat (RTDB)", "Contêiner do Nível C2")
  Component_Ext(storage, "Armazenamento de Arquivos (Storage)", "Contêiner do Nível C2")
  Component_Ext(auth, "Serviço de Autenticação", "Contêiner do Nível C2")

  UpdateElementStyle(userDevice, $fontColor="white", $bgColor="rgb(13, 105, 184)")
  UpdateElementStyle(gcp, $fontColor="white", $bgColor="rgb(66, 133, 244)")
  UpdateElementStyle(appHosting, $fontColor="black", $bgColor="rgb(251, 188, 5)")
  UpdateElementStyle(cloudFunctions, $fontColor="black", $bgColor="rgb(251, 188, 5)")
  UpdateElementStyle(firebaseCoreServices, $fontColor="black", $bgColor="rgb(255, 160, 0)")
  UpdateElementStyle(googleAI, $fontColor="white", $bgColor="rgb(100, 100, 100)")
```

## Descrição da Implantação

*   **Dispositivo do Usuário:**
    *   Os usuários acessam o Energy Compliance Analyzer através de um **Navegador Web** em seus dispositivos (desktops, tablets, smartphones).
    *   O navegador executa a aplicação cliente (Frontend Web App), que é uma Single Page Application construída com Next.js/React.

*   **Google Cloud Platform (GCP) / Firebase:**
    *   **Firebase App Hosting:**
        *   Hospeda a aplicação **Frontend Web App & Server Actions** (contêiner `nextJsAppInstance`).
        *   Este serviço gerencia o build, deploy e escalonamento da aplicação Next.js.
        *   A região de implantação é tipicamente `us-central1` ou outra configurada durante o setup do Firebase App Hosting.
    *   **Firebase Functions:**
        *   Hospeda o contêiner de **Processamento em Background** (`analysisProcessorInstance`).
        *   Estas são funções serverless Node.js que executam a pipeline de IA (Genkit com Gemini API) em resposta a gatilhos (ex: atualizações no Firestore).
        *   A região também é configurável (ex: `us-central1`).
    *   **Serviços Firebase (Core):**
        *   **Firebase Firestore (`firestoreInstance`):** Utilizado como o banco de dados NoSQL principal para armazenar metadados das análises, status, tags e os relatórios estruturados (JSON). Pode ser configurado como multi-regional ou regional.
        *   **Firebase Realtime Database (`rtdbInstance`):** Usado para o histórico de conversas do chat interativo, fornecendo sincronização em tempo real. Geralmente é regional.
        *   **Firebase Storage (`storageInstance`):** Armazena os arquivos CSV enviados pelos usuários e os relatórios MDX gerados. Os buckets do Storage podem ser multi-regionais ou regionais.
        *   **Firebase Authentication (`authInstance`):** Gerencia a autenticação de usuários (via Google Sign-In). É um serviço global.

*   **Google AI (Gemini) (Sistema Externo):**
    *   Os modelos de linguagem generativa (LLMs) são acessados via API.
    *   As Server Actions (para o chat) e as Firebase Functions (para a pipeline de análise) fazem chamadas de API para o Gemini através do framework Genkit.

## Interações Chave na Implantação

*   O **Navegador Web** do usuário baixa e executa o Frontend App do **Firebase App Hosting**.
*   O Frontend App interage com os **Serviços Firebase (Core)** (Auth, Firestore, RTDB, Storage) usando os SDKs do Firebase via HTTPS e WebSockets (para RTDB).
*   O Frontend App (especificamente as Server Actions) interage com a **Google AI** via Genkit para a funcionalidade de chat.
*   Atualizações no **Firebase Firestore** (feitas pelas Server Actions) podem acionar as **Firebase Functions**.
*   As **Firebase Functions** interagem com **Firebase Firestore**, **Firebase Storage** (usando o Firebase Admin SDK) e com a **Google AI** (via Genkit) para realizar o processamento da análise.

Este diagrama de implantação fornece uma visão geral de como os diferentes pedaços do sistema são hospedados e interagem em um ambiente de produção.
