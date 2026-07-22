import { Loader2, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, type ButtonProps } from './Button';
import { useMicrofeedback } from '@/hooks/common/useMicrofeedback';
import { message } from '@/utils/messageHelper';

/**
 * SaveButton：封装"保存"操作的按钮，内置状态机与反馈。
 *
 * 使用方式：
 * - 传入 `onSave`，**必须返回 Promise<void>**；resolve 视为成功，reject 视为失败。
 * - 内部基于 useMicrofeedback 维护状态机：idle → pending → success | error，约 1500ms 后自动回 idle。
 *   - pending：禁用按钮 + 显示 Loader2 旋转图标 + savingLabel
 *   - success：显示 Check 图标（绿色）+ savedLabel，1500ms 后回 idle
 *   - error：通过 message.error 弹错误 toast，按钮立即回 idle（不进入 success 态）
 * - 文案可通过 idleLabel / savingLabel / savedLabel 覆盖，默认走 i18n（common.save / saving / saved / saveFailed）。
 *
 * 集成约束：
 * - **不要使用底层 Button 的 `loading` prop**：SaveButtonProps 已通过 Omit 移除 loading，
 *   内部由 isPending 自行驱动图标与禁用态；外部再传 loading 会导致双 spinner 与状态不一致。
 * - **不要传 onClick**：onClick 也已 Omit，内部由 handleSave 接管。
 * - 其余 ButtonProps（variant、disabled、leftIcon 等）正常透传；idle 状态下显示 leftIcon。
 */
interface SaveButtonProps extends Omit<ButtonProps, 'onClick' | 'loading'> {
  onSave: () => Promise<void>;
  idleLabel?: string;
  savingLabel?: string;
  savedLabel?: string;
  errorToastDuration?: number;
}

export function SaveButton({
  onSave,
  idleLabel,
  savingLabel,
  savedLabel,
  errorToastDuration,
  variant = 'primary',
  disabled,
  leftIcon,
  ...rest
}: SaveButtonProps) {
  const { t } = useTranslation();
  const { isPending, isSuccess, run, reset } = useMicrofeedback({
    resetMs: 1500,
  });

  const idleText = idleLabel ?? t('common.save');
  const savingText = savingLabel ?? t('common.saving');
  const savedText = savedLabel ?? t('toast.common.saved');

  const handleSave = async () => {
    try {
      await run(onSave());
    } catch (err) {
      const errorMsg =
        err instanceof Error && err.message
          ? err.message
          : t('toast.common.saveFailed');
      message.error(
        errorMsg,
        errorToastDuration !== undefined
          ? { duration: errorToastDuration }
          : undefined,
      );
      reset();
    }
  };

  const icon = isPending ? (
    <Loader2 className="w-4 h-4 animate-spin" />
  ) : isSuccess ? (
    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
  ) : (
    leftIcon
  );

  const label = isPending
    ? savingText
    : isSuccess
      ? savedText
      : idleText;

  const isDisabled = disabled || isPending;

  return (
    <Button
      variant={variant}
      disabled={isDisabled}
      leftIcon={icon}
      onClick={handleSave}
      {...rest}
    >
      {label}
    </Button>
  );
}
