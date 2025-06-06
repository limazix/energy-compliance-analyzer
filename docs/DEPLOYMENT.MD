
# Guia de Deployment do Energy Compliance Analyzer

Este documento detalha os processos de deploy manual e automático (via GitHub Actions) para o projeto Energy Compliance Analyzer, que utiliza Firebase App Hosting para a aplicação Next.js e Firebase Functions para o processamento em backend.

## Visão Geral do Deployment

O projeto é implantado no projeto Firebase `electric-magnitudes-analizer` e consiste em quatro partes principais para deploy:

1.  **Aplicação Next.js:** Implantada no Firebase App Hosting.
2.  **Funções de Backend (AI, Processamento):** Implantadas como Firebase Functions.
3.  **Regras de Segurança:** Regras do Firestore, Storage e Realtime Database (localizadas na pasta `rules/`).
4.  **Índices do Firestore:** (Se houver, gerenciados por `firestore.indexes.json`).

Os workflows de GitHub Actions (na pasta `.github/workflows/`) estão configurados para automatizar o deploy de todas essas partes.

## Deployment Automático com GitHub Actions (Recomendado)

Este projeto inclui uma cadeia de workflows de GitHub Actions para construir, testar e implantar a aplicação. O workflow principal para deploy é o `4-deploy-to-firebase.yml`.

### Configuração do GitHub Actions

1.  **ID do Backend do App Hosting:**
    *   No arquivo `.github/workflows/4-deploy-to-firebase.yml`, localize a seção de deploy do App Hosting:
        ```yaml
        - name: Deploy to Firebase App Hosting (via GitHub App)
          uses: firebase-tools/action-apphosting-deploy@v0
          with:
            projectId: ${{ secrets.NEXT_PUBLIC_PROJECT_ID }}
            backendId: ema-backend # CONFIRME ESTE ID
            region: us-central1
        ```
    *   **CONFIRME `backendId: ema-backend`**. Substitua `ema-backend` pelo ID real do seu backend do App Hosting se for diferente.
    *   Você pode obter este ID no Firebase Console (App Hosting > seu backend) após criá-lo.

