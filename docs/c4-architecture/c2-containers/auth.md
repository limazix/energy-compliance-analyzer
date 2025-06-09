
# C2 Model: Container Detail - Authentication Service (Firebase Authentication)

[<- Back to Container Overview (C2)](./index.md)

## Description

**Firebase Authentication** provides backend services, easy-to-use SDKs, and ready-made UI libraries to authenticate users in the Energy Compliance Analyzer application. It integrates directly with popular identity providers like Google Sign-In.

## Responsibilities (Behaviors)

*   **User Authentication:**
    *   Manages the user login flow via Google Sign-In.
    *   Verifies user identity with Google and issues Firebase ID tokens to the client.
*   **Session Management:**
    *   Maintains the user's authentication state in the Frontend Web App.
    *   Provides information about the currently logged-in user (UID, display name, email, profile picture URL).
*   **Identity Provision for Security Rules:**
    *   The UID (User ID) of the authenticated user is crucial for enforcing Firebase Firestore, Firebase Storage, and Firebase Realtime Database Security Rules.
    *   The rules use `request.auth.uid` to ensure users can only access or modify their own data.
*   **User Account Creation:**
    *   Automatically creates a user record in the Firebase Authentication backend the first time a user logs in with an identity provider (like Google).

## Technologies and Constraints

*   **Core Technology:** Firebase Authentication.
*   **Supported Identity Providers:** Configured to use Google Sign-In. Could be extended to other OAuth providers (Facebook, Twitter, GitHub), email/password, phone number, etc.
*   **SDKs:**
    *   The Firebase SDK for client (web) is used in the Frontend Web App to initiate the login flow and observe authentication state changes.
    *   The Firebase Admin SDK can be used in server environments (Next.js Server Actions, Firebase Functions) to verify ID tokens or manage users programmatically (though user management is not a core feature of this system).
*   **ID Tokens:** Uses JWT (JSON Web Tokens) ID tokens to securely communicate authentication state between the client and backend services (or to validate access in Server Actions).
*   **Security:**
    *   Handles the complexity of OAuth flows and secure credential storage.
    *   Helps protect against various common attack vectors related to authentication.
*   **Integration with Firebase:** Tightly integrated with other Firebase services, allowing granular access control based on user identity.
*   **Costs:** Firebase Authentication has a generous free tier for most login methods (including Google Sign-In). Costs may apply for more advanced features or very high volumes of phone authentication (SMS).
*   **User Interface:** Although Firebase provides FirebaseUI (a drop-in UI library), this project implements a custom login interface in the Frontend Web App that directly invokes the Firebase Authentication SDK.

    