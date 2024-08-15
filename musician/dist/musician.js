import cron from 'node-cron';
import crypto from 'crypto';
import { TCPMirror } from './tcpmirror.js';
import { WebhookNotifier } from './notify/webhook.js';
import { createUpnpClient } from '@xmcl/nat-api';
const allNotifiers = {
    webhook: WebhookNotifier,
    email: undefined,
};
export class Musician {
    constructor(config) {
        this.upnpClient = undefined;
        this.previousTCPMirrors = {};
        this.notifiers = [];
        this.config = config;
        if (this.config.services.some((function (v) {
            return v.upnp ?? this.config.config.upnp;
        }).bind(this))) {
            this.upnpClient = createUpnpClient();
            console.log('aaa', this.upnpClient);
            this.upnpClient.then((v) => console.log(v));
        }
        // if (config.config.conductor) {
        //   this.socket = new WebSocket(config.config.conductor);
        // }
        for (const notifierConfig of config.notify) {
            const RelevantNotifier = allNotifiers[notifierConfig.type];
            if (RelevantNotifier === undefined)
                continue;
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
            cron.schedule(service.cron_reload, this.shuffleService.bind(this, serviceIdx));
        }
    }
    async stopAll(serviceIdx) {
        if (serviceIdx in this.previousTCPMirrors) {
            const prevTCPMirrors = this.previousTCPMirrors[serviceIdx];
            for (let prevTCPMirror of prevTCPMirrors) {
                await prevTCPMirror.restrain();
                prevTCPMirrors.delete(prevTCPMirror);
            }
        }
    }
    async shuffleService(serviceIdx) {
        await this.stopAll(serviceIdx);
        const serviceConfig = this.config.services[serviceIdx];
        if (!serviceConfig.disabled) {
            const tcpMirrors = new Set();
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
                let attemptedServer = undefined;
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
                }
                catch (err) {
                    attemptedServer.restrain();
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
    async notifyAll(events) {
        await Promise.all(this.notifiers.map((notifier) => notifier.notify(events)));
    }
}
