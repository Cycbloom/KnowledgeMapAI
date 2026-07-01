import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../hooks";
import { Map, Wrench, PanelRight, Keyboard, X } from "lucide-react";

const ONBOARDING_KEY = "graph-editor-onboarding-complete";

const steps = [
  { tourId: "canvas", icon: Map },
  { tourId: "toolbar", icon: Wrench },
  { tourId: "sidebar", icon: PanelRight },
  { tourId: "help", icon: Keyboard },
] as const;

export const isOnboardingComplete = (): boolean => {
  return localStorage.getItem(ONBOARDING_KEY) === "true";
};

export const markOnboardingComplete = (): void => {
  localStorage.setItem(ONBOARDING_KEY, "true");
};

interface OnboardingGuideProps {
  onComplete: () => void;
}

export const OnboardingGuide: React.FC<OnboardingGuideProps> = ({
  onComplete,
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);

  const stepKey = `step${currentStep + 1}` as
    | "step1"
    | "step2"
    | "step3"
    | "step4";
  const title = t(`graphEditor.onboarding.${stepKey}Title`);
  const description = t(`graphEditor.onboarding.${stepKey}Desc`);
  const Icon = steps[currentStep]?.icon ?? Map;
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  const handleNext = useCallback(() => {
    if (isLast) {
      markOnboardingComplete();
      onComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }, [isLast, onComplete]);

  const handlePrev = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, []);

  const handleSkip = useCallback(() => {
    markOnboardingComplete();
    onComplete();
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Semi-transparent overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleSkip}
      />

      {/* Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative z-10 w-full max-w-md mx-4 rounded-2xl shadow-2xl border overflow-hidden"
          style={{
            backgroundColor: isDark ? "#1e293b" : "#ffffff",
            borderColor: isDark ? "#334155" : "#e2e8f0",
          }}
        >
          {/* Skip button */}
          <button
            onClick={handleSkip}
            className="absolute top-3 right-3 p-1.5 rounded-lg transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={16} />
          </button>

          {/* Content */}
          <div className="px-8 pt-8 pb-6">
            {/* Step icon */}
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
              style={{
                backgroundColor: isDark
                  ? "rgba(99, 102, 241, 0.15)"
                  : "rgba(99, 102, 241, 0.1)",
              }}
            >
              <Icon
                size={28}
                className="text-indigo-500 dark:text-indigo-400"
              />
            </div>

            {/* Step badge */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: isDark
                    ? "rgba(99, 102, 241, 0.2)"
                    : "rgba(99, 102, 241, 0.1)",
                  color: isDark ? "#a5b4fc" : "#6366f1",
                }}
              >
                {currentStep + 1} / {steps.length}
              </span>
            </div>

            {/* Title */}
            <h2
              className="text-xl font-semibold mb-2"
              style={{
                color: isDark ? "#f1f5f9" : "#0f172a",
              }}
            >
              {title}
            </h2>

            {/* Description */}
            <p
              className="text-sm leading-relaxed"
              style={{
                color: isDark ? "#94a3b8" : "#64748b",
              }}
            >
              {description}
            </p>
          </div>

          {/* Footer */}
          <div
            className="px-8 py-4 flex items-center justify-between"
            style={{
              backgroundColor: isDark
                ? "rgba(15, 23, 42, 0.4)"
                : "rgba(248, 250, 252, 0.8)",
              borderTopWidth: 1,
              borderTopStyle: "solid",
              borderTopColor: isDark ? "#334155" : "#e2e8f0",
            }}
          >
            {/* Step dots */}
            <div className="flex items-center gap-1.5">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className="rounded-full transition-all duration-200"
                  style={{
                    width: index === currentStep ? 20 : 6,
                    height: 6,
                    backgroundColor:
                      index === currentStep
                        ? "#6366f1"
                        : isDark
                          ? "#475569"
                          : "#cbd5e1",
                  }}
                />
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  onClick={handlePrev}
                  className="px-3 py-1.5 text-sm rounded-lg transition-colors"
                  style={{
                    color: isDark ? "#94a3b8" : "#64748b",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDark
                      ? "#334155"
                      : "#f1f5f9";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {t("graphEditor.onboarding.prev")}
                </button>
              )}
              <button
                onClick={handleNext}
                className="px-4 py-1.5 text-sm font-medium rounded-lg text-white transition-colors"
                style={{
                  backgroundColor: "#6366f1",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#4f46e5";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#6366f1";
                }}
              >
                {isLast
                  ? t("graphEditor.onboarding.finish")
                  : t("graphEditor.onboarding.next")}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
