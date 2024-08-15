import net from 'net';
import { UPNPAdvertiser } from './advertise_upnp.js';
import { z } from 'zod';
import { serviceConfigSchema } from './config.js';
import { Musician } from './musician.js';

class SocketWithMetadata {
  lastIncoming: number = -1;
  lastOutgoing: number = -1;

  socket: net.Socket;

  id: string;

  constructor (socket: net.Socket) {
    this.socket = socket;
    this.id = `${socket.remoteAddress}:${socket.remotePort}-${socket.localAddress}:${socket.localPort}`;
  }
}

export class SocketNotFoundError extends Error {}

interface TCPMirrorOpts {
  config: z.infer<typeof serviceConfigSchema>;
  port: number;
  upnpDefault: boolean;
}

export class TCPMirror {
  server: net.Server;
  options: TCPMirrorOpts;
  musician: Musician;

  currentSockets: Record<string, SocketWithMetadata> = {};

  isUp: boolean = false;

  upnpAdvertiser?: UPNPAdvertiser;

  constructor (options: TCPMirrorOpts, musician: Musician) {
    this.options = options;
    this.musician = musician;

    this.server = net.createServer((function (this: TCPMirror, localSocket: net.Socket) {
      // Big props to kfox
      // https://gist.github.com/kfox/2313683
      // <3

      const socketWithMetadata = new SocketWithMetadata(localSocket);
      this.currentSockets[socketWithMetadata.id] = socketWithMetadata;

      const remoteSocket = new net.Socket();

      remoteSocket.connect({ port: options.config.port, host: 'localhost' });

      localSocket.on('data', function (data) {
        socketWithMetadata.lastIncoming = Date.now();

        if (!remoteSocket.write(data)) {
          localSocket.pause();
        }
      });

      remoteSocket.on('data', function(data) {
        socketWithMetadata.lastOutgoing = Date.now();

        if (!localSocket.write(data)) {
          remoteSocket.pause();
        }
      });

      localSocket.on('drain', function() {
        remoteSocket.resume();
      });

      remoteSocket.on('drain', function() {
        localSocket.resume();
      });

      localSocket.on('close', function(err) {
        if (err) console.error(err);
        remoteSocket.end();
      });

      remoteSocket.on('close', function(err) {
        if (err) console.error(err);
        localSocket.end();
      });
    }).bind(this));

    if (options.config.upnp ?? options.upnpDefault) {
      this.setupUPNPAdvertiser();
    }
  }

  setupUPNPAdvertiser() {
    this.upnpAdvertiser = new UPNPAdvertiser({
      description: this.options.config.name,
      port: this.options.port,
    }, this.musician.upnpClient);
  }

  start() {
    return new Promise<void>((res) => this.server.listen(
      {
        port: this.options.port,
        host: '0.0.0.0',
      },
      (function (this: TCPMirror) {
        this.isUp = true;
        res();
      }).bind(this),
    ))
      .then((function (this: TCPMirror) {
        if (this.upnpAdvertiser) {
          this.upnpAdvertiser.start();
        }
      }).bind(this));
  }

  async restrain() {
    this.isUp = false;
    if (this.upnpAdvertiser && this.upnpAdvertiser.isUp) {
      await this.upnpAdvertiser.stop();
    }
    this.server.close();
  }

  async stop() {
    if (this.isUp) await this.restrain();
    Object.keys(this.currentSockets)
      .forEach(this.closeSocket.bind(this));
  }

  closeSocket(socketId: string) {
    const socketWithMetadata = this.currentSockets[socketId];

    if (!socketWithMetadata) throw new SocketNotFoundError();

    socketWithMetadata.socket.end();
  }
}
