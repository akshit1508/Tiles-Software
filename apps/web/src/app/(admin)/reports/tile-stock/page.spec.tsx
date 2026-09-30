import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TileStockReportPage from './page';
import { reportsApi, TileStockReportResponse } from '@/lib/api/reports';
import { ApiError } from '@/lib/api';

// Mock dependencies
jest.mock('@/lib/api/reports', () => ({
  reportsApi: {
    getDistinctSizes: jest.fn(),
    getTileStockReport: jest.fn(),
    downloadTileStockPdf: jest.fn(),
    fetchTileStockPdfBlob: jest.fn(),
  },
}));

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'u-1', name: 'Admin', role: 'OWNER' },
    isAuthenticated: true,
  }),
}));

const mockReportData: TileStockReportResponse = {
  reportTitle: 'Goverdhan Traders - Tile Sample & Stock Report',
  filterSize: '4*4',
  generatedAt: '2026-09-28T00:15:00.000Z',
  summary: {
    totalDesigns: 2,
    totalAvailableBoxes: 80,
  },
  items: [
    {
      serialNumber: 1,
      productId: 'prod-1',
      brand: 'Kajaria',
      productName: 'Classic Glazed',
      category: 'Wall',
      size: '4*4',
      finish: 'Glossy',
      color: 'White',
      piecesPerBox: 4,
      sellingPricePerBox: 2000,
      availableBoxes: 20,
      imageUrl: 'https://res.cloudinary.com/test/prod1.jpg',
    },
    {
      serialNumber: 2,
      productId: 'prod-2',
      brand: 'Somany',
      productName: 'Staturioa Matte',
      category: 'Floor',
      size: '4*4',
      finish: 'Matte',
      color: 'Grey',
      piecesPerBox: 4,
      sellingPricePerBox: 650,
      availableBoxes: 60,
      imageUrl: null, // missing image to test placeholder
    },
  ],
};

