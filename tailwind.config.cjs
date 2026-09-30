/** @type {import('tailwindcss').Config} */
const tokens = require('./src/theme/tokens.json')

const grayScale = Object.fromEntries(
  Object.entries(tokens.gray).map(([k, v]) => [k.replace('gray', ''), v])
)
grayScale[800] = '#2e3133'

module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // gray-* and neutral-* utilities use the brand gray scale too.
        gray: grayScale,
        neutral: grayScale,
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
