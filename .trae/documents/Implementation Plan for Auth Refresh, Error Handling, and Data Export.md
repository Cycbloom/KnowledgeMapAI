I will implement the requested features in the following phases:

### Phase 1: Implement Token Seamless Refresh (Backend & Frontend)
**Goal**: Prevent users from being logged out when their access token expires by using a refresh token.

1.  **Backend (`api/routes/auth.ts`)**:
    *   Create a new endpoint `POST /auth/refresh`.
    *   This endpoint will accept a `refreshToken`, call Supabase's `refreshSession` method, and return the new session (new Access Token & Refresh Token).

2.  **Frontend State (`src/store/useStore.ts`)**:
    *   Update the store to save `refreshToken` in `localStorage` alongside the existing `token`.
    *   Update `setUser` action to handle both tokens.

3.  **Frontend Networking (`src/services/api.ts`)**:
    *   Modify the `login` function to store the received `refreshToken`.
    *   Implement a **Automatic Retry Mechanism** in the `fetch` wrapper:
        *   When a 401 error occurs, pause the request.
        *   Call the new `/auth/refresh` endpoint using the stored refresh token.
        *   If successful: Update the store with new tokens and retry the original failed request with the new token.
        *   If failed: Clear user data and redirect to login (existing behavior).

### Phase 2: Optimize Global Error Boundary
**Goal**: Ensure AI feature failures (e.g., in Graph Editor) do not crash the entire application (White Screen of Death).

1.  **Refine Error Boundary (`src/components/ErrorBoundary.tsx`)**:
    *   Ensure the component supports a custom `fallback` prop (already does).

2.  **Apply Granular Boundaries (`src/pages/GraphEditor.tsx` & others)**:
    *   Wrap critical AI-heavy components (like the Graph Editor workspace or AI sidebars) with `<ErrorBoundary>`.
    *   Provide a specific fallback UI for these sections (e.g., "AI Service Unavailable, please save your work and refresh" instead of a full page crash).

### Phase 3: General Data Export (Tasks)
**Goal**: Allow users to export their task list data.

1.  **Task List Export (`src/pages/Tasks.tsx`)**:
    *   Add an **"Export Data"** button to the Task List page toolbar.
    *   Implement logic to export the current list of tasks as a **JSON** or **CSV** file.
    *   Utilize the existing `src/utils/exportUtils.ts` if applicable, or extend it.

I will start with Phase 1 (Auth) as it is the most critical infrastructure change.
