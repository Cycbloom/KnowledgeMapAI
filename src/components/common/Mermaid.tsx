import React, { useEffect, useState, useRef } from 'react';

interface MermaidProps {
  chart: string;
}

export const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    const renderChart = async () => {
      if (!chart) return;

      try {
        setError(null);
        
        const mermaid = (await import('mermaid')).default;
        
        if (!initialized.current) {
          mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'strict',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          });
          initialized.current = true;
        }
        
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, chart);
        setSvg(svg);
      } catch (err) {
        console.error('Mermaid render error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      }
    };

    renderChart();
  }, [chart]);

  if (error) {
    return (
      <div
        role="alert"
        className="p-2 bg-red-50 border border-red-100 rounded text-red-600 text-xs font-mono whitespace-pre-wrap"
      >
        Error rendering diagram: {error}
        <pre className="mt-1 text-gray-500">{chart}</pre>
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={chart}
      className="mermaid-container flex justify-center my-4 overflow-x-auto bg-white p-2 rounded-lg border border-gray-100"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
