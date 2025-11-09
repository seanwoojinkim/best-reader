import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        light: {
          bg: '#F9F9F9',
          text: '#1A1A1A',
        },
        dark: {
          bg: '#121212',
          text: '#E0E0E0',
        },
        sepia: {
          bg: '#FBF0D9',
          text: '#5F4B32',
        },
      },
      maxWidth: {
        'reading': '65ch',
        'reading-mobile': '40ch',
      },
      fontFamily: {
        serif: ['Georgia', 'Charter', 'serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
