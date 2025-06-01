
# Energy Compliance Analyzer

Este é um projeto Next.js para analisar a conformidade de dados de qualidade de energia elétrica com base nas resoluções normativas da ANEEL (Agência Nacional de Energia Elétrica) do Brasil. A aplicação permite que usuários façam upload de arquivos CSV contendo dados de medição, identifica as resoluções ANEEL pertinentes e gera um relatório de conformidade, destacando possíveis violações e oferecendo recomendações.

## Descrição do Projeto

O Energy Compliance Analyzer visa simplificar o processo de verificação de conformidade para empresas do setor elétrico, consultores e engenheiros. Utilizando inteligência artificial (Genkit), a ferramenta automatiza a análise de grandes volumes de dados de qualidade de energia, comparando-os com os complexos regulamentos da ANEEL. Isso economiza tempo, reduz erros manuais e fornece insights valiosos para a manutenção e otimização da rede elétrica.

## Componentes Principais

O sistema é composto pelas seguintes partes principais:

*   **Frontend (Next.js & React):** Interface de usuário moderna e responsiva construída com Next.js, React, ShadCN UI e Tailwind CSS. Permite o login de usuários, upload de arquivos, visualização do progresso da análise e consulta aos relatórios gerados.
*   **Backend (Next.js Server Actions & Firebase):**
    *   **Server Actions:** Utilizadas para interações com o backend, como upload de arquivos e gerenciamento de análises, sem a necessidade de criar endpoints de API explícitos.
    *   **Firebase Authentication:** Gerencia a autenticação de usuários via Google.
    *   **Firestore:** Banco de dados NoSQL para armazenar informações sobre as análises dos usuários, metadados dos arquivos, relatórios gerados e tags.
    *   **Firebase Storage:** Armazena os arquivos CSV de dados de qualidade de energia enviados pelos usuários.
*   **Inteligência Artificial (Genkit & Google AI):**
    *   **Genkit Flows:** Orquestram as chamadas aos modelos de IA.
    *   **`identifyAEEEResolutionsFlow`**: Um fluxo que recebe os dados de qualidade de energia e utiliza um modelo de linguagem para identificar as resoluções normativas da ANEEL relevantes.
    *   **`analyzeComplianceReportFlow`**: Um fluxo que recebe os dados de qualidade de energia e as resoluções identificadas, utilizando um modelo de linguagem para gerar um sumário e um relatório detalhado de conformidade.
*   **Banco de Dados (Firestore):** Persiste os dados do usuário, informações sobre as análises, arquivos enviados e relatórios gerados.

## Arquitetura de Alto Nível

A imagem abaixo ilustra a arquitetura geral da aplicação:

