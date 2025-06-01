
import type { HTMLAttributes } from 'react';
import Image from 'next/image';

// Props atualizadas para refletir um elemento de imagem e permitir className
export function Logo(props: HTMLAttributes<HTMLImageElement>) {
  return (
    <Image
      src="https://placehold.co/200x50.png" // Placeholder com proporção 200x50
      alt="Energy Compliance Analyzer Logo"
      width={200} // Largura intrínseca da imagem para aspect ratio
      height={50}  // Altura intrínseca da imagem para aspect ratio
      data-ai-hint="energy compliance" // Hint para busca de imagem por IA
      priority // Otimiza o carregamento do logo
      {...props} // Permite passar className e outros atributos HTML
    />
  );
}
