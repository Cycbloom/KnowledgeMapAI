I will implement the **Batch Question Generation** feature in the Outline View, including the following steps:

### 1. Database & Schema Update
*   **Migration**: Create a new migration file to add the `explanation` (TEXT) column to the `study_cards` table to store the answer analysis/explanation.
*   **Type Definitions**: Update TypeScript interfaces (`StudyCard`) in frontend and backend to include `explanation`.

### 2. Backend Implementation (`api/`)
*   **Enhanced AI Service (`aiService.ts`)**:
    *   Refactor `generateCards` to support **Context-Aware Generation**. It will accept `parentNode` information to provide hierarchical context (e.g., "This node is a child of 'React Performance'").
    *   Implement **Dynamic Prompts**: Construct specific prompts for each question type (`qa`, `choice`, `true_false`) as requested.
    *   Update the System Prompt to require an `explanation` field in the JSON output.
*   **New Endpoint (`batch-generate-cards`)**:
    *   Create a new API endpoint handling batch requests.
    *   **Top-Down Processing**: The logic will sort selected nodes by hierarchy (Root → Leaf) to ensure questions are generated following the learning order.
    *   **Context Assembly**: For each node, it will fetch its parent's title/content to inject as context into the AI prompt.

### 3. Frontend Implementation (`src/`)
*   **Outline View Update (`GraphOutline.tsx`)**:
    *   Add a **"Generate Questions" button** to the multi-select toolbar (visible when nodes are selected).
*   **New Component (`BatchGenerateDialog`)**:
    *   Allow users to select **Question Types** (Multiple Choice, Q&A, True/False).
    *   Allow users to set **Question Count** per node.
    *   Show a progress indicator during the batch generation process.
*   **Study Mode Update**:
    *   Update the Card UI to display the `explanation` (Parsing) when the answer is revealed.

### 4. Verification
*   Verify that questions are generated with explanations.
*   Verify that parent nodes are processed before child nodes (or context is correctly applied).
*   Verify that different question types follow their specific prompt instructions.