2.  **Segredos do GitHub:**
    Configure os seguintes segredos no seu repositório GitHub ("Settings" > "Secrets and variables" > "Actions"):

    *   **Para Autenticação GCP (Workload Identity Federation - Usado para deploy de Functions e Rules):**
        *   `GCP_PROJECT_NUMBER`: O número do seu projeto GCP (ex: `123456789012`).
        *   `GCP_WORKLOAD_IDENTITY_POOL_ID`: O ID do seu Workload Identity Pool no GCP.
        *   `GCP_WORKLOAD_IDENTITY_PROVIDER_ID`: O ID do seu Provider dentro do pool.
        *   `GCP_SERVICE_ACCOUNT_EMAIL`: O email da conta de serviço do GCP que o GitHub Actions usará. Esta conta de serviço precisa ter as seguintes permissões mínimas no GCP:
            *   `Firebase Functions Developer` (roles/cloudfunctions.developer) ou Admin - Para deploy das Functions.
            *   `Firebase Rules System` (roles/firebaserules.system) - Para deploy das regras.
            *   `Service Account User` (roles/iam.serviceAccountUser) - Para permitir que as Functions executem como a conta de serviço delas.
            *   `Service Account Token Creator` (roles/iam.serviceAccountTokenCreator) - Para o GitHub Actions impersonar a conta de serviço.
            *   `Cloud Build Editor` (roles/cloudbuild.builds.editor) - Firebase Functions usam Cloud Build para o deploy.
            *   (Opcional, mas recomendado para Functions) `Logs Writer` (roles/logging.logWriter) e `Monitoring Metric Writer` (roles/monitoring.metricWriter).

    *   **Para o Deploy do App Hosting e Build do Next.js (Variáveis `NEXT_PUBLIC_`):**
        *   `NEXT_PUBLIC_PROJECT_ID`: O ID do seu projeto Firebase (ex: `electric-magnitudes-analizer`). Este também é usado como `projectId` para o deploy do App Hosting.
        *   `FIREBASE_TOKEN`: **Este secret é especial e NÃO deve ser criado manualmente.** Ele é automaticamente fornecido e gerenciado pela integração do Firebase App Hosting GitHub App quando você o instala e configura para o seu repositório. A ação `firebase-tools/action-apphosting-deploy@v0` o utilizará.
        *   `NEXT_PUBLIC_FIREBASE_API_KEY`: Sua chave de API do Firebase para o cliente web (necessária para o build do Next.js).
        *   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`: Seu domínio de autenticação do Firebase (necessário para o build do Next.js).
        *   `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`: Seu bucket do Firebase Storage (necessário para o build do Next.js).
        *   `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`: Seu ID de remetente do Firebase Messaging (necessário para o build do Next.js).
        *   `NEXT_PUBLIC_FIREBASE_APP_ID`: Seu ID do aplicativo Firebase (necessário para o build do Next.js).
        *   `NEXT_PUBLIC_FIREBASE_DATABASE_URL`: A URL do seu Firebase Realtime Database (necessário para o build do Next.js).
        *   `NEXT_PUBLIC_GEMINI_API_KEY`: A chave de API do Google AI (Gemini) (necessária para o build do Next.js, se usada no cliente, e para as Functions em runtime).
        *   `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`: (Opcional) Seu ID de medição do Google Analytics para Firebase (necessário para o build do Next.js).

3.  **Secrets de Runtime das Firebase Functions (Ex: API Key do Gemini):**
    *   A chave de API do Gemini (`GEMINI_API_KEY`) que suas Firebase Functions usam para chamar a IA **DEVE** ser configurada como um secret no ambiente de runtime das suas Firebase Functions no Google Cloud.
    *   Isso pode ser feito via:
        *   **Variáveis de ambiente na configuração da Function no Google Cloud Console.**
        *   **Google Cloud Secret Manager:** E acessá-las programaticamente em suas functions.
    *   O workflow do GitHub Actions *não* lida com a configuração desses secrets de runtime para as functions. Isso é uma configuração separada e essencial que você deve fazer no GCP. O código das functions (em `functions/src/processAnalysis.js`) espera encontrar `process.env.GEMINI_API_KEY`.

### Como Funcionam os Workflows Encadeados

O sistema de deploy usa uma série de workflows:

1.  **`1-build-for-tests.yml`**: Constrói artefatos necessários para os testes (ex: shared code para functions).
2.  **`2-run-tests.yml`**: Executa os testes de integração usando Firebase Emulators. Se falhar, a cadeia para.
3.  **`3-build-for-deployment.yml`**: Constrói a aplicação Next.js e as Firebase Functions para produção. Gera artefatos para deploy. Só executa se os testes passarem e se for um push para a branch `main`.
4.  **`4-deploy-to-firebase.yml`**:
    *   Baixa os artefatos de produção.
    *   Autentica no Google Cloud usando Workload Identity Federation (para Functions e Rules).
    *   **Deploy do App Hosting (Next.js):** Usa a ação `firebase-tools/action-apphosting-deploy@v0` que se autentica usando o `FIREBASE_TOKEN` fornecido pelo GitHub App do Firebase App Hosting.
    *   **Deploy das Firebase Functions:** Usa `firebase deploy --only functions` com as credenciais do WIF.
    *   **Deploy das Regras do Firebase:** Usa `firebase deploy --only firestore:rules,storage:rules,database:rules` com as credenciais do WIF (os arquivos de regras são lidos da pasta `rules/` conforme `firebase.json`).

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
2.  **Prepare o diretório para deploy (se não estiver usando um backend já criado):**
    Crie um diretório (ex: `apphosting_deploy`) e copie `.next/`, `public/`, `package.json`, `package-lock.json`, `next.config.mjs`, `apphosting.yaml` para dentro dele.
3.  **Implante usando o Firebase CLI:**
    Substitua `YOUR_APP_HOSTING_BACKEND_ID` e `YOUR_REGION` (ex: `us-central1`):
    ```bash
    # Se você preparou um diretório:
    # firebase apphosting:backends:deploy YOUR_APP_HOSTING_BACKEND_ID --project electric-magnitudes-analizer --region YOUR_REGION --source apphosting_deploy/
    # Se estiver na raiz do projeto Next.js já construído:
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
3.  **Construa os arquivos compartilhados (se estiver usando a estratégia `build:shared`):**
    ```bash
    npm run build:shared
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

As regras de segurança para Firestore, Firebase Storage e Realtime Database, bem como os índices do Firestore, são cruciais. Os arquivos de regras (`firestore.rules`, `storage.rules`, `database.rules.json`) agora estão localizados na pasta `rules/` e o `firebase.json` aponta para lá.

1.  **Implante as regras e índices:**
    ```bash
    firebase deploy --only firestore,storage,database --project electric-magnitudes-analizer
    ```
    (O comando `firestore` inclui tanto `firestore:rules` quanto `firestore:indexes`. `database` cobre `database:rules`).
2.  **Verifique as regras no Firebase Console:** Após o deploy, confirme visualmente que as regras no console correspondem aos seus arquivos locais (na pasta `rules/`).
