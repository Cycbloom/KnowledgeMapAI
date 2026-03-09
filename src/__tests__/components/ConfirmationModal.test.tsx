import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ConfirmationModal } from "../../components/common";

describe("ConfirmationModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: "Test Title",
    message: "Test Message",
  };

  it("should not render when isOpen is false", () => {
    render(<ConfirmationModal {...defaultProps} isOpen={false} />);
    const modal = screen.queryByText("Test Title");
    expect(modal).not.toBeInTheDocument();
  });

  it("should render title and message when isOpen is true", () => {
    render(<ConfirmationModal {...defaultProps} />);
    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test Message")).toBeInTheDocument();
  });

  it("should call onClose when cancel button is clicked", () => {
    render(<ConfirmationModal {...defaultProps} />);
    const cancelButton = screen.getByText("取消");
    fireEvent.click(cancelButton);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should call onConfirm when confirm button is clicked", () => {
    render(<ConfirmationModal {...defaultProps} />);
    const confirmButton = screen.getByText("确定");
    fireEvent.click(confirmButton);
    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });

  it("should render custom button text", () => {
    render(
      <ConfirmationModal
        {...defaultProps}
        confirmText="Yes, delete it"
        cancelText="No, keep it"
      />,
    );
    expect(screen.getByText("Yes, delete it")).toBeInTheDocument();
    expect(screen.getByText("No, keep it")).toBeInTheDocument();
  });

  it("should render dangerous style when isDangerous is true", () => {
    render(<ConfirmationModal {...defaultProps} isDangerous={true} />);
    const confirmButton = screen.getByText("确定");
    expect(confirmButton.className).toContain("bg-red-600");
  });
});
