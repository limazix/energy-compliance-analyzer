
# Guia de Deployment do Energy Compliance Analyzer

Este documento detalha os processos de deploy manual e automático (via GitHub Actions) para o projeto Energy Compliance Analyzer, que utiliza Firebase App Hosting para a aplicação Next.js e Firebase Functions para o processamento em backend.

## Visão Geral do Deployment

O projeto é implantado no projeto Firebase `electric-magnitudes-analizer` e consiste em três partes principais para deploy:

1.  **Aplicação Next.js:** Implantada no Firebase App Hosting.
2.  **Funções de Backend (AI, Processamento):** Implantadas como Firebase Functions.
3.  **Regras de Segurança:** Regras do Firestore e Storage.

O workflow de GitHub Actions (`.github/workflows/firebase-deploy.yml`) está configurado para automatizar o deploy de todas essas partes.

## Deployment Automático com GitHub Actions (Recomendado)

Este projeto inclui um workflow de GitHub Actions para automatizar o deploy.

### Configuração do GitHub Actions

1.  **ID do Backend do App Hosting:**
    *   No arquivo `.github/workflows/firebase-deploy.yml`, localize a linha:
        `firebase apphosting:backends:deploy YOUR_APP_HOSTING_BACKEND_ID`
    *   **Substitua `YOUR_APP_HOSTING_BACKEND_ID` pelo ID real do seu backend do App Hosting.**
    *   Você pode obter este ID no Firebase Console (App Hosting > seu backend) após criá-lo (seja manualmente pela primeira vez ou via CLI).

2.  **Segredos do GitHub (Workload Identity Federation):**
    Configure os seguintes segredos no seu repositório GitHub ("Settings" > "Secrets and variables" > "Actions"):
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

3.  **Secrets das Firebase Functions (API Keys, etc.):**
    *   A chave `NEXT_PUBLIC_GEMINI_API_KEY` (ou `GEMINI_API_KEY` se você preferir um nome diferente para o ambiente das functions) precisa ser configurada como um secret para suas Firebase Functions no ambiente do Google Cloud. Isso pode ser feito via:
        *   **Variáveis de ambiente no Google Cloud Console:** Durante ou após o deploy das functions.
        *   **Secret Manager do GCP:** E acessá-las nas suas functions.
    *   O workflow do GitHub Actions *não* lida com a configuração desses secrets de runtime das functions. Isso deve ser feito separadamente.

### Como Funciona o Workflow

*   Ao fazer um `git push` para a branch `main` (ou a branch configurada), a Action é disparada.
*   Ela faz o build da aplicação Next.js.
*   Faz o deploy da aplicação Next.js para o Firebase App Hosting.
*   Faz o build e deploy das Firebase Functions.
*   Faz o deploy das regras do Firestore e Storage.

## Deployment Manual

Se precisar fazer deploy manual:

*   Certifique-se de ter o [Firebase CLI](https://firebase.google.com/docs/cli) instalado e estar logado (`firebase login`).
*   Associe seu diretório de projeto local ao projeto `electric-magnitudes-analizer` (`firebase use electric-magnitudes-analizer`).

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

### 3. Deploy das Regras de Segurança do Firebase

As regras de segurança para Firestore e Firebase Storage são cruciais.

1.  **Implante as regras:**
    ```bash
    firebase deploy --only firestore:rules,storage:rules --project electric-magnitudes-analizer
    ```
2.  **Verifique as regras no Firebase Console:** Após o deploy, confirme visualmente que as regras no console correspondem aos seus arquivos locais (`firestore.rules`, `storage.rules`).

Lembre-se de configurar os secrets necessários (como a API Key do Gemini) diretamente no ambiente das Firebase Functions no Google Cloud Console se estiver fazendo deploy manual e elas ainda não estiverem configuradas.
```