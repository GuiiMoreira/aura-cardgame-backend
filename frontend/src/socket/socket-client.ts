import { io, type Socket } from 'socket.io-client';
import {
  SOCKET_PROTOCOL_VERSION,
  type SocketClientToServerEvents,
  type SocketServerToClientEvents,
} from '../contracts/socket-contracts';

export type AuraSocket = Socket<SocketServerToClientEvents, SocketClientToServerEvents>;

export type SocketClientOptions = {
  url: string;
  token: string;
  protocolVersion?: string;
};

export function createSocketClient({
  url,
  token,
  protocolVersion = SOCKET_PROTOCOL_VERSION,
}: SocketClientOptions): AuraSocket {
  return io(url, {
    auth: { token, protocolVersion },
    transports: ['websocket'],
  });
}
