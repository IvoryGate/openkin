import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import type { ChatService } from '../services/ChatService.js';
import type { WsChatRequest, WsServerMessage } from '../types/chat.js';

/**
 * 创建并返回一个 WebSocketServer（不绑定端口），
 * 由 Node.js HTTP server 的 'upgrade' 事件手动处理。
 * 路径过滤：只处理 /ws/chat
 */
export function createChatWsHandler(chatService: ChatService) {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: WebSocket) => {
    console.info('[INFO] [ChatWS] Client connected');

    ws.on('message', async (data: Buffer) => {
      let request: WsChatRequest;
      try {
        request = JSON.parse(data.toString()) as WsChatRequest;
      } catch {
        const errMsg: WsServerMessage = {
          type: 'error',
          code: 'INVALID_MESSAGE',
          message: 'Invalid JSON message',
        };
        ws.send(JSON.stringify(errMsg));
        return;
      }

      if (request.type !== 'chat') return;

      const { agentId, sessionId, message, history } = request;

      if (!agentId || !message) {
        const errMsg: WsServerMessage = {
          type: 'error',
          code: 'VALIDATION_ERROR',
          message: 'agentId and message are required',
        };
        ws.send(JSON.stringify(errMsg));
        return;
      }

      try {
        console.info(
          `[INFO] [ChatService] Starting stream chat agentId=${agentId} sessionId=${sessionId}`,
        );
        const { messageId, stream } = await chatService.startStreamChat({
          agentId,
          userMessage: message,
          history: history ?? [],
        });

        for await (const chunk of stream) {
          if (ws.readyState !== WebSocket.OPEN) break;

          if (!chunk.done && chunk.content) {
            const tokenMsg: WsServerMessage = {
              type: 'token',
              messageId,
              content: chunk.content,
            };
            ws.send(JSON.stringify(tokenMsg));
          }

          if (chunk.done) {
            const doneMsg: WsServerMessage = { type: 'done', messageId };
            ws.send(JSON.stringify(doneMsg));
            break;
          }
        }
      } catch (e: unknown) {
        const err = e as Error;
        const code = err.message.startsWith('AGENT_NOT_FOUND')
          ? 'AGENT_NOT_FOUND'
          : err.message === 'No LLM API key configured'
          ? 'CONFIG_ERROR'
          : 'LLM_ERROR';

        console.error(`[ERROR] [ChatService] ${err.message}`);
        const errMsg: WsServerMessage = {
          type: 'error',
          code,
          message: err.message,
        };
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(errMsg));
        }
      }
    });

    ws.on('close', () => {
      console.info('[INFO] [ChatWS] Client disconnected');
    });

    ws.on('error', (err) => {
      console.error('[ERROR] [ChatWS] WebSocket error', err);
    });
  });

  /**
   * 供 HTTP server 的 upgrade 事件调用
   */
  function handleUpgrade(
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void {
    const url = req.url ?? '';
    if (url === '/ws/chat' || url.startsWith('/ws/chat?')) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  }

  return { handleUpgrade };
}
