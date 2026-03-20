export class TemplateEngine {
  static render(template: string, context: Record<string, any>): string {
    if (!template) return '';

    return this.parseBlock(template, context);
  }

  private static parseBlock(text: string, context: Record<string, any>): string {
    let output = '';
    let cursor = 0;

    while (cursor < text.length) {
      const openTagIndex = text.indexOf('{{#if', cursor);
      const variableIndex = text.indexOf('{{', cursor);

      if (variableIndex === -1) {
        output += text.slice(cursor);
        break;
      }

      if (openTagIndex === -1 || (variableIndex < openTagIndex && text[variableIndex + 2] !== '#')) {
        const closeIndex = text.indexOf('}}', variableIndex);
        if (closeIndex === -1) {
           output += text.slice(cursor);
           break;
        }
        
        output += text.slice(cursor, variableIndex);
        
        const key = text.slice(variableIndex + 2, closeIndex).trim();
        const value = context[key];
        output += value !== undefined && value !== null ? String(value) : '';
        
        cursor = closeIndex + 2;
      } else {
        output += text.slice(cursor, openTagIndex);
        
        const tagCloseIndex = text.indexOf('}}', openTagIndex);
        const key = text.slice(openTagIndex + 5, tagCloseIndex).trim();
        
        let balance = 1;
        let searchCursor = tagCloseIndex + 2;
        let closeBlockIndex = -1;
        let elseBlockIndex = -1;

        while (searchCursor < text.length) {
          const nextOpen = text.indexOf('{{#if', searchCursor);
          const nextClose = text.indexOf('{{/if}}', searchCursor);
          const nextElse = text.indexOf('{{else}}', searchCursor);

          const candidates = [
             { idx: nextOpen, type: 'open' }, 
             { idx: nextClose, type: 'close' }
          ].filter(c => c.idx !== -1).sort((a, b) => a.idx - b.idx);

          if (candidates.length === 0) break;

          const nearest = candidates[0];
          
          if (balance === 1 && nextElse !== -1 && nextElse < nearest.idx) {
             if (elseBlockIndex === -1) elseBlockIndex = nextElse;
             searchCursor = nextElse + 8;
             continue;
          }

          if (nearest.type === 'open') {
            balance++;
            searchCursor = nearest.idx + 5;
          } else {
            balance--;
            if (balance === 0) {
              closeBlockIndex = nearest.idx;
              break;
            }
            searchCursor = nearest.idx + 7;
          }
        }

        if (closeBlockIndex === -1) {
          output += text.slice(openTagIndex);
          break;
        }

        const condition = !!context[key];
        let contentToRender = '';

        if (condition) {
          const endTruePart = elseBlockIndex !== -1 ? elseBlockIndex : closeBlockIndex;
          contentToRender = text.slice(tagCloseIndex + 2, endTruePart);
        } else {
          if (elseBlockIndex !== -1) {
            contentToRender = text.slice(elseBlockIndex + 8, closeBlockIndex);
          }
        }

        output += this.parseBlock(contentToRender, context);

        cursor = closeBlockIndex + 7;
      }
    }

    return output;
  }
}
