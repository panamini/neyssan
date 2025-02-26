export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "hover-outline": "var(--hover-outline)",
        // Grey color palette
        "anti-flash-white": {
          DEFAULT: "#EEEEEE",
          100: "#2f2f2f",
          200: "#5f5f5f",
          300: "#8e8e8e",
          400: "#bebebe",
          500: "#eeeeee",
          600: "#f1f1f1",
          700: "#f4f4f4",
          800: "#f8f8f8",
          900: "#fbfbfb"
        },
        "silver": {
          DEFAULT: "#BFBFBF",
          100: "#262626",
          200: "#4d4d4d",
          300: "#737373",
          400: "#999999",
          500: "#bfbfbf",
          600: "#cccccc",
          700: "#d9d9d9",
          800: "#e6e6e6",
          900: "#f2f2f2"
        },
        "battleship": {
          DEFAULT: "#919191",
          100: "#1d1d1d",
          200: "#3a3a3a",
          300: "#575757",
          400: "#747474",
          500: "#919191",
          600: "#a7a7a7",
          700: "#bdbdbd",
          800: "#d3d3d3",
          900: "#e9e9e9"
        },
        "dim": {
          DEFAULT: "#626262",
          100: "#131313",
          200: "#272727",
          300: "#3a3a3a",
          400: "#4e4e4e",
          500: "#626262",
          600: "#818181",
          700: "#a0a0a0",
          800: "#c0c0c0",
          900: "#dfdfdf"
        },
        "jet": {
          DEFAULT: "#343434",
          100: "#0a0a0a",
          200: "#141414",
          300: "#1f1f1f",
          400: "#292929",
          500: "#343434",
          600: "#5c5c5c",
          700: "#858585",
          800: "#adadad",
          900: "#d6d6d6"
        },
        "carbon": {
          DEFAULT: "#050505",
          100: "#010101",
          200: "#020202",
          300: "#030303",
          400: "#040404",
          500: "#050505",
          600: "#373737",
          700: "#696969",
          800: "#9b9b9b",
          900: "#cdcdcd"
        },
        // Semantic color assignments for dark mode
        dark: {
          bg: "#272727", // Using dim-200 for main background
          element: "#010101", // Using carbon-100 for interactive elements (darkest color)
          text: {
            DEFAULT: "#eeeeee", // Using anti-flash-white for primary text
            muted: "#919191", // Using battleship-500 for secondary text
            hover: "#f8f8f8" // Using anti-flash-white-800 for hover states
          }
        }
      },
    },
  },
  darkMode: 'class',
  plugins: [],
};
