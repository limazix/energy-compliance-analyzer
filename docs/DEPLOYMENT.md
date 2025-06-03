
# Guia de Deployment do Energy Compliance Analyzer

Este documento detalha os processos de deploy manual e automático (via GitHub Actions) para o projeto Energy Compliance Analyzer, que utiliza Firebase App Hosting para a aplicação Next.js e Firebase Functions para o processamento em backend.

## Visão Geral do Deployment

O projeto é implantado no projeto Firebase `electric-magnitudes-analizer` e consiste em quatro partes principais para deploy:

1.  **Aplicação Next.js:** Implantada no Firebase App Hosting.
2.  **Funções de Backend (AI, Processamento):** Implantadas como Firebase Functions.
3.  **Regras de Segurança:** Regras do Firestore, Storage e Realtime Database.
4.  **Índices do Firestore:** (Se houver, gerenciados por `firestore.indexes.json`).

O workflow de GitHub Actions (`.github/workflows/firebase-deploy.yml`) está configurado para automatizar o deploy de todas essas partes.

## Deployment Automático com GitHub Actions (Recomendado)

Este projeto inclui um workflow de GitHub Actions para automatizar o deploy.

### Configuração do GitHub Actions

1.  **ID do Backend do App Hosting:**
    *   No arquivo `.github/workflows/firebase-deploy.yml`, localize a linha:
        `firebase apphosting:backends:deploy YOUR_APP_HOSTING_BACKEND_ID`
    *   **Substitua `YOUR_APP_HOSTING_BACKEND_ID` pelo ID real do seu backend do App Hosting.**
    *   Você pode obter este ID no Firebase Console (App Hosting > seu backend) após criá-lo (seja manualmente pela primeira vez ou via CLI). Por exemplo, pode ser algo como `energy-compliance-analyzer-backend`.

