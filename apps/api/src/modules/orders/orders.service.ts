import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types, ClientSession } from 'mongoose';
import { Order, OrderDocument } from './schemas/order.schema';
import { Counter, CounterDocument } from './schemas/counter.schema';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Inventory, InventoryDocument } from '../inventory/schemas/inventory.schema';
import {
  InventoryTransaction,
  InventoryTransactionDocument,
} from '../inventory/schemas/inventory-transaction.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { CreateOrderDto, ListOrdersDto } from './dto';
import {
  OrderDetailResponse,
  OrderItemResponse,
  PaginatedOrdersResponse,
} from './interfaces';
import {
  InventoryTransactionType,
  OrderStatus,
  SalesUnit,
} from '../../common/enums';

/**
 * Converts Decimal128, string, or number to integer paise (cents).
 * Eliminates binary floating-point drift in monetary calculations.
 */
function toPaise(val: unknown): number {
  if (val == null) return 0;
  const str =
    typeof val === 'object' && 'toString' in val
      ? (val as { toString(): string }).toString()
      : String(val);
  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.round(num * 100);
}

/**
 * Converts integer paise back to rupees rounded to 2 decimal places.
 */
function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}

interface PreparedOrderItem {
  productId: Types.ObjectId;
  productNameSnapshot: string;
  brandSnapshot: string;
  salesQuantity: number;
  salesUnit: SalesUnit;
  physicalPieces: number;
  unitPrice: number;
  unitPricePaise: number;
  lineTotal: number;
  lineTotalPaise: number;
  piecesPerBox: number;
  areaPerBox: number;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Counter.name)
    private readonly counterModel: Model<CounterDocument>,
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
    @InjectModel(InventoryTransaction.name)
    private readonly transactionModel: Model<InventoryTransactionDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. POST /orders (Create Order directly in COMPLETED status)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Atomically validates stock, calculates authoritative totals, decrements stock,
   * records SALE inventory transactions, generates order number via Counter,
   * and creates the Order document in COMPLETED status.
   */
  async create(
    dto: CreateOrderDto,
    userId: string,
  ): Promise<OrderDetailResponse> {
    const customerObjectId = this.validateObjectId(dto.customerId, 'customerId');
    const userObjectId = this.validateObjectId(userId, 'userId');

    // 1. Validate Customer
    const customer = await this.customerModel.findById(customerObjectId).exec();
    if (!customer) {
      throw new NotFoundException(
        `Customer with id ${dto.customerId} not found`,
      );
    }
    if (!customer.isActive) {
      throw new BadRequestException(
        'Cannot create an order for a deactivated customer',
      );
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('An order must contain at least one item');
    }

    // 2. Validate and prepare each order item
    const preparedItems: PreparedOrderItem[] = [];
    const productIds = dto.items.map((item) =>
      this.validateObjectId(item.productId, 'productId'),
    );

    const products = await this.productModel
      .find({ _id: { $in: productIds } })
      .exec();
    const productMap = new Map<string, ProductDocument>();
    for (const p of products) {
      productMap.set(p._id.toString(), p);
    }

    // Fetch existing inventories for all products in this order
    const inventories = await this.inventoryModel
      .find({ productId: { $in: productIds } })
      .exec();
    const inventoryMap = new Map<string, InventoryDocument>();
    for (const inv of inventories) {
      inventoryMap.set(inv.productId.toString(), inv);
    }

    // Track total physical pieces and box requirements per product across all line items
    const requiredPiecesByProduct = new Map<string, number>();
    const requiredBoxesByProduct = new Map<string, number>();

    for (const item of dto.items) {
      const prodIdStr = item.productId;
      const product = productMap.get(prodIdStr);
      if (!product) {
        throw new NotFoundException(
          `Product with id ${item.productId} not found`,
        );
      }
      if (!product.isActive) {
        throw new BadRequestException(
          `Product "${product.productName}" is deactivated and cannot be sold`,
        );
      }

      const piecesPerBox = product.piecesPerBox;
      const areaPerBox = parseFloat(product.areaPerBox.toString());
      let physicalPieces: number;

      // Unit and piece validation according to salesUnit
      switch (item.salesUnit) {
        case SalesUnit.BOX: {
          if (!Number.isInteger(item.salesQuantity) || item.salesQuantity <= 0) {
            throw new BadRequestException(
              `salesQuantity for BOX sales must be a positive integer, received: ${item.salesQuantity}`,
            );
          }
          physicalPieces = item.salesQuantity * piecesPerBox;
          const currentBoxes = requiredBoxesByProduct.get(prodIdStr) ?? 0;
          requiredBoxesByProduct.set(prodIdStr, currentBoxes + item.salesQuantity);
          break;
        }

        case SalesUnit.PIECE: {
          if (!Number.isInteger(item.salesQuantity) || item.salesQuantity <= 0) {
            throw new BadRequestException(
              `salesQuantity for PIECE sales must be a positive integer, received: ${item.salesQuantity}`,
            );
          }
          physicalPieces = item.salesQuantity;
          break;
        }

        case SalesUnit.SQ_FT: {
          if (item.salesQuantity <= 0) {
            throw new BadRequestException(
              `salesQuantity for SQ_FT sales must be positive, received: ${item.salesQuantity}`,
            );
          }
          const areaPerPiece = areaPerBox / piecesPerBox;
          const pieces = item.salesQuantity / areaPerPiece;
          const roundedPieces = Math.round(pieces);

          // Validation tolerance for tiles (cannot cut tiles)
          if (Math.abs(pieces - roundedPieces) > 1e-4) {
            throw new BadRequestException(
              `Requested ${item.salesQuantity} sq.ft does not correspond to a whole number of tiles. Each tile is ${areaPerPiece} sq.ft.`,
            );
          }
          physicalPieces = roundedPieces;
          break;
        }

        default:
          throw new BadRequestException(`Unsupported sales unit: ${item.salesUnit}`);
      }

      // Authoritative Unit Price:
      // If client supplied unitPrice, OWNER authorized custom price is used;
      // otherwise, backend derives it authoritatively from Product.sellingPrice.
      let unitPrice: number;
      const sellingPriceBox = parseFloat(product.sellingPrice.toString());

      if (item.unitPrice !== undefined && item.unitPrice !== null) {
        if (item.unitPrice < 0) {
          throw new BadRequestException('unitPrice cannot be negative');
        }
        unitPrice = paiseToRupees(Math.round(item.unitPrice * 100));
      } else {
        // Authoritative derivation from product.sellingPrice
        switch (item.salesUnit) {
          case SalesUnit.BOX:
            unitPrice = paiseToRupees(Math.round(sellingPriceBox * 100));
            break;
          case SalesUnit.PIECE:
            unitPrice = paiseToRupees(
              Math.round((sellingPriceBox / piecesPerBox) * 100),
            );
            break;
          case SalesUnit.SQ_FT:
            unitPrice = paiseToRupees(
              Math.round((sellingPriceBox / areaPerBox) * 100),
            );
            break;
        }
      }

      const unitPricePaise = Math.round(unitPrice * 100);
      const lineTotalPaise = Math.round(item.salesQuantity * unitPricePaise);
      const lineTotal = paiseToRupees(lineTotalPaise);

      preparedItems.push({
        productId: product._id,
        productNameSnapshot: product.productName,
        brandSnapshot: product.brand,
        salesQuantity: item.salesQuantity,
        salesUnit: item.salesUnit,
        physicalPieces,
        unitPrice,
        unitPricePaise,
        lineTotal,
        lineTotalPaise,
        piecesPerBox,
        areaPerBox,
      });

      const currentTotalPieces = requiredPiecesByProduct.get(prodIdStr) ?? 0;
      requiredPiecesByProduct.set(prodIdStr, currentTotalPieces + physicalPieces);
    }

    // 3. Stock Availability Pre-check
    for (const [prodIdStr, reqPieces] of requiredPiecesByProduct.entries()) {
      const inv = inventoryMap.get(prodIdStr);
      const product = productMap.get(prodIdStr)!;
      const availablePieces = inv ? inv.totalPieces : 0;

      if (availablePieces < reqPieces) {
        throw new BadRequestException(
          `Insufficient stock for product "${product.productName}". Requested ${reqPieces} pieces, but only ${availablePieces} pieces available`,
        );
      }

      // Check complete box availability for BOX sales (DATABASE.md Section 13)
      const reqBoxes = requiredBoxesByProduct.get(prodIdStr) ?? 0;
      if (reqBoxes > 0) {
        const fullBoxesAvailable = Math.floor(
          availablePieces / product.piecesPerBox,
        );
        if (reqBoxes > fullBoxesAvailable) {
          const loosePieces = availablePieces % product.piecesPerBox;
          throw new BadRequestException(
            `Insufficient complete boxes for product "${product.productName}". Requested ${reqBoxes} boxes, but only ${fullBoxesAvailable} complete boxes available (${loosePieces} loose pieces cannot be used for box sale)`,
          );
        }
      }
    }

    // 4. Calculate Order Subtotal and Total Amount (authoritative paise precision)
    const subtotalPaise = preparedItems.reduce(
      (sum, item) => sum + item.lineTotalPaise,
      0,
    );
    const subtotal = paiseToRupees(subtotalPaise);
    const totalAmount = subtotal; // In V1 totalAmount equals subtotal

    // 5. Execute Atomic MongoDB Multi-Document Transaction
    const createdOrder = await this.runInTransaction(async (session) => {
      // 5a. Generate Atomic Order Number (DECISIONS.md ADR-013)
      const now = new Date();
      const yyyy = now.getUTCFullYear().toString();
      const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(now.getUTCDate()).padStart(2, '0');
      const dateKey = `GT-${yyyy}${mm}${dd}`;

      const counter = await this.counterModel.findOneAndUpdate(
        { key: dateKey },
        { $inc: { seq: 1 } },
        { upsert: true, new: true, session },
      );

      const seq = String(counter.seq).padStart(4, '0');
      const orderNumber = `${dateKey}-${seq}`;

      // 5b. Deduct Physical Pieces from Inventories atomically
      for (const [prodIdStr, reqPieces] of requiredPiecesByProduct.entries()) {
        const updatedInventory = await this.inventoryModel
          .findOneAndUpdate(
            {
              productId: new Types.ObjectId(prodIdStr),
              totalPieces: { $gte: reqPieces },
            },
            { $inc: { totalPieces: -reqPieces } },
            { new: true, session },
          )
          .exec();

        if (!updatedInventory) {
          throw new BadRequestException(
            'Concurrent inventory update prevented order completion. Please retry.',
          );
        }
      }

      // 5c. Build and Persist the Order Document
      const orderData = {
        orderNumber,
        customerId: customer._id,
        items: preparedItems.map((item) => ({
          productId: item.productId,
          productNameSnapshot: item.productNameSnapshot,
          brandSnapshot: item.brandSnapshot,
          salesQuantity: Types.Decimal128.fromString(
            String(item.salesQuantity),
          ),
          salesUnit: item.salesUnit,
          physicalPieces: item.physicalPieces,
          unitPrice: Types.Decimal128.fromString(item.unitPrice.toFixed(2)),
          lineTotal: Types.Decimal128.fromString(item.lineTotal.toFixed(2)),
        })),
        subtotal: Types.Decimal128.fromString(subtotal.toFixed(2)),
        totalAmount: Types.Decimal128.fromString(totalAmount.toFixed(2)),
        status: OrderStatus.COMPLETED,
        createdBy: userObjectId,
      };

      const [orderDoc] = await this.orderModel.create([orderData], { session });

      // 5d. Record SALE inventory transactions for audit trail
      const transactions = preparedItems.map((item) => ({
        productId: item.productId,
        transactionType: InventoryTransactionType.SALE,
        physicalPieces: -item.physicalPieces, // Signed negative for stock removed
        salesQuantity: Types.Decimal128.fromString(
          String(item.salesQuantity),
        ),
        salesUnit: item.salesUnit,
        orderId: orderDoc._id,
        createdBy: userObjectId,
      }));

      await this.transactionModel.create(transactions, { session });

      return orderDoc;
    });

    return this.buildOrderResponse(createdOrder, customer, 0, []);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. GET /orders (List Orders with Filtering, Pagination, Derived Payments)
  // ─────────────────────────────────────────────────────────────────────────────

  async findAll(query: ListOrdersDto): Promise<PaginatedOrdersResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.customerId) {
      filter.customerId = this.validateObjectId(query.customerId, 'customerId');
    }

    if (query.startDate || query.endDate) {
      const createdAtFilter: Record<string, Date> = {};
      if (query.startDate) {
        createdAtFilter['$gte'] = new Date(query.startDate);
      }
      if (query.endDate) {
        createdAtFilter['$lte'] = new Date(query.endDate);
      }
      filter.createdAt = createdAtFilter;
    }

    if (query.search && query.search.trim() !== '') {
      const searchRegex = { $regex: query.search.trim(), $options: 'i' };

      // Find matching customers by name or phone
      const matchingCustomers = await this.customerModel
        .find({
          $or: [{ name: searchRegex }, { phone: searchRegex }],
        })
        .select('_id')
        .exec();

      const matchingCustomerIds = matchingCustomers.map((c) => c._id);

      filter['$or'] = [
        { orderNumber: searchRegex },
        { customerId: { $in: matchingCustomerIds } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);

    if (orders.length === 0) {
      return {
        data: [],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
      };
    }

    // Batch query customers and payments to avoid N+1 queries
    const customerIds = Array.from(
      new Set(orders.map((o) => o.customerId.toString())),
    ).map((id) => new Types.ObjectId(id));
    const orderIds = orders.map((o) => o._id);

    const [customers, payments] = await Promise.all([
      this.customerModel.find({ _id: { $in: customerIds } }).exec(),
      this.paymentModel.find({ orderId: { $in: orderIds } }).exec(),
    ]);

    const customerMap = new Map<string, CustomerDocument>();
    for (const c of customers) {
      customerMap.set(c._id.toString(), c);
    }

    const paymentsByOrder = new Map<string, number>();
    for (const p of payments) {
      const oId = p.orderId.toString();
      const current = paymentsByOrder.get(oId) ?? 0;
      paymentsByOrder.set(oId, current + toPaise(p.amount));
    }

    const data: OrderDetailResponse[] = orders.map((order) => {
      const cust = customerMap.get(order.customerId.toString());
      const paidPaise = paymentsByOrder.get(order._id.toString()) ?? 0;
      return this.buildOrderResponse(order, cust, paidPaise);
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. GET /orders/:id (Order Details with Snapshots & Payment History)
  // ─────────────────────────────────────────────────────────────────────────────

  async findOne(id: string): Promise<OrderDetailResponse> {
    const orderObjectId = this.validateObjectId(id, 'id');

    const order = await this.orderModel.findById(orderObjectId).exec();
    if (!order) {
      throw new NotFoundException(`Order with id ${id} not found`);
    }

    const [customer, payments] = await Promise.all([
      this.customerModel.findById(order.customerId).exec(),
      this.paymentModel
        .find({ orderId: order._id })
        .sort({ paymentDate: -1, createdAt: -1 })
        .exec(),
    ]);

    const paidPaise = payments.reduce((sum, p) => sum + toPaise(p.amount), 0);

    return this.buildOrderResponse(order, customer, paidPaise, payments);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. POST /orders/:id/cancel (Dedicated Business Cancellation Command)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Dedicated idempotent order cancellation command (ADR-015).
   * Verifies COMPLETED status, restores consumed inventory, creates SALE_REVERSAL
   * audit transactions, and sets status to CANCELLED.
   */
  async cancel(id: string, userId: string): Promise<OrderDetailResponse> {
    const orderObjectId = this.validateObjectId(id, 'id');
    const userObjectId = this.validateObjectId(userId, 'userId');

    const updatedOrder = await this.runInTransaction(async (session) => {
      const order = await this.orderModel
        .findById(orderObjectId)
        .session(session)
        .exec();

      if (!order) {
        throw new NotFoundException(`Order with id ${id} not found`);
      }

      // Idempotency: Reject already cancelled orders (DATABASE.md Section 37)
      if (order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Order is already cancelled');
      }

      // 1. Restore exact physical pieces to inventory for each line item
      for (const item of order.items) {
        await this.inventoryModel
          .findOneAndUpdate(
            { productId: item.productId },
            { $inc: { totalPieces: item.physicalPieces } },
            { new: true, session },
          )
          .exec();
      }

      // 2. Record SALE_REVERSAL audit records
      const reversals = order.items.map((item) => ({
        productId: item.productId,
        transactionType: InventoryTransactionType.SALE_REVERSAL,
        physicalPieces: item.physicalPieces, // Signed positive for stock restored
        salesQuantity: item.salesQuantity,
        salesUnit: item.salesUnit,
        orderId: order._id,
        reason: 'Order cancelled',
        createdBy: userObjectId,
      }));

      await this.transactionModel.create(reversals, { session });

      // 3. Update Order status
      order.status = OrderStatus.CANCELLED;
      await order.save({ session });

      return order;
    });

    const [customer, payments] = await Promise.all([
      this.customerModel.findById(updatedOrder.customerId).exec(),
      this.paymentModel
        .find({ orderId: updatedOrder._id })
        .sort({ paymentDate: -1, createdAt: -1 })
        .exec(),
    ]);

    const paidPaise = payments.reduce((sum, p) => sum + toPaise(p.amount), 0);

    return this.buildOrderResponse(updatedOrder, customer, paidPaise, payments);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Builds standardized OrderDetailResponse with derived payment numbers.
   */
  private buildOrderResponse(
    order: OrderDocument,
    customer?: CustomerDocument | null,
    paidPaise = 0,
    payments?: PaymentDocument[],
  ): OrderDetailResponse {
    const orderTotalPaise = toPaise(order.totalAmount);
    const paidAmount = paiseToRupees(paidPaise);

    // Cancelled orders do NOT contribute to outstanding balance (DATABASE.md Section 29, 43)
    const outstandingAmount =
      order.status === OrderStatus.COMPLETED
        ? paiseToRupees(Math.max(0, orderTotalPaise - paidPaise))
        : 0;

    const items: OrderItemResponse[] = order.items.map((item) => ({
      productId: item.productId.toString(),
      productNameSnapshot: item.productNameSnapshot,
      brandSnapshot: item.brandSnapshot,
      salesQuantity: parseFloat(item.salesQuantity.toString()),
      salesUnit: item.salesUnit,
      physicalPieces: item.physicalPieces,
      unitPrice: paiseToRupees(toPaise(item.unitPrice)),
      lineTotal: paiseToRupees(toPaise(item.lineTotal)),
    }));

    return {
      _id: order._id.toString(),
      orderNumber: order.orderNumber,
      customerId: order.customerId.toString(),
      customer: customer
        ? {
            _id: customer._id.toString(),
            name: customer.name,
            phone: customer.phone,
            address: customer.address,
            isActive: customer.isActive,
          }
        : undefined,
      items,
      subtotal: paiseToRupees(toPaise(order.subtotal)),
      totalAmount: paiseToRupees(orderTotalPaise),
      status: order.status,
      paidAmount,
      outstandingAmount,
      payments: payments ? payments.map((p) => p.toObject()) : undefined,
      createdBy: order.createdBy ? order.createdBy.toString() : '',
      createdAt: (order as any).createdAt,
      updatedAt: (order as any).updatedAt,
    };
  }

  /**
   * Executes operations within a MongoDB ClientSession / transaction.
   */
  private async runInTransaction<T>(
    operation: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      const result = await operation(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Validates and parses MongoDB ObjectId safely.
   */
  private validateObjectId(id: string, fieldName = 'id'): Types.ObjectId {
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ${fieldName}: ${id}`);
    }
    return new Types.ObjectId(id);
  }
}
