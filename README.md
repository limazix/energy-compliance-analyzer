
# Energy Compliance Analyzer

Este é um projeto Next.js para analisar a conformidade de dados de qualidade de energia elétrica com base nas resoluções normativas da ANEEL (Agência Nacional de Energia Elétrica) do Brasil. A aplicação permite que usuários façam upload de arquivos CSV, identifica as resoluções ANEEL pertinentes e gera um relatório de conformidade. O processamento pesado dos dados é realizado por Firebase Functions, e uma interface de chat interativa permite ao usuário dialogar e refinar os relatórios gerados.

## Descrição do Projeto

O Energy Compliance Analyzer simplifica a verificação de conformidade para o setor elétrico, utilizando uma pipeline de agentes de inteligência artificial (Genkit) para automatizar a análise de dados de qualidade de energia contra os regulamentos da ANEEL. O processamento principal ocorre em Firebase Functions, e uma interface de chat interativa com um agente orquestrador permite ao usuário interagir e refinar os relatórios gerados, com respostas da IA sendo transmitidas em tempo real.

## Componentes Principais

*   **Frontend:** Next.js, React, ShadCN UI, Tailwind CSS.
*   **Backend (API & Gatilhos):** Next.js Server Actions (para interações com o frontend, como o chat do relatório, e para disparar processos em background).
*   **Processamento em Background:** Firebase Functions (Node.js, TypeScript) para análise de dados e IA.
*   **Inteligência Artificial:** Genkit & Google AI (Gemini) executado em Firebase Functions (para o pipeline principal de análise e geração de relatório com agentes especialistas: Analista de Dados, Engenheiro, Relator, Revisor) e em Next.js Server Actions (para o agente orquestrador do chat interativo).
*   **Banco de Dados, Storage e Chat:** Firebase (Authentication, Firestore, Storage, Realtime Database para o chat).
*   **Hosting:** Firebase App Hosting para a aplicação Next.js.

## Funcionalidades Principais

*   Upload de arquivos CSV de dados de qualidade de energia.
*   Pipeline de análise com Agentes de IA Especializados em Firebase Functions:
    *   **Analista de Dados Sênior:** Pré-processamento, análise inicial, sugestão de transformações e visualizações.
    *   **Engenheiro Elétrico (Implícito):** Identificação de resoluções ANEEL e análise de conformidade.
    *   **Relator (Implícito):** Estruturação inicial do relatório.
    *   **Revisor:** Refinamento, correção gramatical, e formatação do relatório.
*   Geração de relatório de conformidade estruturado (JSON e MDX).
*   Interface de Chat Interativo na página de relatório:
    *   Permite ao usuário pedir esclarecimentos, aprofundamentos e solicitar alterações no relatório.
    *   Utiliza um Agente Orquestrador (via Next.js Server Actions e Genkit) para mediar a interação.
    *   Respostas da IA são transmitidas em tempo real (streaming).
    *   Histórico de chat persistente via Firebase Realtime Database.
*   Gerenciamento de análises (visualização, exclusão, tags).

## Arquitetura de Alto Nível

