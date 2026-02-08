import type { Request, Response, NextFunction } from "express";
import {
  PaymentEnvelope,
  PaymentProof,
  SwarmError,
  X402_HEADERS,
  X402_VERSION,
  parsePaymentHeader,
} from "@shared/x402";
import crypto from "crypto";

export interface X402GateConfig {
  price: string;
  address: string;
  resource: string;
  description?: string;
  ttl?: number;
  receiptBaseUrl?: string;
}

// send a 402 response with the proper x402 headers
export function paymentRequired(res: Response, envelope: PaymentEnvelope): void {
  res.status(402);
  res.setHeader(X402_HEADERS.PRICE, envelope.price);
  res.setHeader(X402_HEADERS.PAYMENT_ADDRESS, envelope.address);
  res.setHeader(X402_HEADERS.PAYMENT_METHODS, envelope.methods.join(", "));
  res.setHeader(X402_HEADERS.TTL, String(envelope.ttl));
  res.json({
    error: "PAYMENT_REQUIRED",
    status: 402,
    envelope,
  });
}

// validate a payment proof against the envelope requirements
export function verifyPayment(
  paymentHeader: string,
  envelope: PaymentEnvelope,
  issuedAt?: number
): { valid: boolean; proof?: PaymentProof; error?: string } {
  const proof = parsePaymentHeader(paymentHeader);

  if (!proof) {
    return { valid: false, error: "Malformed payment header" };
  }

  if (proof.version !== X402_VERSION) {
    return { valid: false, error: `Unsupported version: ${proof.version}` };
  }

  // decode the payload and check fields
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(Buffer.from(proof.payload, "base64").toString("utf-8"));
  } catch {
    return { valid: false, error: "Invalid payload encoding" };
  }

  if (String(payload.resource) !== envelope.resource) {
    return { valid: false, error: "Resource mismatch" };
  }

  const amount = Number(payload.amount || 0);
  if (amount < Number(envelope.price)) {
    return { valid: false, error: "Insufficient payment amount" };
  }

  // check TTL expiry
  const timestamp = Number(payload.timestamp || issuedAt || 0);
  if (timestamp > 0) {
    const elapsed = (Date.now() - timestamp) / 1000;
    if (elapsed > envelope.ttl) {
      return { valid: false, error: "Payment expired (TTL exceeded)" };
    }
  }

  // signature verification would go here in production — for now we
  // accept any well-formed proof with valid fields
  return { valid: true, proof };
}

// factory middleware that gates a route behind x402 payment
export function x402Gate(config: X402GateConfig) {
  const envelope: PaymentEnvelope = {
    price: config.price,
    methods: ["base-sepolia"],
    address: config.address,
    ttl: config.ttl || 300,
    resource: config.resource,
    description: config.description || `Access to ${config.resource}`,
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const paymentHeader = req.headers[X402_HEADERS.PAYMENT.toLowerCase()] as string | undefined;

    if (!paymentHeader) {
      return paymentRequired(res, envelope);
    }

    const result = verifyPayment(paymentHeader, envelope);

    if (!result.valid) {
      throw new SwarmError(400, result.error);
    }

    // generate a receipt
    const receiptId = crypto.randomUUID();
    const receiptBase = config.receiptBaseUrl || `/api/x402/receipts`;
    res.setHeader(X402_HEADERS.RECEIPT_URL, `${receiptBase}/${receiptId}`);

    // attach payment info to request for downstream use
    (req as any).x402 = {
      proof: result.proof,
      receiptId,
      envelope,
    };

    next();
  };
}

// error handler for SwarmError instances
export function swarmErrorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof SwarmError) {
    return res.status(err.statusCode).json(err.toJSON());
  }
  next(err);
}

// extract swarm metadata from request headers
export function getSwarmHeaders(req: Request) {
  return {
    swarmId: req.headers[X402_HEADERS.SWARM_ID.toLowerCase()] as string | undefined,
    moltStage: req.headers[X402_HEADERS.MOLT_STAGE.toLowerCase()] as string | undefined,
    paymentMethod: req.headers[X402_HEADERS.PAYMENT_METHOD.toLowerCase()] as string | undefined,
  };
}
