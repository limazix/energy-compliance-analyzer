
'use client';

import { PlusCircle, History, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type DashboardViewProps = {
  userName: string | null | undefined;
  onStartNewAnalysis: () => void;
  onViewPastAnalyses: () => void;
  isLoadingPastAnalyses: boolean;
};

export function DashboardView({ userName, onStartNewAnalysis, onViewPastAnalyses, isLoadingPastAnalyses }: DashboardViewProps) {
  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-headline text-primary">Bem-vindo(a), {userName || 'Usuário'}!</CardTitle>
        <CardDescription className="text-lg">O que você gostaria de fazer hoje?</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <Button size="lg" className="py-8 text-xl" onClick={onStartNewAnalysis}>
          <PlusCircle className="mr-3 h-8 w-8" />
          Iniciar Nova Análise
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="py-8 text-xl"
          onClick={onViewPastAnalyses}
          disabled={isLoadingPastAnalyses}
        >
          {isLoadingPastAnalyses ? <Loader2 className="mr-3 h-8 w-8 animate-spin" /> : <History className="mr-3 h-8 w-8" />}
          Ver Análises Anteriores
        </Button>
      </CardContent>
    </Card>
  );
}

    