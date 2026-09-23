import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OrderCreateModal } from './order-create-modal';
import { customersApi } from '@/lib/api/customers';
import { productsApi } from '@/lib/api/products';
import { ordersApi } from '@/lib/api/orders';

// Mock dependencies
jest.mock('@/lib/api/customers', () => ({
  customersApi: {
    list: jest.fn(),
  },
}));

jest.mock('@/lib/api/products', () => ({
  productsApi: {
    list: jest.fn(),
  },
  parseDecimalValue: jest.fn((val) => (typeof val === 'number' ? val : parseFloat(val || 0))),
  formatCurrencyINR: jest.fn((val) => `₹${Number(val).toLocaleString('en-IN')}`),
}));

jest.mock('@/lib/api/orders', () => ({
  ordersApi: {
    create: jest.fn(),
  },
  getOrderPaymentStatus: jest.fn(),
}));

const mockCustomers = [
  {
    _id: 'cust-1',
    name: 'Sharma Builders',
    phone: '9876543210',
    address: 'Jaipur',
    isActive: true,
    totalOrders: 2,
    outstandingBalance: 5000,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    _id: 'cust-2',
    name: 'Akhil Enterprises',
    phone: '9123456789',
    address: 'Delhi',
    isActive: true,
    totalOrders: 1,
    outstandingBalance: 0,
    createdAt: '2026-01-02',
    updatedAt: '2026-01-02',
  },
  {
    _id: 'cust-3',
    name: 'Akash Tiles',
    phone: '9811122233',
    address: 'Noida',
    isActive: true,
    totalOrders: 0,
    outstandingBalance: 0,
    createdAt: '2026-01-03',
    updatedAt: '2026-01-03',
  },
  {
    _id: 'cust-4',
    name: 'Verma Constructions',
    phone: '8888888888',
    address: 'Gurgaon',
    isActive: true,
    totalOrders: 5,
    outstandingBalance: 12000,
    createdAt: '2026-01-04',
    updatedAt: '2026-01-04',
  },
];

