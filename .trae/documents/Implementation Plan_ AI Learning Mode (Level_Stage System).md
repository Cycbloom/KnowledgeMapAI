I have analyzed the current codebase and designed a "Learning Mode" (闯关模式) that integrates your Mind Map with AI-generated coursework.

### **Plan Overview**
Transform the Mind Map from a static viewer into an interactive **Learning Roadmap**.
**Flow:** Select Node -> **"Start Learning"** -> **AI Lesson (Article + Tutor)** -> **Quiz (Challenge)** -> **Mastery (Unlock)**.

### **1. Backend: AI Learning Engine**
*   **New Feature**: Add `generateLearningMaterial` to `AIService`.
    *   **Prompt Engineering**: specialized prompt to generate **"Textbook-quality"** lessons (Intro -> Core Concepts -> Examples -> Summary) instead of short descriptions.
*   **New Endpoint**: `POST /api/ai/learning-material`.
*   **Optimization**: Ensure Markdown & LaTeX support for math/technical content.

### **2. Frontend: New "Learning Mode" Interface**
Create a dedicated `LearningMode` page (Overlay or separate route) that focuses on reading and understanding.
*   **Split-Screen Layout**:
    *   **Left (Content)**: Clean, focused Markdown reader for the AI-generated lesson.
    *   **Right (AI Tutor)**: A context-aware chat bot. It knows *exactly* what you are reading and can answer specific questions or explain difficult concepts.
*   **Action Flow**:
    *   **"Start Quiz" Button**: Appears after reading. Transitions to the existing **Flashcard/Quiz System** (`Study.tsx`).

### **3. Integration: Graph as Map**
*   **Entry Point**: Add a **"Start Level / 开启闯关"** button in the Node Detail sidebar (`GraphEditor`).
*   **Visual Feedback**: (Optional for V1) When a user passes the quiz, the node in the graph changes color (e.g., Gold) to indicate "Mastery".

### **4. Reuse Existing Assets**
*   **Quiz System**: We will reuse the powerful `Study.tsx` (FSRS algorithm, multiple question types) for the "Challenge" phase.
*   **AI Service**: Reuse existing Chat and Card generation logic.

### **Implementation Steps**
1.  **Backend**: Implement `generateLearningMaterial` API.
2.  **Frontend**: Create `src/pages/LearningMode.tsx` with Split View (Reader + Chat).
3.  **Frontend**: Link `GraphEditor` -> `LearningMode` -> `Study (Quiz)`.
4.  **Verification**: Test the full loop (Generate -> Read -> Chat -> Quiz).
