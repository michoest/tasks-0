import express from 'express';
import { requireAuth } from '../auth.js';

const router = express.Router();

// Store active SSE connections by space
const connections = new Map(); // spaceId -> Set of response objects

// SSE endpoint for space updates
router.get('/spaces/:spaceId', requireAuth, (req, res) => {
  const { spaceId } = req.params;
  const userId = req.session.userId;

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', spaceId })}\n\n`);

  // Add this connection to the space connections
  if (!connections.has(spaceId)) {
    connections.set(spaceId, new Set());
  }
  connections.get(spaceId).add(res);

  console.log(`SSE: User ${userId} connected to space ${spaceId}`);
  console.log(`SSE: Active connections for space ${spaceId}: ${connections.get(spaceId).size}`);

  // Clean up on disconnect
  req.on('close', () => {
    const spaceConnections = connections.get(spaceId);
    if (spaceConnections) {
      spaceConnections.delete(res);
      console.log(`SSE: User ${userId} disconnected from space ${spaceId}`);
      console.log(`SSE: Active connections for space ${spaceId}: ${spaceConnections.size}`);

      if (spaceConnections.size === 0) {
        connections.delete(spaceId);
      }
    }
  });
});

// Function to broadcast updates to all clients in a space
export function broadcastToSpace(spaceId, eventType, data) {
  const spaceConnections = connections.get(spaceId);
  if (!spaceConnections || spaceConnections.size === 0) {
    console.log(`SSE: No connections for space ${spaceId}, skipping broadcast`);
    return;
  }

  const message = `data: ${JSON.stringify({ type: eventType, data })}\n\n`;
  console.log(`SSE: Broadcasting ${eventType} to ${spaceConnections.size} clients in space ${spaceId}`);

  // Send to all connected clients, remove any that fail
  const deadConnections = new Set();
  for (const client of spaceConnections) {
    try {
      client.write(message);
    } catch (error) {
      console.error('SSE: Failed to send to client:', error.message);
      deadConnections.add(client);
    }
  }

  // Clean up dead connections
  for (const client of deadConnections) {
    spaceConnections.delete(client);
  }
}

export default router;
