
# C3: Componente - Componentes de Autenticação (authUI)

[<- Voltar para Componentes do Frontend](./../01-frontend-app-components.md)

## Descrição

Os **Componentes de Autenticação** são responsáveis por toda a interface e lógica do lado do cliente relacionada à autenticação do usuário. Isso inclui botões de login/logout, exibição de informações do perfil do usuário e a integração com o `AuthProvider` para refletir o estado de autenticação.

## Responsabilidades (Comportamentos)

*   **Interface de Login/Logout:**
    *   Fornece o botão "Entrar com Google" (parte do `AuthButton`) para iniciar o fluxo de login.
    *   Exibe o avatar do usuário, nome e um menu dropdown com a opção "Sair" (parte do `AuthButton`) quando o usuário está autenticado.
*   **Exibição de Perfil (Simplificada):**
    *   Mostra o nome de exibição e o e-mail do usuário no menu dropdown do `AuthButton`.
*   **Interação com `AuthProvider`:**
    *   Utiliza o hook `useAuth` (do `AuthProvider`) para obter o estado atual do usuário (logado/não logado, carregando).
    *   Dispara ações de login (via `signInWithPopup`) e logout (via `signOut`) do Firebase SDK.
*   **Redirecionamento (Implícito):**
    *   Indiretamente, as ações de login/logout bem-sucedidas geralmente levam a redirecionamentos gerenciados pelas páginas (ex: `LoginPage` redireciona para `/` após login, `AuthButton` redireciona para `/login` após logout).

## Tecnologias e Aspectos Chave

*   **React Components:** (`AuthButton.tsx`, potencialmente outros componentes de UI relacionados ao perfil).
*   **Firebase SDK (Auth):** `signInWithPopup`, `signOut`, `GoogleAuthProvider`.
*   **Hooks:** `useAuth` para acessar o contexto de autenticação.
*   **ShadCN UI:** `Button`, `Avatar`, `DropdownMenu` para construir a interface.
*   **Lucide-react:** Ícones para botões e itens de menu.
