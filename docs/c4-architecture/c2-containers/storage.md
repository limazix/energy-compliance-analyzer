
# C2 Model: Detalhe do Contêiner - Armazenamento de Arquivos (Firebase Storage)

[<- Voltar para Visão Geral dos Contêineres (C2)](./index.md)

## Descrição

O **Firebase Storage** é um serviço de armazenamento de objetos (blob storage) robusto, simples e econômico, construído para escala de aplicativos. No Energy Compliance Analyzer, ele é usado para armazenar arquivos enviados pelos usuários e relatórios gerados pelo sistema.

## Responsabilidades (Comportamentos)

*   **Armazenamento de Arquivos CSV Enviados:**
    *   Guarda os arquivos CSV originais contendo os dados de qualidade de energia elétrica que são enviados pelos usuários através do Frontend Web App.
    *   Cada arquivo é tipicamente armazenado em um caminho que inclui o ID do usuário e o ID da análise para garantir a organização e o controle de acesso. (Ex: `user_uploads/{userId}/{analysisId}/{fileName}.csv`).
*   **Armazenamento de Relatórios MDX Gerados:**
    *   Guarda os relatórios de conformidade finais que são gerados pela pipeline de IA (Firebase Functions) no formato MDX (Markdown com JSX).
    *   Similar aos CSVs, esses relatórios são armazenados em caminhos estruturados (Ex: `user_reports/{userId}/{analysisId}/report.mdx`).
*   **Fornecimento de Acesso a Arquivos:**
    *   Permite que as Firebase Functions acessem e leiam o conteúdo dos arquivos CSV para processamento.
    *   Permite que as Next.js Server Actions (e, por conseguinte, o frontend) acessem e leiam o conteúdo dos arquivos de relatório MDX para exibição ao usuário.
    *   Fornece URLs de download para os arquivos, se necessário, embora o acesso direto via SDK seja mais comum para operações internas.

## Tecnologias e Restrições

*   **Tecnologia Principal:** Firebase Storage (que é construído sobre o Google Cloud Storage).
*   **Tipo de Armazenamento:** Armazenamento de objetos (blobs). Não é um sistema de arquivos hierárquico tradicional, mas sim um armazenamento de chave-valor onde a chave é o caminho completo do arquivo.
*   **Segurança:**
    *   O acesso aos arquivos é controlado por Regras de Segurança do Firebase Storage.
    *   Estas regras podem definir quem pode fazer upload, download ou excluir arquivos com base na autenticação do usuário, no caminho do arquivo, no tamanho do arquivo, no tipo de conteúdo, etc.
*   **SDKs:**
    *   O Firebase SDK para cliente (web) é usado pelo frontend para realizar uploads de arquivos (geralmente diretamente para o Storage ou via presigned URLs gerenciadas por Server Actions).
    *   O Firebase Admin SDK é usado pelas Firebase Functions e Next.js Server Actions para acessar arquivos (ler CSVs, escrever MDX) com privilégios de servidor.
*   **Estrutura de Caminhos:** Embora não seja um sistema de arquivos, a nomeação de arquivos com "/" cria uma ilusão de estrutura de diretórios, o que é útil para organização e para a aplicação de regras de segurança.
*   **Escalabilidade:** Altamente escalável para armazenar grandes volumes de dados e lidar com um alto volume de operações de upload/download.
*   **Custos:** O faturamento é baseado na quantidade de dados armazenados, nas operações de rede (uploads/downloads) e no número de operações (ex: leituras, escritas, listagens).
*   **Versionamento (Opcional):** O Google Cloud Storage (a base do Firebase Storage) suporta versionamento de objetos, o que pode ser útil para manter históricos de relatórios, embora não esteja explicitamente detalhado como um requisito atual para este sistema.