```mermaid
graph TD
    subgraph "UserInteraction" ["User Interaction"]
        UI["Frontend Next.js/React<br>(ShadCN, TailwindCSS)<br>Hosted on Firebase App Hosting"]
    end

    subgraph "BackendLogic" ["Backend (Next.js)"]
        ServerActions["Next.js Server Actions<br>(Upload Trigger, Chat Orchestrator)"]
    end

    subgraph "FirebasePlatform" ["Firebase Platform"]
        Auth["Firebase Authentication<br>(Google Sign-In)"]
        Firestore["Firebase Firestore<br>(Analyses Metadata, Tags, Status, Structured Report)"]
        Storage["Firebase Storage<br>(Upload CSVs, MDX Reports)"]
        RTDB["Firebase Realtime Database<br>(Chat History)"]
        Functions["Firebase Functions<br>(Heavy Processing, Main AI Pipeline)"]
    end

    subgraph "GenAIServices" ["Artificial Intelligence (Genkit & Gemini)"]
        AIEngineFunctions["AI Engine - Functions<br>(Pipeline: Data Analyst, Electrical Engineer, Reporter, Reviewer)"]
        AIEngineServerActions["AI Engine - Server Actions<br>(Interactive Chat Orchestrator Agent)"]
    end

    %% User Flows
    UI -- "Login via Google" --> Auth
    UI -- "Upload CSV<br>(Title, Description)" --> ServerActions
    ServerActions -- "Creates Initial Analysis Record<br>(Status: 'uploading')" --> Firestore
    ServerActions -- "Uploads CSV to Analysis Path" --> Storage
    ServerActions -- "Finalizes Analysis Record<br>(CSV URL, Status: 'summarizing_data')" --> Firestore

    %% Background Processing Flow (Triggered by Firestore update)
    Firestore -- "Trigger (onUpdate: status='summarizing_data')" --> Functions
    Functions -- "Reads CSV from Storage" --> Storage
    Functions -- "Executes AI Agent Pipeline" --> AIEngineFunctions
    AIEngineFunctions -- "Generates Structured Report (JSON)" --> Functions
    Functions -- "Saves Structured Report (JSON)" --> Firestore
    Functions -- "Converts Structured to MDX and Saves" --> Storage
    Functions -- "Updates Status/Progress to 'completed'" --> Firestore

    %% Report Viewing & Chat Flow
    UI -- "View Report (requests MDX)" --> ServerActions
    ServerActions -- "Reads MDX Path" --> Firestore
    ServerActions -- "Reads MDX Content" --> Storage
    Storage -- "Returns MDX Content" --> ServerActions
    ServerActions -- "Sends MDX to UI" --> UI
    UI -- "Sends Chat Message<br>(with report context)" --> ServerActions
    ServerActions -- "Interacts with AI Orchestrator Agent<br>(using structured report and MDX)" --> AIEngineServerActions
    AIEngineServerActions -- "AI Response / Suggested Modification to Structured Report (if any)" --> ServerActions
    ServerActions -- "Saves Chat Message (user and AI)" --> RTDB
    ServerActions -- "If Report Modified:<br>Updates Structured Report (JSON)" --> Firestore
    ServerActions -- "If Report Modified:<br>Generates and Saves new MDX" --> Storage
    RTDB -- "Syncs Chat in Real-Time with UI" --> UI
    Firestore -- "(Optional) Notifies UI of report changes via listener"-.-> UI

    %% Styling (optional, for clarity in renderers that support it)
    classDef userInteraction fill:#E6E6FA,stroke:#333,stroke-width:2px;
    classDef backendNextJs fill:#ADD8E6,stroke:#333,stroke-width:2px;
    classDef firebasePlatform fill:#FFFACD,stroke:#333,stroke-width:2px;
    classDef genAI fill:#98FB98,stroke:#333,stroke-width:2px;

    class UI userInteraction
    class ServerActions backendNextJs
    class Auth,Firestore,Storage,RTDB,Functions firebasePlatform
    class AIEngineFunctions,AIEngineServerActions genAI
    %% End of diagram
```

<p align="center" data-ai-hint="architecture diagram">Application Architecture Diagram</p>

## Executando Localmente

### Pré-requisitos

*   Node.js (versão 20 ou superior)
*   npm ou yarn
*   Firebase CLI instalado (`npm install -g firebase-tools`)
*   Projeto Firebase (`electric-magnitudes-analizer`) com Authentication, Firestore, Storage e Realtime Database habilitados.
*   Chave de API do Google AI (Gemini).

### Configuração

