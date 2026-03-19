import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16324f",
        mist: "#eef4f8",
        accent: "#1c7c54",
        warn: "#f4a259",
        alert: "#c84630"
      },
      boxShadow: {
        soft: "0 18px 45px rgba(22, 50, 79, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
