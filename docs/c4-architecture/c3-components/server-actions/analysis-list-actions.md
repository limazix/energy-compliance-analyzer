# C3: Component - Analysis Listing Actions (`analysisListActions`)

[<- Back to Server Actions Components](./../02-server-actions-components.md)

## Description

The **Analysis Listing Actions** component (`src/features/analysis-listing/actions/analysisListingActions.ts`) is a Server Actions module focused on fetching and returning a user's list of past analyses from Firebase Firestore.

## Responsibilities (Behaviors)

- **Fetch Past Analyses (`getPastAnalysesAction`):**
  - Receives the user ID.
  - Constructs a Firebase Firestore query to fetch all documents in the `users/{userId}/analyses` subcollection.
  - Orders results, typically by creation date (`createdAt`) in descending order, to show the most recent analyses first.
  - Filters out analyses with a "deleted" status to not display them to the user.
  - Maps data from Firestore documents to the `Analysis` type defined in the application, including converting Firestore Timestamps to ISO strings or Date objects as needed for the frontend.
  - Returns an array of `Analysis` objects.
  - Handles query errors, such as permission denied or network issues.

## Technologies and Key Aspects

- **TypeScript:** For typing analysis data and action parameters.
- **Next.js Server Actions:** To expose fetching functionality securely.
- **Firebase Firestore:**
  - `collection` to reference the user's analyses subcollection.
  - `query` to build the query.
  - `orderBy` to sort results.
  - `where` to filter analyses (e.g., not show those with status "deleted").
  - `getDocs` to execute the query and get the document snapshot.
  - Handling of Firestore `Timestamp`.
- **Error Handling:** Manages and propagates errors that may occur during Firestore queries.
- **Data Typing:** Ensures returned data conforms to the `Analysis` interface.
