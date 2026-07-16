import { message } from './messageHelper';
import i18n from '../i18n';

/**
 * 复制文本到剪贴板，统一处理错误反馈
 * @param text 要复制的文本
 * @param successMessage 复制成功后的提示消息，传 null 则不显示成功提示
 * @returns 是否复制成功
 */
export async function copyToClipboard(
  text: string,
  successMessage: string | null = null,
): Promise<boolean> {
  try {
    if (!navigator?.clipboard?.writeText) {
      message.error(i18n.t('common.clipboard.unavailable'));
      return false;
    }
    await navigator.clipboard.writeText(text);
    if (successMessage !== null) {
      message.success(successMessage);
    }
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    message.error(i18n.t('common.clipboard.copyFailed'));
    return false;
  }
}
