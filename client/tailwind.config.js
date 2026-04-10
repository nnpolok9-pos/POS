/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fef7ed",
          100: "#fdebd1",
          200: "#fbd4a5",
          300: "#f8b46d",
          400: "#f5923f",
          500: "#ef7019",
          600: "#d15410",
          700: "#ad3d11",
          800: "#8c3115",
          900: "#722a15"
        }
      },
      boxShadow: {
        soft: "0 20px 60px rgba(15, 23, 42, 0.16)"
      },
      fontFamily: {
        display: ["Poppins", "sans-serif"],
        sans: ["Manrope", "sans-serif"]
      }
    }
  },
  plugins: []
};
