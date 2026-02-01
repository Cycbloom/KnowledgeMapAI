I have identified the potential causes for the issue where "Separate execution of question card generation tasks" returns 0 cards. The main issues are likely related to **content length limits** causing AI request failures (which are swallowed/logged but result in 0 cards) and **imprecise generation count logic**.

Here is the plan to fix it:

1.  **Modify `api/jobs/taskProcessor.ts`**:
    *   **Implement Content Truncation**: Truncate `node_content` before sending it to the AI service (e.g., limit to 15,000 characters). This prevents OpenAI/DeepSeek from rejecting requests due to context window overflow, which is a common cause for "silent failure" with large nodes.
    *   **Optimize Count Distribution**: Fix the `countPerType` logic. currently `Math.ceil(total / types)` causes over-generation (e.g., asking for 3 cards with 2 types generates 4). I will implement a dynamic remaining-count logic to ensure the exact requested number is generated.
    *   **Improve Error Handling**: Instead of just logging errors to the console, I will track failed types and include them in the task result. This will help with future debugging and user feedback.
    *   **Fix Config Fallback**: Ensure that even if `config` is missing (e.g., from "Backstage Generate" button), the task has sensible defaults and doesn't crash or behave unexpectedly.

2.  **Verify `api/services/aiService.ts`** (Read-only check):
    *   Ensure the prompt construction correctly handles the `type` parameter and doesn't conflict with the `types` array logic.

3.  **Validation**:
    *   I will verify the changes by creating a test task (conceptually) or ensuring the code logic is sound.
    *   The fix addresses the root cause of "0 cards" (likely API failure due to content length) and improves the generation quality.

This plan addresses the "0 cards" anomaly by ensuring requests are valid (truncated) and correctly counted.
