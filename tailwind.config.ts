import type { Config } from 'tailwindcss';
const config: Config = { content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'], theme: { extend: { colors: { navy: '#0F1B2D', cream: '#F7F3EC', stone: { DEFAULT: '#D9D6CE' }, highland: '#8F3030', gold: '#B89B5E' }, fontFamily: { display: ['Playfair Display', 'serif'], sans: ['DM Sans', 'sans-serif'] } } }, plugins: [] };
export default config;
