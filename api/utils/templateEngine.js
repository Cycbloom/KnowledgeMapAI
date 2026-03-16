/**
 * Simple Template Engine
 * Supports:
 * - Variable replacement: {{variable}}
 * - Boolean conditionals: {{#if variable}}...{{else}}...{{/if}} or {{#if variable}}...{{/if}}
 * - Nested conditionals are supported via recursion
 */
export class TemplateEngine {
    static render(template, context) {
        if (!template)
            return '';
        return this.parseBlock(template, context);
    }
    static parseBlock(text, context) {
        let output = '';
        let cursor = 0;
        while (cursor < text.length) {
            const openTagIndex = text.indexOf('{{#if', cursor);
            const variableIndex = text.indexOf('{{', cursor);
            // If no more tags or variables, append rest and break
            if (variableIndex === -1) {
                output += text.slice(cursor);
                break;
            }
            // Check if it's a variable {{var}} or block {{#if}}
            // If we see a variable before an if block (or no if block), handle variable
            if (openTagIndex === -1 || (variableIndex < openTagIndex && text[variableIndex + 2] !== '#')) {
                // It's a variable {{key}}
                const closeIndex = text.indexOf('}}', variableIndex);
                if (closeIndex === -1) {
                    output += text.slice(cursor);
                    break;
                }
                // Append text before variable
                output += text.slice(cursor, variableIndex);
                const key = text.slice(variableIndex + 2, closeIndex).trim();
                const value = context[key];
                output += value !== undefined && value !== null ? String(value) : '';
                cursor = closeIndex + 2;
            }
            else {
                // It's a block {{#if key}}
                // Append text before block
                output += text.slice(cursor, openTagIndex);
                // Find key
                const tagCloseIndex = text.indexOf('}}', openTagIndex);
                const key = text.slice(openTagIndex + 5, tagCloseIndex).trim();
                // Find the matching {{/if}} taking nesting into account
                let balance = 1;
                let searchCursor = tagCloseIndex + 2;
                let closeBlockIndex = -1;
                let elseBlockIndex = -1;
                while (searchCursor < text.length) {
                    const nextOpen = text.indexOf('{{#if', searchCursor);
                    const nextClose = text.indexOf('{{/if}}', searchCursor);
                    const nextElse = text.indexOf('{{else}}', searchCursor);
                    // Find the nearest relevant tag
                    const candidates = [
                        { idx: nextOpen, type: 'open' },
                        { idx: nextClose, type: 'close' }
                    ].filter(c => c.idx !== -1).sort((a, b) => a.idx - b.idx);
                    if (candidates.length === 0)
                        break; // Error: unclosed block
                    const nearest = candidates[0];
                    // Check for else (only relevant if we are at balance 1)
                    if (balance === 1 && nextElse !== -1 && nextElse < nearest.idx) {
                        if (elseBlockIndex === -1)
                            elseBlockIndex = nextElse;
                        searchCursor = nextElse + 8; // skip {{else}}
                        continue;
                    }
                    if (nearest.type === 'open') {
                        balance++;
                        searchCursor = nearest.idx + 5;
                    }
                    else {
                        balance--;
                        if (balance === 0) {
                            closeBlockIndex = nearest.idx;
                            break;
                        }
                        searchCursor = nearest.idx + 7;
                    }
                }
                if (closeBlockIndex === -1) {
                    // Unclosed block, just treat as text
                    output += text.slice(openTagIndex);
                    break;
                }
                // Process block content
                const condition = !!context[key];
                let contentToRender = '';
                if (condition) {
                    // Render the 'true' part
                    const endTruePart = elseBlockIndex !== -1 ? elseBlockIndex : closeBlockIndex;
                    contentToRender = text.slice(tagCloseIndex + 2, endTruePart);
                }
                else {
                    // Render the 'else' part (if exists)
                    if (elseBlockIndex !== -1) {
                        contentToRender = text.slice(elseBlockIndex + 8, closeBlockIndex);
                    }
                }
                // Recursively parse the chosen content
                output += this.parseBlock(contentToRender, context);
                cursor = closeBlockIndex + 7; // skip {{/if}}
            }
        }
        return output;
    }
}
//# sourceMappingURL=templateEngine.js.map