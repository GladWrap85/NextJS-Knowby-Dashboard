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

// utils/getNivoTheme.ts
export function getNivoTheme(isDark: boolean) {
  return {
    background: 'transparent',
    textColor: isDark ? '#e0e0e0' : '#333333',
    fontSize: 12,
    axis: {
      domain: {
        line: {
          stroke: isDark ? '#555' : '#999',
        },
      },
      ticks: {
        line: {
          stroke: isDark ? '#666' : '#ccc',
          strokeWidth: 1,
        },
        text: {
          fill: isDark ? '#aaa' : '#333',
        },
      },
      legend: {
        text: {
          fill: isDark ? '#aaa' : '#333',
        },
      },
    },
    grid: {
      line: {
        stroke: isDark ? '#444' : '#ddd',
        strokeDasharray: '2 2',
      },
    },
    legends: {
      text: {
        fill: isDark ? '#ccc' : '#333',
      },
    },
    tooltip: {
      container: {
        background: isDark ? '#222' : '#fff',
        color: isDark ? '#fff' : '#000',
        fontSize: 12,
        borderRadius: '4px',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.25)',
      },
    },
  };
}

