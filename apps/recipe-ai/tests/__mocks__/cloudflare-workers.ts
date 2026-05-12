/**
 * Mock for cloudflare:workers module
 * Used in Vitest to replace the Cloudflare-specific imports
 */

export class WorkerEntrypoint<Env = unknown> {
  protected env!: Env;
}
