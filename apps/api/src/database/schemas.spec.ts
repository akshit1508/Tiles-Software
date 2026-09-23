/**
 * Schema unit tests — Database Foundation
 *
 * These tests verify:
 *   1. Enum values are complete and correct
 *   2. Schema field types and constraints
 *   3. Counter order number format/increment logic
 *
 * Tests do NOT require a running MongoDB instance.
 */

import { Types } from 'mongoose';
import {
  UserRole,
  SalesUnit,
  OrderStatus,
  PaymentMethod,
  InventoryTransactionType,
} from '../common/enums';

import { UserSchema } from '../modules/users/schemas/user.schema';
import { ProductSchema } from '../modules/products/schemas/product.schema';
import { InventorySchema } from '../modules/inventory/schemas/inventory.schema';
import { InventoryTransactionSchema } from '../modules/inventory/schemas/inventory-transaction.schema';
import { CustomerSchema } from '../modules/customers/schemas/customer.schema';
import { OrderSchema } from '../modules/orders/schemas/order.schema';
import { CounterSchema } from '../modules/orders/schemas/counter.schema';
import { PaymentSchema } from '../modules/payments/schemas/payment.schema';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers for type-safe schema path inspection
// ─────────────────────────────────────────────────────────────────────────────
type PathWithOptions = { options: Record<string, unknown> };
type PathWithEnumValues = { enumValues: string[] };

function pathOptions(schema: { path(p: string): unknown }, field: string): Record<string, unknown> {
  return ((schema.path(field) as unknown) as PathWithOptions).options;
}

function pathEnumValues(schema: { path(p: string): unknown }, field: string): string[] {
  return ((schema.path(field) as unknown) as PathWithEnumValues).enumValues;
}

// ─────────────────────────────────────────────────────────────────────────────
// Enum correctness
// ─────────────────────────────────────────────────────────────────────────────

