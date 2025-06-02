
# Energy Compliance Analyzer

Este é um projeto Next.js para analisar a conformidade de dados de qualidade de energia elétrica com base nas resoluções normativas da ANEEL (Agência Nacional de Energia Elétrica) do Brasil. A aplicação permite que usuários façam upload de arquivos CSV, identifica as resoluções ANEEL pertinentes e gera um relatório de conformidade.

## Descrição do Projeto

O Energy Compliance Analyzer simplifica a verificação de conformidade para o setor elétrico, utilizando inteligência artificial (Genkit) para automatizar a análise de dados de qualidade de energia contra os regulamentos da ANEEL.

## Componentes Principais

*   **Frontend:** Next.js, React, ShadCN UI, Tailwind CSS.
*   **Backend:** Next.js Server Actions, Firebase (Authentication, Firestore, Storage).
*   **Inteligência Artificial:** Genkit & Google AI (Gemini) para identificação de resoluções e análise de conformidade.

## Arquitetura de Alto Nível

![Arquitetura da Aplicação](https://placehold.co/800x400.png?text=Diagrama+da+Arquitetura)
*<p align="center" data-ai-hint="architecture diagram">Diagrama da Arquitetura da Aplicação</p>*

## Executando Localmente

### Pré-requisitos

*   Node.js (versão 18 ou superior)
*   npm ou yarn
*   Firebase CLI instalado
*   Projeto Firebase (`electric-magnitudes-analizer`) com Authentication, Firestore e Storage habilitados.
*   Chave de API do Google AI (Gemini).

### Configuração

1.  **Clone o repositório.**
2.  **Instale as dependências:** `npm install`
3.  **Configure as variáveis de ambiente:**
    Crie um arquivo `.env` na raiz do projeto e adicione as seguintes variáveis (obtenha os valores do Firebase Console e Google AI Studio):
    ```env
    NEXT_PUBLIC_FIREBASE_API_KEY="SUA_API_KEY_DO_FIREBASE"
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="SEU_AUTH_DOMAIN_DO_FIREBASE"
    NEXT_PUBLIC_FIREBASE_PROJECT_ID="electric-magnitudes-analizer"
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="SEU_STORAGE_BUCKET_DO_FIREBASE"
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="SEU_MESSAGING_SENDER_ID_DO_FIREBASE"
    NEXT_PUBLIC_FIREBASE_APP_ID="SEU_APP_ID_DO_FIREBASE"
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="SEU_MEASUREMENT_ID_DO_FIREBASE" # Opcional
    NEXT_PUBLIC_FIREBASE_DATABASE_URL="SUA_DATABASE_URL_DO_FIREBASE" # Opcional

    # Esta chave será usada tanto pelo client-side (via next.config.js) quanto pelo server-side (Genkit)
    NEXT_PUBLIC_GEMINI_API_KEY="SUA_API_KEY_DO_GEMINI"
    ```
    **Importante:**
    * `NEXT_PUBLIC_FIREBASE_PROJECT_ID` deve ser `electric-magnitudes-analizer`.
    * `NEXT_PUBLIC_GEMINI_API_KEY` é usada pelo Genkit no servidor e também disponibilizada para o cliente se necessário. Certifique-se de que está configurada no seu ambiente de deploy (Firebase App Hosting) para as funções de servidor.

4.  **Domínios Autorizados no Firebase Authentication:**
    No Firebase Console (`electric-magnitudes-analizer` > Authentication > Settings > Authorized domains), adicione `localhost` e outros domínios de desenvolvimento (ex: `*.cloudworkstations.dev`).

### Executando a Aplicação

1.  **Inicie o servidor de desenvolvimento Next.js:**
    ```bash
    npm run dev
    ```
    Acesse em `http://localhost:9002` (ou a porta indicada).

2.  **(Opcional) Inicie o servidor de desenvolvimento Genkit:**
    Para depurar fluxos Genkit (se `src/ai/dev.ts` for usado):
    ```bash
    npm run genkit:dev
    # ou para watch mode
    # npm run genkit:watch
    ```
    Acesse a UI do Genkit em `http://localhost:4000`.

### Executando com Firebase Emulators (Recomendado)

O projeto está configurado para conectar-se aos Firebase Emulators (Auth, Firestore, Storage) quando acessado via `localhost`.

1.  **Inicie os Firebase Emulators:**
    (Em um terminal separado, na raiz do projeto)
    ```bash
    npm run emulators:start
    ```
    Isso usa `--import=./firebase-emulator-data --export-on-exit`. A Emulator UI estará em `http://localhost:4001`.

2.  **Inicie sua aplicação Next.js:**
    (Em outro terminal)
    ```bash
    npm run dev
    ```
    Acesse sua aplicação (`http://localhost:9002`). `src/lib/firebase.ts` conectará aos emuladores.

3.  **(Alternativa) Emuladores e dev server juntos com `firebase emulators:exec`:**
    O script `npm run emulators:dev` já está configurado para isso.
    ```bash
    npm run emulators:dev
    ```

## Documentação Detalhada

Para informações sobre deploy manual, configuração de CI/CD com GitHub Actions e troubleshooting avançado, consulte:

*   [**Guia de Deployment**](docs/DEPLOYMENT.md)
*   [**Guia de Troubleshooting**](docs/TROUBLESHOOTING.md)

## Licença

Este projeto é licenciado sob a Licença Apache, Versão 2.0. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

