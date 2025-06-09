
# C3: Componente - Ações de Listagem de Análise (`analysisListActions`)

[<- Voltar para Componentes das Server Actions](./../02-server-actions-components.md)

## Descrição

O componente **Ações de Listagem de Análise** (`src/features/analysis-listing/actions/analysisListingActions.ts`) é um módulo de Server Actions focado em buscar e retornar a lista de análises passadas de um usuário a partir do Firebase Firestore.

## Responsabilidades (Comportamentos)

*   **Busca de Análises Anteriores (`getPastAnalysesAction`):**
    *   Recebe o ID do usuário.
    *   Constrói uma consulta ao Firebase Firestore para buscar todos os documentos na subcoleção `users/{userId}/analyses`.
    *   Ordena os resultados, geralmente pela data de criação (`createdAt`) em ordem decrescente, para mostrar as análises mais recentes primeiro.
    *   Filtra análises com status "deleted" para não exibi-las ao usuário.
    *   Mapeia os dados dos documentos do Firestore para o tipo `Analysis` definido na aplicação, incluindo a conversão de Timestamps do Firestore para strings ISO ou objetos Date, conforme necessário para o frontend.
    *   Retorna um array de objetos `Analysis`.
    *   Trata erros de consulta, como permissões negadas ou problemas de rede.

## Tecnologias e Aspectos Chave

*   **TypeScript:** Para tipagem dos dados da análise e dos parâmetros da ação.
*   **Next.js Server Actions:** Para expor a funcionalidade de busca de forma segura.
*   **Firebase Firestore:**
    *   `collection` para referenciar a subcoleção de análises do usuário.
    *   `query` para construir a consulta.
    *   `orderBy` para ordenar os resultados.
    *   `where` para filtrar análises (ex: não mostrar as com status "deleted").
    *   `getDocs` para executar a consulta e obter o snapshot dos documentos.
    *   Manipulação de `Timestamp` do Firestore.
*   **Tratamento de Erros:** Gerencia e propaga erros que possam ocorrer durante a consulta ao Firestore.
*   **Tipagem de Dados:** Assegura que os dados retornados estejam em conformidade com a interface `Analysis`.
