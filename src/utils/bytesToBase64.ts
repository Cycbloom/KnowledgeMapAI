/**
 * 将字节数组编码为 base64 字符串。
 *
 * 统一 useRealtimeSTT 与 silentAuth 中重复的「二进制→base64」实现；
 * 采用分块写入（而非 String.fromCharCode(...bytes) 的展开写法），
 * 避免大输入时调用栈溢出。
 */
export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode(...Array.from(chunk));
  }
  return btoa(binary);
};