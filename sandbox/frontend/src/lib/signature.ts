import CryptoJS from 'crypto-js';

export function generateSignature(payload: any, secret: string): string {
  const body = JSON.stringify(payload);
  const signature = CryptoJS.HmacSHA256(body, secret).toString(CryptoJS.enc.Hex);
  return signature;
}

export function verifySignature(payload: any, signature: string, secret: string): boolean {
  const expectedSignature = generateSignature(payload, secret);
  return signature === expectedSignature;
}
