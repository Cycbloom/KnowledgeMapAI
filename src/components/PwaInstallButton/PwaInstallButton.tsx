import { useState } from "react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { Button } from "@/components/common/Button";

export interface PwaInstallButtonProps {
  /** 自定义按钮文本，默认 "安装到桌面" */
  label?: string;
  /** 自定义 className */
  className?: string;
}

/**
 * PWA 安装按钮
 *
 * 当 canInstall 为 true 时显示，installed 为 true 时隐藏。
 * 点击后触发 deferredPrompt.prompt()。
 */
export function PwaInstallButton({
  label = "安装到桌面",
  className,
}: PwaInstallButtonProps) {
  const { canInstall, installed, promptInstall } = usePwaInstall();
  const [installing, setInstalling] = useState(false);

  if (!canInstall || installed) return null;

  const handleClick = async () => {
    setInstalling(true);
    try {
      await promptInstall();
    } finally {
      setInstalling(false);
    }
  };

  return (
    <Button
      type="button"
      variant="primary"
      loading={installing}
      onClick={handleClick}
      className={className}
      data-testid="pwa-install-button"
    >
      {installing ? "安装中..." : label}
    </Button>
  );
}
