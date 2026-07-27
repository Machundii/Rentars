import type { Preview } from '@storybook/react';
import '../src/app/globals.css';

/**
 * Apply or remove the `.dark` class on `<html>` to switch between the CSS-
 * variable-based light and dark themes (Tailwind `darkMode: ['class']`).
 */
function applyTheme(theme: string) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Color theme',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', icon: 'sun', title: 'Light' },
          { value: 'dark', icon: 'moon', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },

  decorators: [
    (Story, context) => {
      applyTheme(context.globals.theme ?? 'light');
      return Story();
    },
  ],

  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    nextjs: { appDirectory: true },
    // a11y addon not installed — accessibility is validated via vitest in tests/keyboard-accessibility.test.tsx
    // a11y: { ... },
  },
};

export default preview;
