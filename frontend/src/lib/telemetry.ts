/**
 * Lightweight telemetry service for tracking user behavior metrics
 * - Time-to-first-interaction (TTFI)
 * - Abandoned flows
 * - Feed scroll depth
 */

type TelemetryEventType =
	| "ttfi" // time to first interaction
	| "scroll_depth" // feed scroll depth
	| "flow_start" // user started a flow
	| "flow_complete" // user completed a flow
	| "flow_abandon"; // user abandoned a flow

interface TelemetryEvent {
	type: TelemetryEventType;
	timestamp: number;
	sessionId: string;
	data: Record<string, unknown>;
}

interface FlowState {
	flowId: string;
	flowType: string;
	startedAt: number;
	lastActivity: number;
}

const BATCH_SIZE = 10;
const FLUSH_INTERVAL = 30000; // 30 seconds
const FLOW_TIMEOUT = 60000; // 1 minute - consider flow abandoned after this

class TelemetryService {
	private events: TelemetryEvent[] = [];
	private sessionId: string;
	private sessionStart: number;
	private firstInteractionRecorded = false;
	private activeFlows: Map<string, FlowState> = new Map();
	private flushTimer: ReturnType<typeof setInterval> | null = null;
	private maxScrollDepths: Map<string, number> = new Map(); // feedId -> max depth

	constructor() {
		this.sessionId = this.generateSessionId();
		this.sessionStart = Date.now();
		this.setupEventListeners();
		this.startFlushTimer();
	}

	private generateSessionId(): string {
		return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
	}

	private setupEventListeners(): void {
		if (typeof window === "undefined") return;

		// track first interaction
		const interactionEvents = ["click", "keydown", "touchstart", "scroll"];
		const handleFirstInteraction = (e: Event) => {
			if (!this.firstInteractionRecorded) {
				this.recordTTFI(e.type);
				interactionEvents.forEach((event) => {
					window.removeEventListener(event, handleFirstInteraction, { capture: true });
				});
			}
		};

		interactionEvents.forEach((event) => {
			window.addEventListener(event, handleFirstInteraction, { capture: true, passive: true });
		});

		// check for abandoned flows on page unload
		window.addEventListener("beforeunload", () => {
			this.checkAbandonedFlows(true);
			this.flush(true); // sync flush on unload
		});

		// periodic check for abandoned flows
		setInterval(() => this.checkAbandonedFlows(false), 10000);
	}

	private startFlushTimer(): void {
		if (this.flushTimer) return;
		this.flushTimer = setInterval(() => this.flush(false), FLUSH_INTERVAL);
	}

	private recordTTFI(interactionType: string): void {
		if (this.firstInteractionRecorded) return;
		this.firstInteractionRecorded = true;

		const ttfi = Date.now() - this.sessionStart;
		this.track("ttfi", {
			duration: ttfi,
			interactionType,
			pageUrl: window.location.pathname,
		});
	}

	/**
	 * Track scroll depth for a feed
	 * Call this as user scrolls with the current visible item index and total items
	 */
	trackScrollDepth(feedId: string, visibleIndex: number, totalItems: number): void {
		if (totalItems === 0) return;

		const depthPercent = Math.round((visibleIndex / totalItems) * 100);
		const currentMax = this.maxScrollDepths.get(feedId) || 0;

		// only track if we've scrolled deeper
		if (depthPercent > currentMax) {
			this.maxScrollDepths.set(feedId, depthPercent);

			// track at meaningful thresholds: 25%, 50%, 75%, 90%, 100%
			const thresholds = [25, 50, 75, 90, 100];
			const crossedThreshold = thresholds.find((t) => depthPercent >= t && currentMax < t);

			if (crossedThreshold) {
				this.track("scroll_depth", {
					feedId,
					depth: crossedThreshold,
					itemsViewed: visibleIndex,
					totalItems,
				});
			}
		}
	}

	/**
	 * Start tracking a user flow (e.g., create post, sign up)
	 */
	startFlow(flowType: string, metadata?: Record<string, unknown>): string {
		const flowId = `${flowType}-${Date.now()}`;
		const now = Date.now();

		this.activeFlows.set(flowId, {
			flowId,
			flowType,
			startedAt: now,
			lastActivity: now,
		});

		this.track("flow_start", {
			flowId,
			flowType,
			...metadata,
		});

		return flowId;
	}

