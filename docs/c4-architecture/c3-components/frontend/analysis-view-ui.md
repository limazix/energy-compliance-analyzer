
# C3: Componente - Visualização de Análise (analysisViewUI)

[<- Voltar para Componentes do Frontend](./../01-frontend-app-components.md)

## Descrição

O componente **Visualização de Análise** (`AnalysisView.tsx`) é responsável por exibir os detalhes de uma análise específica, seja ela em andamento ou concluída. Ele mostra o progresso, resultados (se concluída) e permite ações como gerenciamento de tags e exclusão.

## Responsabilidades (Comportamentos)

*   **Exibição de Metadados da Análise:**
    *   Mostra o título, descrição e nome do arquivo original da análise.
*   **Progresso da Análise (se em andamento):**
    *   Utiliza o componente `AnalysisProgressDisplay` para mostrar as etapas do processo de análise e seu status (pendente, em andamento, concluído, erro).
    *   Exibe o progresso numérico geral da análise.
    *   Permite ao usuário solicitar o cancelamento da análise se estiver em andamento.
*   **Resultados da Análise (se concluída):**
    *   Utiliza o componente `AnalysisResultsDisplay` para:
        *   Mostrar um resumo dos resultados e uma prévia do relatório estruturado.
        *   Fornecer um link para a página de visualização detalhada do relatório MDX (`ReportPage`).
        *   Permitir o download do relatório em formato TXT e JSON.
*   **Exibição de Erros:**
    *   Se a análise resultou em erro, exibe a mensagem de erro e o estado das etapas até o ponto da falha.
*   **Gerenciamento de Tags:**
    *   Utiliza o componente `TagEditor` para permitir que o usuário adicione ou remova tags da análise.
*   **Ações da Análise:**
    *   Fornece um botão para excluir a análise (com diálogo de confirmação).
*   **Interação com `useAnalysisManager`:**
    *   Recebe o objeto `currentAnalysis` e `displayedAnalysisSteps` do hook.
    *   Chama funções do hook para adicionar/remover tags, excluir análise e cancelar análise.

## Tecnologias e Aspectos Chave

*   **React Components:** `AnalysisView.tsx`, `AnalysisProgressDisplay.tsx`, `AnalysisResultsDisplay.tsx`, `AnalysisStepItem.tsx`, `TagEditor.tsx`.
*   **ShadCN UI:** `Card`, `Button`, `Badge`, `Progress`, `AlertDialog`, `Input` para construir a interface.
*   **Lucide-react:** Ícones para botões e indicadores de status.
*   **Custom Hooks:** `useAnalysisManager` para obter dados da análise e executar ações.
*   **Server Actions:** (Indiretamente via `useAnalysisManager`) Para operações de backend como adicionar/remover tags, excluir e cancelar análises.
*   **Next.js:** `Link` para navegação para a página do relatório.
