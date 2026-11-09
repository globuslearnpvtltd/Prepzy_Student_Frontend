import type { Preview } from '@storybook/react-vite';
import designConfig from '../design.config.ts';
import './storybook.css';

const themes = ['default', ...Object.keys(designConfig.themes ?? {})];

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Theme from design.config.ts',
      toolbar: { title: 'Theme', icon: 'paintbrush', items: themes, dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'default' },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme as string;
      return (
        <div data-theme={theme === 'default' ? undefined : theme} className="bg-canvas p-6">
          <Story />
        </div>
      );
    },
  ],
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
    a11y: { test: 'error' },
    viewport: {
      options: {
        mobile: { name: 'Mobile 360', styles: { width: '360px', height: '780px' } },
        tablet: { name: 'Tablet 768', styles: { width: '768px', height: '1024px' } },
        desktop: { name: 'Desktop 1280', styles: { width: '1280px', height: '800px' } },
      },
    },
  },
};

export default preview;
