
# C3: Component - Reusable UI Components (uiComponents)

[<- Back to Frontend Components](./../01-frontend-app-components.md)

## Description

**Reusable UI Components** are the fundamental visual building blocks of the application, primarily provided by the ShadCN UI library. They are used throughout the application to create a consistent and modern user interface.

## Responsibilities (Behaviors)

*   **Provide Standardized UI Elements:**
    *   Offer a wide range of ready-to-use components, such as buttons, cards, inputs, dialogs, menus, etc.
*   **Ensure Visual Consistency:**
    *   Help maintain a cohesive design throughout the application, as they are styled according to the defined theme (in `globals.css` and `tailwind.config.ts`).
*   **Encapsulate Common UI Logic:**
    *   Some components (like `DropdownMenu`, `AlertDialog`, `Sheet`) encapsulate complex UI behaviors, such as open/closed state management and accessibility.
*   **Customization via Props:**
    *   Allow customization through props for different variants, sizes, and behaviors.
*   **Integration with Tailwind CSS:**
    *   Are built with Tailwind CSS, making it easy to apply additional styles or overrides when necessary, using utility classes.

## Technologies and Key Aspects

*   **ShadCN UI:** Library of accessible and styled components, built on Radix UI and Tailwind CSS. Components are copied into the project (`src/components/ui/`) and can be modified.
    *   Examples used: `Accordion`, `Alert`, `AlertDialog`, `Avatar`, `Badge`, `Button`, `Card`, `Checkbox`, `Dialog`, `DropdownMenu`, `Input`, `Label`, `Progress`, `ScrollArea`, `Select`, `Separator`, `Sheet`, `Skeleton`, `Switch`, `Table`, `Tabs`, `Textarea`, `Toast`, `Toaster`, `Tooltip`.
*   **Radix UI:** Library of accessible and unstyled UI primitives, which serves as the foundation for many ShadCN UI components.
*   **Tailwind CSS:** Utility-first CSS framework used to style ShadCN UI components and for custom styling throughout the application.
*   **Lucide-react:** SVG icon library used in conjunction with ShadCN UI components.
*   **`cn` utility (`lib/utils.ts`):** Utility function for conditionally merging Tailwind CSS classes.
*   **Theming:** Colors and styles are defined in `src/app/globals.css` using HSL CSS variables, allowing for light and dark themes.

## List of Main ShadCN UI Components Used

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
*   `Form` (based on React Hook Form)
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
*   `Sidebar` (custom component based on ShadCN/Radix primitives)

    