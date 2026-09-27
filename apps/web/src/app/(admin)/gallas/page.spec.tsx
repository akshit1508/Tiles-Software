import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GallasPage from './page';
import { gallasApi } from '@/lib/api/gallas';

// Mock dependencies
jest.mock('@/lib/api/gallas', () => ({
  gallasApi: {
    list: jest.fn(),
    getById: jest.fn(),
    getInventory: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'u-1', name: 'Admin', role: 'OWNER' },
  }),
}));

const mockGallas = [
  {
    _id: 'g-1',
    gallaNumber: 'GAL-01',
    name: 'North Bay',
    description: 'Aisle 1',
    isActive: true,
    productCount: 3,
    totalBoxes: 65,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    _id: 'g-2',
    gallaNumber: 'GAL-02',
    name: 'South Bay',
    description: 'Aisle 2',
    isActive: false,
    productCount: 1,
    totalBoxes: 20,
    createdAt: '2026-01-02',
    updatedAt: '2026-01-02',
  },
];

describe('Gallas Management Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (gallasApi.list as jest.Mock).mockImplementation((query?: any) => {
      const search = query?.search?.toLowerCase();
      const filtered = search
        ? mockGallas.filter(
            (g) =>
              g.gallaNumber.toLowerCase().includes(search) ||
              g.name?.toLowerCase().includes(search),
          )
        : mockGallas;
      return Promise.resolve({
        data: filtered,
        total: filtered.length,
        totalPages: 1,
      });
    });
  });

  it('1. renders Galla list and overview metrics', async () => {
    render(<GallasPage />);

    expect(screen.getByText(/Godown Storage Locations/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('GAL-01')).toBeInTheDocument();
      expect(screen.getByText('GAL-02')).toBeInTheDocument();
      expect(screen.getByText('North Bay')).toBeInTheDocument();
    });

    // Check metrics
    expect(screen.getByText('Total Locations')).toBeInTheDocument();
    expect(screen.getByText('Active Locations')).toBeInTheDocument();
  });

  it('2. filters Gallas using search input', async () => {
    render(<GallasPage />);

    await waitFor(() => {
      expect(screen.getByText('GAL-01')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by Galla number/i);
    fireEvent.change(searchInput, { target: { value: 'North' } });

    await waitFor(() => {
      expect(screen.getByText('GAL-01')).toBeInTheDocument();
      expect(screen.queryByText('GAL-02')).not.toBeInTheDocument();
    });
  });

  it('3. opens stock drawer on View Stock click', async () => {
    (gallasApi.getInventory as jest.Mock).mockResolvedValue({
      galla: mockGallas[0],
      totalProducts: 2,
      totalBoxes: 35,
      items: [
        {
          product: { _id: 'p-1', productName: 'Royal Slate', brand: 'Kajaria', category: 'Floor', size: '600x600' },
          boxes: 20,
          totalPieces: 80,
        },
        {
          product: { _id: 'p-2', productName: 'Marble White', brand: 'Somany', category: 'Wall', size: '300x600' },
          boxes: 15,
          totalPieces: 60,
        },
      ],
      products: [],
    });

    render(<GallasPage />);

    await waitFor(() => {
      expect(screen.getByText('GAL-01')).toBeInTheDocument();
    });

    const viewStockBtns = screen.getAllByRole('button', { name: /View Stock/i });
    fireEvent.click(viewStockBtns[0]);

    await waitFor(() => {
      expect(screen.getByText(/Inventory in GAL-01/i)).toBeInTheDocument();
      expect(screen.getByText('Royal Slate')).toBeInTheDocument();
      expect(screen.getByText('Marble White')).toBeInTheDocument();
    });
  });

  it('4. opens Create Galla modal and submits new location', async () => {
    (gallasApi.create as jest.Mock).mockResolvedValue({
      _id: 'g-3',
      gallaNumber: 'GAL-03',
      name: 'East Wing',
      isActive: true,
      productCount: 0,
      totalBoxes: 0,
    });

    render(<GallasPage />);

    const addBtn = screen.getByRole('button', { name: /Add Galla Location/i });
    fireEvent.click(addBtn);

    expect(screen.getByText('Create New Godown Location')).toBeInTheDocument();

    const gallaNumberInput = screen.getByLabelText(/Galla Number \/ Code \*/i);
    fireEvent.change(gallaNumberInput, { target: { value: 'GAL-03' } });

    const submitBtn = screen.getByRole('button', { name: /Create Location/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(gallasApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          gallaNumber: 'GAL-03',
        }),
      );
    });
  });
});
