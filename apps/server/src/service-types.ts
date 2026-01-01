/**
 * Service binding interfaces for the server.
 * These are minimal interfaces that don't depend on Cloudflare types,
 * allowing them to be imported by packages that don't have Cloudflare types.
 */

// Durable Object namespace interface for USER_FEED
export interface DurableObjectId {
  toString(): string;
}

export interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

export interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}
