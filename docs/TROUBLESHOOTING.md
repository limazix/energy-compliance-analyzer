
# Guia de Troubleshooting

Este documento fornece um checklist para diagnosticar e resolver erros comuns, incluindo erros de `PERMISSION_DENIED` e problemas com Firebase Functions, Realtime Database e Genkit.

## **Troubleshooting de Erros `PERMISSION_DENIED` (Firestore/Storage)**

Se você encontrar erros de `PERMISSION_DENIED` no Firestore ou Storage, siga este checklist rigorosamente:

1.  **Conteúdo das Regras Locais:**
    *   Verifique se os arquivos `rules/firestore.rules` e `rules/storage.rules` na pasta `rules/` do seu projeto contêm as regras esperadas. Por exemplo, para um cenário onde usuários só acessam seus próprios dados:
    *   **`rules/firestore.rules` esperado:**
        ```javascript
        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            // Regra para operações em um documento de análise específico
            match /users/{userId}/analyses/{analysisId} {
              allow read, write, update, delete: if request.auth != null && request.auth.uid == userId;
            }
            // Regra para operações na coleção 'analyses' de um usuário
            match /users/{userId}/analyses { // Rule for the collection
              allow list, create: if request.auth != null && request.auth.uid == userId;
            }
          }
        }
        ```
    *   **`rules/storage.rules` esperado:**
        ```javascript
        rules_version = '2';
        service firebase.storage {
          match /b/{bucket}/o {
            match /user_uploads/{userId}/{analysisId}/{allPaths=**} { // Ajustado para incluir analysisId se usado no path
              allow read, write: if request.auth != null && request.auth.uid == userId;
            }
            match /user_reports/{userId}/{analysisId}/{allPaths=**} { // Para relatórios MDX
              allow read, write: if request.auth != null && request.auth.uid == userId;
            }
          }
        }
        ```

2.  **Seleção do Projeto Firebase no CLI (para deploy manual ou local):**
    *   Execute `firebase projects:list` para ver todos os projetos associados à sua conta.
    *   Execute `firebase use electric-magnitudes-analizer` para garantir que este é o projeto ativo no CLI. Se o projeto não aparecer ou não estiver configurado como padrão (`.firebaserc`), configure-o.

3.  **Variáveis de Ambiente do App (Arquivo `.env`):**
    *   Confirme que `NEXT_PUBLIC_FIREBASE_PROJECT_ID` no seu arquivo `.env` é **EXATAMENTE** `electric-magnitudes-analizer`.
    *   Verifique as outras configurações do Firebase no `.env` (API Key, Auth Domain, etc.) e se correspondem às do projeto `electric-magnitudes-analizer` no Firebase Console.

4.  **Deployment das Regras (para deploy manual):**
    *   Execute `firebase deploy --only firestore:rules,storage:rules --project electric-magnitudes-analizer`.
    *   Observe a saída para sucesso e para confirmar que o deploy foi para o projeto `electric-magnitudes-analizer`. O CLI usará os caminhos definidos em `firebase.json` (agora apontando para a pasta `rules/`).

