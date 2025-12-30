import React from "react";
import { useTranslation } from "react-i18next";

const LanguageSwitcher: React.FC = () => {
	const { i18n } = useTranslation();

	const toggleLanguage = () => {
		const newLang = i18n.resolvedLanguage?.startsWith("bg") ? "en" : "bg";
		i18n.changeLanguage(newLang);
	};

	return (
		<div
			onClick={toggleLanguage}
			className="fixed bottom-4 left-4 z-50 cursor-pointer 
                 bg-black/20 hover:bg-black/80 text-white 
                 px-3 py-1 rounded-full text-xs font-mono 
                 transition-all duration-300 backdrop-blur-sm"
			title="Switch Language / Смени език"
		>
			{i18n.resolvedLanguage?.startsWith("bg") ? "🇧🇬 BG" : "🇺🇸 EN"}
		</div>
	);
};

export default LanguageSwitcher;
