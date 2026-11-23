/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        navy: "#1b2454",
        teal: "#12796c",
        mist: "#f4f6fb",
      },
    },
  },
  plugins: [],
};
