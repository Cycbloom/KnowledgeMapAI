import type { AgentTool, ToolCategory, ToolContext } from './types';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';

export class ToolRegistry {
  private tools: Map<string, AgentTool> = new Map();

  register(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  getAll(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  getByCategory(category: ToolCategory): AgentTool[] {
    return this.getAll().filter(
      (tool) => (tool.category ?? "read") === category,
    );
  }

  getWriteTools(): AgentTool[] {
    return this.getByCategory("write");
  }

  getToolDefinitions(
    allowWrite?: boolean,
  ): Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> {
    const tools = allowWrite
      ? this.getAll()
      : this.getByCategory("read");
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<unknown> {
    const tool = this.get(name);
    if (!tool) {
      throw new AppError(`Tool not found: ${name}`, 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    return tool.execute(args, context);
  }
}
