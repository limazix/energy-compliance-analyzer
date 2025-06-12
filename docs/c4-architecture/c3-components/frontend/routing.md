# C3: Component - Routing (routing)

[<- Back to Frontend Components](./../01-frontend-app-components.md)

## Description

The **Routing** component is managed by the Next.js App Router. It is responsible for mapping URLs to corresponding page components and controlling navigation within the application.

## Responsibilities (Behaviors)

- **Mapping Routes to Pages:**
  - `/`: Mapped to `HomePage` (`src/app/page.tsx`).
  - `/login`: Mapped to `LoginPage` (`src/app/login/page.tsx`).
  - `/report/[analysisId]`: Dynamic route mapped to `ReportPage` (`src/app/report/[analysisId]/page.tsx`), where `[analysisId]` is the ID of the specific analysis.
  - `/privacy-policy`: Mapped to `PrivacyPolicyPage` (`src/app/privacy-policy/page.tsx`).
  - `/terms-of-service`: Mapped to `TermsOfServicePage` (`src/app/terms-of-service/page.tsx`).
- **Navigation:**
  - Allows navigation between pages using the Next.js `Link` component or programmatically via the `useRouter` hook (e.g., `router.push('/login')`, `router.replace('/')`).
- **Route Protection (Indirect):**
  - While the App Router itself doesn't perform the protection logic, pages (like `HomePage`) use the `useAuth` hook to check the user's authentication state.
  - If an unauthenticated user tries to access a protected page, logic within that page (or a higher-level layout component, if implemented) will redirect them to the login page.
- **Layouts:**
  - Uses `RootLayout` (`src/app/layout.tsx`) to wrap all pages, providing a common HTML structure, `AuthProvider`, `QueryProvider`, and `Toaster`.
- **Route Parameter Handling:**
  - In dynamic routes like `/report/[analysisId]`, the `useParams` hook is used within the page component to extract the value of `analysisId` from the URL.

## Technologies and Key Aspects

- **Next.js App Router:** File and directory-based routing system in the `app/` folder.
- **React Server Components (RSC) and Client Components:** The App Router supports both, allowing server rendering and client interactivity. Current pages are primarily Client Components ('use client').
- **Layout Components:** `layout.tsx` to define the global UI structure.
- **Navigation Hooks:** `useRouter`, `usePathname`, `useParams` from `next/navigation`.
- **`Link` Component:** For declarative client-side navigation.
