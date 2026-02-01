# FSRS Algorithm Customization & Visualization Plan

## 1. Database Schema Update
- Create migration `supabase/migrations/20260201000004_add_user_settings.sql` to add a `settings` JSONB column to the `users` table.
- This will store user-specific configurations, including FSRS parameters (`request_retention`, `maximum_interval`, etc.).

## 2. Backend Implementation
### API Routes
- **`api/routes/auth.ts`**:
  - Add `PUT /profile` endpoint to allow users to update their profile `settings`.
  - Ensure `GET /user` returns the `settings` field (already covered by `select('*')`).
- **`api/routes/study.ts`**:
  - Refactor to remove the static global `fsrs` instance.
  - Implement a helper to fetch user settings and initialize `fsrs` with custom parameters (e.g., `request_retention`, `maximum_interval`) for each request.
  - Use these dynamic parameters in `PUT /cards/:id/progress` calculations.

## 3. Frontend Implementation
### Profile Page (`src/pages/Profile.tsx`)
- Add an "Algorithm Configuration" section.
- Implement sliders/inputs for:
  - **Target Retention**: Default 0.90 (90%).
  - **Maximum Interval**: Default 36500 days.
- Add "Save Configuration" functionality connecting to the new `PUT /profile` endpoint.

### Statistics Page (`src/pages/Statistics.tsx`)
- **Add "Theoretical Forgetting Curve" Chart**:
  - Visualize the retention decay formula ($R = (1 + factor \times t / S)^{decay}$) based on the user's current settings.
  - Show curves for different Stability (S) values (e.g., S=1, 7, 30 days) to help users understand how their settings affect scheduling.
- **Enhance Forecast Chart**:
  - Ensure the existing "Future Review Forecast" is clearly visible and labeled as "Review Load Prediction".

## 4. Type Definitions
- Update `src/types/index.ts` to include `settings` in the `User` or `Profile` interface.
