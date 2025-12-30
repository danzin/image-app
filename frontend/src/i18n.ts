import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

const resources = {
	en: {
		translation: {
			marketing: {
				welcome: "Welcome to Peek",
				subtitle: "See what's happening right now.",
			},
			auth: {
				login: "Login",
				register: "Register",
				logout: "Logout",
				logout_user: "Log out @{{username}}",
				password: "Password",
				email: "Email",
				forgot_password: "Forgot Password?",
				sign_in_prompt: "Sign in to access all features",
				join: "Join",
			},
			nav: {
				home: "Home",
				explore: "Explore",
				favorites: "Favorites",
				messages: "Messages",
				notifications: "Notifications",
				profile: "Profile",
				create_post: "Create Post",
				settings: "Settings",
				search_placeholder: "Search Peek...",
				post: "Post",
			},
			common: {
				who_to_follow: "Who to follow",
				trends_for_you: "Trending now",
				show_more: "Show more",
				follow: "Follow",
				following: "Following",
				edit_profile: "Edit Profile",
				save: "Save",
				cancel: "Cancel",
				loading: "Loading...",
				error: "Something went wrong",
			},
		},
	},
	bg: {
		translation: {
			marketing: {
				welcome: "Добре дошли в Peek",
				subtitle: "Вижте какво се случва точно сега.",
			},
			auth: {
				login: "Вход",
				register: "Регистрация",
				logout: "Изход",
				logout_user: "Изход @{{username}}",
				password: "Парола",
				email: "Имейл",
				forgot_password: "Забравена парола?",
				sign_in_prompt: "Влезте, за да достъпите всички функции",
				join: "Регистрация",
			},
			nav: {
				home: "Начало",
				explore: "Открий",
				favorites: "Любими",
				messages: "Съобщения",
				notifications: "Известия",
				profile: "Профил",
				create_post: "Публикувай",
				settings: "Настройки",
				search_placeholder: "Търсене в Peek...",
				post: "Публикувай",
			},
			common: {
				who_to_follow: "Кого да последвате",
				trends_for_you: "Актуално сега",
				show_more: "Виж повече",
				follow: "Последвай",
				following: "Последван",
				edit_profile: "Редакция на профила",
				save: "Запази",
				cancel: "Отказ",
				loading: "Зареждане...",
				error: "Възникна грешка",
			},
		},
	},
};

i18n
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		resources,
		fallbackLng: "en",

		detection: {
			order: ["querystring", "localStorage", "navigator", "htmlTag"],

			caches: ["localStorage"],
		},

		interpolation: {
			escapeValue: false,
		},
	});

export default i18n;
