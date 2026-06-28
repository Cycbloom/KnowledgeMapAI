import { createRoot } from 'react-dom/client';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';

export interface AsyncConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

export function asyncConfirm(options: AsyncConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    let resolved = false;

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      root.unmount();
      container.remove();
    };

    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    root.render(
      <ConfirmationModal
        isOpen={true}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title={options.title}
        message={options.message}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        isDangerous={options.isDangerous}
      />,
    );
  });
}
