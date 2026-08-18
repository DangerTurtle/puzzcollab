import { createServer, type Server } from "node:http";
import next from "next";
import { migrate } from "../lib/db/migrations";
import { publishLexicons } from "../lib/lexicon-publisher";
import { SyncService } from "../lib/sync/service";
import type { RuntimeProfile } from "../lib/runtime-profile";

class WebService {
  readonly #development: boolean;
  readonly #hostname: string;
  readonly #port: number;
  #next: ReturnType<typeof next> | undefined;
  #server: Server | undefined;

  constructor(profile: RuntimeProfile) {
    this.#development = profile.development;
    this.#hostname = profile.config.hostname;
    this.#port = profile.config.port;
  }

  async start(): Promise<void> {
    const application = next({
      dev: this.#development,
      hostname: this.#hostname,
      port: this.#port,
      ...(this.#development ? { webpack: true } : {}),
    });
    this.#next = application;
    await application.prepare();
    const handler = application.getRequestHandler();
    const server = createServer((request, response) => {
      void handler(request, response).catch((error) => {
        console.error("Next.js request failed", error);
        if (!response.headersSent) response.writeHead(500);
        if (!response.writableEnded) response.end("Internal server error");
      });
    });
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => reject(error);
      server.once("error", onError);
      server.listen(this.#port, this.#hostname, () => {
        server.off("error", onError);
        resolve();
      });
    });
    this.#server = server;
    console.log(
      `Bulletin web service http://${this.#hostname}:${this.#port}`,
    );
  }

  async close(): Promise<void> {
    if (this.#server) {
      const server = this.#server;
      this.#server = undefined;
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      });
    }
    if (this.#next) {
      const application = this.#next;
      this.#next = undefined;
      await application.close();
    }
  }
}

export class BulletinApplication {
  readonly #profile: RuntimeProfile;
  readonly #sync: SyncService;
  readonly #web: WebService;
  #closeTask: Promise<void> | undefined;

  constructor(profile: RuntimeProfile) {
    this.#profile = profile;
    this.#sync = new SyncService({
      internalUrl: profile.config.syncInternalUrl,
      publicUrl: profile.config.syncPublicUrl,
      serviceDid: profile.config.syncServiceDid,
      serviceId: profile.config.syncService,
      managingAppService: profile.config.managingAppService,
      hostname: profile.config.syncHostname,
      pollInterval: profile.config.syncPollInterval,
    });
    this.#web = new WebService(profile);
  }

  async start(): Promise<void> {
    await migrate();
    console.log("database is ready");
    if (this.#profile.publishLexicons) await publishLexicons();
    try {
      await this.#sync.start();
      await this.#web.start();
    } catch (error) {
      await this.close().catch(() => undefined);
      throw error;
    }
    console.log(`Bulletin profile ${this.#profile.name}`);
  }

  close(): Promise<void> {
    if (this.#closeTask) return this.#closeTask;
    this.#closeTask = this.#close();
    return this.#closeTask;
  }

  async #close(): Promise<void> {
    await this.#sync.close();
    await this.#web.close();
  }
}
