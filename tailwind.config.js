const colors = require('tailwindcss/colors')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    colors: {
      ...colors,
      primary: '#0000ff',
    },
    extend: {},
  },
  plugins: ['gatsby-plugin-postcss'],
}
