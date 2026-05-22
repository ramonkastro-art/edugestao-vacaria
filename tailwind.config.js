/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // Safelist: classes dinâmicas que o Tailwind não detecta via static scan
  safelist: [
    'ml-56', 'ml-16',
    'w-56', 'w-16',
  ],
  theme: { extend: {} },
  plugins: [],
}
