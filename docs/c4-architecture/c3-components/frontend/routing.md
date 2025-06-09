
# C3: Componente - Roteamento (routing)

[<- Voltar para Componentes do Frontend](./../01-frontend-app-components.md)

## Descrição

O componente **Roteamento** é gerenciado pelo Next.js App Router. Ele é responsável por mapear URLs para os componentes de página correspondentes e controlar a navegação dentro da aplicação.

## Responsabilidades (Comportamentos)

*   **Mapeamento de Rotas para Páginas:**
    *   `/`: Mapeado para `HomePage` (`src/app/page.tsx`).
    *   `/login`: Mapeado para `LoginPage` (`src/app/login/page.tsx`).
    *   `/report/[analysisId]`: Rota dinâmica mapeada para `ReportPage` (`src/app/report/[analysisId]/page.tsx`), onde `[analysisId]` é o ID da análise específica.
    *   `/privacy-policy`: Mapeado para `PrivacyPolicyPage` (`src/app/privacy-policy/page.tsx`).
    *   `/terms-of-service`: Mapeado para `TermsOfServicePage` (`src/app/terms-of-service/page.tsx`).
*   **Navegação:**
    *   Permite a navegação entre páginas usando o componente `Link` do Next.js ou programaticamente através do hook `useRouter` (ex: `router.push('/login')`, `router.replace('/')`).
*   **Proteção de Rotas (Indireta):**
    *   Embora o App Router em si não realize a lógica de proteção, as páginas (como `HomePage`) usam o hook `useAuth` para verificar o estado de autenticação do usuário.
    *   Se um usuário não autenticado tentar acessar uma página protegida, a lógica dentro dessa página (ou em um componente de layout superior, se implementado) o redirecionará para a página de login.
*   **Layouts:**
    *   Utiliza o `RootLayout` (`src/app/layout.tsx`) para envolver todas as páginas, fornecendo uma estrutura HTML comum, `AuthProvider`, `QueryProvider` e `Toaster`.
*   **Tratamento de Parâmetros de Rota:**
    *   Em rotas dinâmicas como `/report/[analysisId]`, o hook `useParams` é usado dentro do componente da página para extrair o valor de `analysisId` da URL.

## Tecnologias e Aspectos Chave

*   **Next.js App Router:** Sistema de roteamento baseado em arquivos e diretórios na pasta `app/`.
*   **React Server Components (RSC) e Client Components:** O App Router suporta ambos, permitindo renderização no servidor e interatividade no cliente. As páginas atuais são primariamente Client Components ('use client').
*   **Componentes de Layout:** `layout.tsx` para definir a estrutura global da UI.
*   **Hooks de Navegação:** `useRouter`, `usePathname`, `useParams` do `next/navigation`.
*   **Componente `Link`:** Para navegação declarativa do lado do cliente.
