/** @type {import('tailwindcss').Config} */
const tokens = require('./src/theme/tokens.json')

module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: tokens.core.blue,
          light: tokens.core.blueLight,
          pale: tokens.core.bluePale,
        },
      },
      fontFamily: {
        sans: tokens.fonts.sans.split(',').map((f) => f.trim()),
      },
    },
  },
  plugins: [],
}
