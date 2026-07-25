import { io, Socket } from 'socket.io-client';

class NetworkManager {
  private socket: Socket | null = null;

  public connect(serverUrl: string = 'http://localhost:3002') {
    this.socket = io(serverUrl, {
      transports: ['websocket'],
      autoConnect: true
    });

    this.socket.on('connect', () => {
      console.log('⚡ Conectado al servidor multijugador AtNight:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('⚠️ Desconectado del servidor multijugador AtNight');
    });

    return this.socket;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }
}

export const networkManager = new NetworkManager();
