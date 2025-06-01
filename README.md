# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Firebase Integration

This project is configured to be deployed to the Firebase project `electric-magnitudes-analizer` using Firebase App Hosting.

### Prerequisites

- Ensure you have the [Firebase CLI](https://firebase.google.com/docs/cli) installed and you are logged in (`firebase login`).
- Make sure your local project directory is associated with the `electric-magnitudes-analizer` project. The `.firebaserc` file included in this project sets this as the default. You can confirm by running `firebase use electric-magnitudes-analizer` or check with `firebase projects:list`.

### Deployment

To deploy this application to Firebase App Hosting:

1.  **Build your Next.js application:**
    ```bash
    npm run build
    ```

2.  **Deploy using the Firebase CLI:**
    The `apphosting.yaml` file configures the backend.
    ```bash
    firebase apphosting:backends:deploy
    ```
    The CLI will guide you to select or create a backend resource within your `electric-magnitudes-analizer` project.

    Alternatively, if you have a specific backend ID:
    ```bash
    firebase apphosting:backends:deploy YOUR_BACKEND_ID --project electric-magnitudes-analizer
    ```

For more details, refer to the [Firebase App Hosting documentation](https://firebase.google.com/docs/app-hosting).
