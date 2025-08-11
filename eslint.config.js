import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
	// Backend (Node)
	tseslint.config({
		files: ["backend/src/**/*.ts"],
		languageOptions: {
			ecmaVersion: 2020,
			sourceType: "module",
			globals: globals.node,
		},
		plugins: {
			prettier: eslintPluginPrettier,
		},
		rules: {
			...js.configs.recommended.rules,
			...tseslint.configs.recommended.rules,
			"prettier/prettier": "error",
		},
	}),
	// API Gateway (Node)
	tseslint.config({
		files: ["api-gateway/src/**/*.ts"],
		languageOptions: {
			ecmaVersion: 2020,
			sourceType: "module",
			globals: globals.node,
		},
		plugins: {},
		rules: {
			...js.configs.recommended.rules,
			...tseslint.configs.recommended.rules,
			"prettier/prettier": "error",
		},
	}),
	// Frontend (React)
	tseslint.config({
		files: ["frontend/src/**/*.{ts,tsx}"],
		languageOptions: {
			ecmaVersion: 2020,
			sourceType: "module",
			globals: globals.browser,
		},
		plugins: {
			react,
			"react-hooks": reactHooks,
		},
		rules: {
			...js.configs.recommended.rules,
			...tseslint.configs.recommended.rules,
			...react.configs.recommended.rules,
			...reactHooks.configs.recommended.rules,
			"react/react-in-jsx-scope": "off", // Not needed for React 17+
		},
		settings: {
			react: { version: "detect" },
		},
	}),
];
