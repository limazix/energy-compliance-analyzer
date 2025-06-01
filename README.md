
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
*   Um projeto Firebase criado com Authentication, Firestore e Storage habilitados.
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
    Crie um arquivo `.env` na raiz do projeto e adicione as seguintes variáveis com seus respectivos valores obtidos do Firebase Console e do Google AI Studio:

    ```env
    NEXT_PUBLIC_FIREBASE_API_KEY="SUA_API_KEY_DO_FIREBASE"
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="SEU_AUTH_DOMAIN_DO_FIREBASE"
    NEXT_PUBLIC_FIREBASE_PROJECT_ID="SEU_PROJECT_ID_DO_FIREBASE"
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="SEU_STORAGE_BUCKET_DO_FIREBASE"
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="SEU_MESSAGING_SENDER_ID_DO_FIREBASE"
    NEXT_PUBLIC_FIREBASE_APP_ID="SEU_APP_ID_DO_FIREBASE"
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="SEU_MEASUREMENT_ID_DO_FIREBASE" # Opcional, se usar Analytics
    NEXT_PUBLIC_FIREBASE_DATABASE_URL="SUA_DATABASE_URL_DO_FIREBASE" # Para Realtime Database, se usado. Para Firestore, não é estritamente necessário aqui.

    NEXT_PUBLIC_GEMINI_API_KEY="SUA_API_KEY_DO_GEMINI"
    ```
    **MUITO IMPORTANTE PARA EVITAR ERROS DE PERMISSÃO:** Certifique-se de que `NEXT_PUBLIC_FIREBASE_PROJECT_ID` corresponde **EXATAMENTE** ao ID do projeto Firebase para o qual você implantará as regras de segurança. Uma incompatibilidade aqui é a causa mais comum de erros de `PERMISSION_DENIED`. Verifique o ID do seu projeto no Firebase Console (geralmente visível na URL ou nas Configurações do Projeto).

4.  **Configure os Domínios Autorizados no Firebase Authentication:**
    No console do Firebase, vá em "Authentication" > "Settings" > "Authorized domains" e adicione `localhost`. Se estiver usando o Firebase Studio ou outro ambiente de desenvolvimento em nuvem, adicione os respectivos domínios (ex: `*.cloudworkstations.dev`).

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

### Pré-requisitos para Deploy

