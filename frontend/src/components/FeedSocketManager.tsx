import React from "react";
import { useFeedSocketIntegration } from "../hooks/feeds/useFeedSocketIntegration";
import { useMessagingSocketIntegration } from "../hooks/messaging/useMessagingSocketIntegration";

/**
 * Component that enables real-time feed updates via WebSocket
 * Should be placed inside SocketProvider and QueryClientProvider in the component tree
 * as it reliess on both contexts
 */
const FeedSocketManager: React.FC = () => {
	useFeedSocketIntegration();
	useMessagingSocketIntegration();
	return null; // This component only handles side effects
};

export default FeedSocketManager;
