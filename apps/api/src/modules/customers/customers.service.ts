import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Customer, CustomerDocument } from './schemas/customer.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { CreateCustomerDto, UpdateCustomerDto, ListCustomersDto } from './dto';
import {
  PaginatedCustomers,
  CustomerDetailResponse,
  CustomerListItem,
  CustomerOrderDetail,
  CustomerPaymentDetail,
} from './interfaces/customer.interface';
import { OrderStatus } from '../../common/enums';

/**
 * Helper: Converts Decimal128 or numeric amount to whole paise (cents)
 * to avoid floating-point inaccuracies in currency calculations.
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
 * Helper: Converts whole paise to decimal rupees with 2 decimal precision.
 */
function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // Create
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Creates a new customer record.
   * isActive defaults to true (server-controlled).
   * Phone uniqueness is NOT enforced (DATABASE.md Section 46).
   */
  async create(dto: CreateCustomerDto): Promise<CustomerDocument> {
    const customerData = {
      name: dto.name.trim(),
      phone: dto.phone.trim(),
      address: dto.address ? dto.address.trim() : undefined,
      isActive: true,
    };

    return this.customerModel.create(customerData);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // List
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns a paginated list of customers with dynamically derived totals
   * (totalOrders, outstandingBalance).
   *
   * Defaults to isActive=true (only active customers).
   * Uses batch queries for orders and payments to avoid N+1 queries.
   */
  async findAll(query: ListCustomersDto): Promise<PaginatedCustomers> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    // Filter criteria
    const filter: Record<string, unknown> = {
      isActive: query.isActive !== undefined ? query.isActive : true,
    };

    if (query.search) {
      const sanitized = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter['$or'] = [
        { name: { $regex: sanitized, $options: 'i' } },
        { phone: { $regex: sanitized, $options: 'i' } },
      ];
    }

    const [customers, total] = await Promise.all([
      this.customerModel
        .find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      this.customerModel.countDocuments(filter).exec(),
    ]);

    if (customers.length === 0) {
      return {
        data: [],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    // Batch query orders and payments for this page of customers
    const customerIds = customers.map((c) => c._id);

    const [orders, payments] = await Promise.all([
      this.orderModel
        .find({ customerId: { $in: customerIds } })
        .select('_id customerId totalAmount status')
        .exec(),
      this.paymentModel
        .find({ customerId: { $in: customerIds } })
        .select('_id customerId orderId amount')
        .exec(),
    ]);

    // Aggregate derived metrics per customer in-memory with paise precision
    const data: CustomerListItem[] = customers.map((customer) => {
      const custIdStr = customer._id.toString();
      const custOrders = orders.filter(
        (o) => o.customerId.toString() === custIdStr,
      );
      const totalOrders = custOrders.length;

      // Only COMPLETED orders contribute to outstanding balance (DATABASE.md Sections 29, 43)
      const completedOrders = custOrders.filter(
        (o) => o.status === OrderStatus.COMPLETED,
      );
      const completedOrderIds = new Set(
        completedOrders.map((o) => o._id.toString()),
      );

      const custPayments = payments.filter(
        (p) =>
          p.customerId.toString() === custIdStr &&
          completedOrderIds.has(p.orderId.toString()),
      );

      const ordersPaise = completedOrders.reduce(
        (sum, o) => sum + toPaise(o.totalAmount),
        0,
      );
      const paymentsPaise = custPayments.reduce(
        (sum, p) => sum + toPaise(p.amount),
        0,
      );
      const outstandingBalance = paiseToRupees(
        Math.max(0, ordersPaise - paymentsPaise),
      );

      return {
        _id: custIdStr,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        isActive: customer.isActive,
        totalOrders,
        outstandingBalance,
        createdAt: (customer as any).createdAt,
        updatedAt: (customer as any).updatedAt,
      };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Find One (Detail)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns complete customer details including order history and payment ledger.
   * Derives totalOrders and outstandingBalance from authoritative records.
   */
  async findOne(id: string): Promise<CustomerDetailResponse> {
    this.validateObjectId(id);

    const customer = await this.customerModel.findById(id).exec();
    if (!customer) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }

    // Retrieve full order history and payment ledger
    const [orders, payments] = await Promise.all([
      this.orderModel
        .find({ customerId: customer._id })
        .sort({ createdAt: -1 })
        .exec(),
      this.paymentModel
        .find({ customerId: customer._id })
        .sort({ paymentDate: -1, createdAt: -1 })
        .exec(),
    ]);

    // Map payments by orderId for order-level derivation
    const paymentsByOrder = new Map<string, number>();
    for (const p of payments) {
      const oId = p.orderId.toString();
      const current = paymentsByOrder.get(oId) ?? 0;
      paymentsByOrder.set(oId, current + toPaise(p.amount));
    }

    // Prepare derived order details
    const orderDetails: CustomerOrderDetail[] = orders.map((o) => {
      const oId = o._id.toString();
      const orderPaise = toPaise(o.totalAmount);
      const paidPaise = paymentsByOrder.get(oId) ?? 0;
      const isCompleted = o.status === OrderStatus.COMPLETED;
      const outstandingPaise = isCompleted
        ? Math.max(0, orderPaise - paidPaise)
        : 0;

      return {
        _id: oId,
        orderNumber: o.orderNumber,
        status: o.status,
        totalAmount: paiseToRupees(orderPaise),
        paidAmount: paiseToRupees(paidPaise),
        outstandingAmount: paiseToRupees(outstandingPaise),
        createdAt: (o as any).createdAt,
      };
    });

    // Prepare payment ledger
    const paymentDetails: CustomerPaymentDetail[] = payments.map((p) => ({
      _id: p._id.toString(),
      orderId: p.orderId.toString(),
      amount: paiseToRupees(toPaise(p.amount)),
      paymentMethod: p.paymentMethod,
      paymentDate: p.paymentDate,
      notes: p.notes,
      createdAt: (p as any).createdAt,
    }));

    // Customer-level outstanding balance: Sum(COMPLETED orders) - Sum(valid payments)
    const completedOrders = orders.filter(
      (o) => o.status === OrderStatus.COMPLETED,
    );
    const completedOrderIds = new Set(
      completedOrders.map((o) => o._id.toString()),
    );

    const completedOrdersPaise = completedOrders.reduce(
      (sum, o) => sum + toPaise(o.totalAmount),
      0,
    );
    const validPaymentsPaise = payments
      .filter((p) => completedOrderIds.has(p.orderId.toString()))
      .reduce((sum, p) => sum + toPaise(p.amount), 0);

    const outstandingBalance = paiseToRupees(
      Math.max(0, completedOrdersPaise - validPaymentsPaise),
    );

    return {
      customer,
      totalOrders: orders.length,
      outstandingBalance,
      orders: orderDetails,
      payments: paymentDetails,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Update
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Partially updates mutable customer profile fields (name, phone, address, isActive).
   */
  async update(id: string, dto: UpdateCustomerDto): Promise<CustomerDocument> {
    this.validateObjectId(id);

    const updateData: Record<string, unknown> = {};

    if (dto.name !== undefined) updateData['name'] = dto.name.trim();
    if (dto.phone !== undefined) updateData['phone'] = dto.phone.trim();
    if (dto.address !== undefined) updateData['address'] = dto.address.trim();
    if (dto.isActive !== undefined) updateData['isActive'] = dto.isActive;

    const updated = await this.customerModel
      .findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Activate / Deactivate (Soft Delete)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Sets isActive = true.
   * Throws 409 Conflict if already active.
   */
  async activate(id: string): Promise<CustomerDocument> {
    this.validateObjectId(id);

    const customer = await this.customerModel.findById(id).exec();
    if (!customer) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }

    if (customer.isActive) {
      throw new ConflictException(`Customer with id ${id} is already active`);
    }

    customer.isActive = true;
    return customer.save();
  }

  /**
   * Soft-deactivates the customer (isActive = false).
   * Customers are NEVER hard-deleted to preserve historical records.
   * Throws 409 Conflict if already inactive.
   */
  async deactivate(id: string): Promise<CustomerDocument> {
    this.validateObjectId(id);

    const customer = await this.customerModel.findById(id).exec();
    if (!customer) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }

    if (!customer.isActive) {
      throw new ConflictException(`Customer with id ${id} is already inactive`);
    }

    customer.isActive = false;
    return customer.save();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private validateObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid customer id: ${id}`);
    }
  }
}
