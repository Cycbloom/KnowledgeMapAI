import crypto from 'crypto';

/**
 * AES-256-GCM 加密。
 * 返回格式：`iv:authTag:ciphertext`，各部分均为 base64 编码。
 *
 * @param text - 明文
 * @param key - 32 字节密钥
 * @returns base64 编码的 iv:authTag:ciphertext
 */
export function encrypt(text: string, key: Buffer): string {
  if (!text) {
    throw new Error('Encryption failed: text is empty');
  }
  if (!key || key.length !== 32) {
    throw new Error('Encryption failed: key must be a 32-byte Buffer');
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * AES-256-GCM 解密。
 * 输入格式：`iv:authTag:ciphertext`，各部分均为 base64 编码。
 *
 * @param ciphertext - 加密字符串（格式为 iv:authTag:ciphertext）
 * @param key - 32 字节密钥
 * @returns 明文
 */
export function decrypt(ciphertext: string, key: Buffer): string {
  if (!ciphertext) {
    throw new Error('Decryption failed: ciphertext is empty');
  }
  if (!key || key.length !== 32) {
    throw new Error('Decryption failed: key must be a 32-byte Buffer');
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Decryption failed: invalid ciphertext format, expected iv:authTag:ciphertext');
  }

  const [ivBase64, authTagBase64, encryptedBase64] = parts;

  let iv: Buffer;
  let authTag: Buffer;
  try {
    iv = Buffer.from(ivBase64, 'base64');
    authTag = Buffer.from(authTagBase64, 'base64');
  } catch {
    throw new Error('Decryption failed: invalid base64 encoding in iv or authTag');
  }

  if (iv.length !== 12) {
    throw new Error('Decryption failed: IV must be 12 bytes');
  }
  if (authTag.length !== 16) {
    throw new Error('Decryption failed: auth tag must be 16 bytes');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  try {
    let decrypted = decipher.update(encryptedBase64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    throw new Error(
      `Decryption failed: ${error instanceof Error ? error.message : 'data integrity check failed (wrong key or corrupted data)'}`,
    );
  }
}

/**
 * 从 ENCRYPTION_KEY 环境变量获取 AES-256 密钥。
 * 通过 SHA-256 哈希将环境变量值推导为 32 字节密钥。
 *
 * @returns 32 字节 Buffer
 * @throws 如果 ENCRYPTION_KEY 环境变量未设置
 */
export function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set. ' +
      'Please set it in your .env file or environment configuration.',
    );
  }
  return crypto.createHash('sha256').update(envKey, 'utf8').digest();
}

/**
 * 判断一个存储在数据库中的 apiKey 是否为加密后的密文。
 *
 * AES-256-GCM 加密格式为 `iv:authTag:ciphertext`（均为 base64），其中 iv 为 12 字节、
 * authTag 为 16 字节。仅以「恰好 3 段」判定会误伤形如 `ak:sk` 的明文密钥
 * （例如部分服务商使用冒号分隔的凭据），故这里同时校验 base64 解码后的长度。
 */
export function isEncryptedApiKey(value: string): boolean {
  if (!value) return false;
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  const [ivPart, authTagPart] = parts;
  const iv = Buffer.from(ivPart, 'base64');
  const authTag = Buffer.from(authTagPart, 'base64');
  return iv.length === 12 && authTag.length === 16;
}