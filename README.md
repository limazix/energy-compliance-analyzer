
# Energy Compliance Analyzer

Este é um projeto Next.js para analisar a conformidade de dados de qualidade de energia elétrica com base nas resoluções normativas da ANEEL (Agência Nacional de Energia Elétrica) do Brasil. A aplicação permite que usuários façam upload de arquivos CSV, identifica as resoluções ANEEL pertinentes e gera um relatório de conformidade. O processamento pesado dos dados é realizado por Firebase Functions.

## Descrição do Projeto

O Energy Compliance Analyzer simplifica a verificação de conformidade para o setor elétrico, utilizando inteligência artificial (Genkit) para automatizar a análise de dados de qualidade de energia contra os regulamentos da ANEEL.

## Componentes Principais

*   **Frontend:** Next.js, React, ShadCN UI, Tailwind CSS.
*   **Backend (API & Gatilhos):** Next.js Server Actions (para interações com o frontend e disparar processos).
*   **Processamento em Background:** Firebase Functions (Node.js, TypeScript) para análise de dados e IA.
*   **Inteligência Artificial:** Genkit & Google AI (Gemini) para identificação de resoluções e análise de conformidade, executado dentro das Firebase Functions.
*   **Banco de Dados e Storage:** Firebase (Authentication, Firestore, Storage).
*   **Hosting:** Firebase App Hosting para a aplicação Next.js.

## Arquitetura de Alto Nível

![Arquitetura da Aplicação](https://placehold.co/800x400.png?text=Diagrama+da+Arquitetura)
*<p align="center" data-ai-hint="architecture diagram">Diagrama da Arquitetura da Aplicação</p>*

## Executando Localmente

### Pré-requisitos

*   Node.js (versão 20 ou superior)
*   npm ou yarn
*   Firebase CLI instalado (`npm install -g firebase-tools`)
*   Projeto Firebase (`electric-magnitudes-analizer`) com Authentication, Firestore e Storage habilitados.
*   Chave de API do Google AI (Gemini).

### Configuração

1.  **Clone o repositório.**
2.  **Instale as dependências do Next.js:** `npm install`
3.  **Instale as dependências das Firebase Functions:** `cd functions && npm install && cd ..`
4.  **Configure as variáveis de ambiente:**
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

    # Esta chave será usada pelo Genkit nas Firebase Functions
    # Configure-a também como secret nas suas Firebase Functions no GCP.
    # Para desenvolvimento local das Functions, elas podem tentar ler de process.env.GEMINI_API_KEY
    # ou process.env.NEXT_PUBLIC_GEMINI_API_KEY (se você definir GEMINI_API_KEY no ambiente das functions
    # ou usar a mesma do Next.js para conveniência local).
    NEXT_PUBLIC_GEMINI_API_KEY="SUA_API_KEY_DO_GEMINI"
    ```
    **Importante:**
    * `NEXT_PUBLIC_FIREBASE_PROJECT_ID` deve ser `electric-magnitudes-analizer`.
    * `NEXT_PUBLIC_GEMINI_API_KEY` é essencial para as Firebase Functions. Configure-a como secret no ambiente de deploy das Functions.

5.  **Domínios Autorizados no Firebase Authentication:**
    No Firebase Console (`electric-magnitudes-analizer` > Authentication > Settings > Authorized domains), adicione `localhost` e outros domínios de desenvolvimento (ex: `*.cloudworkstations.dev`).

### Executando a Aplicação com Emuladores (Recomendado)

O projeto está configurado para conectar-se aos Firebase Emulators (Auth, Firestore, Storage, Functions) quando acessado via `localhost`.

1.  **Compile as Firebase Functions (necessário para o emulador de Functions):**
    ```bash
    npm run build --prefix functions
    ```
2.  **Inicie os Firebase Emulators:**
    (Em um terminal separado, na raiz do projeto)
    ```bash
    npm run emulators:start 
    ```
    Isso usa `--import=./firebase-emulator-data --export-on-exit`. A Emulator UI estará em `http://localhost:4001`.

3.  **Inicie sua aplicação Next.js:**
    (Em outro terminal)
    ```bash
    npm run dev
    ```
    Acesse sua aplicação (`http://localhost:9002`). `src/lib/firebase.ts` conectará aos emuladores. A aplicação Next.js acionará as Functions (rodando no emulador) através de escritas no Firestore.

4.  **(Alternativa) Emuladores e dev server juntos com `firebase emulators:exec`:**
    O script `npm run emulators:dev` já está configurado para isso (ele compila as functions e depois roda o dev server do Next.js com os emuladores).
    ```bash
    npm run emulators:dev
    ```

## Deployment

Este projeto é configurado para deploy no **Firebase App Hosting** (para a aplicação Next.js) e **Firebase Functions** (para o processamento em backend).

Consulte o [**Guia de Deployment**](docs/DEPLOYMENT.md) para detalhes sobre deploy manual e automático via GitHub Actions.

## Licença

Este projeto é licenciado sob a Licença Apache, Versão 2.0. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
```