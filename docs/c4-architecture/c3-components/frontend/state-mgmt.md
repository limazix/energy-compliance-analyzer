
# C3: Componente - Gerenciamento de Estado e Lógica de UI (stateMgmt)

[<- Voltar para Componentes do Frontend](./../01-frontend-app-components.md)

## Descrição

O componente **Gerenciamento de Estado e Lógica de UI** representa a coleção de React Contexts e Custom Hooks que gerenciam o estado global da aplicação, o estado de autenticação, os dados das análises, a lógica de upload de arquivos e as notificações ao usuário.

## Responsabilidades (Comportamentos)

*   **`AuthProvider` (`contexts/auth-context.tsx`):**
    *   Gerencia o estado de autenticação do usuário em toda a aplicação.
    *   Utiliza `onAuthStateChanged` do Firebase para ouvir mudanças no estado de login.
    *   Fornece o objeto `user` (ou `null`) e o estado `loading` para os componentes filhos através do hook `useAuth`.
*   **`QueryProvider` (`contexts/query-provider.tsx`):**
    *   Configura o `QueryClient` do TanStack Query (React Query).
    *   Permite o uso do React Query para caching, refetching e gerenciamento de estado de dados do servidor, embora o uso atual seja mais focado em `onSnapshot` e Server Actions diretas. Pode ser expandido.
*   **`useAuth` (`contexts/auth-context.tsx`):**
    *   Hook customizado para consumir o `AuthContext` e acessar facilmente o `user` e `loading`.
*   **`useAnalysisManager` (`hooks/useAnalysisManager.ts`):**
    *   Centraliza a lógica de gerenciamento de análises:
        *   Busca análises passadas (`getPastAnalysesAction`).
        *   Gerencia a `currentAnalysis` selecionada.
        *   Lida com a criação e remoção de `tags` (`addTagToAction`, `removeTagAction`).
        *   Inicia o processamento de IA para uma análise (`processAnalysisFile` action, que sinaliza para a Firebase Function).
        *   Dispara a exclusão de análises (`deleteAnalysisAction`).
        *   Dispara o cancelamento de análises (`cancelAnalysisAction`).
        *   Formata o relatório estruturado para download em TXT.
        *   Calcula os `displayedAnalysisSteps` para a UI.
        *   Utiliza `onSnapshot` do Firestore para atualizações em tempo real da `currentAnalysis`.
*   **`useFileUploadManager` (`features/file-upload/hooks/useFileUploadManager.ts`):**
    *   Encapsula toda a lógica relacionada ao processo de upload de arquivos:
        *   Gerencia o estado do `fileToUpload`, `isUploading`, `uploadProgress` e `uploadError`.
        *   Lida com a seleção de arquivos.
        *   Orquestra a chamada das Server Actions relevantes: `createInitialAnalysisRecordAction`, `updateAnalysisUploadProgressAction`, `finalizeFileUploadRecordAction`, `markUploadAsFailedAction`.
*   **`useToast` (`hooks/use-toast.ts`):**
    *   Fornece uma maneira centralizada de exibir notificações (toasts) para o usuário (sucesso, erro, informação).
    *   Gerencia o estado dos toasts a serem exibidos.

## Tecnologias e Aspectos Chave

*   **React:** Context API, Custom Hooks.
*   **Firebase SDK:** `onAuthStateChanged`, `onSnapshot` (via `useAnalysisManager`).
*   **TanStack Query (React Query):** (Potencial para gerenciamento de estado de servidor, atualmente mais focado em listeners diretos).
*   **Server Actions:** Os hooks customizados (como `useAnalysisManager` e `useFileUploadManager`) interagem com Server Actions para operações de backend.
*   **ShadCN UI:** `Toast` e `Toaster` são usados pelo `useToast`.
*   **Estado Local:** Componentes individuais também usam `useState` e `useEffect` para seu estado local, complementando o estado global gerenciado pelos contextos e hooks.
