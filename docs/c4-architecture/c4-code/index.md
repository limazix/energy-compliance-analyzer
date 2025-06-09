
# C4 Model: Nível 4 - Código (Visão Detalhada) - Energy Compliance Analyzer

Este nível detalha aspectos dinâmicos e de implantação do sistema, mostrando como os componentes colaboram para realizar tarefas e como o sistema é implantado na infraestrutura.

[<- Voltar para Diagrama de Componentes (C3)](../c3-components/index.md)

## Diagramas de Nível 4

1.  **[Diagrama Dinâmico: Processamento de Análise de CSV](./01-dynamic-csv-processing.md)**
    *   Ilustra a sequência de interações quando um usuário faz upload de um arquivo CSV e a análise é processada pela pipeline de IA nas Firebase Functions.

2.  **[Diagrama Dinâmico: Interação com Chat do Relatório](./02-dynamic-report-chat.md)**
    *   Mostra o fluxo de comunicação quando um usuário interage com o agente de IA através do chat do relatório, incluindo possíveis revisões do relatório.

3.  **[Diagrama de Implantação: Visão Geral](./03-deployment-diagram.md)**
    *   Descreve como os contêineres do sistema (Frontend, Server Actions, Firebase Functions) são implantados na infraestrutura do Firebase e Google Cloud.
