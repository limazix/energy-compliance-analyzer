
'use client';

import { Loader2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type NewAnalysisFormProps = {
  fileToUpload: File | null;
  isUploading: boolean;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadAndAnalyze: () => void;
  onCancel: () => void;
};

export function NewAnalysisForm({
  fileToUpload,
  isUploading,
  onFileChange,
  onUploadAndAnalyze,
  onCancel,
}: NewAnalysisFormProps) {
  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-headline text-primary">Nova Análise de Conformidade</CardTitle>
        <CardDescription>Faça upload do seu arquivo CSV de dados de qualidade de energia.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input type="file" accept=".csv" onChange={onFileChange} className="text-base p-2 border-2 border-dashed h-auto" />
        {fileToUpload && <p className="text-sm text-muted-foreground">Arquivo selecionado: {fileToUpload.name}</p>}
        <div className="flex gap-4">
          <Button onClick={onUploadAndAnalyze} disabled={!fileToUpload || isUploading} className="w-full md:w-auto" size="lg">
            {isUploading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UploadCloud className="mr-2 h-5 w-5" />}
            {isUploading ? 'Enviando...' : 'Enviar e Analisar'}
          </Button>
          <Button variant="outline" onClick={onCancel} className="w-full md:w-auto" size="lg">Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

    