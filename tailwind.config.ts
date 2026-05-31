import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 哆啦 A 夢主題色
        doraemon: {
          50: "#E0F2FE",
          100: "#BAE6FD",
          300: "#7DD3FC",
          500: "#00A6E0",
          700: "#0078BA",
          bell: "#FFC700",
          nose: "#E60012",
        },
      },
      backgroundImage: {
        "doraemon-gradient":
          "linear-gradient(135deg, #E0F2FE 0%, #7DD3FC 50%, #00A6E0 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
