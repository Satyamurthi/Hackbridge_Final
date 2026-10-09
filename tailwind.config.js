/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--brand-primary, #4F46E5)',
          secondary: 'var(--brand-secondary, #7C3AED)',
        }
      }
    },
  },
  plugins: [],
}
