import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ namespace: 'realtime', cors: true })
export class RealtimeGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('dashboard:subscribe')
  subscribeDashboard(@MessageBody() payload: { scope: string }) {
    return { event: 'dashboard:subscribed', data: payload };
  }

  emitOrderUpdate(orderId: string, data: unknown): void {
    this.server.emit(`orders:${orderId}`, data);
  }

  emitStockUpdate(productId: string, data: unknown): void {
    this.server.emit(`stock:${productId}`, data);
  }
}
