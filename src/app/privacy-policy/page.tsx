import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { AppHeader } from '@/components/app-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PrivacyPolicyPage() {
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
            <CardTitle className="text-3xl font-bold text-primary">
              Política de Privacidade
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Última atualização: {new Date().toLocaleDateString('pt-BR')}
            </p>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none dark:prose-invert">
            <p>
              <em>
                <strong>Atenção:</strong> Esta é uma política de privacidade modelo e não constitui
                aconselhamento jurídico. Adapte este conteúdo às suas necessidades específicas e
                consulte um profissional jurídico.
              </em>
            </p>

            <h2>1. Introdução</h2>
            <p>
              Bem-vindo ao EMA - Electric Magnitudes Analizer (&quot;Nós&quot;, &quot;Nosso&quot;).
              Esta Política de Privacidade explica como coletamos, usamos, divulgamos e protegemos
              suas informações quando você usa nosso aplicativo.
            </p>

            <h2>2. Informações que Coletamos</h2>
            <p>Podemos coletar os seguintes tipos de informações:</p>
            <ul>
              <li>
                <strong>Informações da Conta:</strong> Quando você se registra usando sua conta
                Google, coletamos informações básicas do perfil fornecidas pelo Google (nome,
                e-mail, foto do perfil) para criar e gerenciar sua conta.
              </li>
              <li>
                <strong>Dados de Qualidade de Energia:</strong> Coletamos os arquivos CSV que você
                envia, contendo dados de qualidade de energia elétrica. Esses dados são usados
                exclusivamente para fornecer serviços de análise e gerar relatórios.
              </li>
              <li>
                <strong>Dados de Uso:</strong> Podemos coletar informações sobre como você usa o
                aplicativo, como análises criadas, relatórios gerados e tags usadas, para melhorar
                nossos serviços.
              </li>
            </ul>

            <h2>3. Como Usamos Suas Informações</h2>
            <p>Usamos suas informações para:</p>
            <ul>
              <li>Fornecer, operar e manter nossos serviços.</li>
              <li>Processar seus arquivos CSV e gerar relatórios de conformidade.</li>
              <li>Permitir a interação com os relatórios gerados através da interface de chat.</li>
              <li>Gerenciar sua conta e fornecer suporte ao cliente.</li>
              <li>Melhorar e personalizar nossos serviços.</li>
              <li>Monitorar o uso de nossos serviços para fins de segurança e operacionais.</li>
            </ul>

            <h2>4. Compartilhamento de Informações</h2>
            <p>
              Não compartilhamos suas informações pessoais com terceiros, exceto nas seguintes
              circunstâncias:
            </p>
            <ul>
              <li>
                <strong>Provedores de Serviço:</strong> Usamos o Firebase (Google) para
                autenticação, armazenamento de dados (Firestore, Storage), banco de dados em tempo
                real (Realtime Database para chat) e hospedagem. Usamos Genkit e Google AI (Gemini)
                para processamento de linguagem natural e geração de análises. Esses provedores têm
                acesso limitado aos seus dados apenas para realizar essas tarefas em nosso nome e
                são obrigados a não divulgá-los ou usá-los para outros fins.
              </li>
              <li>
                <strong>Requisitos Legais:</strong> Podemos divulgar suas informações se exigido por
                lei.
              </li>
            </ul>

            <h2>5. Armazenamento e Segurança de Dados</h2>
            <p>
              Seus dados, incluindo arquivos CSV e relatórios gerados, são armazenados usando
              Firebase Storage e Firestore. Implementamos medidas de segurança para proteger suas
              informações, mas nenhum sistema de segurança é impenetrável.
            </p>
            <p>
              O conteúdo dos arquivos CSV e relatórios gerados são processados por modelos de IA
              (Gemini via Genkit) para fornecer resultados de análise. Não usamos esses dados para
              treinar modelos globais de IA.
            </p>

            <h2>6. Seus Direitos</h2>
            <p>Você tem o direito de:</p>
            <ul>
              <li>Acessar as informações que mantemos sobre você.</li>
              <li>Solicitar a correção de informações imprecisas.</li>
              <li>
                Excluir suas análises e dados associados através das funcionalidades do aplicativo.
                A exclusão de uma análise removerá o arquivo CSV original e os relatórios gerados do
                Firebase Storage, e marcará o registro no Firestore como excluído.
              </li>
              <li>Excluir sua conta (sujeito à política de retenção de dados do Firebase).</li>
            </ul>

            <h2>7. Cookies</h2>
            <p>
              Usamos cookies essenciais para o funcionamento da Autenticação Firebase e para
              gerenciar sua sessão no aplicativo.
            </p>

            <h2>8. Alterações a Esta Política de Privacidade</h2>
            <p>
              Podemos atualizar nossa Política de Privacidade periodicamente. Notificaremos você
              sobre quaisquer alterações publicando a nova Política de Privacidade nesta página.
              Recomendamos que você revise esta Política de Privacidade periodicamente para
              quaisquer alterações.
            </p>

            <h2>9. Contato</h2>
            <p>
              Se você tiver alguma dúvida sobre esta Política de Privacidade, entre em contato
              conosco por e-mail em: [Seu Endereço de E-mail de Contato].
            </p>
          </CardContent>
        </Card>
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/50 bg-muted/20">
        © {new Date().getFullYear()} EMA - Electric Magnitudes Analizer. Todos os direitos
        reservados.
        <div className="mt-1">
          <Link href="/privacy-policy" className="hover:underline">
            Política de Privacidade
          </Link>
          {' | '}
          <Link href="/terms-of-service" className="hover:underline">
            Termos de Serviço
          </Link>
        </div>
      </footer>
    </div>
  );
}
