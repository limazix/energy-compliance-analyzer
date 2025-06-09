
# C3: Componente - Cliente Firebase (firebaseClient)

[<- Voltar para Componentes do Frontend](./../01-frontend-app-components.md)

## Descrição

O **Cliente Firebase** (`src/lib/firebase.ts`) é o módulo responsável pela inicialização e configuração do Firebase SDK para o lado do cliente (navegador). Ele fornece as instâncias dos serviços Firebase (Auth, Firestore, Storage, Realtime Database) que são usadas em toda a aplicação frontend.

## Responsabilidades (Comportamentos)

*   **Inicialização da Aplicação Firebase:**
    *   Lê a configuração do Firebase (API Key, Project ID, etc.) a partir das variáveis de ambiente (`NEXT_PUBLIC_FIREBASE_CONFIG`).
    *   Inicializa a aplicação Firebase usando `initializeApp()`, garantindo que isso aconteça apenas uma vez.
*   **Fornecimento de Instâncias de Serviço Firebase:**
    *   Obtém e exporta as instâncias dos serviços Firebase necessários:
        *   `auth = getAuth(app)`
        *   `db = getFirestore(app)` (para Firestore)
        *   `storage = getStorage(app)` (para Firebase Storage)
        *   `rtdb = getDatabase(app)` (para Firebase Realtime Database)
    *   Exporta o `googleProvider` para ser usado com o Google Sign-In.
*   **Conexão com Emuladores (em desenvolvimento):**
    *   Invoca a função `connectEmulators` (de `src/lib/emulators.ts`) para conectar os SDKs aos Firebase Emulators quando a aplicação está rodando em ambiente de desenvolvimento local (`localhost`).
    *   Isso permite testar a integração com Firebase sem usar os serviços de produção.
*   **Validação da Configuração:**
    *   Inclui verificações para garantir que a string de configuração do Firebase (`NEXT_PUBLIC_FIREBASE_CONFIG`) está presente e é um JSON válido, e que campos essenciais como `apiKey` e `projectId` existem. Lança erros críticos se a configuração estiver ausente ou malformada.

## Tecnologias e Aspectos Chave

*   **Firebase SDK (Cliente):**
    *   `firebase/app`: `initializeApp`, `getApps`, `getApp`.
    *   `firebase/auth`: `getAuth`, `GoogleAuthProvider`.
    *   `firebase/firestore`: `getFirestore`.
    *   `firebase/storage`: `getStorage`.
    *   `firebase/database`: `getDatabase`.
*   **Variáveis de Ambiente Next.js:** A configuração do Firebase é fornecida através de `process.env.NEXT_PUBLIC_FIREBASE_CONFIG`.
*   **Emuladores Firebase:** Lógica para conectar aos emuladores (`connectAuthEmulator`, `connectFirestoreEmulator`, `connectStorageEmulator`, `connectDatabaseEmulator`) em `src/lib/emulators.ts`.
*   **Segurança:** A configuração do Firebase exposta ao cliente (`NEXT_PUBLIC_FIREBASE_CONFIG`) contém apenas informações não sensíveis necessárias para a inicialização do SDK. A segurança real dos dados é imposta pelas Regras de Segurança do Firebase (Firestore, Storage, RTDB) e pela lógica de backend (Server Actions, Firebase Functions).