const mockProducts = [
  {
    _id: 'prod-1',
    productName: 'Kajaria Floor 600x600',
    brand: 'Kajaria',
    gallaNumber: 'GAL-001',
    category: 'Floor',
    size: '600x600',
    finish: 'Glossy',
    color: 'White',
    piecesPerBox: 4,
    areaPerBox: 16,
    purchasePrice: 400,
    sellingPrice: 600,
    minimumStockPieces: 20,
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
];

describe('OrderCreateModal Component', () => {
  const onCloseMock = jest.fn();
  const onSuccessMock = jest.fn();

  const setupModal = async () => {
    render(
      <OrderCreateModal
        isOpen={true}
        onClose={onCloseMock}
        onSuccess={onSuccessMock}
      />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText(/Select Customer/i)).not.toBeDisabled();
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (customersApi.list as jest.Mock).mockResolvedValue({ data: mockCustomers });
    (productsApi.list as jest.Mock).mockResolvedValue({ data: mockProducts });
  });

  it('renders modal with customer select, box inputs, and payment section', async () => {
    await setupModal();

    expect(screen.getByText('New Sale (Combined Order & Payment)')).toBeInTheDocument();
    expect(screen.getByLabelText(/Select Customer/i)).toBeInTheDocument();
    expect(screen.getByText(/Tile Products \(Boxes Only\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Quantity \(BOXES\)/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Payment at Sale/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Sale/i })).toBeInTheDocument();
  });

  it('populates unit price per box when a product is selected', async () => {
    await setupModal();

    const productSelect = screen.getByLabelText(/Product #1/i);
    fireEvent.change(productSelect, { target: { value: 'prod-1' } });

    const priceInput = screen.getByLabelText(/Price \(₹ \/ BOX\)/i) as HTMLInputElement;
    expect(priceInput.value).toBe('600');
  });

  it('calculates order total from box quantity and unit price', async () => {
    await setupModal();

    // Select product
    fireEvent.change(screen.getByLabelText(/Product #1/i), { target: { value: 'prod-1' } });

    // Set quantity = 10 boxes (10 * 600 = 6000)
    const qtyInput = screen.getByLabelText(/Quantity \(BOXES\)/i);
    fireEvent.change(qtyInput, { target: { value: '10' } });

    // Order total and line total should reflect 6000
    expect(screen.getAllByText('₹6,000').length).toBeGreaterThan(0);
  });

  it('sets paidNow = total and outstanding = 0 when "Paid Full" is clicked', async () => {
    await setupModal();

    fireEvent.change(screen.getByLabelText(/Product #1/i), { target: { value: 'prod-1' } });
    fireEvent.change(screen.getByLabelText(/Quantity \(BOXES\)/i), { target: { value: '5' } }); // 5 * 600 = 3000

    const paidFullBtn = screen.getByRole('button', { name: /Paid Full/i });
    fireEvent.click(paidFullBtn);

    const paidNowInput = screen.getByLabelText(/Paid Now/i) as HTMLInputElement;
    expect(paidNowInput.value).toBe('3000');
    expect(screen.getByText('PAID')).toBeInTheDocument();
    expect(screen.getByText('Fully settled')).toBeInTheDocument();
  });

  it('updates live outstanding balance for partial payment', async () => {
    await setupModal();

    fireEvent.change(screen.getByLabelText(/Product #1/i), { target: { value: 'prod-1' } });
    fireEvent.change(screen.getByLabelText(/Quantity \(BOXES\)/i), { target: { value: '5' } }); // Total: 3000

    const paidNowInput = screen.getByLabelText(/Paid Now/i);
    fireEvent.change(paidNowInput, { target: { value: '1000' } }); // Paid: 1000, Outstanding: 2000

    expect(screen.getByText('PARTIALLY PAID')).toBeInTheDocument();
    expect(screen.getByText('₹2,000')).toBeInTheDocument();
  });

  it('validates overpayment on client side', async () => {
    await setupModal();

    fireEvent.change(screen.getByLabelText(/Select Customer/i), { target: { value: 'cust-1' } });
    fireEvent.change(screen.getByLabelText(/Product #1/i), { target: { value: 'prod-1' } });
    fireEvent.change(screen.getByLabelText(/Quantity \(BOXES\)/i), { target: { value: '2' } }); // Total: 1200

    const paidNowInput = screen.getByLabelText(/Paid Now/i);
    fireEvent.change(paidNowInput, { target: { value: '2000' } }); // Exceeds 1200

    const submitBtn = screen.getByRole('button', { name: /Create Sale/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Payment cannot exceed order total/i)).toBeInTheDocument();
    expect(ordersApi.create).not.toHaveBeenCalled();
  });

  it('submits combined sale atomically with initial payment', async () => {
    const createdOrderMock = {
      _id: 'ord-123',
      orderNumber: 'GT-20260923-0001',
      customerId: 'cust-1',
      items: [],
      subtotal: 1200,
      totalAmount: 1200,
      status: 'COMPLETED',
      paidAmount: 500,
      outstandingAmount: 700,
      paymentStatus: 'PARTIALLY PAID',
      createdAt: '2026-09-23T10:00:00Z',
      updatedAt: '2026-09-23T10:00:00Z',
      createdBy: 'user-1',
    };
    (ordersApi.create as jest.Mock).mockResolvedValue(createdOrderMock);

    await setupModal();

    fireEvent.change(screen.getByLabelText(/Select Customer/i), { target: { value: 'cust-1' } });
    fireEvent.change(screen.getByLabelText(/Product #1/i), { target: { value: 'prod-1' } });
    fireEvent.change(screen.getByLabelText(/Quantity \(BOXES\)/i), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/Paid Now/i), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText(/Payment Method/i), { target: { value: 'UPI' } });

    const submitBtn = screen.getByRole('button', { name: /Create Sale/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(ordersApi.create).toHaveBeenCalledWith({
        customerId: 'cust-1',
        items: [
          {
            productId: 'prod-1',
            quantityBoxes: 2,
            salesUnit: 'BOX',
            unitPrice: 600,
          },
        ],
        initialPayment: {
          amount: 500,
          paymentMethod: 'UPI',
          notes: undefined,
        },
      });
      expect(onSuccessMock).toHaveBeenCalledWith(createdOrderMock);
      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  it('submits unpaid / credit sale without initialPayment when paidNow is 0', async () => {
    const createdOrderMock = {
      _id: 'ord-124',
      orderNumber: 'GT-20260923-0002',
      customerId: 'cust-1',
      items: [],
      subtotal: 600,
      totalAmount: 600,
      status: 'COMPLETED',
      paidAmount: 0,
      outstandingAmount: 600,
      paymentStatus: 'UNPAID',
      createdAt: '2026-09-23T10:00:00Z',
      updatedAt: '2026-09-23T10:00:00Z',
      createdBy: 'user-1',
    };
    (ordersApi.create as jest.Mock).mockResolvedValue(createdOrderMock);

    await setupModal();

    fireEvent.change(screen.getByLabelText(/Select Customer/i), { target: { value: 'cust-1' } });
    fireEvent.change(screen.getByLabelText(/Product #1/i), { target: { value: 'prod-1' } });
    fireEvent.change(screen.getByLabelText(/Quantity \(BOXES\)/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/Paid Now/i), { target: { value: '0' } });

    const submitBtn = screen.getByRole('button', { name: /Create Sale/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(ordersApi.create).toHaveBeenCalledWith({
        customerId: 'cust-1',
        items: [
          {
            productId: 'prod-1',
            quantityBoxes: 1,
            salesUnit: 'BOX',
            unitPrice: 600,
          },
        ],
        initialPayment: undefined,
      });
      expect(onSuccessMock).toHaveBeenCalledWith(createdOrderMock);
    });
  });

  describe('Customer Searchable Select UX', () => {
    it('filters customer list by typing partial customer name', async () => {
      await setupModal();

      const customerInput = screen.getByLabelText(/Select Customer/i);
      fireEvent.change(customerInput, { target: { value: 'ak' } });

      expect(screen.getByText('Akhil Enterprises')).toBeInTheDocument();
      expect(screen.getByText('Akash Tiles')).toBeInTheDocument();
      expect(screen.queryByText('Sharma Builders')).not.toBeInTheDocument();
      expect(screen.queryByText('Verma Constructions')).not.toBeInTheDocument();
    });

    it('performs case-insensitive customer matching', async () => {
      await setupModal();

      const customerInput = screen.getByLabelText(/Select Customer/i);
      fireEvent.change(customerInput, { target: { value: 'SHARMA' } });

      expect(screen.getByText('Sharma Builders')).toBeInTheDocument();
      expect(screen.queryByText('Akhil Enterprises')).not.toBeInTheDocument();
    });

    it('filters customers by partial phone number', async () => {
      await setupModal();

      const customerInput = screen.getByLabelText(/Select Customer/i);
      fireEvent.change(customerInput, { target: { value: '9811' } });

      expect(screen.getByText('Akash Tiles')).toBeInTheDocument();
      expect(screen.queryByText('Sharma Builders')).not.toBeInTheDocument();
    });

    it('displays clean empty state when no customer matches', async () => {
      await setupModal();

      const customerInput = screen.getByLabelText(/Select Customer/i);
      fireEvent.change(customerInput, { target: { value: 'NonExistentXYZ' } });

      expect(screen.getByText('No matching customers found')).toBeInTheDocument();
    });

    it('selects filtered customer on click and updates field', async () => {
      await setupModal();

      const customerInput = screen.getByLabelText(/Select Customer/i);
      fireEvent.change(customerInput, { target: { value: 'verma' } });

      const customerOption = screen.getByText('Verma Constructions');
      fireEvent.click(customerOption);

      expect((customerInput as HTMLInputElement).value).toBe('Verma Constructions');
    });

    it('allows clearing and changing the selected customer', async () => {
      await setupModal();

      const customerInput = screen.getByLabelText(/Select Customer/i);

      // Select a customer
      fireEvent.change(customerInput, { target: { value: 'cust-1' } });
      expect((customerInput as HTMLInputElement).value).toBe('Sharma Builders');

      // Click clear button
      const clearBtn = screen.getByLabelText(/Clear selection/i);
      fireEvent.click(clearBtn);

      expect((customerInput as HTMLInputElement).value).toBe('');

      // Now search and select another customer
      fireEvent.change(customerInput, { target: { value: 'akhil' } });
      fireEvent.click(screen.getByText('Akhil Enterprises'));

      expect((customerInput as HTMLInputElement).value).toBe('Akhil Enterprises');
    });
  });
});
