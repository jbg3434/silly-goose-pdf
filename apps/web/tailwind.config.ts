import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#172B3A", 700: "#21394B", 900: "#0F1E29" },
        teal: { DEFAULT: "#168F88", 700: "#0E6E68", 100: "#DDF0EE" },
        ivory: { DEFAULT: "#F8F5EC", 200: "#EFEADB", 300: "#E3DCC8" },
        amber: { DEFAULT: "#E7A63B", 700: "#8A5A0B", 100: "#FBEBCD" },
        slate: { DEFAULT: "#53616A", 300: "#A9B3B9" },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        bob: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-4px)" } },
        honk: { "0%,100%": { transform: "rotate(0)" }, "20%": { transform: "rotate(-8deg) scale(1.05)" }, "40%": { transform: "rotate(6deg)" }, "60%": { transform: "rotate(-3deg)" } },
        flap: { "0%,100%": { transform: "rotate(0)" }, "50%": { transform: "rotate(-24deg)" } },
        pop: { "0%": { transform: "scale(.6)", opacity: "0" }, "60%": { transform: "scale(1.1)", opacity: "1" }, "100%": { transform: "scale(1)" } },
      },
      animation: {
        bob: "bob 2.8s ease-in-out infinite",
        honk: "honk .6s ease-in-out 1",
        flap: "flap .35s ease-in-out 3",
        pop: "pop .3s ease-out 1",
      },
    },
  },
  plugins: [],
};
export default config;
