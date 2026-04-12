import crypto from "crypto";

export function generateOTP(length: number = 6): string {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += digits[crypto.randomInt(0, digits.length)];
  }
  return otp;
}

export function generateReferralCode(): string {
  return "HB-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

export function generatePayReferenceCode(plateNumber: string): string {
  return `HB-${plateNumber.replace(/\s/g, "").toUpperCase()}`;
}

export function generateTrackingNumber(): string {
  const prefix = "HBP";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export function generateConfirmationCode(): string {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export function parsePagination(query: any): PaginationParams {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 25));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function paginationResponse(total: number, params: PaginationParams) {
  return {
    page: params.page,
    limit: params.limit,
    total,
    pages: Math.ceil(total / params.limit),
  };
}
