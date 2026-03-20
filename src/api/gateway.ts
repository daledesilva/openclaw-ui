import { Message } from '../App';

let socket: WebSocket | null = null;
let onMessageCallback: ((message: any) => void) | null = null;
let onReasoningCallback: ((chunk: string) => void) | null = null;
let onContentCallback: ((chunk: string) => void) | null = null;

const GATEWAY_URL = `ws://${window.location.hostname}:18789`;

function connect() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log('WebSocket already connected.');
    return;
  }

  socket = new WebSocket(GATEWAY_URL);

  socket.onopen = () => {
    console.log('WebSocket connection established.');
    const connectPayload = {
      type: 'req',
      id: 'connect-ui',
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'openclaw-ui',
          version: '0.1.0',
          platform: 'web',
          mode: 'operator',
        },
        role: 'operator',
        scopes: ['operator.read', 'operator.write', 'chat.read', 'chat.write'],
      },
    };
    console.log('GATEWAY SENT:', JSON.stringify(connectPayload, null, 2));
    socket?.send(JSON.stringify(connectPayload));
  };

  socket.onmessage = (event) => {
    console.log('GATEWAY RECEIVED:', event.data);
    const data = JSON.parse(event.data);

    // Handle initial connection response
    if (data.id === 'connect-ui' && data.ok) {
      console.log('Gateway handshake successful.');
      return;
    }
    
    // Handle session.stream events (the agent's reply)
    if (data.type === 'evt' && data.method === 'session.stream') {
        const { payload } = data;
        if (payload.type === 'reasoning') {
            onReasoningCallback?.(payload.data);
        } else if (payload.type === 'content') {
            onContentCallback?.(payload.data);
        }
    }

    if (onMessageCallback) {
      onMessageCallback(data);
    }
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  socket.onclose = () => {
    console.log('WebSocket connection closed.');
    socket = null;
  };
}

export function sendMessageToGateway(message: string) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.error('WebSocket is not connected.');
    return;
  }

  const messagePayload = {
    type: 'req',
    id: `msg-${Date.now()}`,
    method: 'session.send',
    params: {
      sessionKey: 'main', // Hardcoded to the main session
      message: message,
      agentId: 'main'
    },
  };
  socket.send(JSON.stringify(messagePayload));
}

export function initGatewayConnection({
  onMessage,
  onReasoning,
  onContent,
}: {
  onMessage: (message: any) => void;
  onReasoning: (chunk: string) => void;
  onContent: (chunk: string) => void;
}) {
  onMessageCallback = onMessage;
  onReasoningCallback = onReasoning;
  onContentCallback = onContent;
  connect();
}
