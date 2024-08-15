import { WebSocket } from 'ws';
import { z } from 'zod';
import cron from 'node-cron';
import crypto from 'crypto';
import { configSchema, notifyConfigSchema, serviceConfigSchema } from './config.js';
import { TCPMirror } from './tcpmirror.js';
import { BaseNotifier, Notification } from './notify/base_notifier.js';
import { WebhookNotifier } from './notify/webhook.js';
// import { EmailNotifier } from './notify/email.js';
import { createUpnpClient, UpnpClient } from '@immjs/nat-api';

const allNotifiers = {
  webhook: WebhookNotifier,
  email: undefined,
} as const;

export class Musician {
  config: z.infer<typeof configSchema>;
  socket: WebSocket | undefined;
  upnpClient: Promise<UpnpClient> = undefined as unknown as Promise<UpnpClient>;

  previousTCPMirrors: Record<number, Set<TCPMirror>> = {};

  notifiers: BaseNotifier<z.infer<typeof notifyConfigSchema>['type']>[] = [];

  constructor(config: z.infer<typeof configSchema>) {
    this.config = config;

    if (this.config.services.some((function (this: Musician, v: z.infer<typeof serviceConfigSchema>) {
      return v.upnp ?? this.config.config.upnp;
    }).bind(this))) {
      this.upnpClient = createUpnpClient({ interface: config.config.iface });
    }

    // if (config.config.conductor) {
    //   this.socket = new WebSocket(config.config.conductor);
    // }

    for (const notifierConfig of config.notify) {
      const RelevantNotifier = allNotifiers[notifierConfig.type];
      if (RelevantNotifier === undefined) continue;

      // @ts-ignore ahh situation
      this.notifiers.push(new RelevantNotifier(notifierConfig));
    }

    this.notifyAll([{
      title: `Shaffuru started`,
      message: `The shaffaru service just started and will start arraging ports.`,
    }]);

    for (const serviceIdxStr in config.services) {
      const serviceIdx = +serviceIdxStr;
      const service = config.services[serviceIdx];

      this.shuffleService(serviceIdx);
      cron.schedule(
        service.cron_reload,
        this.shuffleService.bind(this, serviceIdx),
      );
    }
  }

  async stopAll(serviceIdx: number) {
    if (serviceIdx in this.previousTCPMirrors) {
      const prevTCPMirrors = this.previousTCPMirrors[serviceIdx];
      for (let prevTCPMirror of prevTCPMirrors) {
        await prevTCPMirror.restrain();
        prevTCPMirrors.delete(prevTCPMirror);
      }
    }
  }

  async shuffleService(serviceIdx: number) {
    await this.stopAll(serviceIdx);

    const serviceConfig = this.config.services[serviceIdx];

    if (!serviceConfig.disabled) {
      
      const tcpMirrors = new Set<TCPMirror>();
      this.previousTCPMirrors[serviceIdx] = tcpMirrors;
  
      for (const forcedConfig of serviceConfig.forced) {
        if (!forcedConfig.disabled) {
          const newTCPMirror = new TCPMirror({
            config: this.config.services[serviceIdx],
            port: forcedConfig.port,
            upnpDefault: this.config.config.upnp,
          }, this);
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
            config: serviceConfig,
            port,
            upnpDefault: this.config.config.upnp,
          }, this);
          attemptedServer.start();
          tcpMirrors.add(attemptedServer);
          additionalServers -= 1;
        } catch (err) {
          attemptedServer!.restrain();
        }
      }

      if (serviceConfig.notify ?? this.config.config.notify) {
        this.notifyAll([{
          title: `Service ${JSON.stringify(serviceConfig.name)} changed`,
          message: `The ${tcpMirrors.size === 1 ? 'port' : 'ports'} \
to access the service ${JSON.stringify(serviceConfig.name)} \
are now ${[...tcpMirrors].map((v) => v.options.port).sort((a, b) => a - b).join(', ') || `inexistant`}.`,
        }]);
      }
    }
  }

  async notifyAll(events: Notification[]) {
    await Promise.all(
      this.notifiers.map((notifier) => notifier.notify(events)),
    );
  }
}
