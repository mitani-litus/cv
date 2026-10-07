import type { Server } from 'node:http';

export interface GatewayResult {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
}

export function createGateway(invoke: (event: object) => Promise<GatewayResult>): Server;
export function invokeViaEmulator(invokeUrl: string): (event: object) => Promise<GatewayResult>;
