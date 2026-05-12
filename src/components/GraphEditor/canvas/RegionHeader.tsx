import React from "react";
import { motion } from "framer-motion";
import type { RegionInfo } from "@shared/types/graph";

interface RegionHeaderProps {
  region: RegionInfo;
  isCollapsed: boolean;
  originX: number;
  originY: number;
  radius: number;
  isDark: boolean;
}

export const RegionHeader: React.FC<RegionHeaderProps> = ({
  region,
  isCollapsed,
  originX,
  originY,
  radius,
  isDark,
}) => {
  const midAngle = (region.angleStart + region.angleEnd) / 2;

  const labelOffset = 25;
  const labelX = originX + (radius + labelOffset) * Math.cos(midAngle);
  const labelY = originY + (radius + labelOffset) * Math.sin(midAngle);

  let tangentAngle = midAngle + Math.PI / 2;

  let normalizedAngle = tangentAngle % (2 * Math.PI);
  if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;

  let textRotation = normalizedAngle * (180 / Math.PI);

  const needsFlip =
    normalizedAngle > Math.PI / 2 && normalizedAngle < (3 * Math.PI) / 2;
  if (needsFlip) {
    textRotation += 180;
  }

  const nodeCount = region.nodes.length;

  const textColor = isDark ? "#f1f5f9" : "#0f172a";
  const textShadow = isDark
    ? "0 1px 3px rgba(0,0,0,0.5)"
    : "0 1px 3px rgba(255,255,255,0.8), 0 1px 2px rgba(0,0,0,0.2)";

  const countColor = isDark ? "#94a3b8" : "#64748b";

  const collapsedCircleFill = isDark ? "#1e293b" : "#ffffff";
  const collapsedCircleStroke = region.color;

  return (
    <g data-region-id={region.id}>
      <motion.g
        initial={false}
        animate={{ opacity: isCollapsed ? 0.6 : 1 }}
        transition={{ duration: 0.2 }}
      >
        <motion.text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          dominantBaseline={needsFlip ? "text-before-edge" : "text-after-edge"}
          fontSize={16}
          fontWeight={600}
          fill={textColor}
          letterSpacing="0.15em"
          style={{
            pointerEvents: "none",
            textShadow,
          }}
          transform={`rotate(${textRotation}, ${labelX}, ${labelY})`}
        >
          {region.icon ? `${region.icon} ${region.name}` : region.name}
        </motion.text>

        {!isCollapsed && nodeCount > 0 && (
          <motion.text
            x={labelX}
            y={labelY}
            textAnchor="middle"
            dominantBaseline={
              needsFlip ? "text-after-edge" : "text-before-edge"
            }
            fontSize={10}
            fill={countColor}
            style={{ pointerEvents: "none" }}
            transform={`rotate(${textRotation}, ${labelX}, ${labelY})`}
          >
            {nodeCount} 个节点
          </motion.text>
        )}

        {isCollapsed && nodeCount > 0 && (
          <motion.g
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <motion.circle
              cx={originX + (radius + 50) * Math.cos(midAngle)}
              cy={originY + (radius + 50) * Math.sin(midAngle)}
              r={10}
              fill={collapsedCircleFill}
              stroke={collapsedCircleStroke}
              strokeWidth={2}
            />
            <motion.text
              x={originX + (radius + 50) * Math.cos(midAngle)}
              y={originY + (radius + 50) * Math.sin(midAngle)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              fontWeight={700}
              fill={region.color}
              style={{ pointerEvents: "none" }}
            >
              {nodeCount > 99 ? "99+" : nodeCount}
            </motion.text>
          </motion.g>
        )}
      </motion.g>
    </g>
  );
};
