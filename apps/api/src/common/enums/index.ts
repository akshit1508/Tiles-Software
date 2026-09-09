/**
 * Shared enumerations used across schemas.
 * Defined here to avoid circular imports and enforce single source of truth.
 */

/** The role assigned to the business owner account */
export enum UserRole {
  OWNER = 'OWNER',
}

/** Units in which a product can be sold */
export enum SalesUnit {
  BOX = 'BOX',
  PIECE = 'PIECE',
  SQ_FT = 'SQ_FT',
}

/** All valid V1 order statuses — NO DRAFT state exists */
export enum OrderStatus {
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/** Payment method types supported in V1 */
export enum PaymentMethod {
  CASH = 'CASH',
  UPI = 'UPI',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CHEQUE = 'CHEQUE',
}

/** Types of inventory movements */
export enum InventoryTransactionType {
  STOCK_IN = 'STOCK_IN',
  SALE = 'SALE',
  DAMAGE = 'DAMAGE',
  ADJUSTMENT = 'ADJUSTMENT',
  SALE_REVERSAL = 'SALE_REVERSAL',
}
