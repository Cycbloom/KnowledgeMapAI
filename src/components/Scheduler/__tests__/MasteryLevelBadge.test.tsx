// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../tests/helpers/renderWithProviders";

const MASTERY_THRESHOLDS = {
  beginner: 0.25,
  introductory: 0.45,
  familiar: 0.65,
  proficient: 0.82,
  master: 1.0,
} as const;

const MASTERY_LABEL_KEYS = {
  beginner: 'scheduler.review.mastery.beginner',
  introductory: 'scheduler.review.mastery.introductory',
  familiar: 'scheduler.review.mastery.familiar',
  proficient: 'scheduler.review.mastery.proficient',
  master: 'scheduler.review.mastery.master',
} as const;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

import { MasteryLevelBadge } from "../MasteryLevelBadge";

describe("MasteryLevelBadge", () => {
  it("<MasteryLevelBadge mastery={0.564}/> renders text '56%'", () => {
    renderWithProviders(<MasteryLevelBadge mastery={0.564} showLabel={false} />);
    expect(screen.getByText(/56%/)).toBeInTheDocument();
  });

  it("<MasteryLevelBadge mastery={0.23}/> contains MASTERY_LABEL_KEYS.beginner key", () => {
    renderWithProviders(<MasteryLevelBadge mastery={0.23} showIcon={false} showPercent={false} />);
    expect(screen.getByText(MASTERY_LABEL_KEYS.beginner)).toBeInTheDocument();
  });

  it("uses correct beginner threshold (< MASTERY_THRESHOLDS.beginner)", () => {
    renderWithProviders(
      <MasteryLevelBadge
        mastery={MASTERY_THRESHOLDS.beginner - 0.01}
        showIcon={false}
        showPercent={false}
      />
    );
    expect(screen.getByText(MASTERY_LABEL_KEYS.beginner)).toBeInTheDocument();
  });

  it("uses introductory threshold (>=beginner, <introductory)", () => {
    renderWithProviders(
      <MasteryLevelBadge
        mastery={(MASTERY_THRESHOLDS.beginner + MASTERY_THRESHOLDS.introductory) / 2}
        showIcon={false}
        showPercent={false}
      />
    );
    expect(screen.getByText(MASTERY_LABEL_KEYS.introductory)).toBeInTheDocument();
  });

  it("uses familiar threshold (>=introductory, <familiar)", () => {
    renderWithProviders(
      <MasteryLevelBadge
        mastery={(MASTERY_THRESHOLDS.introductory + MASTERY_THRESHOLDS.familiar) / 2}
        showIcon={false}
        showPercent={false}
      />
    );
    expect(screen.getByText(MASTERY_LABEL_KEYS.familiar)).toBeInTheDocument();
  });

  it("uses proficient threshold (>=familiar, <proficient)", () => {
    renderWithProviders(
      <MasteryLevelBadge
        mastery={(MASTERY_THRESHOLDS.familiar + MASTERY_THRESHOLDS.proficient) / 2}
        showIcon={false}
        showPercent={false}
      />
    );
    expect(screen.getByText(MASTERY_LABEL_KEYS.proficient)).toBeInTheDocument();
  });

  it("uses master threshold (>=proficient)", () => {
    renderWithProviders(
      <MasteryLevelBadge
        mastery={(MASTERY_THRESHOLDS.proficient + 1) / 2}
        showIcon={false}
        showPercent={false}
      />
    );
    expect(screen.getByText(MASTERY_LABEL_KEYS.master)).toBeInTheDocument();
  });

  it("rounds mastery correctly: mastery=0.995 → '100%'", () => {
    renderWithProviders(<MasteryLevelBadge mastery={0.995} showLabel={false} />);
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it("handles mastery=0 → '0%'", () => {
    renderWithProviders(<MasteryLevelBadge mastery={0} showLabel={false} />);
    expect(screen.getByText(/0%/)).toBeInTheDocument();
  });

  it("clamps mastery=1.5 → '100%' (safe clamp)", () => {
    renderWithProviders(<MasteryLevelBadge mastery={1.5} showLabel={false} />);
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it("clamps mastery=-0.2 → '0%' (safe clamp)", () => {
    renderWithProviders(<MasteryLevelBadge mastery={-0.2} showLabel={false} />);
    expect(screen.getByText(/0%/)).toBeInTheDocument();
  });

  it("variant=compact renders rounded element (pill style)", () => {
    const { container } = renderWithProviders(
      <MasteryLevelBadge
        mastery={0.65}
        variant="compact"
        showIcon={true}
        showLabel={false}
        showPercent={true}
      />
    );
    expect(screen.getByText(/65%/)).toBeInTheDocument();
    const outer = container.firstElementChild as HTMLElement | null;
    expect(outer).not.toBeNull();
    expect(outer?.className).toContain("rounded");
  });

  it("variant=full renders both label key and percent together", () => {
    renderWithProviders(
      <MasteryLevelBadge
        mastery={0.9}
        variant="full"
        showIcon={false}
        showLabel={true}
        showPercent={true}
      />
    );
    expect(screen.getByText(MASTERY_LABEL_KEYS.master)).toBeInTheDocument();
    expect(screen.getByText(/90%/)).toBeInTheDocument();
  });
});
