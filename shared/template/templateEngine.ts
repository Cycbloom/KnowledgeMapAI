/**
 * Simple Template Engine
 * Supports:
 * - Variable replacement: {{variable}} / {{join array 'separator'}}
 * - Boolean conditionals: {{#if variable}}...{{else}}...{{/if}} or {{#if variable}}...{{/if}}
 * - Array iteration: {{#each array}}...{{/each}} (inside, use item properties; {{this}} for scalars)
 * - Nested blocks are supported via recursion
 */
export class TemplateEngine {
  static render(template: string, context: Record<string, unknown>): string {
    if (!template) return '';

    return this.parseBlock(template, context);
  }

  /**
   * 从模板文本提取全部占位符变量名（{{var}} / {{#if key}} / {{#each key}} / {{join arr 'sep'}}）。
   * 去重并按字母序返回；不含结构标记（else / /if / /each）。
   */
  static extractVariables(template: string): string[] {
    if (!template) return [];
    const vars = new Set<string>();

    // {{join array 'sep'}} → array
    const joinRe = /\{\{\s*join\s+([A-Za-z0-9_]+)/g;
    let m: RegExpExecArray | null;
    while ((m = joinRe.exec(template))) vars.add(m[1]);

    // {{var}} / {{#if key}} / {{#each key}}
    const re = /\{\{\s*(?:#(?:if|each)\s+)?([A-Za-z0-9_]+)(?:\s|'|\}\})/g;
    while ((m = re.exec(template))) {
      const name = m[1];
      if (name === 'join' || name === 'else' || name === '/if' || name === '/each') {
        continue;
      }
      vars.add(name);
    }

    return Array.from(vars).sort();
  }

  /**
   * 统计模板中的块结构数量，供前端可视化提示。
   */
  static countBlocks(
    template: string,
  ): { if: number; each: number } {
    if (!template) return { if: 0, each: 0 };
    const ifCount = (template.match(/\{\{#if\s/g) || []).length;
    const eachCount = (template.match(/\{\{#each\s/g) || []).length;
    return { if: ifCount, each: eachCount };
  }

  private static parseBlock(
    text: string,
    context: Record<string, unknown>,
  ): string {
    let output = '';
    let cursor = 0;

    while (cursor < text.length) {
      const openIndex = text.indexOf('{{', cursor);
      if (openIndex === -1) {
        output += text.slice(cursor);
        break;
      }

      const after = text.slice(openIndex + 2);

      if (after.startsWith('#if')) {
        output += text.slice(cursor, openIndex);
        const block = this.parseIfBlock(text, openIndex, context);
        if (!block.ok) {
          output += text.slice(openIndex);
          break;
        }
        output += this.parseBlock(block.content, context);
        cursor = block.end;
        continue;
      }

      if (after.startsWith('#each')) {
        output += text.slice(cursor, openIndex);
        const block = this.parseEachBlock(text, openIndex, context);
        if (!block.ok) {
          output += text.slice(openIndex);
          break;
        }
        output += block.content;
        cursor = block.end;
        continue;
      }

      // Plain variable {{key}} or helper {{join array 'sep'}}
      const closeIndex = text.indexOf('}}', openIndex);
      if (closeIndex === -1) {
        output += text.slice(cursor);
        break;
      }

      output += text.slice(cursor, openIndex);
      const expr = text.slice(openIndex + 2, closeIndex).trim();
      output += this.renderExpression(expr, context);
      cursor = closeIndex + 2;
    }

    return output;
  }

  private static renderExpression(
    expr: string,
    context: Record<string, unknown>,
  ): string {
    // {{join array 'separator'}}
    const joinMatch = /^join\s+([A-Za-z0-9_]+)\s+'([^']*)'$/.exec(expr);
    if (joinMatch) {
      const value = context[joinMatch[1]];
      if (Array.isArray(value)) {
        return value.map((v) => String(v)).join(joinMatch[2]);
      }
      return '';
    }

    if (expr === 'this') {
      return this.stringify(context['this']);
    }

    const value = context[expr];
    if (Array.isArray(value)) {
      return value.map((v) => String(v)).join(', ');
    }
    return value !== undefined && value !== null ? String(value) : '';
  }

  private static stringify(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.map((v) => String(v)).join(', ');
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      if (typeof obj.title === 'string') return obj.title;
      if (typeof obj.name === 'string') return obj.name;
      return JSON.stringify(value);
    }
    return String(value);
  }

  private static parseIfBlock(
    text: string,
    openIndex: number,
    context: Record<string, unknown>,
  ): { ok: boolean; content: string; end: number } {
    const tagClose = text.indexOf('}}', openIndex);
    if (tagClose === -1) return { ok: false, content: '', end: -1 };
    const key = text.slice(openIndex + 5, tagClose).trim();

    const { bodyStart, bodyEnd, elseIndex } = this.findBlockEnd(
      text,
      tagClose + 2,
      'if',
    );
    if (bodyEnd === -1) return { ok: false, content: '', end: -1 };

    const condition = !!context[key];
    const content = condition
      ? text.slice(bodyStart, elseIndex !== -1 ? elseIndex : bodyEnd)
      : elseIndex !== -1
        ? text.slice(elseIndex + 8, bodyEnd)
        : '';
    return { ok: true, content, end: bodyEnd + 7 };
  }

  private static parseEachBlock(
    text: string,
    openIndex: number,
    context: Record<string, unknown>,
  ): { ok: boolean; content: string; end: number } {
    const tagClose = text.indexOf('}}', openIndex);
    if (tagClose === -1) return { ok: false, content: '', end: -1 };
    const key = text.slice(openIndex + 7, tagClose).trim();

    const { bodyStart, bodyEnd } = this.findBlockEnd(
      text,
      tagClose + 2,
      'each',
    );
    if (bodyEnd === -1) return { ok: false, content: '', end: -1 };

    const arr = context[key];
    const body = text.slice(bodyStart, bodyEnd);
    let out = '';
    if (Array.isArray(arr)) {
      for (const item of arr) {
        const itemCtx =
          typeof item === 'object' && item !== null
            ? { ...context, ...(item as Record<string, unknown>) }
            : { ...context, this: item };
        out += this.parseBlock(body, itemCtx);
      }
    }
    return { ok: true, content: out, end: bodyEnd + 9 };
  }

  /**
   * 查找匹配当前块的结束位置（{{/if}} 或 {{/each}}），支持嵌套与 {{else}}。
   */
  private static findBlockEnd(
    text: string,
    start: number,
    kind: 'if' | 'each',
  ): { bodyStart: number; bodyEnd: number; elseIndex: number } {
    const bodyStart = start;
    let balance = 1;
    let cursor = start;
    let elseIndex = -1;

    while (cursor < text.length) {
      const candidates: Array<{ idx: number; type: 'open' | 'close' | 'else' }> = [];
      const nextIfOpen = text.indexOf('{{#if', cursor);
      const nextEachOpen = text.indexOf('{{#each', cursor);
      const nextIfClose = text.indexOf('{{/if}}', cursor);
      const nextEachClose = text.indexOf('{{/each}}', cursor);
      const nextElse = text.indexOf('{{else}}', cursor);

      if (nextIfOpen !== -1) candidates.push({ idx: nextIfOpen, type: 'open' });
      if (nextEachOpen !== -1) candidates.push({ idx: nextEachOpen, type: 'open' });
      if (nextIfClose !== -1) candidates.push({ idx: nextIfClose, type: 'close' });
      if (nextEachClose !== -1) candidates.push({ idx: nextEachClose, type: 'close' });
      if (nextElse !== -1 && kind === 'if') candidates.push({ idx: nextElse, type: 'else' });

      if (candidates.length === 0) break;
      candidates.sort((a, b) => a.idx - b.idx);
      const nearest = candidates[0];

      if (nearest.type === 'else') {
        if (balance === 1 && elseIndex === -1) elseIndex = nearest.idx;
        cursor = nearest.idx + 8;
        continue;
      }

      if (nearest.type === 'open') {
        balance++;
        const tagEnd = text.indexOf('}}', nearest.idx);
        cursor = tagEnd !== -1 ? tagEnd + 2 : nearest.idx + 5;
        continue;
      }

      balance--;
      if (balance === 0) {
        return { bodyStart, bodyEnd: nearest.idx, elseIndex };
      }
      cursor =
        nearest.idx !== -1 && text.startsWith('{{/if}}', nearest.idx)
          ? nearest.idx + 7
          : nearest.idx + 9;
    }

    return { bodyStart, bodyEnd: -1, elseIndex };
  }
}
