import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Inventory, InventoryDocument } from '../inventory/schemas/inventory.schema';
import {
  ListOutstandingCustomersDto,
  DashboardSummaryQueryDto,
} from './dto';
import {
  PaginatedOutstandingCustomersResponse,
  CustomerOutstandingListItem,
  CustomerOutstandingDetailResponse,
  OrderOutstandingBreakdown,
  DashboardSummaryResponse,
} from './interfaces';
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
export class DashboardService {
  constructor(
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. GET /outstanding/customers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns a paginated list of customers who have an outstanding balance > 0.
   *
   * LOCKED BUSINESS RULES:
   * - Outstanding is NOT stored on Customer or Order.
   * - Derived strictly: sum(COMPLETED orders totalAmount) - sum(valid payments against them).
   * - Cancelled orders do NOT contribute to outstanding.
   * - Deactivated customers (isActive: false) ARE included if they still have outstanding > 0.
   * - Integer paise arithmetic is used to avoid floating point drift.
   * - Customers with 0 outstanding are excluded.
   */
  async getOutstandingCustomers(
    query: ListOutstandingCustomersDto,
  ): Promise<PaginatedOutstandingCustomersResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    // Build customer match condition if search filter provided
    const customerMatch: Record<string, unknown> = {};
    if (query.search && query.search.trim() !== '') {
      const searchRegex = { $regex: query.search.trim(), $options: 'i' };
      customerMatch['$or'] = [{ name: searchRegex }, { phone: searchRegex }];
    }

    // Step 1: Find candidate customers matching search (if any)
    const customers = await this.customerModel
      .find(customerMatch)
      .select('_id name phone isActive')
      .exec();

    if (customers.length === 0) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    const customerIds = customers.map((c) => c._id);

    // Step 2: Query completed orders and their payments for these customers in batch
    const [orders, payments] = await Promise.all([
      this.orderModel
        .find({
          customerId: { $in: customerIds },
          status: OrderStatus.COMPLETED,
        })
        .select('_id customerId totalAmount')
        .exec(),
      this.paymentModel
        .find({
          customerId: { $in: customerIds },
        })
        .select('_id customerId orderId amount')
        .exec(),
    ]);

    // Step 3: Compute payment sum per order (in integer paise)
    const paidByOrder = new Map<string, number>();
    for (const p of payments) {
      const oId = p.orderId.toString();
      paidByOrder.set(oId, (paidByOrder.get(oId) || 0) + toPaise(p.amount));
    }

    // Step 4: Aggregate totalSales, totalPaid, and outstanding per customer
    const orderIdsByCustomer = new Map<string, typeof orders>();
    for (const order of orders) {
      const cId = order.customerId.toString();
      const list = orderIdsByCustomer.get(cId) || [];
      list.push(order);
      orderIdsByCustomer.set(cId, list);
    }

    const customersWithOutstanding: CustomerOutstandingListItem[] = [];

    for (const customer of customers) {
      const cId = customer._id.toString();
      const customerOrders = orderIdsByCustomer.get(cId) || [];

      if (customerOrders.length === 0) {
        continue;
      }

      let totalSalesPaise = 0;
      let totalPaidPaise = 0;

      for (const ord of customerOrders) {
        const orderPaise = toPaise(ord.totalAmount);
        const orderPaid = paidByOrder.get(ord._id.toString()) || 0;
        totalSalesPaise += orderPaise;
        totalPaidPaise += orderPaid;
      }

      const outstandingPaise = Math.max(0, totalSalesPaise - totalPaidPaise);

      // Only include customers with outstanding > 0
      if (outstandingPaise > 0) {
        customersWithOutstanding.push({
          customerId: cId,
          customerName: customer.name,
          customerPhone: customer.phone,
          totalSales: paiseToRupees(totalSalesPaise),
          totalPaid: paiseToRupees(totalPaidPaise),
          outstanding: paiseToRupees(outstandingPaise),
          isActive: customer.isActive,
        });
      }
    }

    // Sort descending by outstanding amount
    customersWithOutstanding.sort((a, b) => b.outstanding - a.outstanding);

    const total = customersWithOutstanding.length;
    const paginatedData = customersWithOutstanding.slice(skip, skip + limit);

    return {
      data: paginatedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. GET /outstanding/customers/:customerId
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns complete outstanding details and order-level breakdown for a customer.
   */
  async getCustomerOutstandingDetail(
    customerId: string,
  ): Promise<CustomerOutstandingDetailResponse> {
    const customerObjectId = this.validateObjectId(customerId, 'customerId');

    const customer = await this.customerModel.findById(customerObjectId).exec();
    if (!customer) {
      throw new NotFoundException(`Customer with id ${customerId} not found`);
    }

    // Fetch all orders and payments for this customer
    const [orders, payments] = await Promise.all([
      this.orderModel
        .find({ customerId: customerObjectId })
        .sort({ createdAt: -1 })
        .exec(),
      this.paymentModel
        .find({ customerId: customerObjectId })
        .exec(),
    ]);

    // Map payments per order
    const paymentsByOrder = new Map<string, number>();
    for (const p of payments) {
      const oId = p.orderId.toString();
      paymentsByOrder.set(
        oId,
        (paymentsByOrder.get(oId) || 0) + toPaise(p.amount),
      );
    }

    let totalCompletedSalesPaise = 0;
    let totalCompletedPaidPaise = 0;

    const orderBreakdown: OrderOutstandingBreakdown[] = orders.map((order) => {
      const orderPaise = toPaise(order.totalAmount);
      const paidPaise = paymentsByOrder.get(order._id.toString()) || 0;
      const isCompleted = order.status === OrderStatus.COMPLETED;

      if (isCompleted) {
        totalCompletedSalesPaise += orderPaise;
        totalCompletedPaidPaise += paidPaise;
      }

      // Cancelled orders contribute 0 outstanding
      const outstandingPaise = isCompleted
        ? Math.max(0, orderPaise - paidPaise)
        : 0;

      return {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        orderDate: (order as any).createdAt,
        totalAmount: paiseToRupees(orderPaise),
        paidAmount: paiseToRupees(paidPaise),
        outstanding: paiseToRupees(outstandingPaise),
        status: order.status,
      };
    });

    const outstandingPaise = Math.max(
      0,
      totalCompletedSalesPaise - totalCompletedPaidPaise,
    );

    return {
      customer: {
        _id: customer._id.toString(),
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        isActive: customer.isActive,
      },
      totalCompletedSales: paiseToRupees(totalCompletedSalesPaise),
      totalPaid: paiseToRupees(totalCompletedPaidPaise),
      outstanding: paiseToRupees(outstandingPaise),
      orders: orderBreakdown,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. GET /dashboard/summary
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns real-time aggregate statistics for the business owner.
   *
   * Date filtering semantics:
   * - startDate: inclusive start date ($gte)
   * - endDate: exclusive upper bound ($lt next day 00:00:00 UTC)
   * - Order & Sales metrics are filtered by order.createdAt
   * - Collection metrics are filtered by payment.paymentDate
   * - Low stock is evaluated against current inventory vs product minimumStockPieces
   */
  async getDashboardSummary(
    query: DashboardSummaryQueryDto,
  ): Promise<DashboardSummaryResponse> {
    const orderCreatedAtFilter: Record<string, Date> = {};
    const paymentDateFilter: Record<string, Date> = {};
    let hasDateFilter = false;

    if (query.startDate || query.endDate) {
      hasDateFilter = true;
      if (query.startDate) {
        const start = new Date(query.startDate);
        orderCreatedAtFilter['$gte'] = start;
        paymentDateFilter['$gte'] = start;
      }
      if (query.endDate) {
        const parsedEnd = new Date(query.endDate);
        const nextDay = new Date(parsedEnd);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        nextDay.setUTCHours(0, 0, 0, 0);
        orderCreatedAtFilter['$lt'] = nextDay;
        paymentDateFilter['$lt'] = nextDay;
      }
    }

    // 1. Product Counts
    const [totalProducts, activeProducts] = await Promise.all([
      this.productModel.countDocuments({}).exec(),
      this.productModel.countDocuments({ isActive: true }).exec(),
    ]);

    // 2. Customer Counts
    const [totalCustomers, activeCustomers] = await Promise.all([
      this.customerModel.countDocuments({}).exec(),
      this.customerModel.countDocuments({ isActive: true }).exec(),
    ]);

    // 3. Order Aggregations (filtered by order createdAt if dates provided)
    const orderFilter: Record<string, unknown> = {};
    if (hasDateFilter) {
      orderFilter.createdAt = orderCreatedAtFilter;
    }

    const orderStatsPipeline: PipelineStage[] = [
      { $match: orderFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmountSum: {
            $sum: { $toDouble: '$totalAmount' },
          },
        },
      },
    ];

    const orderStats = await this.orderModel.aggregate(orderStatsPipeline).exec();

    let completedOrders = 0;
    let cancelledOrders = 0;
    let totalSalesPaise = 0;

    for (const stat of orderStats) {
      if (stat._id === OrderStatus.COMPLETED) {
        completedOrders = stat.count;
        totalSalesPaise = toPaise(stat.totalAmountSum);
      } else if (stat._id === OrderStatus.CANCELLED) {
        cancelledOrders = stat.count;
      }
    }
    const totalOrders = completedOrders + cancelledOrders;

    // 4. Payment Collection Aggregation (filtered by paymentDate if dates provided)
    const paymentFilter: Record<string, unknown> = {};
    if (hasDateFilter) {
      paymentFilter.paymentDate = paymentDateFilter;
    }

    const paymentStatsPipeline: PipelineStage[] = [
      { $match: paymentFilter },
      {
        $group: {
          _id: null,
          totalCollected: {
            $sum: { $toDouble: '$amount' },
          },
        },
      },
    ];

    const paymentStats = await this.paymentModel.aggregate(paymentStatsPipeline).exec();
    const totalCollectedPaise =
      paymentStats.length > 0 ? toPaise(paymentStats[0].totalCollected) : 0;

    // 5. Total Outstanding Calculation
    // In V1, outstanding is authoritative and derived: for each COMPLETED order,
    // order outstanding = max(0, order.totalAmount - sum(all payments for that order)).
    // Total outstanding is the sum of real remaining balances of the matching orders.
    // Payments made outside the date window still reduce the real outstanding balance of those orders.
    let totalOutstandingPaise = 0;
    if (completedOrders > 0) {
      const completedOrderPipeline: PipelineStage[] = [
        {
          $match: {
            ...orderFilter,
            status: OrderStatus.COMPLETED,
          },
        },
        {
          $lookup: {
            from: 'payments',
            localField: '_id',
            foreignField: 'orderId',
            as: 'orderPayments',
          },
        },
        {
          $project: {
            _id: 1,
            totalAmountDouble: { $toDouble: '$totalAmount' },
            paidTotalDouble: {
              $sum: {
                $map: {
                  input: '$orderPayments',
                  as: 'p',
                  in: { $toDouble: '$$p.amount' },
                },
              },
            },
          },
        },
      ];

      const completedOrdersWithPayments = await this.orderModel
        .aggregate(completedOrderPipeline)
        .exec();

      for (const ord of completedOrdersWithPayments) {
        const orderPaise = toPaise(ord.totalAmountDouble);
        const paidPaise = toPaise(ord.paidTotalDouble);
        const orderOutstandingPaise = Math.max(0, orderPaise - paidPaise);
        totalOutstandingPaise += orderOutstandingPaise;
      }
    }

    // 6. Low Stock Products
    const lowStockPipeline: PipelineStage[] = [
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $match: {
          'product.isActive': true,
          $expr: {
            $lte: [
              '$totalPieces',
              {
                $multiply: [
                  {
                    $ifNull: [
                      '$product.minimumStockBoxes',
                      {
                        $floor: {
                          $divide: [
                            { $ifNull: ['$product.minimumStockPieces', 0] },
                            '$product.piecesPerBox',
                          ],
                        },
                      },
                    ],
                  },
                  '$product.piecesPerBox',
                ],
              },
            ],
          },
        },
      },
      {
        $project: {
          _id: 0,
          productId: '$product._id',
          productName: '$product.productName',
          brand: '$product.brand',
          currentPieces: '$totalPieces',
          piecesPerBox: '$product.piecesPerBox',
          minimumStockBoxes: {
            $ifNull: [
              '$product.minimumStockBoxes',
              {
                $floor: {
                  $divide: [
                    { $ifNull: ['$product.minimumStockPieces', 0] },
                    '$product.piecesPerBox',
                  ],
                },
              },
            ],
          },
          minimumStockPieces: {
            $ifNull: [
              '$product.minimumStockPieces',
              {
                $multiply: [
                  { $ifNull: ['$product.minimumStockBoxes', 0] },
                  '$product.piecesPerBox',
                ],
              },
            ],
          },
        },
      },
    ];

    const lowStockItems = await this.inventoryModel.aggregate(lowStockPipeline).exec();

    return {
      totalProducts,
      activeProducts,
      totalCustomers,
      activeCustomers,
      totalOrders,
      completedOrders,
      cancelledOrders,
      totalSales: paiseToRupees(totalSalesPaise),
      totalCollected: paiseToRupees(totalCollectedPaise),
      totalOutstanding: paiseToRupees(totalOutstandingPaise),
      lowStock: {
        totalLowStockProducts: lowStockItems.length,
        items: lowStockItems.map((item) => {
          const piecesPerBox = item.piecesPerBox || 1;
          const currentPieces = item.currentPieces || 0;
          const fullBoxes = Math.floor(currentPieces / piecesPerBox);
          const loosePieces = currentPieces % piecesPerBox;
          const minimumStockBoxes = item.minimumStockBoxes ?? 0;

          return {
            productId: item.productId.toString(),
            productName: item.productName,
            brand: item.brand,
            currentPieces,
            fullBoxes,
            loosePieces,
            piecesPerBox,
            minimumStockBoxes,
            minimumStockPieces:
              item.minimumStockPieces ?? minimumStockBoxes * piecesPerBox,
          };
        }),
      },
      dateFilter: hasDateFilter
        ? {
            startDate: query.startDate,
            endDate: query.endDate,
            salesFilteredBy: 'order.createdAt',
            collectedFilteredBy: 'payment.paymentDate',
          }
        : undefined,
    };
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
