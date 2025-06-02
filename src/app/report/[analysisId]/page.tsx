
'use client'; 

import { Suspense, useEffect, useState, use } from 'react'; // Added use
import { MDXRemote, type MDXRemoteProps } from 'next-mdx-remote/rsc'; 
import { getAnalysisReportAction } from '@/features/report-viewing/actions/reportViewingActions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, MessageSquarePlus, Send, AlertTriangle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { AppHeader } from '@/components/app-header'; 
import { useAuth } from '@/contexts/auth-context';
import { useRouter, useParams } from 'next/navigation';
import type { AnalysisReportData } from '@/types/analysis';

interface ReportDataState extends AnalysisReportData {
  isLoading: boolean;
}

export default function ReportPage() {
  const router = useRouter();
  const params = useParams();
  const analysisId = params.analysisId as string; 

  const { user, loading: authLoading } = useAuth();

  const [reportData, setReportData] = useState<ReportDataState>({
    mdxContent: null,
    fileName: null,
    analysisId: analysisId,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    if (authLoading) {
      return; 
    }

    if (!user) {
      router.replace('/login'); 
      return;
    }

    if (user && user.uid && analysisId) {
      setReportData(prev => ({ ...prev, isLoading: true, error: null, analysisId: analysisId }));
      getAnalysisReportAction(user.uid, analysisId)
        .then(data => {
          if (data.error) {
            setReportData({
              mdxContent: null,
              fileName: data.fileName, // Keep fileName even on error for context
              analysisId: data.analysisId || analysisId,
              isLoading: false,
              error: data.error,
            });
          } else {
            setReportData({
              mdxContent: data.mdxContent || null,
              fileName: data.fileName || 'Relatório',
              analysisId: data.analysisId || analysisId,
              isLoading: false,
              error: null,
            });
          }
        })
        .catch(e => {
          setReportData({
            mdxContent: null,
            fileName: null,
            analysisId: analysisId,
            isLoading: false,
            error: `Erro ao carregar o relatório: ${e instanceof Error ? e.message : String(e)}`,
          });
        });
    } else if (!analysisId && user && !authLoading) { 
        setReportData({
            mdxContent: null,
            fileName: null,
            analysisId: null,
            isLoading: false,
            error: "ID da análise não encontrado na URL.",
        });
    }
  }, [analysisId, user, authLoading, router]);

  if (authLoading || reportData.isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto py-8 px-4 flex-1 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </main>
         <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/50 bg-muted/20">
           © {new Date().getFullYear()} Energy Compliance Analyzer. Todos os direitos reservados.
         </footer>
      </div>
    );
  }

  if (reportData.error) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto py-8 px-4 flex-1">
          <div className="text-center py-10 bg-destructive/10 border border-destructive rounded-md p-6">
            <h1 className="text-2xl font-bold text-destructive flex items-center justify-center">
              <AlertTriangle className="mr-2 h-7 w-7"/> Falha ao Carregar Relatório
            </h1>
             {reportData.fileName && <p className="text-sm text-muted-foreground mt-1">Arquivo: {reportData.fileName}</p>}
            <p className="text-destructive-foreground mt-2">{reportData.error}</p>
            <Button asChild className="mt-6">
              <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Página Inicial</Link>
            </Button>
          </div>
        </main>
         <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/50 bg-muted/20">
           © {new Date().getFullYear()} Energy Compliance Analyzer. Todos os direitos reservados.
         </footer>
      </div>
    );
  }
  
  if (!reportData.mdxContent) {
     return (
      <div className="flex flex-col min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto py-8 px-4 flex-1">
          <div className="text-center py-10">
            <h1 className="text-2xl font-bold text-destructive">Relatório Não Encontrado</h1>
            <p className="text-muted-foreground mt-2">O conteúdo do relatório para a análise com ID: {reportData.analysisId || 'desconhecido'} não pôde ser carregado ou não existe.</p>
             {reportData.fileName && <p className="text-sm text-muted-foreground mt-1">Arquivo: {reportData.fileName}</p>}
            <Button asChild className="mt-6">
              <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Página Inicial</Link>
            </Button>
          </div>
        </main>
         <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/50 bg-muted/20">
           © {new Date().getFullYear()} Energy Compliance Analyzer. Todos os direitos reservados.
         </footer>
      </div>
    );
  }

  const mdxProps: MDXRemoteProps = {
    source: reportData.mdxContent,
    // components: { /* Custom components if any */ }
  };

  return (
    <div className="flex flex-col min-h-screen bg-muted/30">
       <AppHeader />
      <main className="container mx-auto py-8 px-4 flex-1">
        <div className="mb-6 flex justify-between items-center">
          <Button asChild variant="outline" size="sm">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Análises
            </Link>
          </Button>
        </div>

        <div className="mb-4 p-4 bg-card rounded-lg shadow">
            <h1 className="text-3xl font-bold text-primary">{reportData.fileName ? `Relatório: ${reportData.fileName}` : 'Relatório Detalhado'}</h1>
            <p className="text-sm text-muted-foreground">Análise ID: {reportData.analysisId}</p>
        </div>

        <article className="prose prose-slate lg:prose-xl max-w-none bg-card p-6 sm:p-8 md:p-10 rounded-lg shadow-lg">
          <Suspense fallback={<div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto"/> Carregando relatório...</div>}>
            {/* @ts-expect-error MDXRemoteProps might be expecting compiledSource from serialize, but we're passing raw string */}
            <MDXRemote {...mdxProps} />
          </Suspense>
        </article>

        <section className="mt-12 p-6 bg-card rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-primary flex items-center">
            <MessageSquarePlus className="mr-3 h-7 w-7" /> Sugestões e Revisões
          </h2>
          <p className="text-muted-foreground mb-4">
            Esta seção é um placeholder para a funcionalidade de revisão interativa.
            No futuro, você poderá selecionar partes do texto e solicitar alterações diretamente aqui.
          </p>
          <Textarea
            placeholder="Digite suas sugestões ou comentários sobre o relatório aqui..."
            className="mb-4 min-h-[120px]"
            aria-label="Caixa de texto para sugestões e revisões"
          />
          <Button disabled> 
            <Send className="mr-2 h-4 w-4" /> Enviar Sugestões
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            (Funcionalidade de envio de sugestões ainda não implementada)
          </p>
        </section>
      </main>
       <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/50 bg-muted/20">
        © {new Date().getFullYear()} Energy Compliance Analyzer. Todos os direitos reservados.
       </footer>
    </div>
  );
}
