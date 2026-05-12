import React, { memo } from "react";

interface SelectionBoxProps {
  isSelecting: boolean;
  selectionBox: {
    start: { x: number; y: number };
    end: { x: number; y: number };
  } | null;
}

const SelectionBoxComponent: React.FC<SelectionBoxProps> = ({
  isSelecting,
  selectionBox,
}) => {
  if (!isSelecting || !selectionBox) {
    return null;
  }

  return (
    <rect
      x={Math.min(selectionBox.start.x, selectionBox.end.x)}
      y={Math.min(selectionBox.start.y, selectionBox.end.y)}
      width={Math.abs(selectionBox.end.x - selectionBox.start.x)}
      height={Math.abs(selectionBox.end.y - selectionBox.start.y)}
      fill="rgba(59, 130, 246, 0.1)"
      stroke="rgba(59, 130, 246, 0.5)"
      strokeWidth={2}
      strokeDasharray="5,5"
      style={{ pointerEvents: "none" }}
    />
  );
};

export const SelectionBox = memo(SelectionBoxComponent);
