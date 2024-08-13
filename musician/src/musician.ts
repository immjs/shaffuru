import { WebSocket } from 'ws';
import { z } from 'zod';
import { configSchema } from './config.js';
import cron from 'node-cron';
import crypto from 'crypto';
import { TCPMirror } from './tcpmirror.js';

export class Musician {
  config: z.infer<typeof configSchema>;
  socket: WebSocket | undefined;

  previousTCPMirrors: Record<number, Set<TCPMirror>> = {};

  constructor(config: z.infer<typeof configSchema>) {
    this.config = config;

    if (config.config.conductor) {
      this.socket = new WebSocket(config.config.conductor);
  
      // this.socket.on('message', (data) => {
        
      // });
    }

    for (let serviceIdxStr in config.services) {
      const serviceIdx = +serviceIdxStr;
      const service = config.services[serviceIdx];

      this.shuffleService(serviceIdx);
      cron.schedule(service.cron_reload, this.shuffleService.bind(this, serviceIdx));
    }
  }

  async stopAll(serviceIdx: number) {
    if (serviceIdx in this.previousTCPMirrors) {
      const prevTCPMirrors = this.previousTCPMirrors[serviceIdx];
      for (let prevTCPMirror of prevTCPMirrors) {
        await prevTCPMirror.stop();
        prevTCPMirrors.delete(prevTCPMirror);
      }
    }
  }

  async shuffleService(serviceIdx: number) {
    await this.stopAll(serviceIdx);

    const serviceConfig = this.config.services[serviceIdx];

    const tcpMirrors = new Set();

    for (let forcedConfig of serviceConfig.forced) {
      if (!forcedConfig.disabled) {
        const newTCPMirror = new TCPMirror({
          config: this.config.services[serviceIdx],
          port: forcedConfig.port,
          upnpDefault: this.config.config.upnp,
        });
        newTCPMirror.start();
        tcpMirrors.add(newTCPMirror);
      }
    }

    let additionalServers = serviceConfig.number;
    while (additionalServers !== 0) {
      let attemptedServer: TCPMirror | undefined = undefined;
      try {
        const port = crypto.randomInt(...serviceConfig.range);
        attemptedServer = new TCPMirror({
          config: this.config.services[serviceIdx],
          port,
          upnpDefault: this.config.config.upnp,
        });
        attemptedServer.start();
        tcpMirrors.add(attemptedServer);
        additionalServers -= 1;
      } catch (err) {
        attemptedServer!.restrain();
      }
    }
  }
}
