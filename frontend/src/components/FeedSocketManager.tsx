import React from 'react';
import { useFeedSocketIntegration } from '../hooks/feeds/useFeedSocketIntegration';

/**
 * Component that enables real-time feed updates via WebSocket
 * Should be placed inside SocketProvider and QueryClientProvider
 */
const FeedSocketManager: React.FC = () => {
  useFeedSocketIntegration();
  return null; // This component only handles side effects
};

export default FeedSocketManager;