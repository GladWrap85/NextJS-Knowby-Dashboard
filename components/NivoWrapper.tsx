'use client';

import { useEffect, useState } from 'react';

export function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const update = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

export function getNivoTheme(isDark: boolean) {
  return {
    textColor: isDark ? "#ffffff" : "#111111",
    axis: {
      domain: { line: { stroke: isDark ? "#999" : "#333" } },
      ticks: {
        line: { stroke: isDark ? "#999" : "#333", strokeWidth: 1 },
        text: { fill: isDark ? "#ccc" : "#333" },
      },
      legend: { text: { fill: isDark ? "#ccc" : "#333" } },
    },
    legends: {
      text: { fill: isDark ? "#ccc" : "#333" },
    },
    tooltip: {
      container: {
        background: isDark ? "#1e1e1e" : "#fff",
        color: isDark ? "#fff" : "#000",
        fontSize: 12,
      },
    },
  };
}
