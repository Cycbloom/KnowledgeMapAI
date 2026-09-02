import { describe, it, expect } from 'vitest';
import { bytesToBase64 } from '../bytesToBase64';

describe('bytesToBase64', () => {
  it('编码空字节数组为空串', () => {
    expect(bytesToBase64(new Uint8Array(0))).toBe('');
  });

  it('正确编码小输入（与 btoa 逐字节结果一致）', () => {
    const bytes = new Uint8Array([104, 101, 108, 108, 111]); // 'hello'
    expect(bytesToBase64(bytes)).toBe('aGVsbG8=');
  });

  it('编码 UTF-8 字节序列为正确 base64', () => {
    const text = '学习图谱';
    const bytes = new TextEncoder().encode(text);
    expect(bytesToBase64(bytes)).toBe(btoa(String.fromCharCode(...Array.from(bytes))));
  });

  it('大输入不爆栈（分块路径），结果与标准 base64 一致', () => {
    const bytes = new Uint8Array(100_000).map(() => Math.floor(Math.random() * 256));
    // 分块拼接等价于一次性展开（btoa 对大输入本身支持）
    const expected = btoa(String.fromCharCode(...Array.from(bytes)));
    expect(bytesToBase64(bytes)).toBe(expected);
  });
});