1.  **Clone o repositório.**
2.  **Instale as dependências do Next.js:** `npm install`
3.  **Instale as dependências das Firebase Functions:** `cd functions && npm install && cd ..`
4.  **Configure as variáveis de ambiente:**
    Crie um arquivo `.env` na raiz do projeto. Este arquivo será usado para desenvolvimento local (incluindo o servidor de desenvolvimento do Next.js e os Firebase Emulators).
    ```env
    # Configuração consolidada do Firebase para o cliente Next.js
    # DEVE ser um JSON stringificado válido.
    NEXT_PUBLIC_FIREBASE_CONFIG='{"apiKey":"SUA_API_KEY_DO_FIREBASE","authDomain":"SEU_AUTH_DOMAIN_DO_FIREBASE","projectId":"electric-magnitudes-analizer","storageBucket":"SEU_STORAGE_BUCKET_DO_FIREBASE","messagingSenderId":"SEU_MESSAGING_SENDER_ID_DO_FIREBASE","appId":"SEU_APP_ID_DO_FIREBASE","measurementId":"SEU_MEASUREMENT_ID_DO_FIREBASE","databaseURL":"SUA_DATABASE_URL_DO_FIREBASE"}'

    # Chave de API do Gemini para fluxos Genkit no Next.js (Server Actions) e Firebase Functions (quando emuladas localmente)
    # Para Firebase Functions implantadas, esta chave é configurada como secret no ambiente de deploy.
    NEXT_PUBLIC_GEMINI_API_KEY="SUA_API_KEY_DO_GEMINI"
    ```
    **Importante:**
    *   `NEXT_PUBLIC_FIREBASE_CONFIG`:
        *   O valor para `projectId` DEVE ser `electric-magnitudes-analizer`.
        *   O valor para `databaseURL` é essencial para o Realtime Database (chat), ex: `https://electric-magnitudes-analizer-default-rtdb.firebaseio.com`.
        *   Assegure-se de que todo o valor desta variável seja uma string JSON válida e única, entre aspas simples ou duplas, conforme a sintaxe do seu shell/`.env`.
    *   `NEXT_PUBLIC_GEMINI_API_KEY`: Usada pelos fluxos Genkit tanto no Next.js (para o chat) quanto nas Firebase Functions (durante a emulação local).

5.  **Domínios Autorizados no Firebase Authentication:**
    No Firebase Console (`electric-magnitudes-analizer` > Authentication > Settings > Authorized domains), adicione `localhost` e outros domínios de desenvolvimento (ex: `*.cloudworkstations.dev`).

6.  **Regras de Segurança do Firebase:**
    Revise e, se necessário, implante as regras de segurança para Firestore (`rules/firestore.rules`), Storage (`rules/storage.rules`) e Realtime Database (`rules/database.rules.json`) antes de executar localmente ou testar.
    Implantação manual (se ainda não feita pelo CI/CD):
    `firebase deploy --only firestore,storage,database --project electric-magnitudes-analizer`

### Executando a Aplicação com Emuladores (Recomendado)

O projeto está configurado para conectar-se aos Firebase Emulators (Auth, Firestore, Storage, Functions, Realtime Database) quando acessado via `localhost`.

1.  **Compile as Firebase Functions (necessário para o emulador de Functions):**
    ```bash
    npm run build --prefix functions
    ```
2.  **Inicie os Firebase Emulators:**
    (Em um terminal separado, na raiz do projeto)
    ```bash
    npm run emulators:start 
    ```
    Isso usa `--import=./firebase-emulator-data --export-on-exit`. A Emulator UI estará em `http://localhost:4001`. Verifique se os emuladores de `auth`, `firestore`, `storage`, `functions` e `database` estão ativos.

3.  **Inicie sua aplicação Next.js:**
    (Em outro terminal)
    ```bash
    npm run dev
    ```
    Acesse sua aplicação (`http://localhost:9002`). `src/lib/firebase.ts` conectará aos emuladores. A aplicação Next.js acionará as Functions (rodando no emulador) através de escritas no Firestore. A interface de chat com o relatório interage com fluxos Genkit via Server Actions do Next.js, que usarão a `NEXT_PUBLIC_GEMINI_API_KEY` do seu `.env`.

4.  **(Alternativa) Emuladores e dev server juntos com `firebase emulators:exec`:**
    O script `npm run emulators:dev` já está configurado para isso (ele compila as functions e depois roda o dev server do Next.js com os emuladores).
    ```bash
    npm run emulators:dev
    ```
5.  **(Opcional) Iniciar o Servidor de Desenvolvimento Genkit (para testar fluxos isoladamente):**
    Se quiser testar os fluxos Genkit da pasta `src/ai/flows` de forma isolada, você pode usar:
    ```bash
    npm run genkit:dev
    ```
    Isso iniciará a UI de desenvolvimento da Genkit (geralmente em `http://localhost:4000/flows`).

## Testando

Para rodar os testes de UI e integração (que usam os Firebase Emulators), execute:
```bash
npm test
```
Isso utilizará o script `firebase emulators:exec --import=./firebase-emulator-data jest` para executar os testes Jest em um ambiente com os emuladores ativos. Certifique-se de que as functions foram compiladas (`npm run build --prefix functions`) antes.

