I will implement the requested changes to the Study Mode and Gamification Logic.

### **Backend (`api/services/graphService.ts`)**
1.  **Enhance `getGraphNodeStatus`**:
    *   Fetch `settings` from the `knowledge_graphs` table.
    *   **Gamification Switch**: Check `settings.gamification_enabled`. If false, all nodes are unlocked.
    *   **Learning Direction**: Check `settings.learning_direction` ('top_down' vs 'bottom_up').
        *   **Top-Down (Default)**: Children depend on Parents (Parent not mastered -> Child locked).
        *   **Bottom-Up (Leaf First)**: Parents depend on Children (Children not mastered -> Parent locked).

### **Frontend - Study Page (`src/pages/Study.tsx`)**
1.  **Dashboard View (New Default State)**:
    *   Instead of starting the quiz immediately, show a **Study Dashboard**.
    *   **Stats**: Total cards, Mastered count, Due count.
    *   **Actions**: "Start Review" (Due cards), "Cram Mode" (All cards).
    *   **Question Bank (Card List)**: A table displaying all generated questions for the current scope (Graph or Node).
        *   Columns: Question, Answer, Type, Mastery Status.
        *   Actions: Delete card.
2.  **Quiz View**:
    *   Only activated when the user clicks "Start".
    *   Includes a "Back to Dashboard" button.

### **Frontend - Graph Editor (`src/pages/GraphEditor.tsx`)**
1.  **Settings Modal**:
    *   Add a "Graph Settings" dialog (accessible via a gear icon or menu).
    *   **Toggles**:
        *   "Enable Gamification / Level Mode" (开启闯关模式).
        *   "Learning Order" (学习顺序): "Root to Leaf" (Top-Down) vs "Leaf to Root" (Bottom-Up).

### **Summary of User Experience Changes**
*   **Study Page**: Now acts as a central hub with a question bank list, preventing the "start immediately" jarring experience.
*   **Gamification**: Users can now choose to learn from **Leaf Nodes first** (treating them as parts of the whole) and can toggle the entire gamification system on/off.
