import React from "react";
import { useNavigate } from "react-router-dom";

interface HashtagTextProps {
	text: string;
	className?: string;
	hashtagClassName?: string;
}

/**
 * Component that detects hashtags in text and makes them clickable
 * Hashtags - #word or #word_with_underscores
 */
const HashtagText: React.FC<HashtagTextProps> = ({
	text,
	className = "",
	hashtagClassName = "text-cyan-400 hover:text-cyan-300 cursor-pointer font-semibold",
}) => {
	const navigate = useNavigate();

	// Regex to match hashtags
	const hashtagRegex = /#([a-zA-Z0-9_]+)/g;

	const handleHashtagClick = (tag: string, e: React.MouseEvent) => {
		e.stopPropagation(); // prevent parent click handlers
		navigate(`/results?q=${encodeURIComponent(tag)}`);
	};

	// Split text by hashtags and create clickable elements
	const renderTextWithHashtags = () => {
		const parts: React.ReactNode[] = [];
		let lastIndex = 0;
		let match;

		// Reset regex index
		hashtagRegex.lastIndex = 0;

		while ((match = hashtagRegex.exec(text)) !== null) {
			const fullHashtag = match[0]; //#forests
			const tagName = match[1]; //forests
			const matchIndex = match.index;

			// Add text before the hashtag
			if (matchIndex > lastIndex) {
				parts.push(text.substring(lastIndex, matchIndex));
			}

			parts.push(
				<span
					key={`hashtag-${matchIndex}`}
					className={hashtagClassName}
					onClick={(e) => handleHashtagClick(tagName, e)}
				>
					{fullHashtag}
				</span>
			);

			lastIndex = matchIndex + fullHashtag.length;
		}

		if (lastIndex < text.length) {
			parts.push(text.substring(lastIndex));
		}

		return parts;
	};

	return <span className={className}>{renderTextWithHashtags()}</span>;
};

export default HashtagText;
