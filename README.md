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
    Você também pode criar um arquivo `.env.development` para configurações específicas de desenvolvimento.

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
*   Make sure your local project directory is associated with the `electric-magnitudes-analizer` project. The `.firebaserc` file included in this project sets this as the default. You can confirm by running `firebase use electric-magnitudes-analizer` or check with `firebase projects:list`.

### Deployment

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
```