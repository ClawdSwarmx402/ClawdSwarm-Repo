export const X402_VERSION = "0.1.0";

export const SUPPORTED_METHODS = ["base-sepolia", "base-mainnet", "solana"] as const;
export type PaymentMethod = (typeof SUPPORTED_METHODS)[number];

export interface PaymentRequirement {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
}

export interface PaymentProof {
  version: string;
  signature: string;
  payload: string; // base64-encoded
}

export interface PaymentEnvelope {
  price: string;
  methods: string[];
  address: string;
  ttl: number;
  resource: string;
  description: string;
}

// themed error codes matching the swarm vernacular
const ERROR_CODES: Record<number, string> = {
  400: "CRACKED_SHELL",
  401: "NO_EXOSKELETON",
  402: "PAYMENT_REQUIRED",
  403: "SHELL_REJECTED",
  404: "EMPTY_TIDE_POOL",
  409: "SHELL_CONFLICT",
  429: "CLAW_CRAMP",
  500: "SHELL_SHATTER",
  503: "MOLTING_IN_PROGRESS",
};

export class SwarmError extends Error {
  public statusCode: number;
  public code: string;

  constructor(statusCode: number, detail?: string) {
    const code = ERROR_CODES[statusCode] || "SHELL_SHATTER";
    super(detail || code);
    this.statusCode = statusCode;
    this.code = code;
    this.name = "SwarmError";
  }

  toJSON() {
    return {
      error: this.code,
      status: this.statusCode,
      message: this.message,
    };
  }
}

export function getErrorCode(status: number): string {
  return ERROR_CODES[status] || "SHELL_SHATTER";
}

export function createPaymentEnvelope(
  price: string,
  address: string,
  resource: string,
  description: string,
  ttl = 300,
  methods: string[] = [...SUPPORTED_METHODS]
): PaymentEnvelope {
  return { price, methods, address, ttl, resource, description };
}

export function parsePaymentHeader(header: string): PaymentProof | null {
  try {
    const decoded = Buffer.from(header, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded);

    if (!parsed.version || !parsed.signature || !parsed.payload) {
      return null;
    }

    return {
      version: parsed.version,
      signature: parsed.signature,
      payload: parsed.payload,
    };
  } catch {
    return null;
  }
}

// x402 header names used in requests and responses
export const X402_HEADERS = {
  // request headers
  PAYMENT: "X-Payment",
  PAYMENT_METHOD: "X-Payment-Method",
  SWARM_ID: "X-Swarm-ID",
  MOLT_STAGE: "X-Molt-Stage",
  // response headers
  PRICE: "X-Price",
  PAYMENT_ADDRESS: "X-Payment-Address",
  PAYMENT_METHODS: "X-Payment-Methods",
  TTL: "X-TTL",
  RECEIPT_URL: "X-Receipt-URL",
} as const;

// quick helpers for encoding payment proofs
export function encodePaymentHeader(proof: PaymentProof): string {
  return Buffer.from(JSON.stringify(proof)).toString("base64");
}

export function isValidMethod(method: string): boolean {
  return (SUPPORTED_METHODS as readonly string[]).includes(method);
}