2.  **Segredos do GitHub:**
    Configure os seguintes segredos no seu repositório GitHub ("Settings" > "Secrets and variables" > "Actions"):

    *   **Para Autenticação GCP (Workload Identity Federation):**
        *   `GCP_PROJECT_NUMBER`: O número do seu projeto GCP (ex: `123456789012`).
        *   `GCP_WORKLOAD_IDENTITY_POOL_ID`: O ID do seu Workload Identity Pool no GCP.
        *   `GCP_WORKLOAD_IDENTITY_PROVIDER_ID`: O ID do seu Provider dentro do pool.
        *   `GCP_SERVICE_ACCOUNT_EMAIL`: O email da conta de serviço do GCP que o GitHub Actions usará. Esta conta de serviço precisa ter as seguintes permissões mínimas no GCP:
            *   `Firebase App Hosting Admin` (roles/firebaseapphosting.admin) - Para deploy do App Hosting.
            *   `Firebase Functions Developer` (roles/cloudfunctions.developer) ou Admin - Para deploy das Functions.
            *   `Firebase Rules System` (roles/firebaserules.system) - Para deploy das regras.
            *   `Service Account User` (roles/iam.serviceAccountUser) - Para permitir que as Functions executem como a conta de serviço delas.
            *   `Service Account Token Creator` (roles/iam.serviceAccountTokenCreator) - Para o GitHub Actions impersonar a conta de serviço.
            *   `Cloud Build Editor` (roles/cloudbuild.builds.editor) - Firebase Functions usam Cloud Build para o deploy.
            *   (Opcional, mas recomendado para Functions) `Logs Writer` (roles/logging.logWriter) e `Monitoring Metric Writer` (roles/monitoring.metricWriter).

    *   **Para o Build do Next.js (Variáveis `NEXT_PUBLIC_`):**
        *   `NEXT_PUBLIC_FIREBASE_API_KEY`: Sua chave de API do Firebase para o cliente web.
        *   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`: Seu domínio de autenticação do Firebase.
        *   `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`: Seu bucket do Firebase Storage.
        *   `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`: Seu ID de remetente do Firebase Messaging.
        *   `NEXT_PUBLIC_FIREBASE_APP_ID`: Seu ID do aplicativo Firebase.
        *   `NEXT_PUBLIC_FIREBASE_DATABASE_URL`: A URL do seu Firebase Realtime Database.
        *   `NEXT_PUBLIC_GEMINI_API_KEY`: A chave de API do Google AI (Gemini) **se for usada diretamente no código do cliente Next.js**. Se for usada apenas no backend (Firebase Functions), este secret não é necessário aqui, mas sim na configuração das Functions.
        *   `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`: (Opcional) Seu ID de medição do Google Analytics para Firebase.

3.  **Secrets de Runtime das Firebase Functions (Ex: API Key do Gemini):**
    *   A chave de API do Gemini (`GEMINI_API_KEY`) que suas Firebase Functions usam para chamar a IA **DEVE** ser configurada como um secret no ambiente de runtime das suas Firebase Functions no Google Cloud.
    *   Isso pode ser feito via:
        *   **Variáveis de ambiente na configuração da Function no Google Cloud Console.**
        *   **Google Cloud Secret Manager:** E acessá-las programaticamente em suas functions.
    *   O workflow do GitHub Actions *não* lida com a configuração desses secrets de runtime para as functions. Isso é uma configuração separada e essencial que você deve fazer no GCP. O código das functions (em `functions/src/processAnalysis.ts`) espera encontrar `process.env.GEMINI_API_KEY` ou `functions.config().gemini.apikey`.

### Como Funciona o Workflow

*   Ao fazer um `git push` para a branch `main` (ou a branch configurada), ou ao abrir/sincronizar um Pull Request para `main`, a Action é disparada.
*   **Job `test`**:
    *   Instala dependências para o app Next.js e para as Firebase Functions.
    *   Constrói as Firebase Functions (necessário para os emuladores).
    *   Executa os testes Jest (`npm test`), que usam os Firebase Emulators.
    *   Se os testes falharem, o workflow para aqui.
*   **Job `build_and_deploy`** (só executa em `push` para `main` e se o job `test` passar):
    *   Instala dependências e faz o build da aplicação Next.js, usando os secrets do GitHub para as variáveis `NEXT_PUBLIC_*`.
    *   Autentica no Google Cloud usando Workload Identity Federation.
    *   Faz o deploy da aplicação Next.js para o Firebase App Hosting.
    *   Faz o build e deploy das Firebase Functions.
    *   Faz o deploy das regras do Firestore, Storage e Realtime Database.

## Deployment Manual

Se precisar fazer deploy manual:

*   Certifique-se de ter o [Firebase CLI](https://firebase.google.com/docs/cli) instalado e estar logado (`firebase login`).
*   Associe seu diretório de projeto local ao projeto `electric-magnitudes-analizer` (`firebase use electric-magnitudes-analizer`).
*   Configure suas variáveis de ambiente locais no arquivo `.env` para o build do Next.js, se necessário.

### 1. Deploy da Aplicação Next.js (App Hosting)

1.  **Construa sua aplicação Next.js:**
    ```bash
    npm run build
    ```
2.  **Implante usando o Firebase CLI:**
    Substitua `YOUR_APP_HOSTING_BACKEND_ID` e `YOUR_REGION` (ex: `us-central1`):
    ```bash
    firebase apphosting:backends:deploy YOUR_APP_HOSTING_BACKEND_ID --project electric-magnitudes-analizer --region YOUR_REGION
    ```
    Se for o primeiro deploy, o CLI pode ajudar a criar um backend.

### 2. Deploy das Firebase Functions

1.  **Navegue até o diretório das functions:**
    ```bash
    cd functions
    ```
2.  **Instale as dependências das functions (se ainda não o fez):**
    ```bash
    npm install
    ```
3.  **Compile as functions (TypeScript para JavaScript):**
    ```bash
    npm run build
    ```
4.  **Volte para o diretório raiz do projeto:**
    ```bash
    cd ..
    ```
5.  **Implante as functions usando o Firebase CLI:**
    ```bash
    firebase deploy --only functions --project electric-magnitudes-analizer
    ```
    **Lembre-se**: Configure a API Key do Gemini e outros secrets necessários diretamente no ambiente das Firebase Functions no Google Cloud Console.

### 3. Deploy das Regras de Segurança e Índices do Firebase

As regras de segurança para Firestore, Firebase Storage e Realtime Database, bem como os índices do Firestore, são cruciais.

1.  **Implante as regras e índices:**
    ```bash
    firebase deploy --only firestore,storage,database --project electric-magnitudes-analizer
    ```
    (O comando `firestore` inclui tanto `firestore:rules` quanto `firestore:indexes`. `database` cobre `database:rules`).
2.  **Verifique as regras no Firebase Console:** Após o deploy, confirme visualmente que as regras no console correspondem aos seus arquivos locais (`firestore.rules`, `storage.rules`, `database.rules.json`).
```