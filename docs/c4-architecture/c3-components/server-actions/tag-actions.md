
# C3: Component - Tag Management Actions (`tagActions`)

[<- Back to Server Actions Components](./../02-server-actions-components.md)

## Description

The **Tag Management Actions** component (`src/features/tag-management/actions/tagActions.ts`) is a Server Actions module dedicated to adding and removing tags from a specific analysis in Firebase Firestore.

## Responsibilities (Behaviors)

*   **Add Tag (`addTagToAction`):**
    *   Receives user ID, analysis ID, and the tag string to be added.
    *   Reads the analysis document from Firestore.
    *   Checks if the tag already exists in the document's `tags` array.
    *   If the tag doesn't exist, adds it to the `tags` array and updates the Firestore document.
    *   Performs input validation (e.g., tag cannot be empty).
*   **Remove Tag (`removeTagAction`):**
    *   Receives user ID, analysis ID, and the tag string to be removed.
    *   Reads the analysis document from Firestore.
    *   Filters the `tags` array to remove the specified tag.
    *   Updates the Firestore document with the new tags array.

## Technologies and Key Aspects

*   **TypeScript:** For typing and code organization.
*   **Next.js Server Actions:** To execute tag modification logic on the server.
*   **Firebase Firestore:**
    *   `getDoc` to read the current state of an analysis's tags.
    *   `updateDoc` to modify the `tags` array in the analysis document.
    *   Use of Firestore array operators (if applicable, or server-side array manipulation before update).
*   **Array Manipulation:** Logic to add or remove elements from an array idempotently (for addition) and safely.
*   **Error Handling:** Manages errors like analysis not found or document update failures.

    