### Configuração do Ambiente de Teste para Jest (Local)

Os testes Jest precisam que certas variáveis de ambiente sejam definidas para interagir corretamente com os emuladores Firebase e para a inicialização do Firebase em si.
As variáveis de ambiente necessárias são as mesmas utilizadas pelo workflow de CI em `.github/workflows/tests.yml`.

**Opções para configurar variáveis de ambiente para testes Jest locais:**

1.  **Arquivo `.env.test` (Recomendado se seu setup Jest o suporta):**
    Algumas configurações Jest (especialmente com `dotenv`) podem carregar automaticamente um arquivo `.env.test`. Se for o caso, crie este arquivo na raiz do projeto:
    ```env
    # .env.test
    # Configuração consolidada do Firebase para testes (pode usar valores dummy se as chamadas reais são mockadas)
    NEXT_PUBLIC_FIREBASE_CONFIG='{"apiKey":"test-api-key","authDomain":"localhost","projectId":"electric-magnitudes-analizer","storageBucket":"localhost","messagingSenderId":"test-sender-id","appId":"test-app-id","databaseURL":"http://localhost:9000/?ns=electric-magnitudes-analizer"}'
    NEXT_PUBLIC_GEMINI_API_KEY="test-gemini-key-for-jest"

    # Configurações do Emulador (correspondem a firebase.json e ao que o CI usa)
    FIRESTORE_EMULATOR_HOST="localhost:8080"
    FIREBASE_AUTH_EMULATOR_HOST="localhost:9099"
    FIREBASE_STORAGE_EMULATOR_HOST="localhost:9199" # Ou 127.0.0.1:9199
    FIREBASE_DATABASE_EMULATOR_HOST="localhost:9000"
    FUNCTIONS_EMULATOR_HOST="localhost:5001"
    FIREBASE_FUNCTIONS_EMULATOR_ORIGIN="http://localhost:5001" # Ou http://127.0.0.1:5001

    # Outras variáveis que podem ser necessárias dependendo dos testes
    GCLOUD_PROJECT="electric-magnitudes-analizer" # Mesmo que NEXT_PUBLIC_FIREBASE_PROJECT_ID
    GCP_REGION="us-central1" # Região padrão para functions

    # FIREBASE_CONFIG é uma string JSON usada por firebase-admin nos emuladores.
    # O conteúdo de FIREBASE_CONFIG é tipicamente {"databaseURL": "http://localhost:9000/?ns=PROJECT_ID", "storageBucket": "localhost", "projectId": "PROJECT_ID"}
    # Mas para os emuladores de functions, o CLI do Firebase geralmente o define automaticamente.
    # Se você tiver problemas, pode precisar defini-lo explicitamente.
    # FIREBASE_CONFIG='{"projectId":"electric-magnitudes-analizer","databaseURL":"http://localhost:9000/?ns=electric-magnitudes-analizer","storageBucket":"localhost"}'
    ```
    *Nota: O `jest.setup.js` neste projeto NÃO mocka mais `NEXT_PUBLIC_FIREBASE_CONFIG`. Você DEVE fornecê-lo através do seu ambiente.*

2.  **Prefixando o comando de teste:**
    Você pode definir as variáveis diretamente no comando:
    ```bash
    NEXT_PUBLIC_FIREBASE_CONFIG='{...}' FIRESTORE_EMULATOR_HOST="localhost:8080" npm test
    ```
    (Isso pode se tornar verboso).

3.  **Configuração do Ambiente Shell/IDE:**
    Exporte as variáveis no seu terminal antes de rodar `npm test`, ou configure-as nas configurações de execução da sua IDE para os testes Jest.

Consulte a seção `env:` do job `test_production` em `.github/workflows/tests.yml` para a lista completa de variáveis de ambiente que o ambiente de CI utiliza e que você pode precisar replicar para testes locais consistentes.

## Deployment

Este projeto é configurado para deploy no **Firebase App Hosting** (para a aplicação Next.js) e **Firebase Functions** (para o processamento em backend). As regras de segurança (Firestore, Storage, Realtime Database) também são implantadas.

Consulte o [**Guia de Deployment**](docs/DEPLOYMENT.md) para detalhes sobre deploy manual e automático via GitHub Actions.

## Licença

Este projeto é licenciado sob a Licença Apache, Versão 2.0. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