describe('Enums', () => {
  describe('UserRole', () => {
    it('contains exactly OWNER', () => {
      expect(Object.values(UserRole)).toEqual(['OWNER']);
    });
  });

  describe('SalesUnit', () => {
    it('contains BOX, PIECE, SQ_FT', () => {
      expect(Object.values(SalesUnit)).toEqual(['BOX', 'PIECE', 'SQ_FT']);
    });
  });

  describe('OrderStatus', () => {
    it('contains COMPLETED and CANCELLED only — no DRAFT', () => {
      const statuses = Object.values(OrderStatus);
      expect(statuses).toEqual(['COMPLETED', 'CANCELLED']);
      expect(statuses).not.toContain('DRAFT');
    });
  });

  describe('PaymentMethod', () => {
    it('contains CASH, UPI, BANK_TRANSFER, CHEQUE', () => {
      expect(Object.values(PaymentMethod)).toEqual([
        'CASH',
        'UPI',
        'BANK_TRANSFER',
        'CHEQUE',
      ]);
    });
  });

  describe('InventoryTransactionType', () => {
    it('contains all five types including SALE_REVERSAL', () => {
      expect(Object.values(InventoryTransactionType)).toEqual([
        'STOCK_IN',
        'SALE',
        'DAMAGE',
        'ADJUSTMENT',
        'SALE_REVERSAL',
      ]);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Schema structure
// ─────────────────────────────────────────────────────────────────────────────

describe('UserSchema', () => {
  it('creates the schema without errors', () => {
    expect(UserSchema).toBeDefined();
  });

  it('has email field with unique constraint', () => {
    const opts = pathOptions(UserSchema, 'email');
    expect(opts.unique).toBe(true);
  });

  it('has passwordHash with select:false to exclude from queries', () => {
    const opts = pathOptions(UserSchema, 'passwordHash');
    expect(opts.select).toBe(false);
  });

  it('has role enum restricted to OWNER', () => {
    const values = pathEnumValues(UserSchema, 'role');
    expect(values).toEqual([UserRole.OWNER]);
  });

  it('has timestamps enabled', () => {
    const schemaOpts = (UserSchema as unknown as { options: Record<string, unknown> }).options;
    expect(schemaOpts['timestamps']).toBe(true);
  });
});

describe('ProductSchema', () => {
  it('creates the schema without errors', () => {
    expect(ProductSchema).toBeDefined();
  });

  it('has piecesPerBox as a Number type', () => {
    expect(ProductSchema.path('piecesPerBox').instance).toBe('Number');
  });

  it('has areaPerBox, purchasePrice, sellingPrice as Decimal128', () => {
    for (const field of ['areaPerBox', 'purchasePrice', 'sellingPrice']) {
      expect(ProductSchema.path(field).instance).toBe('Decimal128');
    }
  });

  it('enforces areaPerBox > 0 via validator', () => {
    const opts = pathOptions(ProductSchema, 'areaPerBox');
    const validator = (opts.validate as { validator: (v: Types.Decimal128) => boolean }).validator;
    expect(validator(Types.Decimal128.fromString('10.5'))).toBe(true);
    expect(validator(Types.Decimal128.fromString('0.01'))).toBe(true);
    expect(validator(Types.Decimal128.fromString('0'))).toBe(false);
    expect(validator(Types.Decimal128.fromString('-1'))).toBe(false);
  });

  it('enforces purchasePrice >= 0 via validator', () => {
    const opts = pathOptions(ProductSchema, 'purchasePrice');
    const validator = (opts.validate as { validator: (v: Types.Decimal128) => boolean }).validator;
    expect(validator(Types.Decimal128.fromString('100'))).toBe(true);
    expect(validator(Types.Decimal128.fromString('0'))).toBe(true);
    expect(validator(Types.Decimal128.fromString('-5'))).toBe(false);
  });

  it('enforces sellingPrice >= 0 via validator', () => {
    const opts = pathOptions(ProductSchema, 'sellingPrice');
    const validator = (opts.validate as { validator: (v: Types.Decimal128) => boolean }).validator;
    expect(validator(Types.Decimal128.fromString('150'))).toBe(true);
    expect(validator(Types.Decimal128.fromString('0'))).toBe(true);
    expect(validator(Types.Decimal128.fromString('-10'))).toBe(false);
  });

  it('has isActive as Boolean', () => {
    expect(ProductSchema.path('isActive').instance).toBe('Boolean');
  });

  it('has minimumStockPieces as Number', () => {
    expect(ProductSchema.path('minimumStockPieces').instance).toBe('Number');
  });

  it('has minimumStockBoxes as Number', () => {
    expect(ProductSchema.path('minimumStockBoxes').instance).toBe('Number');
  });
});

describe('InventorySchema', () => {
  it('creates the schema without errors', () => {
    expect(InventorySchema).toBeDefined();
  });

  it('has totalPieces as a Number type', () => {
    expect(InventorySchema.path('totalPieces').instance).toBe('Number');
  });

  it('has productId as ObjectId with unique constraint', () => {
    const opts = pathOptions(InventorySchema, 'productId');
    expect(opts.unique).toBe(true);
  });

  it('does NOT have fullBoxes, loosePieces, or totalSqFt fields (these are derived)', () => {
    expect(InventorySchema.path('fullBoxes')).toBeUndefined();
    expect(InventorySchema.path('loosePieces')).toBeUndefined();
    expect(InventorySchema.path('totalSqFt')).toBeUndefined();
  });
});

describe('InventoryTransactionSchema', () => {
  it('creates the schema without errors', () => {
    expect(InventoryTransactionSchema).toBeDefined();
  });

  it('has transactionType enum with all five values', () => {
    const values = pathEnumValues(InventoryTransactionSchema, 'transactionType');
    expect(values).toEqual(Object.values(InventoryTransactionType));
  });

  it('has physicalPieces as Number', () => {
    expect(InventoryTransactionSchema.path('physicalPieces').instance).toBe('Number');
  });

  it('has salesUnit enum with BOX, PIECE, SQ_FT', () => {
    const values = pathEnumValues(InventoryTransactionSchema, 'salesUnit');
    expect(values).toEqual(Object.values(SalesUnit));
  });

  it('has optional orderId as ObjectId', () => {
    const path = InventoryTransactionSchema.path('orderId');
    expect(path).toBeDefined();
    expect(path.instance).toBe('ObjectId');
  });

  it('has salesQuantity as Decimal128', () => {
    expect(InventoryTransactionSchema.path('salesQuantity').instance).toBe('Decimal128');
  });
});

describe('CustomerSchema', () => {
  it('creates the schema without errors', () => {
    expect(CustomerSchema).toBeDefined();
  });

  it('has name as a required String', () => {
    const opts = pathOptions(CustomerSchema, 'name');
    expect(opts.required).toBe(true);
  });

  it('has phone as a required String', () => {
    const opts = pathOptions(CustomerSchema, 'phone');
    expect(opts.required).toBe(true);
  });

  it('has isActive as Boolean', () => {
    expect(CustomerSchema.path('isActive').instance).toBe('Boolean');
  });

  it('does NOT have outstandingAmount field (it is derived)', () => {
    expect(CustomerSchema.path('outstandingAmount')).toBeUndefined();
  });
});

describe('OrderSchema', () => {
  it('creates the schema without errors', () => {
    expect(OrderSchema).toBeDefined();
  });

  it('has orderNumber as String with unique constraint', () => {
    const opts = pathOptions(OrderSchema, 'orderNumber');
    expect(opts.unique).toBe(true);
  });

  it('orderNumber regex matches GT-YYYYMMDD-XXXX format', () => {
    const opts = pathOptions(OrderSchema, 'orderNumber');
    const regex = opts['match'] as RegExp;
    expect(regex.test('GT-20240115-0001')).toBe(true);
    expect(regex.test('GT-20240115-9999')).toBe(true);
    expect(regex.test('GT-2024015-0001')).toBe(false);
    expect(regex.test('DRAFT-001')).toBe(false);
  });

  it('has status enum restricted to COMPLETED and CANCELLED (no DRAFT)', () => {
    const values = pathEnumValues(OrderSchema, 'status');
    expect(values).toEqual([OrderStatus.COMPLETED, OrderStatus.CANCELLED]);
    expect(values).not.toContain('DRAFT');
  });

  it('has subtotal and totalAmount as Decimal128', () => {
    for (const field of ['subtotal', 'totalAmount']) {
      expect(OrderSchema.path(field).instance).toBe('Decimal128');
    }
  });

  it('has embedded items array', () => {
    const path = OrderSchema.path('items');
    expect(path).toBeDefined();
  });

  it('has createdBy as ObjectId', () => {
    expect(OrderSchema.path('createdBy').instance).toBe('ObjectId');
  });
});

describe('CounterSchema', () => {
  it('creates the schema without errors', () => {
    expect(CounterSchema).toBeDefined();
  });

  it('has key as unique String', () => {
    const opts = pathOptions(CounterSchema, 'key');
    expect(opts.unique).toBe(true);
  });

  it('has seq as Number', () => {
    expect(CounterSchema.path('seq').instance).toBe('Number');
  });

  it('enforces seq as a non-negative integer via validator', () => {
    const opts = pathOptions(CounterSchema, 'seq');
    expect(opts.min).toBe(0);
    const validator = (opts.validate as { validator: (v: number) => boolean }).validator;
    expect(validator(0)).toBe(true);
    expect(validator(1)).toBe(true);
    expect(validator(100)).toBe(true);
    expect(validator(1.5)).toBe(false);
  });

  it('does NOT have timestamps', () => {
    const opts = (CounterSchema as unknown as { options: Record<string, unknown> }).options;
    expect(opts['timestamps']).toBe(false);
  });
});

describe('PaymentSchema', () => {
  it('creates the schema without errors', () => {
    expect(PaymentSchema).toBeDefined();
  });

  it('has orderId as required ObjectId', () => {
    const opts = pathOptions(PaymentSchema, 'orderId');
    expect(opts.required).toBe(true);
  });

  it('has customerId as required ObjectId', () => {
    const opts = pathOptions(PaymentSchema, 'customerId');
    expect(opts.required).toBe(true);
  });

  it('has amount as Decimal128', () => {
    expect(PaymentSchema.path('amount').instance).toBe('Decimal128');
  });

  it('enforces amount > 0 via validator', () => {
    const opts = pathOptions(PaymentSchema, 'amount');
    const validator = (opts.validate as { validator: (v: Types.Decimal128) => boolean }).validator;
    expect(validator(Types.Decimal128.fromString('500'))).toBe(true);
    expect(validator(Types.Decimal128.fromString('0.01'))).toBe(true);
    expect(validator(Types.Decimal128.fromString('0'))).toBe(false);
    expect(validator(Types.Decimal128.fromString('-50'))).toBe(false);
  });

  it('has paymentMethod enum with all four methods', () => {
    const values = pathEnumValues(PaymentSchema, 'paymentMethod');
    expect(values).toEqual(Object.values(PaymentMethod));
  });

  it('has paymentDate as Date', () => {
    expect(PaymentSchema.path('paymentDate').instance).toBe('Date');
  });

  it('has createdBy as ObjectId', () => {
    expect(PaymentSchema.path('createdBy').instance).toBe('ObjectId');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Counter — atomic order number format logic
// ─────────────────────────────────────────────────────────────────────────────

describe('Counter — atomic increment logic', () => {
  /**
   * Verifies the GT-YYYYMMDD-XXXX assembly logic that the OrdersService
   * will use. No MongoDB connection required.
   */
  function buildOrderNumber(dateKey: string, seq: number): string {
    return `${dateKey}-${seq.toString().padStart(4, '0')}`;
  }

  it('formats GT-YYYYMMDD-XXXX correctly for seq=1', () => {
    expect(buildOrderNumber('GT-20240115', 1)).toBe('GT-20240115-0001');
  });

  it('formats GT-YYYYMMDD-XXXX correctly for seq=9999', () => {
    expect(buildOrderNumber('GT-20240115', 9999)).toBe('GT-20240115-9999');
  });

  it('produces unique order numbers for different seq values', () => {
    const numbers = new Set<string>();
    for (let i = 1; i <= 100; i++) {
      numbers.add(buildOrderNumber('GT-20240115', i));
    }
    expect(numbers.size).toBe(100);
  });

  it('matches GT-YYYYMMDD-XXXX regex pattern', () => {
    const regex = /^GT-\d{8}-\d{4}$/;
    for (let i = 1; i <= 10; i++) {
      expect(regex.test(buildOrderNumber('GT-20240115', i))).toBe(true);
    }
  });

  it('simulates sequential counter increments without collision', () => {
    const store: Record<string, number> = {};

    function atomicIncrement(key: string): number {
      store[key] = (store[key] ?? 0) + 1;
      return store[key];
    }

    const results: string[] = [];
    for (let i = 0; i < 5; i++) {
      const seq = atomicIncrement('GT-20241225');
      results.push(buildOrderNumber('GT-20241225', seq));
    }

    expect(results).toEqual([
      'GT-20241225-0001',
      'GT-20241225-0002',
      'GT-20241225-0003',
      'GT-20241225-0004',
      'GT-20241225-0005',
    ]);
  });
});
