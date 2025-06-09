
# C3: Componente - Ações de Gerenciamento de Tags (`tagActions`)

[<- Voltar para Componentes das Server Actions](./../02-server-actions-components.md)

## Descrição

O componente **Ações de Gerenciamento de Tags** (`src/features/tag-management/actions/tagActions.ts`) é um módulo de Server Actions dedicado a adicionar e remover tags de uma análise específica no Firebase Firestore.

## Responsabilidades (Comportamentos)

*   **Adicionar Tag (`addTagToAction`):**
    *   Recebe o ID do usuário, o ID da análise e a string da tag a ser adicionada.
    *   Lê o documento da análise no Firestore.
    *   Verifica se a tag já existe no array `tags` do documento.
    *   Se a tag não existir, adiciona-a ao array `tags` e atualiza o documento no Firestore.
    *   Realiza a validação da entrada (ex: tag não pode ser vazia).
*   **Remover Tag (`removeTagAction`):**
    *   Recebe o ID do usuário, o ID da análise e a string da tag a ser removida.
    *   Lê o documento da análise no Firestore.
    *   Filtra o array `tags` para remover a tag especificada.
    *   Atualiza o documento no Firestore com o novo array de tags.

## Tecnologias e Aspectos Chave

*   **TypeScript:** Para tipagem e organização do código.
*   **Next.js Server Actions:** Para executar a lógica de modificação de tags no servidor.
*   **Firebase Firestore:**
    *   `getDoc` para ler o estado atual das tags de uma análise.
    *   `updateDoc` para modificar o array `tags` no documento da análise.
    *   Uso de operadores de array do Firestore (se aplicável, ou manipulação do array no lado do servidor antes do update).
*   **Manipulação de Arrays:** Lógica para adicionar ou remover elementos de um array de forma idempotente (para adição) e segura.
*   **Tratamento de Erros:** Gerencia erros como análise não encontrada ou falhas ao atualizar o documento.
