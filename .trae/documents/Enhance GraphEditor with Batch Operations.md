Based on the code analysis, the **Box Selection** feature is already implemented in the underlying 3D engine (`BoxSelection.tsx`), but the **Batch Operations UI** in the editor is currently limited to just "Batch Delete".

I will enhance the `GraphEditor.tsx` to fully support the requested batch operations.

### Plan: Enhance Batch Operations in GraphEditor

1.  **Update `GraphEditor.tsx`**:
    *   **Implement Batch Logic**:
        *   Add `handleBatchColorChange(color)`: Updates the color of all selected nodes.
        *   Add `handleBatchLevelChange(level)`: Updates the level (and corresponding theme color) of all selected nodes.
        *   Use `Promise.all` to execute these updates in parallel using the existing `updateNodeMutation`.
    *   **Expand Floating Toolbar**:
        *   Modify the existing "Batch Actions Toolbar" (which currently only shows "Batch Delete").
        *   Add a **Color Picker** (Palette icon) to batch set node colors.
        *   Add a **Level Selector** (Layers icon) to batch set node hierarchy levels (Root, Core, Sub, etc.).
        *   Keep the existing "Batch Delete" button.

2.  **Verification**:
    *   Verify that `Shift + Drag` triggers the box selection (existing feature).
    *   Verify that selecting multiple nodes brings up the expanded toolbar.
    *   Verify that changing color or level applies to *all* selected nodes.

No changes are needed for `Graph3D.tsx` or `BoxSelection.tsx` as they already support the selection mechanism.
