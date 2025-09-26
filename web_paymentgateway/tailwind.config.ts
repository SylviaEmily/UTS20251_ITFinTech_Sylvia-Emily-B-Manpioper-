/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#154D71", // paling gelap
          blue: "#1C6EA4", // sedang
          sky:  "#33A1E0", // paling terang
        },
      },
      boxShadow: {
        card: "0 2px 12px rgba(21,77,113,0.06)",
      },
    },
  },
  plugins: [],
};