5.  **VERIFICAÇÃO CRÍTICA E VISUAL - Regras Ativas no Firebase Console:**
    *   Abra o Firebase Console ([console.firebase.google.com](https://console.firebase.google.com/)).
    *   Selecione o projeto `electric-magnitudes-analizer`.
    *   Vá para **Firestore Database > Aba "Regras"**. Compare o texto COMPLETO das regras exibidas aqui com o conteúdo do seu arquivo `rules/firestore.rules` local. Eles devem ser *idênticos*.
    *   Faça o mesmo para **Storage > Aba "Regras"**, comparando com seu arquivo `rules/storage.rules` local.
    *   **Se as regras no console não forem as esperadas, o deploy falhou, foi para o projeto errado, ou o deploy automático (se configurado) não está funcionando como esperado.** Este é o ponto mais comum de falha.

6.  **Logs do Servidor Next.js (e Console do Navegador):**
    *   Verifique os logs do seu servidor Next.js (console onde você executou `npm run dev`).
        *   Exemplo da action `createInitialAnalysisRecordAction` ao tentar criar um documento:
          `[Action_createInitialAnalysisRecord] Attempting to add document to Firestore. Path: 'users/USER_ID_DA_ACTION/analyses'. Data for user 'USER_ID_DA_ACTION'. Using Project ID: 'ID_DO_PROJETO_NO_SERVIDOR'`
          Confirme se o `ID_DO_PROJETO_NO_SERVIDOR` é `electric-magnitudes-analizer`.
        *   Exemplo de erro no servidor para `getPastAnalysesAction`:
          `[getPastAnalysesAction] PERMISSION_DENIED while querying path 'users/USER_ID_DA_ACTION/analyses' for userId 'USER_ID_DA_ACTION'. Check Firestore rules against active project 'ID_DO_PROJETO_NO_SERVIDOR'. Auth state in rules might be incorrect or userId mismatch. Firestore error code: [código do erro], message: [mensagem do erro]`
    *   Verifique os logs do console do navegador (DevTools). O `AuthProvider` loga o `currentUser` (ex: `[AuthProvider] Auth state changed. currentUser: {"uid":"USER_ID_DO_CLIENTE", ...}`).
    *   **CONFIRME se o `USER_ID_DA_ACTION` dos logs do servidor (tanto para criar quanto para listar) é o mesmo `USER_ID_DO_CLIENTE` que você vê no `currentUser` dos logs do navegador.** Se houver uma discrepância aqui, o `userId` sendo usado para construir o caminho no Firestore não corresponderá ao `request.auth.uid` nas regras.
    *   Confirme se o `ID_DO_PROJETO_NO_SERVIDOR` logado corresponde ao `NEXT_PUBLIC_FIREBASE_PROJECT_ID` no seu `.env` e ao projeto `electric-magnitudes-analizer` que você está configurando.

7.  **Estado de Autenticação do Usuário:**
    *   No seu aplicativo, assegure-se de que o usuário está autenticado (`user` não é `null` e `user.uid` está presente e é uma string válida e não vazia *antes* de tentar operações que exigem autenticação). O `AuthProvider` e os logs do `user.uid` devem confirmar isso.

8.  **Caminhos no Código vs. Regras:**
    *   Verifique se os caminhos que seu código está tentando acessar no Firestore/Storage (visíveis nos logs do servidor) correspondem exatamente aos caminhos definidos nas suas regras (incluindo a variável `userId` no padrão `users/{userId}/...`).

Seguir este checklist rigorosamente geralmente resolve a maioria dos problemas de `PERMISSION_DENIED`. A causa mais provável é uma inconsistência entre as regras locais, as regras efetivamente implantadas no Firebase Console, o ID do projeto configurado, ou o `userId` usado na lógica da aplicação versus o `request.auth.uid` visto pelo Firebase.

## **Troubleshooting do Firebase Realtime Database (RTDB)**

Se você tiver problemas com o chat do relatório (que usa RTDB):

1.  **Conteúdo das Regras Locais (`rules/database.rules.json`):**
    *   Verifique se `rules/database.rules.json` na pasta `rules/` do projeto permite acesso aos caminhos do chat. Exemplo:
        ```json
        {
          "rules": {
            "chats": {
              "$analysisId": {
                ".read": "auth != null", // Idealmente, restrinja mais
                ".write": "auth != null" // Idealmente, restrinja mais
              }
            }
          }
        }
        ```
    *   **Importante:** Para produção, restrinja estas regras para garantir que apenas usuários autorizados (ex: o dono da análise associada ao `analysisId`) possam ler/escrever no chat específico.

2.  **Variáveis de Ambiente (`.env`):**
    *   Confirme que `NEXT_PUBLIC_FIREBASE_DATABASE_URL` está corretamente definida no seu arquivo `.env` e aponta para o RTDB do projeto `electric-magnitudes-analizer`.
    *   Exemplo: `NEXT_PUBLIC_FIREBASE_DATABASE_URL="https://electric-magnitudes-analizer-default-rtdb.firebaseio.com"`

3.  **Deployment das Regras (para deploy manual):**
    *   Execute `firebase deploy --only database:rules --project electric-magnitudes-analizer`.
    *   Verifique a saída para confirmar o sucesso.

4.  **VERIFICAÇÃO CRÍTICA E VISUAL - Regras Ativas no Firebase Console:**
    *   Abra o Firebase Console (`electric-magnitudes-analizer`).
    *   Vá para **Realtime Database > Aba "Regras"**. Compare com seu `rules/database.rules.json` local.

5.  **Logs do Console do Navegador:**
    *   Procure por erros de conexão com o RTDB ou mensagens de "PERMISSION_DENIED" específicas do RTDB.
    *   Verifique se `rtdb` em `src/lib/firebase.ts` está sendo inicializado corretamente e se conecta ao emulador (se local) ou à produção.

## **Troubleshooting de Firebase Functions**

Se o processamento da análise em background falhar:

1.  **Logs das Functions:**
    *   **Firebase Console:** Vá para "Functions" > "Registros" (Logs) para ver os logs da sua função `processAnalysisOnUpdate` (ou o nome que você deu). Filtre por nome da função e severidade (Erro, Aviso, Info).
    *   **Emulator UI:** Se estiver usando emuladores (`http://localhost:4001`), vá para a aba "Functions" > "Logs".
    *   Procure por:
        *   Erros de inicialização (ex: Genkit não configurado, API key faltando).
        *   Erros durante a leitura do arquivo do Storage.
        *   Erros das chamadas à Genkit/IA.
        *   Erros ao escrever de volta no Firestore.
        *   Mensagens de timeout.

2.  **Configuração da API Key (Ex: `GEMINI_API_KEY`):**
    *   Para Functions implantadas, a API Key do Gemini **DEVE** ser configurada como uma variável de ambiente ou secret diretamente na configuração da função no Google Cloud Console (não no código ou `.env` do Next.js).
    *   Verifique se o código em `functions/src/processAnalysis.ts` está acessando essa variável corretamente (ex: `process.env.GEMINI_API_KEY`).
    *   Para emuladores, a função pode tentar ler de `process.env.GEMINI_API_KEY` ou `process.env.NEXT_PUBLIC_GEMINI_API_KEY` se você tiver o mesmo nome no `.env` raiz.

3.  **Timeout e Limites de Memória:**
    *   Em `firebase.json` ou na configuração de deploy, a função `processAnalysisOnUpdate` tem `timeoutSeconds` e `memory` adequados para a tarefa? Processamento de IA pode exigir mais tempo e memória. O máximo para funções acionadas por eventos de background pode ser maior que para HTTP.

4.  **Permissões da Conta de Serviço da Função:**
    *   A conta de serviço padrão das Firebase Functions tem permissões para:
        *   Ler/escrever no Firestore (nos caminhos corretos).
        *   Ler/escrever no Storage (nos caminhos corretos).
        *   Chamar os serviços de IA (Gemini).

5.  **Gatilho do Firestore (`onUpdate`):**
    *   Confirme se a função está sendo acionada quando o status de uma análise é mudado para `'summarizing_data'` (ou o status de gatilho). Verifique os logs da função para invocações.

## **Troubleshooting de Genkit / Interações com IA**

Para problemas com as chamadas à Genkit (tanto nas Server Actions do Next.js quanto nas Firebase Functions):

1.  **API Keys:**
    *   **Next.js (local/Server Actions):** A `NEXT_PUBLIC_GEMINI_API_KEY` no seu arquivo `.env` está correta e é acessada pela instância `ai` em `src/ai/genkit.ts`?
    *   **Firebase Functions:** Veja o item 2 na seção "Troubleshooting de Firebase Functions".

2.  **Erros `GenerativeAIError`:**
    *   Se a aplicação os captura e exibe (ex: no `errorMessage` da análise ou no chat), eles podem fornecer detalhes sobre o que deu errado na chamada à IA (ex: `BLOCK_REASON_SAFETY`, `INVALID_API_KEY`, etc.).
    *   Verifique os logs do servidor Next.js (para Server Actions) ou os logs das Firebase Functions.

3.  **Cotas de API:**
    *   Verifique no Google AI Studio ou Google Cloud Console se você atingiu as cotas de uso da API Gemini.

4.  **Verificar Fluxos com `genkit:dev`:**
    *   Use `npm run genkit:dev` (ou `genkit:watch`) para iniciar a UI de desenvolvimento da Genkit.
    *   Teste seus fluxos (especialmente o `orchestrateReportInteractionFlow` e os da pipeline de análise) diretamente na UI da Genkit para isolar se o problema está no fluxo em si ou na forma como ele é chamado.

5.  **Prompt Engineering:**
    *   Se as respostas da IA não são as esperadas, revise os prompts em `src/ai/prompt-configs/`. Eles estão claros? Estão guiando a IA corretamente? O schema de saída está bem definido?

Lembre-se de sempre verificar os logs primeiro, pois eles geralmente contêm as pistas mais diretas sobre o que está acontecendo.
