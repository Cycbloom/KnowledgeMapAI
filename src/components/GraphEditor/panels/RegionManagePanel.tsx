import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Edit2, Trash2, Layers } from "lucide-react";
import type { Node, CustomRegion, RegionInfo } from "@shared/types/graph";
import {
  BACKBONE_MODULE_LABELS,
  BACKBONE_MODULE_COLORS,
} from "@shared/types/graph";

interface RegionManagePanelProps {
  nodes: Node[];
  customRegions: CustomRegion[];
  onEditRegion: (region: CustomRegion) => void;
  onDeleteRegion: (regionId: string) => void;
  onCreateRegion: () => void;
}

export const RegionManagePanel: React.FC<RegionManagePanelProps> = ({
  nodes,
  customRegions,
  onEditRegion,
  onDeleteRegion,
  onCreateRegion,
}) => {
  const { t } = useTranslation();

  const backboneRegions = useMemo(() => {
    const regionMap = new Map<string, RegionInfo>();

    nodes.forEach((node) => {
      const module = node.properties?.backboneModule as string | undefined;
      if (
        module &&
        BACKBONE_MODULE_LABELS[module as keyof typeof BACKBONE_MODULE_LABELS]
      ) {
        if (!regionMap.has(module)) {
          regionMap.set(module, {
            id: module,
            name: BACKBONE_MODULE_LABELS[
              module as keyof typeof BACKBONE_MODULE_LABELS
            ],
            color:
              BACKBONE_MODULE_COLORS[
                module as keyof typeof BACKBONE_MODULE_COLORS
              ],
            icon: "",
            angleStart: 0,
            angleEnd: 0,
            nodes: [],
            isCollapsed: false,
          });
        }
        regionMap.get(module)!.nodes.push(node);
      }
    });

    return Array.from(regionMap.values());
  }, [nodes]);

  const customRegionsWithNodes = useMemo(() => {
    return customRegions.map((region) => {
      const regionNodes = nodes.filter((node) =>
        region.nodeIds.includes(node.id),
      );
      return {
        ...region,
        nodes: regionNodes,
        nodeCount: regionNodes.length,
      };
    });
  }, [customRegions, nodes]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t("graphEditor.region.title")}
          </h2>
          <button
            onClick={onCreateRegion}
            className="px-3 py-1.5 text-xs font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors"
          >
            {t("graphEditor.region.createRegion")}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {backboneRegions.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
              {t("graphEditor.region.backboneRegions")}
            </h3>
            <div className="space-y-2">
              {backboneRegions.map((region) => (
                <div
                  key={region.id}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: region.color }}
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {region.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {t("graphEditor.region.nodeCount", {
                          count: region.nodes.length,
                        })}
                      </div>
                    </div>
                  </div>
                  <Layers size={16} className="text-slate-400" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
            {t("graphEditor.region.customRegions")}
          </h3>
          {customRegionsWithNodes.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
              {t("graphEditor.region.noCustomRegions")}
            </div>
          ) : (
            <div className="space-y-2">
              {customRegionsWithNodes.map((region) => (
                <div
                  key={region.id}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 group"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: region.color }}
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {region.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {t("graphEditor.region.nodeCount", {
                          count: region.nodeCount,
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEditRegion(region)}
                      className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded transition-colors"
                      title={t("graphEditor.region.editRegion")}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => onDeleteRegion(region.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                      title={t("graphEditor.region.deleteRegion")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
