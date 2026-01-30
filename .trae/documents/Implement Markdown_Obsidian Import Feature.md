I will implement the **Markdown/Obsidian Import** feature by extending the existing import functionality in the Dashboard.

### Implementation Plan

1.  **Frontend: Update Dashboard Import (`src/pages/Dashboard.tsx`)**
    *   **Modify File Input**: Update the existing "Import" button's file input to accept `.md` files in addition to `.json`.
    *   **Add Logic**: In the file handler, detect `.md` extension and trigger a specialized Markdown parser.
    *   **Reuse Backend**: The parsed data will be converted to the standard JSON format and sent to the existing `/api/data/import` endpoint, which already handles graph creation and ID mapping.

2.  **Utility: Create Markdown Parser (`src/utils/markdownParser.ts`)**
    *   **Create new utility** to parse Markdown text into Graph Nodes and Edges.
    *   **Hierarchy Logic**:
        *   `# H1` -> **Root** Node (Purple)
        *   `## H2` -> **Core** Node (Red) - *Child of H1*
        *   `### H3` -> **Sub** Node (Orange) - *Child of H2*
        *   `#### H4` -> **Normal** Node (Blue) - *Child of H3*
        *   `#####+` -> **Leaf** Node (Green) - *Child of H4*
    *   **Content Extraction**: Text between headers will be captured as the node's `content` (description).
    *   **ID Generation**: Auto-generate temporary IDs (e.g., `md-1`, `md-2`) to establish relationships, which the backend will map to real UUIDs.

### Technical Details
*   **File**: `src/pages/Dashboard.tsx` (UI Update)
*   **File**: `src/utils/markdownParser.ts` (New Logic)
*   **API**: `POST /api/data/import` (Reuse existing)

This approach ensures seamless integration with your existing workflow while enabling knowledge migration from Obsidian/Notion.