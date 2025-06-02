
# Guia de Troubleshooting

Este documento fornece um checklist para diagnosticar e resolver erros comuns, especialmente erros de `PERMISSION_DENIED` no Firestore ou Storage.

## **Troubleshooting de Erros `PERMISSION_DENIED`**

Se você encontrar erros de `PERMISSION_DENIED` no Firestore ou Storage, siga este checklist rigorosamente:

1.  **Conteúdo das Regras Locais:**
    *   Verifique se os arquivos `firestore.rules` e `storage.rules` na raiz do seu projeto contêm as regras esperadas. Por exemplo, para um cenário onde usuários só acessam seus próprios dados:
    *   **`firestore.rules` esperado:**
        ```javascript
        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            // Regra para operações em um documento de análise específico
            match /users/{userId}/analyses/{analysisId} {
              allow get, update, delete: if request.auth != null && request.auth.uid == userId;
            }
            // Regra para operações na coleção 'analyses' de um usuário
            match /users/{userId}/analyses { // Rule for the collection
              allow list, create: if request.auth != null && request.auth.uid == userId;
            }
          }
        }
        ```
    *   **`storage.rules` esperado:**
        ```javascript
        rules_version = '2';
        service firebase.storage {
          match /b/{bucket}/o {
            match /user_uploads/{userId}/{allPaths=**} { // Cobre arquivos e pastas
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
    *   Observe a saída para sucesso e para confirmar que o deploy foi para o projeto `electric-magnitudes-analizer`.

5.  **VERIFICAÇÃO CRÍTICA E VISUAL - Regras Ativas no Firebase Console:**
    *   Abra o Firebase Console ([console.firebase.google.com](https://console.firebase.google.com/)).
    *   Selecione o projeto `electric-magnitudes-analizer`.
    *   Vá para **Firestore Database > Aba "Regras"**. Compare o texto COMPLETO das regras exibidas aqui com o conteúdo do seu arquivo `firestore.rules` local. Eles devem ser *idênticos*.
    *   Faça o mesmo para **Storage > Aba "Regras"**, comparando com seu arquivo `storage.rules` local.
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

Seguir este checklist rigorosamente geralmente resolve a maioria dos problemas de `PERMISSION_DENIED`. A causa mais provável é uma inconsistência entre as regras locais, as regras efetivamente implantadas no Firebase Console, o ID do projeto configurado, ou o `userId` usado na lógica da aplicação versus o `request.auth.uid` visto pelo Firestore.
