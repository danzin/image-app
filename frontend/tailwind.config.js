/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			colors: {
				background: "#000000",
				primary: "#ffffff", // text-primary
				secondary: "#a1a1aa", // text-secondary
				accent: "#0ea5e9", // light blue
				divider: "rgba(255, 255, 255, 0.12)",
			},
		},
	},
	plugins: [],
};
