import {
  BackboneModule,
  BACKBONE_MODULE_TITLES,
} from "../../../shared/types/graph";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

interface BackboneNode {
  properties?: {
    backboneModule?: string;
  };
}

export class BackboneValidatorService {
  validateBackboneNodeTitle(title: string): {
    isValid: boolean;
    module?: BackboneModule;
  } {
    const normalizedTitle = title.trim().toLowerCase();

    for (const [module, standardTitle] of Object.entries(
      BACKBONE_MODULE_TITLES,
    )) {
      if (normalizedTitle === standardTitle.toLowerCase()) {
        return {
          isValid: true,
          module: module as BackboneModule,
        };
      }
    }

    return { isValid: false };
  }

  correctBackboneNodeTitle(title: string): {
    correctedTitle: string;
    module: BackboneModule;
  } {
    const normalizedTitle = title.trim().toLowerCase();

    for (const [module, standardTitle] of Object.entries(
      BACKBONE_MODULE_TITLES,
    )) {
      if (normalizedTitle === standardTitle.toLowerCase()) {
        return {
          correctedTitle: standardTitle,
          module: module as BackboneModule,
        };
      }
    }

    for (const [module, standardTitle] of Object.entries(
      BACKBONE_MODULE_TITLES,
    )) {
      if (normalizedTitle.includes(standardTitle.toLowerCase())) {
        return {
          correctedTitle: standardTitle,
          module: module as BackboneModule,
        };
      }
    }

    for (const [module, standardTitle] of Object.entries(
      BACKBONE_MODULE_TITLES,
    )) {
      if (standardTitle.toLowerCase().includes(normalizedTitle)) {
        return {
          correctedTitle: standardTitle,
          module: module as BackboneModule,
        };
      }
    }

    const keywords: Record<BackboneModule, string[]> = {
      [BackboneModule.RESEARCH_BACKGROUND]: [
        "背景",
        "发展历程",
        "研究现状",
        "问题陈述",
        "历史",
      ],
      [BackboneModule.LITERATURE_REVIEW]: [
        "文献",
        "综述",
        "相关研究",
        "前人研究",
        "相关工作",
      ],
      [BackboneModule.RESEARCH_METHODS]: [
        "方法",
        "方法论",
        "技术手段",
        "实验方法",
        "研究设计",
      ],
      [BackboneModule.CORE_CONCEPTS]: ["概念", "核心", "理论", "定义", "术语"],
      [BackboneModule.APPLICATION_DOMAINS]: [
        "应用",
        "领域",
        "场景",
        "实践",
        "案例",
      ],
      [BackboneModule.FUTURE_DIRECTIONS]: [
        "未来",
        "方向",
        "趋势",
        "展望",
        "发展",
      ],
    };

    for (const [module, moduleKeywords] of Object.entries(keywords)) {
      for (const keyword of moduleKeywords) {
        if (normalizedTitle.includes(keyword.toLowerCase())) {
          return {
            correctedTitle: BACKBONE_MODULE_TITLES[module as BackboneModule],
            module: module as BackboneModule,
          };
        }
      }
    }

    throw new AppError(ErrorCodes.VALIDATION_ERROR, {
      context: { title, message: "无法自动修正骨干节点标题" },
    });
  }

  validateBackboneModule(module: string): boolean {
    return Object.values(BackboneModule).includes(module as BackboneModule);
  }

  isBackboneNode(node: BackboneNode): boolean {
    if (!node?.properties?.backboneModule) {
      return false;
    }

    return this.validateBackboneModule(node.properties.backboneModule);
  }
}

export const backboneValidatorService = new BackboneValidatorService();
