I will modify `api/services/aiService.ts` to adjust the AI's behavior for node expansion.

### Changes to `expandKnowledge` method:

1. **Optimize System Prompt**:

   * Shift the primary goal to **generating new concepts** (Exploration).

   * Refine the **Linking Logic**: Explicitly instruct the AI to only link to an 'Existing Node' if it is a **perfect match**.

   * Add instruction to avoid forcing connections to loosely related existing nodes.
2. **Increase Context Limit**:

   * Increase the `existingNodes.slice(0, 50)` limit to **200**. This ensures the AI is aware of more nodes in the graph, reducing the chance of creating unintentional duplicates ("independent new nodes") while the prompt ensures it doesn't over-link.

### Expected Outcome:

* **Detail View**: Will still generate new nodes (as preferred), but will be smarter about avoiding exact duplicates of existing nodes (better linking capability).

* **Outline View**: Will stop aggressively connecting to existing nodes unless they are highly relevant, favoring the creation of new, specific sub-topics.

