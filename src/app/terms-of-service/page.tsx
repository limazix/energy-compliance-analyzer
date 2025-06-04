
import { AppHeader } from '@/components/app-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function TermsOfServicePage() {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <AppHeader />
      <main className="container mx-auto max-w-3xl py-8 px-4 flex-1">
        <div className="mb-6">
          <Link href="/login" className="text-sm text-primary hover:underline flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para o Login
          </Link>
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-primary">Termos de Serviço</CardTitle>
            <p className="text-sm text-muted-foreground">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none dark:prose-invert">
            <p><em><strong>Atenção:</strong> Este é um modelo de termos de serviço e não constitui aconselhamento jurídico. Adapte este conteúdo às suas necessidades específicas e consulte um profissional jurídico.</em></p>

            <h2>1. Aceitação dos Termos</h2>
            <p>Ao acessar e usar o aplicativo EMA - Electric Magnitudes Analizer (&quot;Serviço&quot;), você concorda em cumprir estes Termos de Serviço (&quot;Termos&quot;). Se você não concordar com estes Termos, não use o Serviço.</p>

            <h2>2. Descrição do Serviço</h2>
            <p>O EMA - Electric Magnitudes Analizer é uma ferramenta que permite aos usuários fazer upload de arquivos CSV contendo dados de qualidade de energia elétrica. O Serviço utiliza inteligência artificial (Genkit e Google AI) para analisar esses dados em relação às resoluções normativas da ANEEL e gerar relatórios de conformidade. O serviço também oferece uma interface de chat para interagir com os relatórios.</p>

            <h2>3. Contas de Usuário</h2>
            <p>Para usar o Serviço, você deve se registrar usando uma conta Google. Você é responsável por manter a confidencialidade de sua conta e por todas as atividades que ocorrem sob sua conta. Você concorda em nos notificar imediatamente sobre qualquer uso não autorizado de sua conta.</p>

            <h2>4. Uso do Serviço e Dados do Usuário</h2>
            <ul>
              <li>Você é o único responsável pelo conteúdo dos arquivos CSV que faz upload (&quot;Dados do Usuário&quot;) e garante que tem todos os direitos necessários para fazer upload e processar esses dados.</li>
              <li>Você concede ao EMA - Electric Magnitudes Analizer uma licença mundial, não exclusiva, isenta de royalties e transferível para usar, reproduzir, modificar e processar seus Dados do Usuário exclusivamente com o propósito de fornecer e melhorar o Serviço para você.</li>
              <li>Você concorda em não usar o Serviço para quaisquer fins ilegais ou não autorizados.</li>
            </ul>

            <h2>5. Processamento por Inteligência Artificial</h2>
            <p>O Serviço utiliza modelos de inteligência artificial (IA) para analisar seus Dados do Usuário e gerar relatórios. Embora nos esforcemos para fornecer resultados precisos, as análises e relatórios gerados pela IA são fornecidos &quot;como estão&quot; e podem conter erros ou omissões. O Serviço não se destina a substituir o julgamento profissional de engenheiros qualificados ou aconselhamento jurídico.</p>
            <p>Os resultados gerados pela IA não devem ser considerados como aconselhamento técnico ou legal definitivo. Você é responsável por verificar a precisão e adequação dos relatórios antes de tomar qualquer decisão com base neles.</p>

            <h2>6. Propriedade Intelectual</h2>
            <ul>
              <li><strong>Nosso Serviço:</strong> Nós possuímos todos os direitos, títulos e interesses sobre o Serviço, incluindo todo o software, design, texto, gráficos e outros conteúdos (excluindo seus Dados do Usuário e relatórios gerados a partir deles).</li>
              <li><strong>Seus Dados e Relatórios:</strong> Você retém todos os direitos de propriedade sobre seus Dados do Usuário. Os relatórios gerados a partir de seus Dados do Usuário são de sua propriedade, sujeitos à nossa licença para operar o Serviço.</li>
            </ul>

            <h2>7. Isenção de Garantias</h2>
            <p>O SERVIÇO É FORNECIDO &quot;COMO ESTÁ&quot; E &quot;CONFORME DISPONÍVEL&quot;, SEM GARANTIAS DE QUALQUER TIPO, EXPRESSAS OU IMPLÍCITAS, INCLUINDO, MAS NÃO SE LIMITANDO A, GARANTIAS DE COMERCIALIZAÇÃO, ADEQUAÇÃO A UM PROPÓSITO ESPECÍFICO E NÃO VIOLAÇÃO. NÃO GARANTIMOS QUE O SERVIÇO SERÁ ININTERRUPTO, SEGURO OU LIVRE DE ERROS, NEM QUE OS RESULTADOS DA ANÁLISE SERÃO COMPLETAMENTE PRECISOS OU CONFIÁVEIS.</p>

            <h2>8. Limitação de Responsabilidade</h2>
            <p>EM NENHUMA CIRCUNSTÂNCIA O EMA - ELECTRIC MAGNITUDES ANALIZER SERÁ RESPONSÁVEL POR QUAISQUER DANOS INDIRETOS, INCIDENTAIS, ESPECIAIS, CONSEQUENCIAIS OU PUNITIVOS, INCLUINDO, SEM LIMITAÇÃO, PERDA DE LUCROS, DADOS, USO, BOA VONTADE OU OUTRAS PERDAS INTANGÍVEIS, RESULTANTES DE (I) SEU ACESSO OU USO OU INCAPACIDADE DE ACESSAR OU USAR O SERVIÇO; (II) QUALQUER CONDUTA OU CONTEÚDO DE TERCEIROS NO SERVIÇO; (III) QUALQUER CONTEÚDO OBTIDO DO SERVIÇO; E (IV) ACESSO, USO OU ALTERAÇÃO NÃO AUTORIZADOS DE SUAS TRANSMISSÕES OU CONTEÚDO, SEJA COM BASE EM GARANTIA, CONTRATO, DELITO (INCLUINDO NEGLIGÊNCIA) OU QUALQUER OUTRA TEORIA LEGAL, TENHAMOS SIDO INFORMADOS OU NÃO DA POSSIBILIDADE DE TAIS DANOS.</p>

            <h2>9. Rescisão</h2>
            <p>Podemos rescindir ou suspender seu acesso ao Serviço imediatamente, sem aviso prévio ou responsabilidade, por qualquer motivo, incluindo, sem limitação, se você violar os Termos.</p>

            <h2>10. Alterações aos Termos</h2>
            <p>Reservamo-nos o direito, a nosso exclusivo critério, de modificar ou substituir estes Termos a qualquer momento. Se uma revisão for material, tentaremos fornecer um aviso com pelo menos 30 dias de antecedência antes que quaisquer novos termos entrem em vigor. O que constitui uma alteração material será determinado a nosso exclusivo critério.</p>

            <h2>11. Legislação Aplicável</h2>
            <p>Estes Termos serão regidos e interpretados de acordo com as leis do Brasil, sem consideração a seus conflitos de disposições legais.</p>

            <h2>12. Contato</h2>
            <p>Se você tiver alguma dúvida sobre estes Termos, entre em contato conosco através do e-mail: [Seu Endereço de E-mail para Contato].</p>
          </CardContent>
        </Card>
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/50 bg-muted/20">
        © {new Date().getFullYear()} EMA - Electric Magnitudes Analizer. Todos os direitos reservados.
        <div className="mt-1">
          <Link href="/privacy-policy" className="hover:underline">Política de Privacidade</Link>
          {' | '}
          <Link href="/terms-of-service" className="hover:underline">Termos de Serviço</Link>
        </div>
      </footer>
    </div>
  );
}
