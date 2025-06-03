
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

![Arquitetura da Aplicação](https://placehold.co/800x400.png?text=Diagrama+da+Arquitetura)
*<p align="center" data-ai-hint="architecture diagram">Diagrama da Arquitetura da Aplicação</p>*

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
    Crie um arquivo `.env` na raiz do projeto e adicione as seguintes variáveis (obtenha os valores do Firebase Console e Google AI Studio):
    ```env
    NEXT_PUBLIC_FIREBASE_API_KEY="SUA_API_KEY_DO_FIREBASE"
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="SEU_AUTH_DOMAIN_DO_FIREBASE"
    NEXT_PUBLIC_FIREBASE_PROJECT_ID="electric-magnitudes-analizer"
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="SEU_STORAGE_BUCKET_DO_FIREBASE"
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="SEU_MESSAGING_SENDER_ID_DO_FIREBASE"
    NEXT_PUBLIC_FIREBASE_APP_ID="SEU_APP_ID_DO_FIREBASE"
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="SEU_MEASUREMENT_ID_DO_FIREBASE" # Opcional
    NEXT_PUBLIC_FIREBASE_DATABASE_URL="SUA_DATABASE_URL_DO_FIREBASE" # Ex: https://electric-magnitudes-analizer-default-rtdb.firebaseio.com

    # Esta chave será usada pelos fluxos Genkit.
    # Para desenvolvimento local (Server Actions do Next.js e `genkit:dev`), defina-a no seu .env.
    # Para Firebase Functions, ela deve ser configurada como um secret no ambiente de deploy
    # (ex: via Secret Manager ou variáveis de ambiente da função, acessada como process.env.GEMINI_API_KEY).
    NEXT_PUBLIC_GEMINI_API_KEY="SUA_API_KEY_DO_GEMINI"
    ```
    **Importante:**
    * `NEXT_PUBLIC_FIREBASE_PROJECT_ID` deve ser `electric-magnitudes-analizer`.
    * `NEXT_PUBLIC_FIREBASE_DATABASE_URL` é essencial para o Realtime Database (chat).
    * `NEXT_PUBLIC_GEMINI_API_KEY` é usada pelos fluxos Genkit tanto no Next.js (para o chat) quanto nas Firebase Functions.

5.  **Domínios Autorizados no Firebase Authentication:**
    No Firebase Console (`electric-magnitudes-analizer` > Authentication > Settings > Authorized domains), adicione `localhost` e outros domínios de desenvolvimento (ex: `*.cloudworkstations.dev`).

6.  **Regras de Segurança do Firebase:**
    Revise e, se necessário, implante as regras de segurança para Firestore (`firestore.rules`), Storage (`storage.rules`) e Realtime Database (`database.rules.json`) antes de executar localmente ou testar, para garantir que os emuladores ou o projeto Firebase real tenham as permissões corretas.
    Implantação manual (se ainda não feita pelo CI/CD ou se quiser forçar uma atualização):
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

### Testando

Para rodar os testes de UI e integração (que usam os Firebase Emulators), execute:
```bash
npm test
```
Isso utilizará o script `firebase emulators:exec --import=./firebase-emulator-data jest` para executar os testes Jest em um ambiente com os emuladores ativos. Certifique-se de que as functions foram compiladas (`npm run build --prefix functions`) antes.

## Deployment

Este projeto é configurado para deploy no **Firebase App Hosting** (para a aplicação Next.js) e **Firebase Functions** (para o processamento em backend). As regras de segurança (Firestore, Storage, Realtime Database) também são implantadas.

Consulte o [**Guia de Deployment**](docs/DEPLOYMENT.md) para detalhes sobre deploy manual e automático via GitHub Actions.

## Licença

Este projeto é licenciado sob a Licença Apache, Versão 2.0. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
