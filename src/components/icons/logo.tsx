
import type { HTMLAttributes } from 'react';
import Image from 'next/image';

// Props atualizadas para refletir um elemento de imagem e permitir className
export function Logo(props: HTMLAttributes<HTMLImageElement>) {
  return (
    <Image
      src="https://placehold.co/200x60.png" // Placeholder com proporção ajustada
      alt="Energy Compliance Analyzer Logo"
      width={150} // Largura preferida para exibição no header
      height={45}  // Altura correspondente para manter proporção ~200x60
      data-ai-hint="green energy circuit leaf" // Hint para busca de imagem por IA
      priority // Otimiza o carregamento do logo
      {...props} // Permite passar className e outros atributos HTML
    />
  );
}
