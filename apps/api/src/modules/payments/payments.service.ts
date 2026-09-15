import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types, ClientSession } from 'mongoose';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { CreatePaymentDto, ListPaymentsDto } from './dto';
import { PaymentResponse, PaginatedPaymentsResponse } from './interfaces';
import { OrderStatus } from '../../common/enums';

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

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. POST /payments (Record a payment against an order)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Records a payment against an existing order.
   *
   * Locked V1 Rules:
   * - Payment can ONLY be created against an existing order.
   * - No unallocated / advance / customer-wallet payments.
   * - Cancelled orders cannot receive payments.
   * - CustomerId is derived authoritatively from the order.
   * - If client supplies customerId, validate that it matches order.customerId.
   * - Deactivated customers CAN still record payments for existing outstanding orders.
   * - Payment amount must be positive.
   * - Overpayment must be rejected.
   * - Money calculations must use integer paise arithmetic.
   * - Payment creation is atomic and transaction-safe.
   * - Serializes concurrent payment creation per order using the Order __v write-conflict serialization point.
   */
  async create(
    dto: CreatePaymentDto,
    userId: string,
  ): Promise<PaymentResponse> {
    const orderObjectId = this.validateObjectId(dto.orderId, 'orderId');
    const userObjectId = this.validateObjectId(userId, 'userId');

    const paymentAmountPaise = toPaise(dto.amount);
    if (paymentAmountPaise <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }

    if (dto.customerId) {
      this.validateObjectId(dto.customerId, 'customerId');
    }

    const { paymentDoc, orderDoc, customerDoc, remainingOutstandingPaise } =
      await this.runInTransaction(async (session) => {
        // 1. Atomic Order Lock & Version Increment (Serializes concurrent payments for this order)
        const order = await this.orderModel
          .findOneAndUpdate(
            {
              _id: orderObjectId,
              status: OrderStatus.COMPLETED,
            },
            { $inc: { __v: 1 } },
            { new: true, session },
          )
          .exec();

        if (!order) {
          // Check whether the order does not exist or exists in CANCELLED status
          const existingOrder = await this.orderModel
            .findById(orderObjectId)
            .session(session)
            .exec();

          if (!existingOrder) {
            throw new NotFoundException(
              `Order with id ${dto.orderId} not found`,
            );
          }
          if (existingOrder.status === OrderStatus.CANCELLED) {
            throw new BadRequestException(
              'Cannot record payment for a cancelled order',
            );
          }
          throw new BadRequestException(
            `Cannot record payment for order in status: ${existingOrder.status}`,
          );
        }

        // 2. Validate Referenced Customer
        const customer = await this.customerModel
          .findById(order.customerId)
          .session(session)
          .exec();

        if (!customer) {
          throw new NotFoundException(
            `Referenced customer with id ${order.customerId.toString()} not found`,
          );
        }

        // Validate optional client-supplied customerId strictly matches order customer
        if (dto.customerId && dto.customerId !== order.customerId.toString()) {
          throw new BadRequestException(
            'Supplied customerId does not match the customer on the referenced order',
          );
        }

        // Note: Soft-deactivated customers (customer.isActive === false) CAN still record payments
        // for already-existing outstanding orders. Deactivation is NOT rejected here.

        // 3. Read Existing Payments for this Order (inside transaction boundary)
        const existingPayments = await this.paymentModel
          .find({ orderId: order._id })
          .session(session)
          .exec();

        // 4. Integer Paise Arithmetic for Outstanding Balance & Overpayment Enforcement
        const orderTotalPaise = toPaise(order.totalAmount);
        const existingPaidPaise = existingPayments.reduce(
          (sum, p) => sum + toPaise(p.amount),
          0,
        );

        const remainingBeforePaymentPaise = orderTotalPaise - existingPaidPaise;

        if (paymentAmountPaise > remainingBeforePaymentPaise) {
          throw new BadRequestException(
            `Payment amount ₹${paiseToRupees(paymentAmountPaise).toFixed(2)} exceeds remaining order outstanding balance of ₹${paiseToRupees(remainingBeforePaymentPaise).toFixed(2)}`,
          );
        }

        // 5. Persist Immutable Payment Document
        const paymentData = {
          customerId: order.customerId,
          orderId: order._id,
          amount: Types.Decimal128.fromString(
            paiseToRupees(paymentAmountPaise).toFixed(2),
          ),
          paymentMethod: dto.paymentMethod,
          paymentDate: new Date(dto.paymentDate),
          notes: dto.notes?.trim() || undefined,
          createdBy: userObjectId,
        };

        const [paymentDoc] = await this.paymentModel.create([paymentData], {
          session,
        });

        const remainingAfterPaymentPaise =
          remainingBeforePaymentPaise - paymentAmountPaise;

        return {
          paymentDoc,
          orderDoc: order,
          customerDoc: customer,
          remainingOutstandingPaise: remainingAfterPaymentPaise,
        };
      });

    return this.buildPaymentResponse(
      paymentDoc,
      orderDoc,
      customerDoc,
      remainingOutstandingPaise,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. GET /payments (List payments with filters and pagination)
  // ─────────────────────────────────────────────────────────────────────────────

  async findAll(query: ListPaymentsDto): Promise<PaginatedPaymentsResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (query.orderId) {
      filter.orderId = this.validateObjectId(query.orderId, 'orderId');
    }

    if (query.customerId) {
      filter.customerId = this.validateObjectId(query.customerId, 'customerId');
    }

    if (query.paymentMethod) {
      filter.paymentMethod = query.paymentMethod;
    }

    if (query.startDate || query.endDate) {
      const paymentDateFilter: Record<string, Date> = {};
      if (query.startDate) {
        paymentDateFilter['$gte'] = new Date(query.startDate);
      }
      if (query.endDate) {
        // Exclusive upper bound ($lt next day) so end date includes the entire calendar day
        const parsedEnd = new Date(query.endDate);
        const nextDay = new Date(parsedEnd);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        nextDay.setUTCHours(0, 0, 0, 0);
        paymentDateFilter['$lt'] = nextDay;
      }
      filter.paymentDate = paymentDateFilter;
    }

    const [payments, total] = await Promise.all([
      this.paymentModel
        .find(filter)
        .sort({ paymentDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.paymentModel.countDocuments(filter).exec(),
    ]);

    if (payments.length === 0) {
      return {
        data: [],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    // Populate order and customer details
    const orderIds = [...new Set(payments.map((p) => p.orderId.toString()))].map(
      (id) => new Types.ObjectId(id),
    );
    const customerIds = [
      ...new Set(payments.map((p) => p.customerId.toString())),
    ].map((id) => new Types.ObjectId(id));

    const [orders, customers] = await Promise.all([
      this.orderModel
        .find({ _id: { $in: orderIds } })
        .select('_id orderNumber totalAmount status')
        .exec(),
      this.customerModel
        .find({ _id: { $in: customerIds } })
        .select('_id name phone address isActive')
        .exec(),
    ]);

    const orderMap = new Map<string, OrderDocument>();
    for (const order of orders) {
      orderMap.set(order._id.toString(), order);
    }

    const customerMap = new Map<string, CustomerDocument>();
    for (const cust of customers) {
      customerMap.set(cust._id.toString(), cust);
    }

    const data: PaymentResponse[] = payments.map((p) => {
      const order = orderMap.get(p.orderId.toString());
      const customer = customerMap.get(p.customerId.toString());
      return this.buildPaymentResponse(p, order, customer);
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
  // 3. GET /payments/:id (Get single payment detail)
  // ─────────────────────────────────────────────────────────────────────────────

  async findOne(id: string): Promise<PaymentResponse> {
    const paymentObjectId = this.validateObjectId(id, 'id');
    const payment = await this.paymentModel.findById(paymentObjectId).exec();

    if (!payment) {
      throw new NotFoundException(`Payment with id ${id} not found`);
    }

    const [order, customer] = await Promise.all([
      this.orderModel
        .findById(payment.orderId)
        .select('_id orderNumber totalAmount status')
        .exec(),
      this.customerModel
        .findById(payment.customerId)
        .select('_id name phone address isActive')
        .exec(),
    ]);

    // Calculate current remaining outstanding for the order if order exists and is COMPLETED
    let remainingOutstanding: number | undefined;
    if (order && order.status === OrderStatus.COMPLETED) {
      const allPayments = await this.paymentModel
        .find({ orderId: order._id })
        .exec();
      const orderTotalPaise = toPaise(order.totalAmount);
      const totalPaidPaise = allPayments.reduce(
        (sum, p) => sum + toPaise(p.amount),
        0,
      );
      remainingOutstanding = paiseToRupees(
        Math.max(0, orderTotalPaise - totalPaidPaise),
      );
    } else if (order && order.status === OrderStatus.CANCELLED) {
      remainingOutstanding = 0;
    }

    return this.buildPaymentResponse(
      payment,
      order || undefined,
      customer || undefined,
      remainingOutstanding !== undefined
        ? toPaise(remainingOutstanding)
        : undefined,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────────────────────

  private buildPaymentResponse(
    payment: PaymentDocument,
    order?: OrderDocument,
    customer?: CustomerDocument,
    remainingOutstandingPaise?: number,
  ): PaymentResponse {
    return {
      _id: payment._id.toString(),
      orderId: payment.orderId.toString(),
      order: order
        ? {
            _id: order._id.toString(),
            orderNumber: order.orderNumber,
            totalAmount: paiseToRupees(toPaise(order.totalAmount)),
            status: order.status,
          }
        : undefined,
      customerId: payment.customerId.toString(),
      customer: customer
        ? {
            _id: customer._id.toString(),
            name: customer.name,
            phone: customer.phone,
            address: customer.address,
            isActive: customer.isActive,
          }
        : undefined,
      amount: paiseToRupees(toPaise(payment.amount)),
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate,
      notes: payment.notes,
      remainingOutstanding:
        remainingOutstandingPaise !== undefined
          ? paiseToRupees(remainingOutstandingPaise)
          : undefined,
      createdBy: payment.createdBy ? payment.createdBy.toString() : '',
      createdAt: (payment as any).createdAt,
    };
  }

  /**
   * Executes operations within a MongoDB ClientSession / transaction.
   * If a write conflict / TransientTransactionError occurs, aborts and bubbles up.
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
