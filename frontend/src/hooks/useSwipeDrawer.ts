import { useRef, useEffect, useCallback, useState } from "react";

interface SwipeDrawerOptions {
	edgeWidth?: number;
	velocityThreshold?: number;
	minSwipeDistance?: number;
}

interface SwipeDrawerReturn {
	isOpen: boolean;
	open: () => void;
	close: () => void;
	toggle: () => void;
	drawerRef: React.RefObject<HTMLDivElement>;
	backdropRef: React.RefObject<HTMLDivElement>;
	dragOffset: number;
	isDragging: boolean;
}

const DRAWER_WIDTH = 280;

export function useSwipeDrawer(options: SwipeDrawerOptions = {}): SwipeDrawerReturn {
	const {
		// swipe can start from left ~40% of screen
		edgeWidth = 150,
		velocityThreshold = 0.3,
		minSwipeDistance = 30,
	} = options;

	const [isOpen, setIsOpen] = useState(false);
	const [dragOffset, setDragOffset] = useState(0);
	const [isDragging, setIsDragging] = useState(false);

	const drawerRef = useRef<HTMLDivElement>(null);
	const backdropRef = useRef<HTMLDivElement>(null);

	// track touch state with refs to avoid stale closure issues
	const touchState = useRef({
		startX: 0,
		startY: 0,
		startTime: 0,
		lastX: 0,
		isTracking: false,
		direction: null as "open" | "close" | null,
	});

	const open = useCallback(() => {
		setIsOpen(true);
		setDragOffset(0);
		setIsDragging(false);
	}, []);

	const close = useCallback(() => {
		setIsOpen(false);
		setDragOffset(0);
		setIsDragging(false);
	}, []);

	const toggle = useCallback(() => {
		setIsOpen((prev) => !prev);
		setDragOffset(0);
		setIsDragging(false);
	}, []);

	useEffect(() => {
		const handleTouchStart = (e: TouchEvent) => {
			const touch = e.touches[0];
			const x = touch.clientX;

			touchState.current = {
				startX: x,
				startY: touch.clientY,
				startTime: Date.now(),
				lastX: x,
				isTracking: false,
				direction: null,
			};

			// determine if we should track this touch
			if (isOpen) {
				// when open, track any touch to potentially close
				touchState.current.isTracking = true;
				touchState.current.direction = "close";
			} else if (x <= edgeWidth) {
				// when closed, only track touches starting from left zone
				touchState.current.isTracking = true;
				touchState.current.direction = "open";
			}
		};

		const handleTouchMove = (e: TouchEvent) => {
			if (!touchState.current.isTracking) return;

			const touch = e.touches[0];
			const deltaX = touch.clientX - touchState.current.startX;
			const deltaY = touch.clientY - touchState.current.startY;

			// if this is early in the gesture, check if it's more vertical than horizontal
			if (!isDragging && Math.abs(deltaY) > Math.abs(deltaX) + 10) {
				// user is scrolling vertically, abort
				touchState.current.isTracking = false;
				return;
			}

			touchState.current.lastX = touch.clientX;

			const { direction } = touchState.current;

			if (direction === "open") {
				// opening: only respond to rightward movement
				if (deltaX > 10) {
					setIsDragging(true);
					const offset = Math.min(DRAWER_WIDTH, Math.max(0, deltaX));
					setDragOffset(offset);
				}
			} else if (direction === "close") {
				// closing: only respond to leftward movement
				if (deltaX < -10) {
					setIsDragging(true);
					const offset = Math.min(0, Math.max(-DRAWER_WIDTH, deltaX));
					setDragOffset(offset);
				}
			}
		};

		const handleTouchEnd = () => {
			if (!touchState.current.isTracking) return;

			const deltaX = touchState.current.lastX - touchState.current.startX;
			const elapsed = Date.now() - touchState.current.startTime;
			const velocity = Math.abs(deltaX) / Math.max(elapsed, 1);
			const isFastSwipe = velocity > velocityThreshold;

			const { direction } = touchState.current;

			if (direction === "open") {
				// check if should open
				const shouldOpen =
					(deltaX > minSwipeDistance && isFastSwipe) || dragOffset > DRAWER_WIDTH / 3;
				if (shouldOpen) {
					open();
				} else {
					setDragOffset(0);
					setIsDragging(false);
				}
			} else if (direction === "close") {
				// check if should close
				const shouldClose =
					(deltaX < -minSwipeDistance && isFastSwipe) || dragOffset < -DRAWER_WIDTH / 3;
				if (shouldClose) {
					close();
				} else {
					setDragOffset(0);
					setIsDragging(false);
				}
			}

			touchState.current.isTracking = false;
			touchState.current.direction = null;
		};

		document.addEventListener("touchstart", handleTouchStart, { passive: true });
		document.addEventListener("touchmove", handleTouchMove, { passive: true });
		document.addEventListener("touchend", handleTouchEnd, { passive: true });

		return () => {
			document.removeEventListener("touchstart", handleTouchStart);
			document.removeEventListener("touchmove", handleTouchMove);
			document.removeEventListener("touchend", handleTouchEnd);
		};
	}, [isOpen, isDragging, dragOffset, edgeWidth, velocityThreshold, minSwipeDistance, open, close]);

	// handle backdrop click to close
	useEffect(() => {
		const backdrop = backdropRef.current;
		if (!backdrop) return;

		const handleClick = () => {
			if (isOpen) close();
		};

		backdrop.addEventListener("click", handleClick);
		return () => backdrop.removeEventListener("click", handleClick);
	}, [isOpen, close]);

	// handle escape key
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && isOpen) close();
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, close]);

	// prevent body scroll when open
	useEffect(() => {
		document.body.style.overflow = isOpen ? "hidden" : "";
		return () => {
			document.body.style.overflow = "";
		};
	}, [isOpen]);

	return {
		isOpen,
		open,
		close,
		toggle,
		drawerRef,
		backdropRef,
		dragOffset,
		isDragging,
	};
}
