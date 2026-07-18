import React from "react";
import type { RegionInfo } from "@shared/types/graph";

interface RegionBackgroundProps {
  region: RegionInfo;
  opacity: number;
  radius: number;
  originX: number;
  originY: number;
}

export const RegionBackground = React.memo(({
  region,
  opacity,
  radius,
  originX,
  originY,
}: RegionBackgroundProps) => {
  const startAngle = region.angleStart;
  const endAngle = region.angleEnd;

  const angleDiff = endAngle - startAngle;
  const isFullCircle = angleDiff >= Math.PI * 1.999;

  if (isFullCircle) {
    return (
      <circle
        cx={originX}
        cy={originY}
        r={radius}
        fill={region.color}
        fillOpacity={opacity}
        stroke={region.color}
        strokeWidth={1}
        strokeOpacity={opacity * 0.5}
        style={{
          transition: "fill-opacity 0.3s ease, stroke-opacity 0.3s ease",
        }}
      />
    );
  }

  const x1 = originX + radius * Math.cos(startAngle);
  const y1 = originY + radius * Math.sin(startAngle);
  const x2 = originX + radius * Math.cos(endAngle);
  const y2 = originY + radius * Math.sin(endAngle);

  const largeArcFlag = angleDiff > Math.PI ? 1 : 0;

  const pathD = [
    `M ${originX} ${originY}`,
    `L ${x1} ${y1}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
    "Z",
  ].join(" ");

  return (
    <path
      d={pathD}
      fill={region.color}
      fillOpacity={opacity}
      stroke={region.color}
      strokeWidth={1}
      strokeOpacity={opacity * 0.5}
      style={{
        transition: "fill-opacity 0.3s ease, stroke-opacity 0.3s ease",
      }}
    />
  );
});
