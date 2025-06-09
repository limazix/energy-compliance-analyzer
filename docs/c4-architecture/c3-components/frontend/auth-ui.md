
# C3: Component - Authentication Components (authUI)

[<- Back to Frontend Components](./../01-frontend-app-components.md)

## Description

The **Authentication Components** are responsible for all client-side UI and logic related to user authentication. This includes login/logout buttons, display of user profile information, and integration with `AuthProvider` to reflect the authentication state.

## Responsibilities (Behaviors)

*   **Login/Logout Interface:**
    *   Provides the "Sign in with Google" button (part of `AuthButton`) to initiate the login flow.
    *   Displays the user's avatar, name, and a dropdown menu with a "Sign out" option (part of `AuthButton`) when the user is authenticated.
*   **Profile Display (Simplified):**
    *   Shows the user's display name and email in the `AuthButton`'s dropdown menu.
*   **Interaction with `AuthProvider`:**
    *   Uses the `useAuth` hook (from `AuthProvider`) to get the current user state (logged in/out, loading).
    *   Triggers login (via `signInWithPopup`) and logout (via `signOut`) actions from the Firebase SDK.
*   **Redirection (Implicit):**
    *   Indirectly, successful login/logout actions usually lead to redirects managed by the pages (e.g., `LoginPage` redirects to `/` after login, `AuthButton` redirects to `/login` after logout).

## Technologies and Key Aspects

*   **React Components:** (`AuthButton.tsx`, potentially other UI components related to profile).
*   **Firebase SDK (Auth):** `signInWithPopup`, `signOut`, `GoogleAuthProvider`.
*   **Hooks:** `useAuth` to access the authentication context.
*   **ShadCN UI:** `Button`, `Avatar`, `DropdownMenu` to build the interface.
*   **Lucide-react:** Icons for buttons and menu items.

    