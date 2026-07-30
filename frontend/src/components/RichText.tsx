import React from "react";
import { Box } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

interface RichTextProps {
  text: string;
}

const clickableTokenSx = {
  color: "primary.main",
  cursor: "pointer",
  fontWeight: 700,
  textDecoration: "none",
  "&:hover": {
    color: "primary.light",
    textDecoration: "underline",
  },
  "&:focus-visible": {
    borderRadius: 0.5,
    outline: "2px solid",
    outlineColor: "primary.main",
    outlineOffset: 2,
  },
};

/**
 * This component detects hashtags and mentions in text and makes them clickable
 * Hashtags - #word - /results/?q=#word
 * Mentions - @handle - /profile/handle
 */
const RichText: React.FC<RichTextProps> = ({ text }) => {
  // Regex to match hashtags for words and mentions with '#' or '@'
  // Matches alphanumeric and underscores, including unicode characters for hashtags
  const tokenRegex = /((?:#[\p{L}\p{N}_]+)|(?:@[a-zA-Z0-9._]+))/gu;

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
          <Box
            component={RouterLink}
            to={`/results/?q=${encodeURIComponent(token)}`}
            key={`hashtag-${matchIndex}`}
            sx={clickableTokenSx}
            onClick={(event) => event.stopPropagation()}
          >
            {token}
          </Box>,
        );
      } else if (token.startsWith("@")) {
        parts.push(
          <Box
            component={RouterLink}
            to={`/profile/${encodeURIComponent(token.substring(1))}`}
            key={`mention-${matchIndex}`}
            sx={clickableTokenSx}
            onClick={(event) => event.stopPropagation()}
          >
            {token}
          </Box>,
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

  return (
    <Box
      component="span"
      sx={{
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
      }}
    >
      {renderContent()}
    </Box>
  );
};

export default RichText;
