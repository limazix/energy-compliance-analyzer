import type { HTMLAttributes } from 'react';

import Image from 'next/image';

// Props atualizadas para refletir um elemento de imagem e permitir className
export function Logo(props: HTMLAttributes<HTMLImageElement>) {
  return (
    <Image
      src="/assets/logo.png" // Updated path to public/assets/logo.png
      alt="EMA - Electric Magnitudes Analizer Logo"
      width={150} // Adjusted width for a wider logo
      height={45} // Adjusted height for a ~3.33:1 aspect ratio
      priority // Otimiza o carregamento do logo
      {...props} // Permite passar className e outros atributos HTML
    />
  );
}
