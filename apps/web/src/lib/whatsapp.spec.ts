import {
  normalizeWhatsAppPhone,
  generateTileStockWhatsAppMessage,
  buildWhatsAppChatUrl,
} from './whatsapp';

describe('WhatsApp Click-to-Chat Utilities', () => {
  describe('normalizeWhatsAppPhone', () => {
    it('1. Correctly formats 10-digit Indian numbers with 91 prefix', () => {
      expect(normalizeWhatsAppPhone('9876543210')).toEqual({
        normalized: '919876543210',
      });
      expect(normalizeWhatsAppPhone('7000123456')).toEqual({
        normalized: '917000123456',
      });
      expect(normalizeWhatsAppPhone('8888899999')).toEqual({
        normalized: '918888899999',
      });
      expect(normalizeWhatsAppPhone('6123456789')).toEqual({
        normalized: '916123456789',
      });
    });

    it('2. Removes spaces, +, -, and parentheses from formatted numbers', () => {
      expect(normalizeWhatsAppPhone('+91 98765 43210')).toEqual({
        normalized: '919876543210',
      });
      expect(normalizeWhatsAppPhone('+91-9876543210')).toEqual({
        normalized: '919876543210',
      });
      expect(normalizeWhatsAppPhone('(9876) 543-210')).toEqual({
        normalized: '919876543210',
      });
      expect(normalizeWhatsAppPhone('+91 (9876) 543 210')).toEqual({
        normalized: '919876543210',
      });
    });

    it('3. Strips leading 0 from 11-digit numbers and prepends 91', () => {
      expect(normalizeWhatsAppPhone('09876543210')).toEqual({
        normalized: '919876543210',
      });
      expect(normalizeWhatsAppPhone('07000123456')).toEqual({
        normalized: '917000123456',
      });
    });

    it('4. Preserves 12-digit Indian numbers that already start with 91', () => {
      expect(normalizeWhatsAppPhone('919876543210')).toEqual({
        normalized: '919876543210',
      });
    });

    it('5. Preserves valid international numbers (8-15 digits) without inventing country codes', () => {
      expect(normalizeWhatsAppPhone('14155552671')).toEqual({
        normalized: '14155552671',
      });
      expect(normalizeWhatsAppPhone('447911123456')).toEqual({
        normalized: '447911123456',
      });
    });

    it('6. Returns error when phone is empty, null, or undefined', () => {
      expect(normalizeWhatsAppPhone('')).toEqual({
        normalized: null,
        error: expect.stringMatching(/Customer phone number is (missing|empty)/),
      });
      expect(normalizeWhatsAppPhone(null as any)).toEqual({
        normalized: null,
        error: expect.stringMatching(/Customer phone number is missing/),
      });
      expect(normalizeWhatsAppPhone(undefined as any)).toEqual({
        normalized: null,
        error: expect.stringMatching(/Customer phone number is missing/),
      });
    });

    it('7. Returns error when phone number contains invalid characters or insufficient digits', () => {
      expect(normalizeWhatsAppPhone('12345')).toEqual({
        normalized: null,
        error: expect.stringMatching(/Invalid phone format/),
      });
      expect(normalizeWhatsAppPhone('invalid-phone')).toEqual({
        normalized: null,
        error: expect.stringMatching(/Invalid phone format/),
      });
    });
  });

  describe('generateTileStockWhatsAppMessage', () => {
    it('8. Generates professional greeting with first name and "ji"', () => {
      const msg = generateTileStockWhatsAppMessage({
        customerName: 'Rajesh Sharma',
        size: '4*4',
        totalDesigns: 3,
        totalBoxes: 86,
      });

      expect(msg).toContain('Namaste Rajesh ji,');
      expect(msg).toContain('Please find the tile stock report for size 4*4.');
      expect(msg).toContain('Total Designs: 3');
      expect(msg).toContain('Available Boxes: 86');
      expect(msg).toContain('Regards,\nGoverdhan Traders');
    });

    it('9. Handles single-word customer names cleanly', () => {
      const msg = generateTileStockWhatsAppMessage({
        customerName: 'Sunil',
        size: '2*2',
        totalDesigns: 1,
        totalBoxes: 25,
      });

      expect(msg).toContain('Namaste Sunil ji,');
      expect(msg).toContain('Please find the tile stock report for size 2*2.');
      expect(msg).toContain('Total Designs: 1');
      expect(msg).toContain('Available Boxes: 25');
    });
  });

  describe('buildWhatsAppChatUrl', () => {
    it('10. Safely URL-encodes special characters and newlines in wa.me URL', () => {
      const message = 'Namaste Rajesh ji,\n\nTest message with & and %?';
      const url = buildWhatsAppChatUrl('919876543210', message);

      expect(url).toBe(
        `https://wa.me/919876543210?text=${encodeURIComponent(message)}`,
      );
      expect(url).toContain('https://wa.me/919876543210?text=');
      expect(url).not.toContain('\n');
      expect(url).toContain('%0A');
    });
  });
});
