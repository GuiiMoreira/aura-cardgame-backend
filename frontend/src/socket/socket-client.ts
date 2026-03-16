import { io, type Socket } from 'socket.io-client';
import type { SocketClientToServerEvents, SocketServerToClientEvents } from '../contracts/socket-contracts';

export type AuraSocket = Socket<SocketServerToClientEvents, SocketClientToServerEvents>;

export type SocketClientOptions = {
  url: string;
  token: string;
};

export function createSocketClient({ url, token }: SocketClientOptions): AuraSocket {
  return io(url, {
    auth: { token },
    transports: ['websocket'],
  });
}
