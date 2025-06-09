
# C3: Componente - Componentes de UI Reutilizáveis (uiComponents)

[<- Voltar para Componentes do Frontend](./../01-frontend-app-components.md)

## Descrição

Os **Componentes de UI Reutilizáveis** são os blocos de construção visuais fundamentais da aplicação, fornecidos principalmente pela biblioteca ShadCN UI. Eles são usados em toda a aplicação para criar uma interface de usuário consistente e moderna.

## Responsabilidades (Comportamentos)

*   **Fornecer Elementos de UI Padronizados:**
    *   Oferecem uma ampla gama de componentes prontos para uso, como botões, cards, inputs, diálogos, menus, etc.
*   **Garantir Consistência Visual:**
    *   Ajudam a manter um design coeso em toda a aplicação, pois são estilizados de acordo com o tema definido (em `globals.css` e `tailwind.config.ts`).
*   **Encapsular Lógica de UI Comum:**
    *   Alguns componentes (como `DropdownMenu`, `AlertDialog`, `Sheet`) encapsulam comportamentos de UI complexos, como gerenciamento de estado aberto/fechado e acessibilidade.
*   **Customização via Props:**
    *   Permitem customização através de props para diferentes variantes, tamanhos e comportamentos.
*   **Integração com Tailwind CSS:**
    *   São construídos com Tailwind CSS, facilitando a aplicação de estilos adicionais ou overrides quando necessário, usando classes utilitárias.

## Tecnologias e Aspectos Chave

*   **ShadCN UI:** Biblioteca de componentes acessíveis e estilizados, construídos sobre Radix UI e Tailwind CSS. Os componentes são copiados para o projeto (`src/components/ui/`) e podem ser modificados.
    *   Exemplos utilizados: `Accordion`, `Alert`, `AlertDialog`, `Avatar`, `Badge`, `Button`, `Card`, `Checkbox`, `Dialog`, `DropdownMenu`, `Input`, `Label`, `Progress`, `ScrollArea`, `Select`, `Separator`, `Sheet`, `Skeleton`, `Switch`, `Table`, `Tabs`, `Textarea`, `Toast`, `Toaster`, `Tooltip`.
*   **Radix UI:** Biblioteca de primitivos de UI acessíveis e não estilizados, que serve de base para muitos componentes ShadCN UI.
*   **Tailwind CSS:** Framework CSS utilitário usado para estilizar os componentes ShadCN UI e para estilização customizada em toda a aplicação.
*   **Lucide-react:** Biblioteca de ícones SVG usada em conjunto com os componentes ShadCN UI.
*   **`cn` utility (`lib/utils.ts`):** Função utilitária para mesclar classes Tailwind CSS condicionalmente.
*   **Tematização:** Cores e estilos são definidos em `src/app/globals.css` usando variáveis CSS HSL, permitindo temas claro e escuro.

## Lista dos Principais Componentes ShadCN UI Utilizados

*   `Accordion`
*   `Alert` / `AlertDialog`
*   `Avatar`
*   `Badge`
*   `Button`
*   `Calendar`
*   `Card`
*   `Checkbox`
*   `Dialog`
*   `DropdownMenu`
*   `Form` (baseado em React Hook Form)
*   `Input`
*   `Label`
*   `Menubar`
*   `Popover`
*   `Progress`
*   `RadioGroup`
*   `ScrollArea`
*   `Select`
*   `Separator`
*   `Sheet`
*   `Skeleton`
*   `Slider`
*   `Switch`
*   `Table`
*   `Tabs`
*   `Textarea`
*   `Toast` / `Toaster`
*   `Tooltip`
*   `Sidebar` (componente customizado baseado em primitivos ShadCN/Radix)
