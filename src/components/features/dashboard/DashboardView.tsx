
'use client';

import { PlusCircle, History, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type DashboardViewProps = {
  userName: string | null | undefined;
  onStartNewAnalysis: () => void;
  // onViewPastAnalyses foi removido, pois a navegação agora é por abas no header
  isLoadingPastAnalyses: boolean; // Pode ser mantido se o dashboard precisar mostrar um loader geral
};

export function DashboardView({ userName, onStartNewAnalysis, isLoadingPastAnalyses }: DashboardViewProps) {
  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-headline text-primary">Bem-vindo(a), {userName || 'Usuário'}!</CardTitle>
        <CardDescription className="text-lg">O que você gostaria de fazer hoje?</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-1"> {/* Alterado para md:grid-cols-1 já que só há um botão principal */}
        <Button size="lg" className="py-8 text-xl" onClick={onStartNewAnalysis}>
          <PlusCircle className="mr-3 h-8 w-8" />
          Iniciar Nova Análise
        </Button>
        {/* O botão para "Ver Análises Anteriores" foi removido daqui. A navegação é feita pelas abas no header. */}
        {/* Se isLoadingPastAnalyses for relevante para o estado geral do dashboard, pode-se adicionar um indicador aqui. */}
        {/* Exemplo: {isLoadingPastAnalyses && <div className="flex justify-center mt-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>} */}
      </CardContent>
    </Card>
  );
}