![Arquitetura da Aplicação](https://placehold.co/800x400.png?text=Diagrama+da+Arquitetura)
*<p align="center" data-ai-hint="architecture diagram">Diagrama da Arquitetura da Aplicação</p>*

## Executando Localmente

Para executar o projeto localmente, siga os passos abaixo:

### Pré-requisitos

*   Node.js (versão 18 ou superior recomendada)
*   npm ou yarn
*   Firebase CLI instalado e configurado (veja a seção de Integração com Firebase)
*   Um projeto Firebase criado com Authentication, Firestore e Storage habilitados (`electric-magnitudes-analizer`).
*   Uma chave de API do Google AI (Gemini) para as funcionalidades de Genkit.

### Configuração

1.  **Clone o repositório:**
    ```bash
    git clone <URL_DO_REPOSITORIO>
    cd <NOME_DA_PASTA_DO_PROJETO>
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    # ou
    # yarn install
    ```

3.  **Configure as variáveis de ambiente:**
    Crie um arquivo `.env` na raiz do projeto e adicione as seguintes variáveis com seus respectivos valores obtidos do Firebase Console (para o projeto `electric-magnitudes-analizer`) e do Google AI Studio:

    ```env
    NEXT_PUBLIC_FIREBASE_API_KEY="SUA_API_KEY_DO_FIREBASE"
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="SEU_AUTH_DOMAIN_DO_FIREBASE"
    NEXT_PUBLIC_FIREBASE_PROJECT_ID="electric-magnitudes-analizer" # MUITO IMPORTANTE
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="SEU_STORAGE_BUCKET_DO_FIREBASE"
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="SEU_MESSAGING_SENDER_ID_DO_FIREBASE"
    NEXT_PUBLIC_FIREBASE_APP_ID="SEU_APP_ID_DO_FIREBASE"
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="SEU_MEASUREMENT_ID_DO_FIREBASE" # Opcional
    NEXT_PUBLIC_FIREBASE_DATABASE_URL="SUA_DATABASE_URL_DO_FIREBASE" # Opcional

    NEXT_PUBLIC_GEMINI_API_KEY="SUA_API_KEY_DO_GEMINI"
    ```
    **MUITO IMPORTANTE PARA EVITAR ERROS DE PERMISSÃO:** Certifique-se de que `NEXT_PUBLIC_FIREBASE_PROJECT_ID` está definido como `electric-magnitudes-analizer`.

4.  **Configure os Domínios Autorizados no Firebase Authentication:**
    No console do Firebase (projeto `electric-magnitudes-analizer`), vá em "Authentication" > "Settings" > "Authorized domains" e adicione `localhost`. Se estiver usando o Firebase Studio ou outro ambiente de desenvolvimento em nuvem, adicione os respectivos domínios (ex: `*.cloudworkstations.dev`).

### Executando a Aplicação

1.  **Inicie o servidor de desenvolvimento do Next.js (com Turbopack):**
    ```bash
    npm run dev
    ```
    Isso geralmente iniciará a aplicação em `http://localhost:9002`.

2.  **(Opcional) Inicie o servidor de desenvolvimento do Genkit (para depuração de fluxos):**
    Se você precisar depurar ou testar os fluxos do Genkit separadamente, pode executar:
    ```bash
    npm run genkit:dev
    # ou para watch mode
    # npm run genkit:watch
    ```
    Isso iniciará a UI de desenvolvimento do Genkit, normalmente em `http://localhost:4000`.

## Integração com Firebase

Este projeto é configurado para ser implantado no projeto Firebase `electric-magnitudes-analizer` usando o Firebase App Hosting.

### Pré-requisitos para Deploy Manual

*   Ensure you have the [Firebase CLI](https://firebase.google.com/docs/cli) installed and you are logged in (`firebase login`).
*   Make sure your local project directory is associated with the `electric-magnitudes-analizer` project. O arquivo `.firebaserc` incluído neste projeto define isso como padrão. Confirme com `firebase use electric-magnitudes-analizer` ou verifique com `firebase projects:list`.

### Deployment Manual da Aplicação (App Hosting)

To deploy this application to Firebase App Hosting:

1.  **Build your Next.js application:**
    ```bash
    npm run build
    ```

2.  **Deploy using the Firebase CLI:**
    The `apphosting.yaml` file configures the backend.
    ```bash
    firebase apphosting:backends:deploy YOUR_APP_HOSTING_BACKEND_ID --project electric-magnitudes-analizer
    ```
    Substitua `YOUR_APP_HOSTING_BACKEND_ID` pelo ID do seu backend do App Hosting. Se for o primeiro deploy, o CLI pode ajudar a criar um.

For more details, refer to the [Firebase App Hosting documentation](https://firebase.google.com/docs/app-hosting).

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
    *   Se for o primeiro deploy, você pode precisar fazer um deploy manual inicial para criar o backend e obter seu ID, ou o CLI pode criá-lo durante o primeiro deploy via Actions se você remover `YOUR_APP_HOSTING_BACKEND_ID` do comando `apphosting:backends:deploy` no workflow (o CLI tentará guiá-lo, o que pode não ser ideal para CI puro, mas pode funcionar).
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

## **Troubleshooting de Erros `PERMISSION_DENIED`**

Se você encontrar erros de `PERMISSION_DENIED` no Firestore ou Storage, siga este checklist rigorosamente:

1.  **Conteúdo das Regras Locais:**
    *   Verifique se os arquivos `firestore.rules` e `storage.rules` na raiz do seu projeto contêm as regras esperadas.

2.  **Seleção do Projeto Firebase no CLI (para deploy manual ou local):**
    *   Execute `firebase projects:list` e `firebase use electric-magnitudes-analizer`.

3.  **Variáveis de Ambiente do App (Arquivo `.env`):**
    *   Confirme que `NEXT_PUBLIC_FIREBASE_PROJECT_ID` no seu arquivo `.env` é **EXATAMENTE** `electric-magnitudes-analizer`.
    *   Verifique as outras configurações do Firebase no `.env`.

4.  **Deployment das Regras (para deploy manual):**
    *   Execute `firebase deploy --only firestore:rules,storage:rules --project electric-magnitudes-analizer`.
    *   Observe a saída para sucesso e o projeto correto.

5.  **VERIFICAÇÃO CRÍTICA E VISUAL - Regras Ativas no Firebase Console:**
    *   Abra o Firebase Console ([console.firebase.google.com](https://console.firebase.google.com/)).
    *   Selecione o projeto `electric-magnitudes-analizer`.
    *   Vá para **Firestore Database > Aba "Regras"**. Compare o texto COMPLETO das regras exibidas aqui com o conteúdo do seu arquivo `firestore.rules` local. Eles devem ser *idênticos*.
    *   Faça o mesmo para **Storage > Aba "Regras"**, comparando com seu arquivo `storage.rules` local. Se as regras no console não forem as esperadas, o deploy falhou, foi para o projeto errado, ou o deploy automático (se configurado) não está funcionando como esperado.

6.  **Logs do Servidor Next.js (e Console do Navegador):**
    *   Verifique os logs do seu servidor Next.js (console onde você executou `npm run dev`).
        *   Exemplo da action `createInitialAnalysisRecordAction`: `[Action_createInitialAnalysisRecord] Attempting to add document to Firestore. Path: 'users/USER_ID_AQUI/analyses'. Data for user 'USER_ID_AQUI'. Project: 'electric-magnitudes-analizer'`
        *   Exemplo de erro: `[Action_createInitialAnalysisRecord] PERMISSION_DENIED ao tentar criar documento para userId: 'USER_ID_AQUI' ...`
        *   Exemplo de `getPastAnalysesAction`: `[getPastAnalysesAction] Attempting to query Firestore collection at path: 'users/USER_ID_AQUI/analyses' for userId: 'USER_ID_AQUI' (Project: 'electric-magnitudes-analizer')`
    *   Verifique os logs do console do navegador (DevTools). O `AuthProvider` loga o `currentUser` (ex: `[AuthProvider] Auth state changed. currentUser: {"uid":"USER_ID_DO_CLIENTE", ...}`).
    *   **Confirme se o `USER_ID_AQUI` dos logs do servidor é o mesmo `USER_ID_DO_CLIENTE` que você vê no `currentUser` dos logs do navegador.**
    *   Confirme se o `electric-magnitudes-analizer` nos logs do servidor corresponde ao projeto correto.

7.  **Estado de Autenticação do Usuário:**
    *   No seu aplicativo, assegure-se de que o usuário está autenticado (`user` não é `null` e `user.uid` está presente e é uma string válida) *antes* de tentar operações que exigem autenticação.

8.  **Caminhos no Código vs. Regras:**
    *   Verifique se os caminhos que seu código está tentando acessar no Firestore/Storage (visíveis nos logs do servidor) correspondem exatamente aos caminhos definidos nas suas regras (incluindo a variável `userId`).

Seguir este checklist rigorosamente geralmente resolve a maioria dos problemas de `PERMISSION_DENIED`.

## Licença

Este projeto é licenciado sob a Licença Apache, Versão 2.0. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
