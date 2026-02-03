export type CaretCoordinates = {
	top: number;
	left: number;
	height: number;
};

/**
 * Returns the {top, left, height} coordinates of the caret in a text input or textarea.
 * Replicates the styles of the element to a shadow div to measure position.
 */
export function getCaretCoordinates(element: HTMLInputElement | HTMLTextAreaElement, position: number): CaretCoordinates {
	const div = document.createElement("div");
	document.body.appendChild(div);

	const style = div.style;
	const computed = window.getComputedStyle(element);

	style.whiteSpace = "pre-wrap";
	style.wordWrap = "break-word";
	style.position = "absolute";
	style.visibility = "hidden";

	// Copy all relevant properties
	const properties = [
		"direction",
		"boxSizing",
		"width",
		"height",
		"overflowX",
		"overflowY",
		"borderTopWidth",
		"borderRightWidth",
		"borderBottomWidth",
		"borderLeftWidth",
		"borderStyle",
		"paddingTop",
		"paddingRight",
		"paddingBottom",
		"paddingLeft",
		"fontStyle",
		"fontVariant",
		"fontWeight",
		"fontStretch",
		"fontSize",
		"fontSizeAdjust",
		"lineHeight",
		"fontFamily",
		"textAlign",
		"textTransform",
		"textIndent",
		"textDecoration",
		"letterSpacing",
		"wordSpacing",
		"tabSize",
		"MozTabSize",
	];

	properties.forEach((prop) => {
		style.setProperty(prop, computed.getPropertyValue(prop));
	});

	if (element.nodeName === "INPUT") {
		style.whiteSpace = "pre";
	}

	// Text content up to the caret
	div.textContent = element.value.substring(0, position);

	// Create a span for the caret position
	const span = document.createElement("span");
	span.textContent = element.value.substring(position) || ".";
	div.appendChild(span);

	const coordinates = {
		top: span.offsetTop + parseInt(computed["borderTopWidth"]),
		left: span.offsetLeft + parseInt(computed["borderLeftWidth"]),
		height: parseInt(computed["lineHeight"]),
	};

	document.body.removeChild(div);

	return coordinates;
}
