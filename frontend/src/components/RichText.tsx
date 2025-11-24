import React from "react";
import { useNavigate } from "react-router-dom";

interface RichTextProps {
	text: string;
	className?: string;
	hashtagClassName?: string;
	mentionClassName?: string;
}

/**
 * This component detects hashtags and mentions in text and makes them clickable
 * Hashtags - #word - /search/tags?tags=word
 * Mentions - @username - /profile/username
 */
const RichText: React.FC<RichTextProps> = ({
	text,
	className = "",
	hashtagClassName = "text-accent hover:text-accent-hover cursor-pointer font-bold hover:underline",
	mentionClassName = "text-accent hover:text-accent-hover cursor-pointer font-bold hover:underline",
}) => {
	const navigate = useNavigate();

	// Regex to match hashtags for words and mentions with '#' or '@'
	// Matches alphanumeric and underscores
	const tokenRegex = /((?:#[a-zA-Z0-9_]+)|(?:@[a-zA-Z0-9_]+))/g;

	const handleHashtagClick = (tag: string, e: React.MouseEvent) => {
		e.stopPropagation();
		// strip '#'
		const cleanTag = tag.substring(1);

		if (!cleanTag) return;

		navigate(`/results/?q=${encodeURIComponent(cleanTag)}`);
	};

	const handleMentionClick = (mention: string, e: React.MouseEvent) => {
		e.stopPropagation();
		// Strip '@'
		const username = mention.substring(1);

		if (!username) return;

		navigate(`/profile/${encodeURIComponent(username)}`);
	};

	const renderContent = () => {
		if (!text) return null;

		const parts: React.ReactNode[] = [];
		let lastIndex = 0;
		let match;

		// Reset regex state just in case
		tokenRegex.lastIndex = 0;

		while ((match = tokenRegex.exec(text)) !== null) {
			const token = match[0];
			const matchIndex = match.index;

			// Add plain text before the token
			if (matchIndex > lastIndex) {
				parts.push(text.substring(lastIndex, matchIndex));
			}

			if (token.startsWith("#")) {
				parts.push(
					<span
						key={`hashtag-${matchIndex}`}
						className={hashtagClassName}
						onClick={(e) => handleHashtagClick(token, e)}
					>
						{token}
					</span>
				);
			} else if (token.startsWith("@")) {
				parts.push(
					<span
						key={`mention-${matchIndex}`}
						className={mentionClassName}
						onClick={(e) => handleMentionClick(token, e)}
					>
						{token}
					</span>
				);
			}

			lastIndex = matchIndex + token.length;
		}

		// Add remaining plain text
		if (lastIndex < text.length) {
			parts.push(text.substring(lastIndex));
		}

		return parts;
	};

	return <p className={`whitespace-pre-wrap break-words ${className}`}>{renderContent()}</p>;
};

export default RichText;