*   Ensure you have the [Firebase CLI](https://firebase.google.com/docs/cli) installed and you are logged in (`firebase login`).
*   Make sure your local project directory is associated with the `electric-magnitudes-analizer` project. The `.firebaserc` file included in this project sets this as the default. You can confirm by running `firebase use electric-magnitudes-analizer` ou verificar com `firebase projects:list`. Se não estiver correto, use `firebase use SEU_PROJECT_ID_CORRETO`.

### Deployment da Aplicação (App Hosting)

To deploy this application to Firebase App Hosting:

1.  **Build your Next.js application:**
    ```bash
    npm run build
    ```

2.  **Deploy using the Firebase CLI:**
    The `apphosting.yaml` file configures the backend.
    ```bash
    firebase apphosting:backends:deploy
    ```
    The CLI will guide you to select or create a backend resource within your `electric-magnitudes-analizer` project.

    Alternatively, if you have a specific backend ID:
    ```bash
    firebase apphosting:backends:deploy YOUR_BACKEND_ID --project electric-magnitudes-analizer
    ```

For more details, refer to the [Firebase App Hosting documentation](https://firebase.google.com/docs/app-hosting).

### **Importante: Deployment das Regras de Segurança do Firebase**

As regras de segurança para Firestore e Firebase Storage são cruciais para o funcionamento correto das permissões. Elas estão definidas nos arquivos `firestore.rules` e `storage.rules` na raiz do projeto.

**Você DEVE implantar essas regras manualmente usando o Firebase CLI:**

1.  **Certifique-se de estar no projeto Firebase correto:**
    *   Verifique o ID do projeto no seu arquivo `.env` (`NEXT_PUBLIC_FIREBASE_PROJECT_ID`). O valor aqui DEVE SER IDÊNTICO ao ID do projeto que você vê no Firebase Console.
    *   No terminal, defina o projeto ativo do Firebase CLI:
        ```bash
        firebase use SEU_PROJECT_ID_CORRETO  # Substitua pelo ID do seu projeto (ex: electric-magnitudes-analizer)
        ```
    *   Você pode verificar o projeto ativo com `firebase projects:list`. Se o projeto ativo no CLI não for o mesmo que o seu app está usando (definido em `.env`), as regras serão implantadas no lugar errado, resultando em erros de `PERMISSION_DENIED`.

2.  **Implante as regras do Firestore:**
    ```bash
    firebase deploy --only firestore:rules
    ```

3.  **Implante as regras do Firebase Storage:**
    ```bash
    firebase deploy --only storage:rules
    ```

    Ou para implantar ambas de uma vez:
    ```bash
    firebase deploy --only firestore,storage
    ```

4.  **Verifique as regras no Firebase Console:** Após o deploy, vá ao Firebase Console, selecione seu projeto, e navegue para "Firestore Database" > "Regras" e para "Storage" > "Regras". **CONFIRME VISUALMENTE** que as regras exibidas no console são as mesmas que estão nos seus arquivos `firestore.rules` e `storage.rules` locais. Se um erro de `PERMISSION_DENIED` persistir, a causa mais provável é uma dessas:
    *   As regras no console não são as esperadas (o deploy falhou ou foi para o projeto errado).
    *   O `NEXT_PUBLIC_FIREBASE_PROJECT_ID` no seu `.env` não corresponde ao ID do projeto onde as regras foram implantadas.

## **Troubleshooting de Erros `PERMISSION_DENIED`**

Se você encontrar erros de `PERMISSION_DENIED` no Firestore ou Storage, siga este checklist rigorosamente:

1.  **Conteúdo das Regras Locais:**
    *   Verifique se o arquivo `firestore.rules` na raiz do seu projeto contém as regras esperadas (por exemplo, `allow read, write: if request.auth != null && request.auth.uid == userId;` para o caminho relevante, ou as versões mais granulares para `list`, `create`, `get`, `update`, `delete`).
    *   Verifique se o arquivo `storage.rules` na raiz do seu projeto contém as regras esperadas (por exemplo, `allow write: if request.auth != null && request.auth.uid == userId;` para o caminho de upload).

2.  **Seleção do Projeto Firebase no CLI:**
    *   Execute `firebase projects:list` no terminal para ver seus projetos e qual está ativo.
    *   Execute `firebase use SEU_ID_DE_PROJETO_CORRETO` (substitua pelo ID do projeto que você está usando para este app, ex: `electric-magnitudes-analizer`). Este deve ser o mesmo projeto configurado no app.

3.  **Variáveis de Ambiente do App (Arquivo `.env`):**
    *   Confirme que `NEXT_PUBLIC_FIREBASE_PROJECT_ID` no seu arquivo `.env` é **EXATAMENTE** o mesmo ID do projeto que você selecionou no passo anterior e para o qual as regras serão implantadas. Qualquer diferença, incluindo letras maiúsculas/minúsculas ou espaços extras, causará erros de permissão.
    *   Verifique também `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` e outras configurações do Firebase no `.env`. Elas devem corresponder às configurações do projeto Firebase correto.

4.  **Deployment das Regras:**
    *   Execute `firebase deploy --only firestore:rules`.
    *   Execute `firebase deploy --only storage:rules`.
    *   Observe a saída dos comandos no terminal. Eles devem indicar sucesso e para qual projeto as regras foram implantadas. Certifique-se de que não há mensagens de erro durante o deploy.

5.  **VERIFICAÇÃO CRÍTICA E VISUAL - Regras Ativas no Firebase Console:**
    *   Abra o Firebase Console ([console.firebase.google.com](https://console.firebase.google.com/)).
    *   Selecione o projeto correto (o mesmo ID que está no seu `.env` e que você usou com `firebase use`).
    *   Vá para **Firestore Database > Aba "Regras"**.
    *   **Compare o texto COMPLETO das regras exibidas aqui, linha por linha, com o conteúdo do seu arquivo `firestore.rules` local.** Eles devem ser *idênticos*. Se não forem, o deploy não atualizou as regras como esperado, ou você está olhando para o projeto errado.
    *   Faça o mesmo para **Storage > Aba "Regras"**, comparando com seu arquivo `storage.rules` local.

6.  **Logs do Servidor Next.js (e Console do Navegador):**
    *   Verifique os logs do seu servidor Next.js (console onde você executou `npm run dev`). As Server Actions já possuem logs que indicam o `userId` (aparado de espaços), o caminho que estão tentando acessar, e o `PROJECT_ID` que o servidor acredita estar usando.
        *   Exemplo de log da action `getPastAnalysesAction`: `[getPastAnalysesAction] Attempting to query Firestore collection at path: 'users/USER_ID_AQUI/analyses' for userId: 'USER_ID_AQUI' (Project: 'SEU_PROJECT_ID_AQUI')`
        *   Se um erro de permissão do Firestore ocorrer na action, ela logará: `[getPastAnalysesAction] PERMISSION_DENIED while querying path 'users/USER_ID_AQUI/analyses' for userId: 'USER_ID_AQUI'. ... Firestore error code: 7 ...`
    *   Verifique os logs do console do navegador (DevTools). O `AuthProvider` loga o `currentUser` (ex: `[AuthProvider] Auth state changed. currentUser: {"uid":"USER_ID_DO_CLIENTE", ...}`).
    *   **Confirme se o `USER_ID_AQUI` dos logs do servidor (usado pela action) é o mesmo `USER_ID_DO_CLIENTE` que você vê no `currentUser` dos logs do navegador.** Uma incompatibilidade aqui indica um problema na forma como o estado de autenticação está sendo passado ou interpretado.
    *   Confirme se o `SEU_PROJECT_ID_AQUI` nos logs do servidor corresponde ao projeto correto.

7.  **Estado de Autenticação do Usuário:**
    *   No seu aplicativo, assegure-se de que o usuário está autenticado (`user` não é `null` e `user.uid` está presente e é uma string válida) *antes* de tentar operações que exigem autenticação. O `AuthProvider` e os hooks `useAuth`, `useFileUploadManager`, `useAnalysisManager` já possuem logs e verificações para isso.

8.  **Caminhos no Código vs. Regras:**
    *   Verifique se os caminhos que seu código está tentando acessar no Firestore/Storage (visíveis nos logs do servidor) correspondem exatamente aos caminhos definidos nas suas regras (incluindo a variável `userId`).

Seguir este checklist rigorosamente geralmente resolve a maioria dos problemas de `PERMISSION_DENIED`. Se o problema persistir após uma verificação minuciosa de todos esses pontos, a causa pode ser mais sutil e exigir uma investigação mais profunda do estado de autenticação, da propagação das credenciais para as Server Actions, ou da configuração específica do projeto Firebase.

## Licença

Este projeto é licenciado sob a Licença Apache, Versão 2.0. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
