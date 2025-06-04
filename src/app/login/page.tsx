'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup } from 'firebase/auth';
import { LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { auth, googleProvider } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/icons/logo';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast({ title: 'Login bem-sucedido!', description: 'Bem-vindo(a) de volta.' });
      router.replace('/');
    } catch (error) {
      console.error('Erro no login com Google:', error);
      toast({
        title: 'Erro no Login',
        description: 'Não foi possível fazer login com Google. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  if (loading || (!loading && user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
         {/* Optionally, show a loader here or nothing while redirecting */}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="items-center text-center">
          <Logo className="mb-4 h-12 w-auto" />
          <CardTitle className="text-3xl font-bold font-headline">EMA - Electric Magnitudes Analizer</CardTitle>
          <CardDescription className="text-md">
            Acesse para analisar dados de qualidade de energia e verificar conformidade com as normas ANEEL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button onClick={handleLogin} className="w-full text-lg py-6" size="lg">
            <LogIn className="mr-2 h-5 w-5" />
            Entrar com Google
          </Button>
          <p className="px-8 text-center text-sm text-muted-foreground">
            Ao continuar, você concorda com nossos Termos de Serviço e Política de Privacidade.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
