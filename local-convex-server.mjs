#!/usr/bin/env node
import { WebSocketServer } from 'ws';
import http from 'http';

const PORT = 3210;

// Create HTTP server
const server = http.createServer((req, res) => {
  // Handle CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Handle HTTP endpoints
  if (req.url === '/initial_messages' && req.method === 'POST') {
    // Return empty message list
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/store_chat' && req.method === 'POST') {
    // Accept chat storage but don't actually store anything
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// Create WebSocket server for /api/*/sync endpoint
const wss = new WebSocketServer({ 
  noServer: true
});

// Handle WebSocket upgrade manually to match any /api/*/sync path
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  
  if (pathname.match(/^\/api\/[\d.]+\/sync$/)) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws, req) => {
  console.log('[Local Convex] WebSocket connected:', req.url);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('[Local Convex] Received:', message.type || 'unknown');

      // Handle different Convex protocol messages
      switch (message.type) {
        case 'Authenticate':
          // Send authentication success
          ws.send(JSON.stringify({
            type: 'AuthenticationResult',
            success: true
          }));
          break;

        case 'Query':
          // Return empty results for all queries
          ws.send(JSON.stringify({
            type: 'QueryResult',
            requestId: message.requestId,
            result: {
              value: message.query?.udfPath?.includes('getAll') ? [] : null,
              logLines: []
            }
          }));
          break;

        case 'Mutation':
          // Acknowledge mutations with a fake ID
          ws.send(JSON.stringify({
            type: 'MutationResult',
            requestId: message.requestId,
            result: {
              value: message.mutation?.udfPath?.includes('startSession') 
                ? 'local-session-' + Date.now()
                : { success: true },
              logLines: []
            }
          }));
          break;

        case 'Action':
          // Acknowledge actions
          ws.send(JSON.stringify({
            type: 'ActionResult',
            requestId: message.requestId,
            result: {
              value: { success: true },
              logLines: []
            }
          }));
          break;

        default:
          console.log('[Local Convex] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[Local Convex] Error processing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('[Local Convex] WebSocket disconnected');
  });

  ws.on('error', (error) => {
    console.error('[Local Convex] WebSocket error:', error);
  });

  // Send initial connection success message
  ws.send(JSON.stringify({
    type: 'Transition',
    startVersion: { ts: Date.now(), identity: null },
    endVersion: { ts: Date.now(), identity: null },
    modifications: []
  }));
});

server.listen(PORT, () => {
  console.log(`[Local Convex] Mock server running on http://localhost:${PORT}`);
  console.log(`[Local Convex] WebSocket endpoint: ws://localhost:${PORT}/api/1.27.0/sync`);
});
