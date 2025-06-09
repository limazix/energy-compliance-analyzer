
# C2 Model: Detalhe do Contêiner - Banco de Dados Principal (Firebase Firestore)

[<- Voltar para Visão Geral dos Contêineres (C2)](./index.md)

## Descrição

O **Firebase Firestore** é um banco de dados NoSQL, orientado a documentos, flexível e escalável, que serve como o principal repositório de dados para o Energy Compliance Analyzer. Ele armazena metadados, estados e os resultados estruturados das análises.

## Responsabilidades (Comportamentos)

*   **Armazenamento de Metadados de Análise:**
    *   Persiste informações sobre cada análise, incluindo:
        *   ID único da análise.
        *   ID do usuário proprietário da análise.
        *   Nome do arquivo CSV original.
        *   Título e descrição fornecidos pelo usuário para a análise.
        *   Código de idioma para o relatório.
        *   Status atual do processo de análise (ex: 'uploading', 'summarizing_data', 'completed', 'error').
        *   Progresso numérico da análise (0-100).
        *   Progresso específico do upload do arquivo (0-100).
        *   Timestamps de criação e conclusão.
        *   Mensagens de erro, se houver.
*   **Armazenamento de Caminhos de Arquivos:**
    *   Guarda a URL ou o caminho de armazenamento (no Firebase Storage) para o arquivo CSV original enviado.
    *   Guarda a URL ou o caminho de armazenamento para o relatório MDX gerado.
*   **Armazenamento de Dados Processados pela IA:**
    *   Persiste o sumário agregado dos dados de qualidade de energia, gerado pelo Agente Analista de Dados.
    *   Armazena a lista de resoluções ANEEL relevantes identificadas pelo Agente Identificador de Resoluções.
    *   Armazena o relatório de conformidade final em formato JSON estruturado, gerado e revisado pela pipeline de IA.
*   **Gerenciamento de Tags:**
    *   Armazena uma lista de tags (strings) associadas a cada análise, permitindo organização e filtragem pelo usuário.
*   **Fonte de Gatilhos para Firebase Functions:**
    *   Atualizações em documentos de análise (especialmente no campo `status`) acionam a Firebase Function `processAnalysisOnUpdate` para iniciar ou continuar o processamento em background.
*   **Fornecimento de Dados para o Frontend:**
    *   Permite que o frontend (via Server Actions) consulte e exiba a lista de análises passadas de um usuário.
    *   Permite que o frontend (via Server Actions) busque os detalhes de uma análise específica, incluindo seu status, progresso e o relatório estruturado.

## Tecnologias e Restrições

*   **Tecnologia Principal:** Firebase Firestore.
*   **Tipo de Banco:** NoSQL, orientado a documentos. Os dados são organizados em coleções de documentos, e os documentos contêm campos (pares chave-valor).
*   **Modelo de Dados:** A estrutura de dados principal é `users/{userId}/analyses/{analysisId}`.
*   **Segurança:** O acesso aos dados é controlado por Regras de Segurança do Firestore, que definem quem pode ler, escrever ou atualizar documentos com base na autenticação do usuário e na estrutura dos dados.
*   **Consultas:** Oferece capacidades de consulta flexíveis, incluindo filtragem e ordenação. Consultas mais complexas podem exigir a criação de índices compostos.
*   **Escalabilidade:** O Firestore é projetado para escalar automaticamente para lidar com grandes quantidades de dados e tráfego.
*   **Consistência:** Oferece forte consistência para leituras e escritas.
*   **Custos:** O faturamento é baseado no número de leituras, escritas, exclusões de documentos e na quantidade de dados armazenados e transferidos pela rede.
*   **Listeners em Tempo Real:** Suporta listeners em tempo real (`onSnapshot`) que permitem que aplicações cliente (ou funções de servidor) recebam atualizações de dados assim que eles mudam, embora neste projeto o uso principal seja para acionar Functions e atualizações ocasionais no frontend via Server Actions.