	/**
	 * Update flow activity timestamp (call on meaningful progress)
	 */
	updateFlowActivity(flowId: string): void {
		const flow = this.activeFlows.get(flowId);
		if (flow) {
			flow.lastActivity = Date.now();
		}
	}

	/**
	 * Mark a flow as completed
	 */
	completeFlow(flowId: string, metadata?: Record<string, unknown>): void {
		const flow = this.activeFlows.get(flowId);
		if (!flow) return;

		const duration = Date.now() - flow.startedAt;
		this.track("flow_complete", {
			flowId,
			flowType: flow.flowType,
			duration,
			...metadata,
		});

		this.activeFlows.delete(flowId);
	}

	/**
	 * Explicitly abandon a flow (e.g., user clicks cancel)
	 */
	abandonFlow(flowId: string, reason?: string): void {
		const flow = this.activeFlows.get(flowId);
		if (!flow) return;

		const duration = Date.now() - flow.startedAt;
		this.track("flow_abandon", {
			flowId,
			flowType: flow.flowType,
			duration,
			reason: reason || "explicit",
		});

		this.activeFlows.delete(flowId);
	}

	private checkAbandonedFlows(isUnload: boolean): void {
		const now = Date.now();

		for (const [flowId, flow] of this.activeFlows) {
			const timeSinceActivity = now - flow.lastActivity;

			if (isUnload || timeSinceActivity > FLOW_TIMEOUT) {
				const duration = now - flow.startedAt;
				this.track("flow_abandon", {
					flowId,
					flowType: flow.flowType,
					duration,
					reason: isUnload ? "page_unload" : "timeout",
				});
				this.activeFlows.delete(flowId);
			}
		}
	}

	private track(type: TelemetryEventType, data: Record<string, unknown>): void {
		this.events.push({
			type,
			timestamp: Date.now(),
			sessionId: this.sessionId,
			data,
		});

		if (this.events.length >= BATCH_SIZE) {
			this.flush(false);
		}
	}

	private async flush(sync: boolean): Promise<void> {
		if (this.events.length === 0) return;

		const eventsToSend = [...this.events];
		this.events = [];

		const payload = JSON.stringify({ events: eventsToSend });

		if (sync && navigator.sendBeacon) {
			// use sendBeacon for reliable delivery on page unload
			navigator.sendBeacon("/api/telemetry", payload);
		} else {
			try {
				await fetch("/api/telemetry", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: payload,
					keepalive: true,
				});
			} catch {
				// silently fail - telemetry should never break the app
				// optionally re-queue events for retry
				this.events = [...eventsToSend, ...this.events].slice(0, 100);
			}
		}
	}

	/**
	 * Get session info for debugging
	 */
	getSessionInfo() {
		return {
			sessionId: this.sessionId,
			sessionDuration: Date.now() - this.sessionStart,
			pendingEvents: this.events.length,
			activeFlows: Array.from(this.activeFlows.keys()),
		};
	}
}

// singleton instance
export const telemetry = new TelemetryService();

// React hook for flow tracking
import { useEffect, useRef } from "react";

export function useFlowTracking(flowType: string, isActive: boolean, metadata?: Record<string, unknown>) {
	const flowIdRef = useRef<string | null>(null);
	const metadataRef = useRef(metadata);
	metadataRef.current = metadata;

	useEffect(() => {
		if (isActive && !flowIdRef.current) {
			flowIdRef.current = telemetry.startFlow(flowType, metadataRef.current);
		} else if (!isActive && flowIdRef.current) {
			telemetry.abandonFlow(flowIdRef.current, "closed");
			flowIdRef.current = null;
		}

		return () => {
			if (flowIdRef.current) {
				telemetry.abandonFlow(flowIdRef.current, "unmount");
				flowIdRef.current = null;
			}
		};
	}, [isActive, flowType]);

	return {
		completeFlow: (completionMetadata?: Record<string, unknown>) => {
			if (flowIdRef.current) {
				telemetry.completeFlow(flowIdRef.current, completionMetadata);
				flowIdRef.current = null;
			}
		},
		updateActivity: () => {
			if (flowIdRef.current) {
				telemetry.updateFlowActivity(flowIdRef.current);
			}
		},
	};
}

// Hook for scroll depth tracking
export function useScrollDepthTracking(feedId: string, currentIndex: number, totalItems: number) {
	useEffect(() => {
		telemetry.trackScrollDepth(feedId, currentIndex, totalItems);
	}, [feedId, currentIndex, totalItems]);
}
