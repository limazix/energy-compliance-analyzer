
# C3: Componente - Listagem de Análises (analysisListUI)

[<- Voltar para Componentes do Frontend](./../01-frontend-app-components.md)

## Descrição

O componente **Listagem de Análises** é responsável por exibir o histórico de análises passadas do usuário de forma organizada, geralmente em um formato de acordeão, permitindo que o usuário veja detalhes de cada uma.

## Responsabilidades (Comportamentos)

*   **Exibição de Análises:**
    *   Apresenta uma lista das análises realizadas pelo usuário.
    *   Para cada análise, exibe informações chave como título (ou nome do arquivo), data de criação e status atual.
    *   Utiliza um componente de Acordeão (`Accordion` da ShadCN UI) onde cada item representa uma análise.
*   **Interação com `useAnalysisManager`:**
    *   Obtém a lista de `pastAnalyses` do hook `useAnalysisManager`.
    *   Reflete o estado de `isLoadingPastAnalyses` para mostrar um indicador de carregamento.
*   **Expansão de Detalhes:**
    *   Ao clicar em um item do acordeão, ele se expande para mostrar o componente `AnalysisView` com os detalhes da análise selecionada.
    *   Gerencia qual análise está atualmente expandida (`expandedAnalysisId` no `HomePage.tsx`) e informa o `useAnalysisManager` sobre a `currentAnalysis`.
*   **Feedback de Lista Vazia:**
    *   Exibe uma mensagem apropriada (ex: "Nenhuma análise anterior encontrada.") se não houver análises para listar.

## Tecnologias e Aspectos Chave

*   **React Components:** Parte do `HomePage.tsx` que renderiza o `Accordion`.
*   **ShadCN UI:** `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`, `Card`, `Badge` para estilização e estrutura.
*   **Custom Hooks:** `useAnalysisManager` para obter a lista de análises e gerenciar o estado da análise atual.
*   **Formatação de Dados:** Utiliza `date-fns` para formatar datas.
*   **Server Actions:** (Indiretamente via `useAnalysisManager`) Para buscar a lista de análises.
