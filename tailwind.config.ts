import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#102026',
        mist: '#f4f7f6',
        forest: '#16483d',
        lime: '#b8d95a',
        coral: '#ee6f57',
        sky: '#62a8c8',
      },
      boxShadow: {
        soft: '0 16px 40px rgba(16, 32, 38, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
