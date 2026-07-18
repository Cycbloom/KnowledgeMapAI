import React from 'react';

interface RenderProfilerProps {
  id: string;
}

const SLOW_RENDER_THRESHOLD_MS = 16;

const handleRender: React.ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
) => {
  if (actualDuration > SLOW_RENDER_THRESHOLD_MS) {
    // eslint-disable-next-line no-console
    console.warn(
      `[RenderProfiler] Slow render: id="${id}", phase="${phase}", duration=${actualDuration.toFixed(2)}ms`,
    );
  }
};

export const RenderProfiler = ({
  id,
  children,
}: React.PropsWithChildren<RenderProfilerProps>) => {
  if (!import.meta.env.DEV) {
    return <>{children}</>;
  }

  return (
    <React.Profiler id={id} onRender={handleRender}>
      {children}
    </React.Profiler>
  );
};
