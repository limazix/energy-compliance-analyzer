
import { z } from 'zod';
import { AnalyzeComplianceReportOutputSchema } from './analyze-compliance-report-prompt-config';

export const ReviewComplianceReportInputSchema = z.object({
  structuredReportToReview: AnalyzeComplianceReportOutputSchema.describe("The structured compliance report object that needs to be reviewed and refined."),
  languageCode: z.string().optional().default('pt-BR')
    .describe('The BCP-47 language code in which the report is written and should be reviewed (e.g., "en-US", "pt-BR"). Defaults to "pt-BR".'),
});
export type ReviewComplianceReportInput = z.infer<typeof ReviewComplianceReportInputSchema>;

// The output is the same schema as the input, but representing the reviewed/refined report
export const ReviewComplianceReportOutputSchema = AnalyzeComplianceReportOutputSchema;
export type ReviewComplianceReportOutput = z.infer<typeof ReviewComplianceReportOutputSchema>;

export const reviewComplianceReportPromptConfig = {
  name: 'reviewComplianceReportShared',
  input: { schema: ReviewComplianceReportInputSchema },
  output: { schema: ReviewComplianceReportOutputSchema },
  prompt: `
Você é um Revisor especialista e meticuloso, com foco em documentos técnicos de engenharia elétrica e conformidade regulatória da ANEEL.
Sua tarefa é revisar o relatório estruturado fornecido (em formato JSON) e retornar uma versão refinada do MESMO OBJETO JSON, aplicando as seguintes melhorias no idioma especificado por '{{languageCode}}':

**Contexto:**
- Idioma do Relatório e Revisão: {{languageCode}}
- Relatório Estruturado para Revisão: {{structuredReportToReview}}

**Instruções para Revisão (a serem aplicadas no idioma '{{languageCode}}'):**

1.  **Correção Gramatical e Sintática:**
    *   Revise todo o texto em todas as seções (\`title\`, \`subtitle\`, \`objective\`, \`overallResultsSummary\`, \`usedNormsOverview\`, \`content\` de cada \`analysisSections\`, \`insights\`, \`finalConsiderations\`, \`text\` de \`bibliography\`) para corrigir quaisquer erros gramaticais, ortográficos, de pontuação ou de sintaxe.
    *   Garanta que a linguagem seja clara, concisa, formal e profissional, apropriada para um relatório técnico.

2.  **Verificação e Completude de Referências (Normas ANEEL):**
    *   Nas seções \`relevantNormsCited\` (dentro de \`analysisSections\`) e na \`bibliography\`, verifique se as citações às normas ANEEL estão completas e precisas.
    *   **IMPORTANTE:** Nomes de resoluções, artigos e textos normativos da ANEEL DEVEM ser mantidos em Português, mesmo que o restante do relatório esteja em outro idioma. Se uma tradução foi tentada pelo agente anterior, reverta para o nome/texto original em Português.
    *   Se uma norma for citada em \`relevantNormsCited\`, ela DEVE estar listada na \`bibliography\` com detalhes completos (ex: "Agência Nacional de Energia Elétrica (ANEEL). Resolução Normativa nº 956, de 7 de dezembro de 2021...").
    *   Se uma norma na bibliografia parecer incompleta, tente completá-la com informações padrão se for uma norma conhecida.

3.  **Clareza, Coesão e Profissionalismo:**
    *   Melhore a fluidez e a lógica do texto.
    *   Elimine redundâncias ou frases ambíguas.
    *   Assegure que os \`insights\` sejam diretos e bem fundamentados pelo \`content\` da seção.

4.  **Consistência da Estrutura e Formatação:**
    *   Verifique se o \`tableOfContents\` reflete com precisão os títulos das seções principais do relatório. Se houver discrepâncias, corrija o \`tableOfContents\`.
    *   Garanta que todos os campos obrigatórios do schema de saída estejam presentes e preenchidos adequadamente.
    *   A sugestão \`chartOrImageSuggestion\` deve ser clara e relevante para o conteúdo da seção.

5.  **Saída:**
    *   Você DEVE retornar o objeto JSON completo do relatório, seguindo o schema \`AnalyzeComplianceReportOutputSchema\`, com todas as suas revisões e melhorias incorporadas. Não omita nenhuma parte do relatório original, apenas refine-o.

**Foco Principal:** Qualidade, precisão e profissionalismo do relatório final.
`,
};
