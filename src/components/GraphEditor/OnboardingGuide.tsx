import React, { useEffect, useRef } from "react";
import { driver, type DriveStep, type Side, type Driver } from "driver.js";
import { useTranslation } from "react-i18next";
import i18next from "i18next";
import "driver.js/dist/driver.css";

const ONBOARDING_KEY = "graph-editor-onboarding-complete";

export const isOnboardingComplete = (): boolean => {
  return localStorage.getItem(ONBOARDING_KEY) === "true";
};

export const markOnboardingComplete = (): void => {
  localStorage.setItem(ONBOARDING_KEY, "true");
};

interface TourCallbacks {
  onOpenSidebar?: () => void;
  onOpenRAGChat?: () => void;
}

interface StepDefinition {
  tourId?: string;
  side: Side;
  i18nKey: string;
  /** Allow user to click the highlighted element (e.g. a button) */
  allowInteraction?: boolean;
  /** Called when user clicks "Next" or the highlighted element itself */
  onAdvance?: (callbacks: TourCallbacks, moveNext: () => void) => void;
}

const stepDefinitions: StepDefinition[] = [
  {
    tourId: "toolbar",
    side: "bottom",
    i18nKey: "step1",
  },
  {
    tourId: "canvas",
    side: "top",
    i18nKey: "step2",
  },
  {
    tourId: "sidebar",
    side: "left",
    i18nKey: "step3",
    allowInteraction: true,
    onAdvance: (callbacks, moveNext) => {
      callbacks.onOpenSidebar?.();
      setTimeout(moveNext, 300);
    },
  },
  {
    tourId: "sidebar-panel",
    side: "left",
    i18nKey: "step3b",
  },
  {
    tourId: "rag-chat",
    side: "right",
    i18nKey: "step4",
    allowInteraction: true,
    onAdvance: (callbacks, moveNext) => {
      callbacks.onOpenRAGChat?.();
      setTimeout(moveNext, 300);
    },
  },
  {
    tourId: "rag-chat-panel",
    side: "right",
    i18nKey: "step4b",
  },
  {
    side: "left",
    i18nKey: "step5",
  },
];

function buildSteps(
  t: (key: string) => string,
  callbacks: TourCallbacks,
  driverRef: { current: Driver | null },
): DriveStep[] {
  return stepDefinitions.map((def) => {
    const step: DriveStep = {
      popover: {
        title: t(`graphEditor.onboarding.${def.i18nKey}Title`),
        description: t(`graphEditor.onboarding.${def.i18nKey}Desc`),
        side: def.side,
      },
    };

    if (def.tourId) {
      step.element = `[data-tour="${def.tourId}"]`;
    }

    // Allow user to click the highlighted element
    if (def.allowInteraction) {
      step.disableActiveInteraction = false;
    }

    // When the element is highlighted, attach a click listener so clicking
    // the actual UI element also advances the tour
    if (def.onAdvance && def.allowInteraction) {
      const hook = def.onAdvance;
      step.onHighlighted = (element) => {
        if (!element) return;
        const handler = () => {
          const drv = driverRef.current;
          if (drv) {
            hook(callbacks, () => drv.moveNext());
          }
          element.removeEventListener("click", handler);
        };
        element.addEventListener("click", handler);
      };
      step.onDeselected = (element) => {
        void element;
      };
    }

    // Intercept "Next" / "Done" button clicks on steps with onAdvance
    if (def.onAdvance) {
      const hook = def.onAdvance;
      step.popover = {
        ...step.popover,
        onNextClick: (_element, _step, opts) => {
          hook(callbacks, () => opts.driver.moveNext());
        },
        onDoneClick: (_element, _step, opts) => {
          hook(callbacks, () => opts.driver.moveNext());
        },
      };
    }

    return step;
  });
}

function createDriverInstance(
  t: (key: string) => string,
  onComplete?: () => void,
  callbacks?: TourCallbacks,
  driverRef?: { current: Driver | null },
) {
  const drv = driver({
    showProgress: true,
    showButtons: ["next", "previous", "close"],
    nextBtnText: t("graphEditor.onboarding.next"),
    prevBtnText: t("graphEditor.onboarding.prev"),
    doneBtnText: t("graphEditor.onboarding.finish"),
    progressText: "{{current}} / {{total}}",
    overlayColor: "#000",
    overlayOpacity: 0.5,
    stagePadding: 8,
    stageRadius: 8,
    animate: true,
    allowClose: true,
    overlayClickBehavior: "close",
    onDestroyStarted: (_element, _step, opts) => {
      markOnboardingComplete();
      onComplete?.();
      opts.driver.destroy();
    },
    onDoneClick: (_element, _step, opts) => {
      markOnboardingComplete();
      onComplete?.();
      opts.driver.destroy();
    },
    onCloseClick: (_element, _step, opts) => {
      markOnboardingComplete();
      onComplete?.();
      opts.driver.destroy();
    },
    steps: buildSteps(t, callbacks ?? {}, driverRef ?? { current: null }),
  });

  if (driverRef) {
    driverRef.current = drv;
  }

  return drv;
}

export const startOnboardingTour = (callbacks?: TourCallbacks): void => {
  const t = i18next.getFixedT(i18next.language);
  const driverRef: { current: Driver | null } = { current: null };
  const driverObj = createDriverInstance(t, undefined, callbacks, driverRef);
  driverObj.drive();
};

interface OnboardingGuideProps {
  onComplete: () => void;
  onOpenSidebar?: () => void;
  onOpenRAGChat?: () => void;
}

export const OnboardingGuide: React.FC<OnboardingGuideProps> = ({
  onComplete,
  onOpenSidebar,
  onOpenRAGChat,
}) => {
  const { t } = useTranslation();
  const onCompleteRef = useRef(onComplete);
  const driverRef = useRef<Driver | null>(null);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const driverObj = createDriverInstance(
      t,
      () => onCompleteRef.current(),
      { onOpenSidebar, onOpenRAGChat },
      { current: null },
    );
    driverRef.current = driverObj;
    driverObj.drive();
  }, [t, onOpenSidebar, onOpenRAGChat]);

  return null;
};
