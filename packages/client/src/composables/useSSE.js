import { ref, onUnmounted } from 'vue';

export function useSSE(workspaceId, onMessage) {
  const connected = ref(false);
  let eventSource = null;
  let reconnectTimer = null;

  function connect() {
    if (eventSource) {
      disconnect();
    }

    const baseUrl = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
    console.log(`SSE: Connecting to workspace ${workspaceId}`);
    eventSource = new EventSource(`${baseUrl}/sse/workspaces/${workspaceId}`, {
      withCredentials: true
    });

    eventSource.onopen = () => {
      console.log(`SSE: Connected to workspace ${workspaceId}`);
      connected.value = true;
    };

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('SSE: Received message:', message);
        if (message.type !== 'connected' && onMessage) {
          onMessage(message);
        }
      } catch (error) {
        console.error('SSE: Error parsing message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE: Connection error:', error);
      connected.value = false;

      // Try to reconnect after 5 seconds
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      reconnectTimer = setTimeout(() => {
        console.log('SSE: Attempting to reconnect...');
        connect();
      }, 5000);
    };
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (eventSource) {
      console.log(`SSE: Disconnecting from workspace ${workspaceId}`);
      eventSource.close();
      eventSource = null;
      connected.value = false;
    }
  }

  // Start connection
  connect();

  // Clean up on unmount
  onUnmounted(() => {
    disconnect();
  });

  return {
    connected,
    disconnect
  };
}
