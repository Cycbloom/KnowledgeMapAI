import { describe, it, expect, beforeEach } from 'vitest';
import { CommandParser } from '../../../services/console/CommandParser';
import type { CommandOption, ParsedArgs } from '../../../services/console/types';

describe('CommandParser', () => {
  let parser: CommandParser;

  beforeEach(() => {
    parser = new CommandParser();
  });

  describe('基本命令解析', () => {
    it('应该解析简单命令', () => {
      const result = parser.parse('help');
      
      expect(result).not.toHaveProperty('message');
      expect((result as ParsedArgs).command).toBe('help');
      expect((result as ParsedArgs).options).toEqual({});
      expect((result as ParsedArgs).positional).toEqual([]);
    });

    it('应该解析带子命令的命令', () => {
      const result = parser.parse('graph list');
      
      expect(result).not.toHaveProperty('message');
      expect((result as ParsedArgs).command).toBe('graph');
      expect((result as ParsedArgs).subcommand).toBe('list');
    });

    it('应该解析带多个位置参数的命令', () => {
      const result = parser.parse('node create "节点标题" "节点内容"');
      
      expect(result).not.toHaveProperty('message');
      expect((result as ParsedArgs).command).toBe('node');
      expect((result as ParsedArgs).subcommand).toBe('create');
      expect((result as ParsedArgs).positional).toEqual(['节点标题', '节点内容']);
    });

    it('应该处理空命令', () => {
      const result = parser.parse('');
      
      expect(result).toHaveProperty('message');
      expect((result as { message: string }).message).toBe('Empty command');
    });

    it('应该处理只有空格的命令', () => {
      const result = parser.parse('   ');
      
      expect(result).toHaveProperty('message');
      expect((result as { message: string }).message).toBe('Empty command');
    });

    it('应该修剪命令前后的空格', () => {
      const result = parser.parse('  help  ');
      
      expect(result).not.toHaveProperty('message');
      expect((result as ParsedArgs).command).toBe('help');
    });
  });

  describe('长选项解析', () => {
    it('应该解析带字符串值的长选项', () => {
      const result = parser.parse('graph create --name "我的图谱"');
      
      expect(result).not.toHaveProperty('message');
      expect((result as ParsedArgs).command).toBe('graph');
      expect((result as ParsedArgs).options.name).toBe('我的图谱');
    });

    it('应该解析带数值的长选项', () => {
      const result = parser.parse('task list --limit 10');
      
      expect(result).not.toHaveProperty('message');
      expect((result as ParsedArgs).options.limit).toBe('10');
    });

    it('应该解析布尔长选项（无值）', () => {
      const result = parser.parse('graph list --verbose');
      
      expect(result).not.toHaveProperty('message');
      expect((result as ParsedArgs).options.verbose).toBe(true);
    });

    it('应该解析多个长选项', () => {
      const result = parser.parse('export --format json --output "./data.json"');
      
      expect(result).not.toHaveProperty('message');
      expect((result as ParsedArgs).options.format).toBe('json');
      expect((result as ParsedArgs).options.output).toBe('./data.json');
    });

    it('应该解析带连字符的长选项名', () => {
      const result = parser.parse('cmd --some-option value');
      
      expect(result).not.toHaveProperty('message');
      expect((result as ParsedArgs).options['some-option']).toBe('value');
    });
  });

  describe('短选项解析', () => {
    it('应该解析短选项', () => {
      const result = parser.parse('graph list -v');
      
      expect(result).not.toHaveProperty('message');
      expect((result as ParsedArgs).options.v).toBe(true);
    });

    it('应该解析带值的短选项', () => {
      const result = parser.parse('task list -l 5');
      
      expect(result).not.toHaveProperty('message');
      expect((result as ParsedArgs).options.l).toBe('5');
    });

    it('应该解析多个短选项', () => {
      const result = parser.parse('cmd -a value1 -b value2');
      
      expect(result).not.toHaveProperty('message');
      expect((result as ParsedArgs).options.a).toBe('value1');
      expect((result as ParsedArgs).options.b).toBe('value2');
    });
  });

  describe('布尔选项解析', () => {
    it('应该将无值的选项解析为 true', () => {
      const result = parser.parse('cmd --flag');
      
      expect(result).not.toHaveProperty('message');
      expect((result as ParsedArgs).options.flag).toBe(true);
    });

    it('应该正确处理选项后跟另一个选项', () => {
      const result = parser.parse('cmd --flag --other value');
      
      expect(result).not.toHaveProperty('message');
      expect((result as ParsedArgs).options.flag).toBe(true);
      expect((result as ParsedArgs).options.other).toBe('value');
    });
  });

  describe('位置参数解析', () => {
    it('应该解析简单位置参数', () => {
      const result = parser.parse('cmd subcommand arg1 arg2');
      
      expect(result).not.toHaveProperty('message');
      expect((result as ParsedArgs).command).toBe('cmd');
      expect((result as ParsedArgs).subcommand).toBe('subcommand');
      expect((result as ParsedArgs).positional).toEqual(['arg1', 'arg2']);
    });

    it('应该区分子命令和位置参数', () => {
      const result = parser.parse('graph create myGraph --public');
      
      expect(result).not.toHaveProperty('message');
      expect((result as ParsedArgs).command).toBe('graph');
      expect((result as ParsedArgs).subcommand).toBe('create');
      expect((result as ParsedArgs).positional).toEqual(['myGraph']);
      expect((result as ParsedArgs).options.public).toBe(true);
    });

    it('应该将选项值后的参数作为位置参数', () => {
      const result = parser.parse('cmd subcommand --name test arg1');
      
      expect(result).not.toHaveProperty('message');
      expect((result as ParsedArgs).subcommand).toBe('subcommand');
      expect((result as ParsedArgs).options.name).toBe('test');
      expect((result as ParsedArgs).positional).toEqual(['arg1']);
    });

    it('应该正确处理没有子命令的位置参数', () => {
      const result = parser.parse('cmd --name test');
      
      expect(result).not.toHaveProperty('message');
      expect((result as ParsedArgs).command).toBe('cmd');
      expect((result as ParsedArgs).subcommand).toBeUndefined();
      expect((result as ParsedArgs).options.name).toBe('test');
    });
  });

  describe('带引号的字符串解析', () => {
    it('应该解析双引号字符串', () => {
      const result = parser.parse('cmd subcommand "hello world"');
      
      expect(result).not.toHaveProperty('message');
      expect((result as ParsedArgs).subcommand).toBe('subcommand');
      expect((result as ParsedArgs).positional).toEqual(['hello world']);
    });

    it('应该解析单引号字符串', () => {
      const result = parser.parse("cmd subcommand 'hello world'");
      
      expect(result).not.toHaveProperty('message');
      expect((result as ParsedArgs).subcommand).toBe('subcommand');
      expect((result as ParsedArgs).positional).toEqual(['hello world']);
    });

    it('应该处理引号内的转义字符', () => {
      const result = parser.parse('cmd subcommand "hello \\"world\\""');
      
      expect(result).not.toHaveProperty('message');
      expect((result as ParsedArgs).subcommand).toBe('subcommand');
      expect((result as ParsedArgs).positional).toEqual(['hello "world"']);
    });

    it('应该处理引号内的转义反斜杠', () => {
      const result = parser.parse('cmd subcommand "path\\\\to\\\\file"');
      
      expect(result).not.toHaveProperty('message');
      expect((result as ParsedArgs).subcommand).toBe('subcommand');
      expect((result as ParsedArgs).positional).toEqual(['path\\to\\file']);
    });

    it('应该处理带空格的选项值', () => {
      const result = parser.parse('cmd --name "My Graph Name"');
      
      expect(result).not.toHaveProperty('message');
      expect((result as ParsedArgs).options.name).toBe('My Graph Name');
    });

    it('应该报告未闭合的引号错误', () => {
      const result = parser.parse('cmd "unclosed string');
      
      expect(result).toHaveProperty('message');
      expect((result as { message: string }).message).toBe('Unterminated quoted string');
    });
  });

  describe('错误处理', () => {
    it('应该报告无效的长选项', () => {
      const result = parser.parse('cmd --');
      
      expect(result).toHaveProperty('message');
      expect((result as { message: string }).message).toBe('Invalid option name after --');
    });

    it('应该报告无效的短选项', () => {
      const result = parser.parse('cmd -1');
      
      expect(result).toHaveProperty('message');
      expect((result as { message: string }).message).toBe('Invalid short option');
    });

    it('应该报告无效的短选项（数字）', () => {
      const result = parser.parse('cmd -');
      
      expect(result).toHaveProperty('message');
    });
  });

  describe('applyOptionDefaults', () => {
    it('应该应用默认值到未设置的选项', () => {
      const parsedArgs: ParsedArgs = {
        command: 'test',
        options: {},
        positional: [],
      };
      
      const options: CommandOption[] = [
        { name: 'limit', type: 'number', description: 'Limit', required: false, default: 10 },
        { name: 'format', type: 'string', description: 'Format', required: false, default: 'json' },
      ];
      
      const result = parser.applyOptionDefaults(parsedArgs, options);
      
      expect(result.options.limit).toBe(10);
      expect(result.options.format).toBe('json');
    });

    it('不应该覆盖已设置的选项', () => {
      const parsedArgs: ParsedArgs = {
        command: 'test',
        options: { limit: 20 },
        positional: [],
      };
      
      const options: CommandOption[] = [
        { name: 'limit', type: 'number', description: 'Limit', required: false, default: 10 },
      ];
      
      const result = parser.applyOptionDefaults(parsedArgs, options);
      
      expect(result.options.limit).toBe(20);
    });

    it('应该保留原始参数不变', () => {
      const parsedArgs: ParsedArgs = {
        command: 'test',
        options: { existing: 'value' },
        positional: ['arg1'],
      };
      
      const options: CommandOption[] = [];
      
      const result = parser.applyOptionDefaults(parsedArgs, options);
      
      expect(result.command).toBe('test');
      expect(result.options.existing).toBe('value');
      expect(result.positional).toEqual(['arg1']);
    });
  });

  describe('validateOptions', () => {
    it('应该通过有效选项验证', () => {
      const parsedArgs: ParsedArgs = {
        command: 'test',
        options: { name: 'test' },
        positional: [],
      };
      
      const options: CommandOption[] = [
        { name: 'name', type: 'string', description: 'Name', required: true },
      ];
      
      const result = parser.validateOptions(parsedArgs, options);
      
      expect(result).toBeNull();
    });

    it('应该检测缺少的必需选项', () => {
      const parsedArgs: ParsedArgs = {
        command: 'test',
        options: {},
        positional: [],
      };
      
      const options: CommandOption[] = [
        { name: 'name', type: 'string', description: 'Name', required: true },
      ];
      
      const result = parser.validateOptions(parsedArgs, options);
      
      expect(result).not.toBeNull();
      expect(result?.message).toContain("Required option 'name' is missing");
    });

    it('应该验证字符串类型', () => {
      const parsedArgs: ParsedArgs = {
        command: 'test',
        options: { name: true },
        positional: [],
      };
      
      const options: CommandOption[] = [
        { name: 'name', type: 'string', description: 'Name', required: false },
      ];
      
      const result = parser.validateOptions(parsedArgs, options);
      
      expect(result).not.toBeNull();
      expect(result?.message).toContain("must be a string");
    });

    it('应该验证布尔类型', () => {
      const parsedArgs: ParsedArgs = {
        command: 'test',
        options: { verbose: 'yes' },
        positional: [],
      };
      
      const options: CommandOption[] = [
        { name: 'verbose', type: 'boolean', description: 'Verbose', required: false },
      ];
      
      const result = parser.validateOptions(parsedArgs, options);
      
      expect(result).not.toBeNull();
      expect(result?.message).toContain("must be a boolean");
    });

    it('应该验证数字类型（字符串形式）', () => {
      const parsedArgs: ParsedArgs = {
        command: 'test',
        options: { count: 'abc' },
        positional: [],
      };
      
      const options: CommandOption[] = [
        { name: 'count', type: 'number', description: 'Count', required: false },
      ];
      
      const result = parser.validateOptions(parsedArgs, options);
      
      expect(result).not.toBeNull();
      expect(result?.message).toContain("must be a number");
    });

    it('应该接受有效的数字字符串', () => {
      const parsedArgs: ParsedArgs = {
        command: 'test',
        options: { count: '42' },
        positional: [],
      };
      
      const options: CommandOption[] = [
        { name: 'count', type: 'number', description: 'Count', required: false },
      ];
      
      const result = parser.validateOptions(parsedArgs, options);
      
      expect(result).toBeNull();
    });
  });

  describe('convertOptionTypes', () => {
    it('应该将字符串数字转换为数字类型', () => {
      const parsedArgs: ParsedArgs = {
        command: 'test',
        options: { count: '42' },
        positional: [],
      };
      
      const options: CommandOption[] = [
        { name: 'count', type: 'number', description: 'Count', required: false },
      ];
      
      const result = parser.convertOptionTypes(parsedArgs, options);
      
      expect(result.options.count).toBe(42);
      expect(typeof result.options.count).toBe('number');
    });

    it('应该将字符串转换为数组类型', () => {
      const parsedArgs: ParsedArgs = {
        command: 'test',
        options: { tags: 'tag1' },
        positional: [],
      };
      
      const options: CommandOption[] = [
        { name: 'tags', type: 'array', description: 'Tags', required: false },
      ];
      
      const result = parser.convertOptionTypes(parsedArgs, options);
      
      expect(Array.isArray(result.options.tags)).toBe(true);
      expect(result.options.tags).toEqual(['tag1']);
    });

    it('应该保留其他选项不变', () => {
      const parsedArgs: ParsedArgs = {
        command: 'test',
        options: { name: 'test', count: '10' },
        positional: [],
      };
      
      const options: CommandOption[] = [
        { name: 'count', type: 'number', description: 'Count', required: false },
      ];
      
      const result = parser.convertOptionTypes(parsedArgs, options);
      
      expect(result.options.name).toBe('test');
      expect(result.options.count).toBe(10);
    });
  });

  describe('复杂命令解析', () => {
    it('应该解析复杂的组合命令', () => {
      const result = parser.parse('graph create "My Graph" --description "A test graph" --public --tags "tag1,tag2"');
      
      expect(result).not.toHaveProperty('message');
      const args = result as ParsedArgs;
      expect(args.command).toBe('graph');
      expect(args.subcommand).toBe('create');
      expect(args.positional).toEqual(['My Graph']);
      expect(args.options.description).toBe('A test graph');
      expect(args.options.public).toBe(true);
      expect(args.options.tags).toBe('tag1,tag2');
    });

    it('应该正确处理混合选项和位置参数', () => {
      const result = parser.parse('cmd subcommand --opt1 val1 arg1 --opt2 val2 arg2');
      
      expect(result).not.toHaveProperty('message');
      const args = result as ParsedArgs;
      expect(args.command).toBe('cmd');
      expect(args.subcommand).toBe('subcommand');
      expect(args.options.opt1).toBe('val1');
      expect(args.options.opt2).toBe('val2');
      expect(args.positional).toEqual(['arg1', 'arg2']);
    });
  });
});
