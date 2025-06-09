
# C3: Componente - Visualização de Relatório (reportViewUI)

[<- Voltar para Componentes do Frontend](./../01-frontend-app-components.md)

## Descrição

O componente **Visualização de Relatório** (`ReportPage.tsx`) é uma página dedicada a exibir o conteúdo completo do relatório de conformidade em formato MDX. Ele também integra a interface de chat para interação com o relatório.

## Responsabilidades (Comportamentos)

*   **Busca de Dados do Relatório:**
    *   Ao carregar, utiliza o `analysisId` dos parâmetros da URL para chamar a Server Action `getAnalysisReportAction`.
    *   Esta action busca os metadados da análise no Firestore e o conteúdo do arquivo MDX no Firebase Storage.
*   **Renderização de MDX:**
    *   Utiliza a biblioteca `next-mdx-remote` para renderizar o conteúdo MDX obtido.
    *   Suporta plugins Remark como `remark-gfm` (para tabelas, etc.) e `remark-mermaidjs` (para renderizar diagramas Mermaid dentro do MDX).
*   **Exibição de Metadados:**
    *   Mostra o nome do arquivo original da análise e o ID da análise.
*   **Interface de Chat:**
    *   Integra o componente `ReportChatUI` (que é parte da lógica desta página) para permitir que o usuário converse com um agente de IA sobre o relatório.
*   **Feedback de Carregamento e Erro:**
    *   Exibe um estado de carregamento enquanto o relatório MDX está sendo buscado.
    *   Mostra mensagens de erro se o relatório não puder ser carregado (ex: análise não encontrada, erro na busca do MDX).
    *   Permite ao usuário tentar recarregar o relatório em caso de falha.
*   **Sincronização de Relatório Estruturado:**
    *   Mantém o estado do `structuredReport` (obtido inicialmente do Firestore via `getAnalysisReportAction` e potencialmente atualizado pelo chat) para fornecer contexto ao agente de chat.
    *   Escuta atualizações no documento da análise no Firestore para o `structuredReport` e `mdxReportStoragePath`. Se alterados (ex: por uma ação do chat), busca novamente o MDX para atualizar a visualização.

## Tecnologias e Aspectos Chave

*   **React Components:** Principalmente `ReportPage.tsx`.
*   **Next.js:** App Router para rota dinâmica (`/report/[analysisId]`), `useParams` para obter o ID da análise.
*   **MDX:** `next-mdx-remote` para renderização, `remark-gfm`, `remark-mermaidjs` para funcionalidades Markdown estendidas.
*   **ShadCN UI:** `Button`, `Textarea`, `ScrollArea`, `Avatar` (para o chat), `Alert` (para erros).
*   **Lucide-react:** Ícones.
*   **Server Actions:** `getAnalysisReportAction` para buscar o conteúdo do relatório.
*   **Firebase:** (Indireto, via Server Action e `ReportChatUI`) Firestore para metadados e `structuredReport`, Storage para arquivos MDX, Realtime Database para o chat.
*   **State Management:** `useState`, `useEffect`, `useCallback` para gerenciar o estado dos dados do relatório, mensagens de chat e interações.
