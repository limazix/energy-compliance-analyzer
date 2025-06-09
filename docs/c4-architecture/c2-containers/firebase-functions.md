
# C2 Model: Detalhe do Contêiner - Processamento em Background (Firebase Functions)

[<- Voltar para Visão Geral dos Contêineres (C2)](./index.md)

## Descrição

As **Firebase Functions** fornecem a capacidade de execução de código backend serverless em resposta a eventos, como atualizações no Firebase Firestore. Neste sistema, elas são responsáveis pela pipeline principal de processamento e análise de IA dos dados de qualidade de energia, que são tarefas computacionalmente intensivas e/ou de longa duração.

## Responsabilidades (Comportamentos)

*   **Gatilho de Execução:**
    *   São acionadas automaticamente quando um documento de análise no Firebase Firestore tem seu status atualizado para "summarizing_data" (ou um status similar indicando que o upload foi concluído e o processamento deve iniciar).
*   **Leitura de Dados:**
    *   Lê o arquivo CSV de dados de qualidade de energia que foi previamente enviado pelo usuário e armazenado no Firebase Storage. O caminho para este arquivo é obtido do documento do Firestore que acionou a função.
*   **Execução da Pipeline de Análise de IA:**
    *   Orquestra uma sequência de agentes de IA especializados (implementados como fluxos Genkit) para processar os dados:
        1.  **Agente Analista de Dados (Sumarizador):** Lê o CSV (potencialmente em chunks se for grande), pré-processa os dados, extrai métricas chave, identifica anomalias e gera um sumário textual.
        2.  **Agente Identificador de Resoluções:** Com base no sumário dos dados, identifica as resoluções normativas da ANEEL que são pertinentes à análise.
        3.  **Agente Engenheiro de Conformidade (Relator Inicial):** Utiliza o sumário dos dados e as resoluções identificadas para gerar um rascunho inicial do relatório de conformidade em formato JSON estruturado.
        4.  **Agente Revisor de Relatório:** Revisa o relatório JSON estruturado, corrigindo gramática, melhorando a clareza, garantindo a formatação correta e o tom profissional.
*   **Armazenamento de Resultados:**
    *   Salva o relatório JSON estruturado final (após a revisão) de volta no documento correspondente da análise no Firebase Firestore.
    *   Converte o relatório JSON estruturado para o formato MDX (Markdown com JSX).
    *   Salva o arquivo MDX gerado no Firebase Storage.
*   **Atualização de Status e Progresso:**
    *   Atualiza o campo de progresso e o status do documento da análise no Firestore em várias etapas da pipeline (ex: 'identifying_regulations', 'assessing_compliance', 'reviewing_report', 'completed', 'error').
    *   Em caso de erro durante o processamento, registra a mensagem de erro no documento da análise no Firestore e define o status como "error".

## Tecnologias e Restrições

*   **Plataforma:** Firebase Functions (executando em ambiente Node.js).
*   **Linguagem:** TypeScript (compilado para JavaScript).
*   **Inteligência Artificial:**
    *   Genkit para definição e orquestração dos fluxos de IA (agentes).
    *   Google AI (modelos Gemini) para as capacidades de processamento de linguagem natural dos agentes.
*   **SDKs Firebase (Lado do Servidor):** Firebase Admin SDK para interagir com Firestore (gatilhos, leitura/escrita de dados) e Storage (leitura de CSV, escrita de MDX).
*   **Gatilhos:** Primariamente acionadas por eventos do Firestore (`onUpdate` de documentos).
*   **Limites de Execução:**
    *   Sujeitas aos limites de tempo de execução das Firebase Functions (máximo de 9 minutos para funções acionadas por eventos de background, mas configurável).
    *   Sujeitas aos limites de memória configurados para a função.
    *   O processamento de arquivos CSV grandes pode precisar ser dividido em chunks ou usar estratégias para se manter dentro desses limites.
*   **Escalabilidade:** As Firebase Functions escalam automaticamente com base na carga.
*   **Segurança:** Executam em um ambiente de servidor confiável com permissões gerenciadas via Contas de Serviço do IAM.
