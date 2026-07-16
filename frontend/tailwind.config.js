/** @type {import('tailwindcss').Config} */

// Escalones de marca definidos en src/index.css como tripletas RGB.
// El envoltorio rgb(var(--x) / <alpha-value>) es lo que permite que sigan
// funcionando los modificadores de opacidad (bg-brand-50/40, shadow-brand-500/20).
// Si esto se cambia por 'var(--brand-600)' a secas, esos modificadores se
// rompen sin avisar: Tailwind emite el color pero descarta el alfa.
const escala = (nombre) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((paso) => [
      paso,
      `rgb(var(--${nombre}-${paso}) / <alpha-value>)`,
    ]),
  );

export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        brand: escala('brand'),
        accent: escala('accent'),
      },
    },
  },
  plugins: [],
}
