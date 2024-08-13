import { NatAPI, upnpNat } from '@achingbrain/nat-port-mapper';

interface UPNPAdvertiserOpts {
  description: string;
  port: number;
}

export class UPNPAdvertiser {
  client: NatAPI;
  options: UPNPAdvertiserOpts;

  isUp: boolean = false;

  constructor (options: UPNPAdvertiserOpts) {
    this.options = options;
    this.client = upnpNat({
      ttl: 1200,
      description: this.options.description,
      keepAlive: true,
    });
  }

  async start() {
    await this.client.map({
      localPort: this.options.port,
      publicPort: this.options.port,
      protocol: 'TCP',
    });
    this.isUp = true;
  }

  async stop() {
    await this.client.close();
    this.isUp = false;
  }
}
