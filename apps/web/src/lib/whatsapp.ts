/**
 * WhatsApp click-to-chat utility helpers for Goverdhan Traders.
 * Generates direct wa.me URLs with normalized customer phone numbers
 * and prefilled professional messages.
 */

export interface PhoneNormalizationResult {
  normalized: string | null;
  error?: string;
}

/**
 * Normalizes customer phone numbers for WhatsApp click-to-chat links:
 * - Removes spaces, +, -, parentheses, and formatting dots.
 * - Strips leading 0 from 11-digit numbers (e.g., 09876543210 -> 9876543210 -> 919876543210).
 * - For Indian 10-digit mobile numbers (starting with 6, 7, 8, 9), prepends country code 91.
 * - If already starting with 91 followed by a 10-digit mobile number, preserves it.
 * - For other international numbers with digits only (8-15 digits), preserves the digits without inventing codes.
 * - Returns an error if the phone is missing or invalid.
 */
export function normalizeWhatsAppPhone(phone: string | null | undefined): PhoneNormalizationResult {
  if (!phone || typeof phone !== 'string') {
    return {
      normalized: null,
      error: 'Customer phone number is missing on file.',
    };
  }

  // Remove spaces, +, -, (), and dots
  let cleaned = phone.replace(/[\s+\-().]/g, '');

  if (!cleaned) {
    return {
      normalized: null,
      error: 'Customer phone number is empty.',
    };
  }

  // Strip single leading 0 from 11-digit numbers
  if (cleaned.length === 11 && cleaned.startsWith('0') && /^[6-9]/.test(cleaned.charAt(1))) {
    cleaned = cleaned.substring(1);
  }

  // Standard Indian 10-digit mobile number
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return { normalized: `91${cleaned}` };
  }

  // Indian number already prefixed with 91
  if (/^91[6-9]\d{9}$/.test(cleaned)) {
    return { normalized: cleaned };
  }

  // Valid international number (8 to 15 digits)
  if (/^\d{8,15}$/.test(cleaned)) {
    return { normalized: cleaned };
  }

  return {
    normalized: null,
    error: `Invalid phone format ("${phone}"). Please ensure the customer has a valid 10-digit mobile number.`,
  };
}

/**
 * Generates the standard, courteous message for the tile stock report:
 *
 * Example:
 * Namaste Rajesh ji,
 *
 * Please find the tile stock report for size 4*4.
 *
 * Total Designs: 3
 * Available Boxes: 86
 *
 * Regards,
 * Goverdhan Traders
 */
export function generateTileStockWhatsAppMessage(params: {
  customerName: string;
  size: string;
  totalDesigns: number;
  totalBoxes: number;
}): string {
  const rawName = (params.customerName || 'Customer').trim();
  const firstName = rawName.split(/\s+/)[0] || rawName;

  return [
    `Namaste ${firstName} ji,`,
    '',
    `Please find the tile stock report for size ${params.size}.`,
    '',
    `Total Designs: ${params.totalDesigns}`,
    `Available Boxes: ${params.totalBoxes}`,
    '',
    'Regards,',
    'Goverdhan Traders',
  ].join('\n');
}

/**
 * Builds the official WhatsApp click-to-chat URL:
 * https://wa.me/<phone>?text=<encoded-message>
 */
export function buildWhatsAppChatUrl(normalizedPhone: string, message: string): string {
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;
}
