import { createUpnpClient, UpnpClient } from '@immjs/nat-api';

interface UPNPAdvertiserOpts {
  description: string;
  port: number;
}

export class UPNPAdvertiser {
  client: Promise<UpnpClient>;
  options: UPNPAdvertiserOpts;

  isUp: boolean = false;
  keepItAliveInterval: NodeJS.Timeout | undefined;

  constructor (options: UPNPAdvertiserOpts, client: Promise<UpnpClient>) {
    this.options = options;
    console.log(client);
    this.client = client;
  }

  async start() {
    await this.addMap();
    this.keepItAliveInterval = setInterval(this.addMap.bind(this), 30 * 1000);
  }

  async addMap() {
    const client = await this.client;
    if (this.isUp) await client.unmap({ public: this.options.port });
    await client.map({
      public: this.options.port,
      private: this.options.port,
      ttl: 60,
      description: this.options.description,
      protocol: 'tcp',
    });
    this.isUp = true;
  }

  async stop() {
    const client = await this.client;
    await client.unmap({ public: this.options.port });
    this.isUp = false;
    if (this.keepItAliveInterval) clearInterval(this.keepItAliveInterval);
    this.keepItAliveInterval = undefined;
  }
}
