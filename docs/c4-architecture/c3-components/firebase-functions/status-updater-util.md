
# C3: Componente - Atualizador de Status/Progresso (`statusUpdaterUtil`)

[<- Voltar para Componentes das Firebase Functions](./../03-firebase-functions-components.md)

## Descrição

O **Atualizador de Status/Progresso** representa a lógica dentro da Firebase Function `processAnalysis.js` que utiliza o Firebase Admin SDK para interagir com o Firebase Firestore. Sua responsabilidade é atualizar o documento da análise no Firestore com o status atual do processamento, o progresso percentual e, eventualmente, os resultados finais ou mensagens de erro.

## Responsabilidades (Comportamentos)

*   **Atualização de Progresso:**
    *   Em várias etapas da pipeline de análise (ex: após leitura do arquivo, após sumarização de um chunk, após identificação de resoluções), atualiza o campo `progress` do documento da análise no Firestore para refletir o avanço.
*   **Atualização de Status:**
    *   Modifica o campo `status` do documento da análise para indicar a fase atual do processamento (ex: 'identifying_regulations', 'assessing_compliance', 'reviewing_report', 'completed', 'error', 'cancelled').
*   **Registro de Resultados:**
    *   Ao final do processamento bem-sucedido:
        *   Salva o relatório estruturado final (JSON) no campo `structuredReport`.
        *   Salva o caminho para o arquivo MDX no Firebase Storage no campo `mdxReportStoragePath`.
        *   Salva o sumário do relatório no campo `summary`.
        *   Define o `status` como "completed" e `progress` como 100.
        *   Registra o `completedAt` timestamp.
        *   Limpa quaisquer `errorMessage` anteriores.
*   **Registro de Erros:**
    *   Em caso de falha em qualquer etapa da pipeline:
        *   Define o `status` como "error".
        *   Registra uma mensagem de erro detalhada no campo `errorMessage`.
        *   Mantém o `progress` no valor em que a falha ocorreu.
*   **Manipulação de Cancelamento:**
    *   Se um cancelamento for detectado (`status` === 'cancelling'), atualiza o status para 'cancelled' e pode registrar uma mensagem.

## Tecnologias e Aspectos Chave

*   **Firebase Admin SDK (Firestore):**
    *   `admin.firestore()` para obter a instância do Firestore.
    *   `docRef.update()` para modificar campos específicos do documento da análise.
    *   `admin.firestore.FieldValue.serverTimestamp()` para registrar timestamps.
*   **Interação com Firestore:** Componente crucial para fornecer feedback em tempo real ao usuário sobre o andamento da análise, pois o frontend geralmente escuta (`onSnapshot`) as mudanças neste documento.
*   **Tratamento de Erros:** Deve lidar com possíveis falhas ao tentar atualizar o Firestore, embora essas sejam geralmente menos comuns do que erros na pipeline de IA.

## Interações

*   **Utilizado por:** Orquestrador da Pipeline (`processAnalysisFn`) ao longo de sua execução.
*   **Interage com:** Firebase Firestore.
*   **Entrada:** Dados a serem atualizados (status, progresso, resultados, erros).
*   **Saída:** Nenhuma (apenas efeitos colaterais de escrita no Firestore).
