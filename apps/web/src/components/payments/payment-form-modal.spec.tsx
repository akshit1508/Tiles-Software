import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PaymentFormModal } from './payment-form-modal';
import { ordersApi, Order } from '@/lib/api/orders';
import { paymentsApi } from '@/lib/api/payments';

jest.mock('@/lib/api/orders', () => ({
  ordersApi: {
    list: jest.fn(),
    getById: jest.fn(),
  },
}));

jest.mock('@/lib/api/payments', () => ({
  paymentsApi: {
    create: jest.fn(),
  },
}));

jest.mock('@/lib/api/products', () => ({
  formatCurrencyINR: jest.fn((val) => `₹${Number(val).toLocaleString('en-IN')}`),
}));

const mockOrders: Partial<Order>[] = [
  {
    _id: 'ord-1',
    orderNumber: 'GT-20260923-0001',
    customerId: 'cust-1',
    customer: {
      _id: 'cust-1',
      name: 'Rahul Sharma',
      phone: '9876543210',
    },
    totalAmount: 5000,
    paidAmount: 3000,
    outstandingAmount: 2000,
    status: 'COMPLETED',
    createdAt: '2026-09-23T10:00:00Z',
    items: [],
  },
  {
    _id: 'ord-2',
    orderNumber: 'GT-20260923-0007',
    customerId: 'cust-2',
    customer: {
      _id: 'cust-2',
      name: 'Amit Kumar',
      phone: '9123456780',
    },
    totalAmount: 1500,
    paidAmount: 0,
    outstandingAmount: 1500,
    status: 'COMPLETED',
    createdAt: '2026-09-23T11:00:00Z',
    items: [],
  },
  {
    _id: 'ord-3',
    orderNumber: 'GT-20260922-0042',
    customerId: 'cust-3',
    customer: {
      _id: 'cust-3',
      name: 'Pooja Verma',
      phone: '9988776655',
    },
    totalAmount: 4000,
    paidAmount: 4000,
    outstandingAmount: 0,
    status: 'COMPLETED',
    createdAt: '2026-09-22T09:00:00Z',
    items: [],
  },
];

describe('PaymentFormModal - Searchable Order Select UX', () => {
  const onCloseMock = jest.fn();
  const onSuccessMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (ordersApi.list as jest.Mock).mockResolvedValue({ data: mockOrders });
    (ordersApi.getById as jest.Mock).mockImplementation((id: string) => {
      const match = mockOrders.find((o) => o._id === id);
      return Promise.resolve(match);
    });
  });

  const setupModal = async () => {
    render(
      <PaymentFormModal
        isOpen={true}
        onClose={onCloseMock}
        onSuccess={onSuccessMock}
      />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText(/Select Order/i)).not.toBeDisabled();
    });
  };

  it('filters orders by partial order number', async () => {
    await setupModal();

    const orderInput = screen.getByLabelText(/Select Order/i);
    fireEvent.change(orderInput, { target: { value: '0007' } });

    expect(screen.getByText('GT-20260923-0007')).toBeInTheDocument();
    expect(screen.queryByText('GT-20260923-0001')).not.toBeInTheDocument();
    expect(screen.queryByText('GT-20260922-0042')).not.toBeInTheDocument();
  });

  it('filters orders by customer name', async () => {
    await setupModal();

    const orderInput = screen.getByLabelText(/Select Order/i);
    fireEvent.change(orderInput, { target: { value: 'rahul' } });

    expect(screen.getByText('GT-20260923-0001')).toBeInTheDocument();
    expect(screen.getByText(/Rahul Sharma/i)).toBeInTheDocument();
    expect(screen.queryByText('GT-20260923-0007')).not.toBeInTheDocument();
  });

  it('performs case-insensitive order and customer search', async () => {
    await setupModal();

    const orderInput = screen.getByLabelText(/Select Order/i);
    fireEvent.change(orderInput, { target: { value: 'AMIT' } });

    expect(screen.getByText('GT-20260923-0007')).toBeInTheDocument();
    expect(screen.getByText(/Amit Kumar/i)).toBeInTheDocument();
    expect(screen.queryByText('GT-20260923-0001')).not.toBeInTheDocument();
  });

  it('displays proper empty state when no matching order is found', async () => {
    await setupModal();

    const orderInput = screen.getByLabelText(/Select Order/i);
    fireEvent.change(orderInput, { target: { value: 'nonexistent-9999' } });

    expect(screen.getByText('No matching orders found')).toBeInTheDocument();
  });

  it('selects filtered order and loads authoritative details and outstanding balance', async () => {
    await setupModal();

    const orderInput = screen.getByLabelText(/Select Order/i);
    fireEvent.change(orderInput, { target: { value: '0007' } });

    const option = screen.getByText('GT-20260923-0007');
    fireEvent.click(option);

    await waitFor(() => {
      expect(ordersApi.getById).toHaveBeenCalledWith('ord-2');
      // Amount input auto-fills with outstanding amount (1500)
      const amountInput = screen.getByPlaceholderText('0.00') as HTMLInputElement;
      expect(amountInput.value).toBe('1500');
    });

    // Check order summary card is displayed
    expect(screen.getByText('Already Paid')).toBeInTheDocument();
    expect(screen.getByText('Outstanding')).toBeInTheDocument();
  });

  it('allows clearing and changing the selected order', async () => {
    await setupModal();

    const orderInput = screen.getByLabelText(/Select Order/i);

    // Select order 1
    fireEvent.change(orderInput, { target: { value: 'ord-1' } });
    await waitFor(() => {
      expect((orderInput as HTMLInputElement).value).toBe('GT-20260923-0001');
    });

    // Clear selection
    const clearBtn = screen.getByLabelText(/Clear selection/i);
    fireEvent.click(clearBtn);

    expect((orderInput as HTMLInputElement).value).toBe('');

    // Now select order 2
    fireEvent.change(orderInput, { target: { value: '0007' } });
    fireEvent.click(screen.getByText('GT-20260923-0007'));

    await waitFor(() => {
      expect((orderInput as HTMLInputElement).value).toBe('GT-20260923-0007');
    });
  });

  it('submits payment against selected order successfully', async () => {
    (paymentsApi.create as jest.Mock).mockResolvedValue({
      _id: 'pay-1',
      paymentNumber: 'PAY-001',
      orderId: 'ord-1',
      amount: 2000,
    });

    await setupModal();

    const orderInput = screen.getByLabelText(/Select Order/i);
    fireEvent.change(orderInput, { target: { value: 'ord-1' } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('2000')).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /Confirm Payment/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(paymentsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'ord-1',
          amount: 2000,
          paymentMethod: 'CASH',
        }),
      );
      expect(onSuccessMock).toHaveBeenCalled();
      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  it('renders preselected initialOrder without requiring manual selection', () => {
    render(
      <PaymentFormModal
        isOpen={true}
        onClose={onCloseMock}
        onSuccess={onSuccessMock}
        initialOrder={mockOrders[0] as Order}
      />,
    );

    expect(screen.getByText('Linked Order')).toBeInTheDocument();
    expect(screen.getAllByText('GT-20260923-0001').length).toBeGreaterThan(0);
  });
});