describe('Tile Stock Report Page (Phase 4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (reportsApi.getDistinctSizes as jest.Mock).mockResolvedValue({
      sizes: ['2*2', '4*4', '600*600'],
    });
    (reportsApi.getTileStockReport as jest.Mock).mockResolvedValue(mockReportData);
    (reportsApi.downloadTileStockPdf as jest.Mock).mockResolvedValue({
      filename: 'Goverdhan_Stock_4x4_2026-09-28.pdf',
      sizeBytes: 45000,
    });
    (reportsApi.fetchTileStockPdfBlob as jest.Mock).mockResolvedValue({
      blob: new Blob(['%PDF-1.4 mock'], { type: 'application/pdf' }),
      filename: 'Goverdhan_Stock_4x4_2026-09-28.pdf',
    });
  });

  it('1. Page renders with title, subtitle and initial prompt', async () => {
    render(<TileStockReportPage />);

    expect(screen.getByRole('heading', { level: 1, name: /Tile Stock Report/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Generate a size-wise live stock catalogue for customers/i),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Select a Size to Preview Catalogue/i),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(reportsApi.getDistinctSizes).toHaveBeenCalledTimes(1);
    });
  });

  it('2. Sizes load from backend API on mount and populate selector', async () => {
    render(<TileStockReportPage />);

    await waitFor(() => {
      expect(reportsApi.getDistinctSizes).toHaveBeenCalledTimes(1);
    });

    const select = screen.getByLabelText(/Tile Size/i) as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    await waitFor(() => {
      expect(select.options.length).toBe(4); // placeholder + 3 sizes
    });

    expect(select.options[1].value).toBe('2*2');
    expect(select.options[2].value).toBe('4*4');
    expect(select.options[3].value).toBe('600*600');
  });

  it('3. Default stock filter is availableOnly = true', async () => {
    render(<TileStockReportPage />);

    await waitFor(() => {
      expect(reportsApi.getDistinctSizes).toHaveBeenCalledTimes(1);
    });

    const checkbox = screen.getByLabelText(
      /Only show available stock/i,
    ) as HTMLInputElement;

    expect(checkbox).toBeInTheDocument();
    expect(checkbox.checked).toBe(true);
  });

  it('4. Generate button is disabled until a size is selected', async () => {
    render(<TileStockReportPage />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /4 × 4/i })).toBeInTheDocument();
    });

    const generateBtn = screen.getByRole('button', { name: /Generate Report/i });
    expect(generateBtn).toBeDisabled();

    // Select a size
    const select = screen.getByLabelText(/Tile Size/i);
    fireEvent.change(select, { target: { value: '4*4' } });

    expect(generateBtn).not.toBeDisabled();
  });

  it('5. Generates report with selected size and availableOnly=true by default', async () => {
    render(<TileStockReportPage />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /4 × 4/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Tile Size/i), {
      target: { value: '4*4' },
    });

    const generateBtn = screen.getByRole('button', { name: /Generate Report/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(reportsApi.getTileStockReport).toHaveBeenCalledWith({
        size: '4*4',
        availableOnly: true,
      });
    });

    // Check summary metrics
    await waitFor(() => {
      expect(screen.getByText('2 Models')).toBeInTheDocument();
      expect(screen.getByText('80 Boxes')).toBeInTheDocument();
    });

    // Check table rows
    expect(screen.getByText('Classic Glazed')).toBeInTheDocument();
    expect(screen.getByText('Staturioa Matte')).toBeInTheDocument();
    expect(screen.getByText('Kajaria')).toBeInTheDocument();
    expect(screen.queryByText('₹2,000.00')).not.toBeInTheDocument();
    expect(screen.queryByText('₹650.00')).not.toBeInTheDocument();
    expect(screen.queryByText(/Rate \/ Box/i)).not.toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
  });

  it('6. Passes availableOnly=false when toggle is turned off', async () => {
    render(<TileStockReportPage />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /4 × 4/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Tile Size/i), {
      target: { value: '4*4' },
    });

    const checkbox = screen.getByLabelText(/Only show available stock/i);
    fireEvent.click(checkbox);
    expect((checkbox as HTMLInputElement).checked).toBe(false);

    const generateBtn = screen.getByRole('button', { name: /Generate Report/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(reportsApi.getTileStockReport).toHaveBeenCalledWith({
        size: '4*4',
        availableOnly: false,
      });
    });
  });

  it('7. Displays No Image placeholder when imageUrl is null', async () => {
    render(<TileStockReportPage />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /4 × 4/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Tile Size/i), {
      target: { value: '4*4' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText('No Img')).toBeInTheDocument();
    });
  });

  it('8. Renders empty state when zero designs match filter', async () => {
    (reportsApi.getTileStockReport as jest.Mock).mockResolvedValue({
      reportTitle: 'Goverdhan Traders - Tile Sample & Stock Report',
      filterSize: '99x99',
      generatedAt: '2026-09-28T00:15:00.000Z',
      summary: { totalDesigns: 0, totalAvailableBoxes: 0 },
      items: [],
    });

    render(<TileStockReportPage />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /4 × 4/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Tile Size/i), {
      target: { value: '4*4' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText('No tiles found')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Generate Report/i })).not.toBeDisabled();
    });
  });

  it('9. Renders clean error state when API returns an error', async () => {
    (reportsApi.getTileStockReport as jest.Mock).mockRejectedValue(
      new ApiError({
        statusCode: 500,
        message: 'Internal server error aggregating inventories',
      }),
    );

    render(<TileStockReportPage />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /4 × 4/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Tile Size/i), {
      target: { value: '4*4' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText('Could Not Generate Report')).toBeInTheDocument();
      expect(
        screen.getByText('Internal server error aggregating inventories'),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Generate Report/i })).not.toBeDisabled();
    });
  });

  it('10. Downloads PDF when Download PDF button is clicked', async () => {
    render(<TileStockReportPage />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /4 × 4/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Tile Size/i), {
      target: { value: '4*4' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Download PDF/i })).toBeInTheDocument();
    });

    const downloadBtn = screen.getByRole('button', { name: /Download PDF/i });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(reportsApi.downloadTileStockPdf).toHaveBeenCalledWith('4*4', true);
    });

    await waitFor(() => {
      expect(screen.getByText(/Downloaded Goverdhan_Stock_4x4_2026-09-28.pdf/i)).toBeInTheDocument();
    });
  });

  it('11. Customer privacy: Does NOT render Galla numbers, Galla IDs or internal MongoDB IDs', async () => {
    render(<TileStockReportPage />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /4 × 4/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Tile Size/i), {
      target: { value: '4*4' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText('Classic Glazed')).toBeInTheDocument();
    });

    // Verify customer privacy: no internal Galla or database IDs
    expect(screen.queryByText(/gallaId/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/gallaNumber/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Galla 1/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/prod-1/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/prod-2/i)).not.toBeInTheDocument();
  });

  it('12. Share on WhatsApp button is hidden initially and appears after report is generated', async () => {
    render(<TileStockReportPage />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /4 × 4/i })).toBeInTheDocument();
    });

    // Before generation, WhatsApp button is not visible
    expect(
      screen.queryByRole('button', { name: /Share on WhatsApp/i }),
    ).not.toBeInTheDocument();

    // Generate report
    fireEvent.change(screen.getByLabelText(/Tile Size/i), {
      target: { value: '4*4' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Share on WhatsApp/i }),
      ).toBeInTheDocument();
    });
  });

  it('13. Share on WhatsApp: on desktop (no Web Share API), fetches PDF blob, downloads it and opens WhatsApp with pre-filled message', async () => {
    // Simulate desktop — no navigator.share
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });

    const windowOpenSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    const originalCreateObjectURL = global.URL.createObjectURL;
    const originalRevokeObjectURL = global.URL.revokeObjectURL;
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();

    render(<TileStockReportPage />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /4 × 4/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Tile Size/i), { target: { value: '4*4' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Share on WhatsApp/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Share on WhatsApp/i }));

    // fetchTileStockPdfBlob called with correct params
    await waitFor(() => {
      expect(reportsApi.fetchTileStockPdfBlob).toHaveBeenCalledWith('4*4', true);
    });

    // WhatsApp opens with wa.me?text= URL (pre-filled message, no phone — user picks contact)
    await waitFor(() => {
      expect(windowOpenSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^https:\/\/wa\.me\/\?text=/),
        '_blank',
        'noopener,noreferrer',
      );
    });

    // downloadTileStockPdf (the separate button) was NOT called
    expect(reportsApi.downloadTileStockPdf).not.toHaveBeenCalled();

    // Success banner shown
    await waitFor(() => {
      expect(
        screen.getByText(/PDF.*saved.*WhatsApp opened with message/i),
      ).toBeInTheDocument();
    });

    global.URL.createObjectURL = originalCreateObjectURL;
    global.URL.revokeObjectURL = originalRevokeObjectURL;
    windowOpenSpy.mockRestore();
  });

  it('14. Share on WhatsApp: shows error banner when PDF fetch fails', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });

    (reportsApi.fetchTileStockPdfBlob as jest.Mock).mockRejectedValue(
      new ApiError({ statusCode: 500, message: 'PDF generation failed on server.' }),
    );

    render(<TileStockReportPage />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /4 × 4/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Tile Size/i), { target: { value: '4*4' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Share on WhatsApp/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Share on WhatsApp/i }));

    await waitFor(() => {
      expect(screen.getByText(/PDF generation failed on server/i)).toBeInTheDocument();
    });
  });

  it('15. Download PDF button still functions independently alongside Share on WhatsApp', async () => {
    render(<TileStockReportPage />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /4 × 4/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Tile Size/i), {
      target: { value: '4*4' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Download PDF/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Share on WhatsApp/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Download PDF/i }));

    await waitFor(() => {
      expect(reportsApi.downloadTileStockPdf).toHaveBeenCalledWith('4*4', true);
    });
  });
});
