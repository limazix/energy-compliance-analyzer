
# Guia de Deployment do Energy Compliance Analyzer

Este documento detalha os processos de deploy manual e automático (via GitHub Actions) para o projeto Energy Compliance Analyzer.

## Integração com Firebase

Este projeto é configurado para ser implantado no projeto Firebase `electric-magnitudes-analizer` usando o Firebase App Hosting.

### Pré-requisitos para Deploy Manual

*   Certifique-se de ter o [Firebase CLI](https://firebase.google.com/docs/cli) instalado e estar logado (`firebase login`).
*   Associe seu diretório de projeto local ao projeto `electric-magnitudes-analizer`. O arquivo `.firebaserc` incluído neste projeto define isso como padrão. Confirme com `firebase use electric-magnitudes-analizer` ou verifique com `firebase projects:list`.

### Deployment Manual da Aplicação (App Hosting)

Para implantar esta aplicação no Firebase App Hosting:

1.  **Construa sua aplicação Next.js:**
    ```bash
    npm run build
    ```

2.  **Implante usando o Firebase CLI:**
    O arquivo `apphosting.yaml` configura o backend.
    ```bash
    firebase apphosting:backends:deploy YOUR_APP_HOSTING_BACKEND_ID --project electric-magnitudes-analizer
    ```
    Substitua `YOUR_APP_HOSTING_BACKEND_ID` pelo ID do seu backend do App Hosting. Se for o primeiro deploy, o CLI pode ajudar a criar um.

Para mais detalhes, consulte a [documentação do Firebase App Hosting](https://firebase.google.com/docs/app-hosting).

### **Importante: Deployment Manual das Regras de Segurança do Firebase**

As regras de segurança para Firestore e Firebase Storage são cruciais. Elas estão definidas nos arquivos `firestore.rules` e `storage.rules`.

**Você DEVE implantar essas regras manualmente usando o Firebase CLI (se não estiver usando o deploy automático via GitHub Actions):**

1.  **Certifique-se de estar no projeto Firebase correto:**
    *   Verifique `NEXT_PUBLIC_FIREBASE_PROJECT_ID` no `.env` (deve ser `electric-magnitudes-analizer`).
    *   No terminal, defina o projeto ativo: `firebase use electric-magnitudes-analizer`.

2.  **Implante as regras:**
    ```bash
    firebase deploy --only firestore:rules,storage:rules --project electric-magnitudes-analizer
    ```

3.  **Verifique as regras no Firebase Console:** Após o deploy, vá ao Firebase Console (`electric-magnitudes-analizer`), navegue para "Firestore Database" > "Regras" e para "Storage" > "Regras". **CONFIRME VISUALMENTE** que as regras exibidas são as mesmas dos seus arquivos locais.

## Deployment Automático com GitHub Actions

Este projeto inclui um workflow de GitHub Actions (`.github/workflows/firebase-deploy.yml`) para automatizar o deploy para o Firebase.

### Configuração do GitHub Actions

1.  **Obtenha o ID do seu Backend do App Hosting:**
    *   Se você já fez deploy manual do backend do App Hosting, pode encontrar o ID no Firebase Console (App Hosting > seu backend).
    *   Se for o primeiro deploy, você pode precisar fazer um deploy manual inicial para criar o backend e obter seu ID.
    *   **Edite o arquivo `.github/workflows/firebase-deploy.yml`** e substitua o placeholder `YOUR_APP_HOSTING_BACKEND_ID` pelo ID real do seu backend.

2.  **Configurar Autenticação com Google Cloud (Workload Identity Federation - Recomendado):**
    Este método é mais seguro pois não armazena chaves de longa duração.
    *   **Crie uma Conta de Serviço no GCP:**
        *   No [Google Cloud Console](https://console.cloud.google.com/), vá para "IAM & Admin" > "Service Accounts" para o projeto `electric-magnitudes-analizer`.
        *   Crie uma nova conta de serviço (ex: `github-actions-deployer`).
        *   Conceda os seguintes papéis a esta conta de serviço:
            *   `Firebase App Hosting Admin` (roles/firebaseapphosting.admin) - Para deploy do App Hosting.
            *   `Firebase Rules System` (roles/firebaserules.system) - Para deploy das regras do Firestore/Storage.
            *   `Service Account Token Creator` (roles/iam.serviceAccountTokenCreator) - Necessário para o Workload Identity Federation.
        *   Anote o email da conta de serviço (ex: `github-actions-deployer@electric-magnitudes-analizer.iam.gserviceaccount.com`).
    *   **Configure o Workload Identity Federation:**
        *   Ainda no GCP Console, vá para "IAM & Admin" > "Workload Identity Federation".
        *   Crie um novo "Pool" (ex: `github-pool`) ou use um existente.
        *   Adicione um "Provider" a este pool. Escolha "OpenID Connect (OIDC)".
            *   **Issuer (URL):** `https://token.actions.githubusercontent.com`
            *   **Audience:** Deixe o padrão ou configure um específico se desejar.
            *   **Attribute mapping:** Mapeie `google.subject` para `assertion.sub`. O `assertion.sub` conterá informações como `repo:SEU_USUARIO_GITHUB/SEU_REPOSITORIO:ref:refs/heads/main`.
            *   **Attribute condition (opcional mas recomendado):** Limite quais repositórios ou branches podem usar esta identidade. Ex: `assertion.repository == 'SEU_USUARIO_GITHUB/SEU_REPOSITORIO'`
        *   Após criar o provider, clique nele e depois em "Grant Access". Conceda à conta de serviço criada anteriormente (ex: `github-actions-deployer`) a permissão para ser impersonada por identidades federadas que correspondem aos atributos configurados. Adicione um principal no formato: `principalSet://iam.googleapis.com/projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/<POOL_ID>/attribute.repository/<SEU_USUARIO_GITHUB>/<SEU_REPOSITORIO>` (ou outro atributo que você usou).
    *   **Adicione os Segredos ao GitHub:**
        No seu repositório GitHub, vá em "Settings" > "Secrets and variables" > "Actions" e adicione os seguintes segredos (Actions secrets):
        *   `GCP_PROJECT_NUMBER`: O número do seu projeto GCP (não o ID, mas o número. Ex: `123456789012`).
        *   `GCP_WORKLOAD_IDENTITY_POOL_ID`: O ID do seu Workload Identity Pool (ex: `github-pool`).
        *   `GCP_WORKLOAD_IDENTITY_PROVIDER_ID`: O ID do seu Provider dentro do pool (ex: `my-github-provider`).
        *   `GCP_SERVICE_ACCOUNT_EMAIL`: O email da conta de serviço que você criou (ex: `github-actions-deployer@electric-magnitudes-analizer.iam.gserviceaccount.com`).

3.  **Alternativa: Autenticação com Chave de Conta de Serviço JSON (Menos Recomendado):**
    *   **Crie uma Chave para a Conta de Serviço:**
        *   No Google Cloud Console, vá para "IAM & Admin" > "Service Accounts".
        *   Selecione a conta de serviço criada acima (ou crie uma nova com os papéis "Firebase App Hosting Admin" e "Firebase Rules System").
        *   Vá na aba "Keys", clique em "Add Key" > "Create new key". Escolha JSON e faça o download do arquivo.
    *   **Adicione o Segredo ao GitHub:**
        *   No seu repositório GitHub, vá em "Settings" > "Secrets and variables" > "Actions" e adicione um novo segredo de repositório:
            *   Nome: `FIREBASE_SERVICE_ACCOUNT_ELECTRIC_MAGNITUDES_ANALIZER`
            *   Valor: Cole o conteúdo COMPLETO do arquivo JSON da chave da conta de serviço.
        *   Se optar por este método, você precisará descomentar/ajustar as seções de autenticação no arquivo `.github/workflows/firebase-deploy.yml` para usar `FIREBASE_TOKEN` e `credentials_json`.

### Como Funciona o Workflow

*   Quando você fizer um `git push` para a branch `main` (ou a branch configurada no workflow), a Action será disparada.
*   Ela fará o build da sua aplicação Next.js.
*   Em seguida, usará o Firebase CLI para fazer o deploy do backend do App Hosting.
*   Finalmente, fará o deploy das regras do Firestore e Storage.

Consulte o arquivo `.github/workflows/firebase-deploy.yml` para a configuração exata do workflow.
