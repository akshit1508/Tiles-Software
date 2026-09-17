import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Button,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
} from '@/components/ui';
import { Product, parseDecimalValue } from '@/lib/api/products';
import {
  inventoryApi,
  InventoryTransaction,
  InventoryTransactionType,
} from '@/lib/api/inventory';
import { ApiError } from '@/lib/api';
import { History, FileText } from 'lucide-react';

interface InventoryHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

export function InventoryHistoryModal({
  isOpen,
  onClose,
  product,
}: InventoryHistoryModalProps) {
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>('');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!product?._id) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await inventoryApi.getHistory(product._id, {
        page,
        limit,
        transactionType: (typeFilter as InventoryTransactionType) || undefined,
      });

      setTransactions(response.data);
      setTotal(response.total);
      setTotalPages(response.totalPages);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load transaction audit trail');
      }
    } finally {
      setIsLoading(false);
    }
  }, [product?._id, page, limit, typeFilter]);

  useEffect(() => {
    if (isOpen && product?._id) {
      fetchHistory();
    }
  }, [isOpen, product?._id, fetchHistory]);

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTypeFilter(e.target.value);
    setPage(1);
  };

  const renderTypeBadge = (type: InventoryTransactionType) => {
    switch (type) {
      case 'STOCK_IN':
        return <Badge variant="success" size="sm">Stock In</Badge>;
      case 'SALE':
        return <Badge variant="info" size="sm">Sale</Badge>;
      case 'DAMAGE':
        return <Badge variant="danger" size="sm">Damage</Badge>;
      case 'ADJUSTMENT':
        return <Badge variant="warning" size="sm">Adjustment</Badge>;
      case 'SALE_REVERSAL':
        return <Badge variant="neutral" size="sm">Sale Reversal</Badge>;
      default:
        return <Badge variant="default" size="sm">{type}</Badge>;
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(d);
    } catch {
      return isoString;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Inventory Transaction Audit Trail"
      description={
        product
          ? `Immutable ledger movements for ${product.productName} (${product.gallaNumber})`
          : 'Inventory transaction audit trail'
      }
      size="xl"
    >
      <div className="space-y-4">
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="w-full sm:w-64">
            <Select
              label="Filter by Movement Type"
              value={typeFilter}
              onChange={handleTypeChange}
              disabled={isLoading && transactions.length === 0}
              options={[
                { label: 'All Transaction Types', value: '' },
                { label: 'STOCK_IN (Stock In)', value: 'STOCK_IN' },
                { label: 'SALE (Order Deduction)', value: 'SALE' },
                { label: 'DAMAGE (Damaged Tiles)', value: 'DAMAGE' },
                { label: 'ADJUSTMENT (Audit Adjustment)', value: 'ADJUSTMENT' },
                { label: 'SALE_REVERSAL (Cancelled Order)', value: 'SALE_REVERSAL' },
              ]}
            />
          </div>

          <div className="text-xs text-slate-500 text-right w-full sm:w-auto">
            Total Movements: <span className="font-semibold text-slate-800">{total}</span>
          </div>
        </div>

        {/* Content */}
        {isLoading && transactions.length === 0 ? (
          <div className="p-8">
            <LoadingState message="Loading transaction audit log..." />
          </div>
        ) : error && transactions.length === 0 ? (
          <ErrorState
            title="Failed to Load History"
            message={error}
            onRetry={fetchHistory}
          />
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={<History className="h-8 w-8 text-slate-400" />}
            title="No inventory transactions recorded"
            description="No movements have occurred for this tile product matching the selected criteria."
          />
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden max-h-[380px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Piece Change</TableHead>
                    <TableHead>Customer Sales Unit</TableHead>
                    <TableHead>Audit Reason / Order ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => {
                    const isPositive = tx.physicalPieces > 0;
                    const salesQty = tx.salesQuantity
                      ? parseDecimalValue(tx.salesQuantity)
                      : null;

                    return (
                      <TableRow key={tx._id}>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {formatDate(tx.createdAt)}
                        </TableCell>

                        <TableCell>
                          {renderTypeBadge(tx.transactionType)}
                        </TableCell>

                        <TableCell className="text-right font-mono text-sm font-semibold">
                          <span
                            className={
                              isPositive ? 'text-emerald-700' : 'text-rose-700'
                            }
                          >
                            {isPositive ? `+${tx.physicalPieces}` : tx.physicalPieces}{' '}
                            <span className="text-[11px] font-normal text-slate-500 font-sans">
                              pcs
                            </span>
                          </span>
                        </TableCell>

                        <TableCell className="text-xs text-slate-700">
                          {salesQty !== null && tx.salesUnit ? (
                            <span>
                              {salesQty} {tx.salesUnit.toLowerCase()}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>

                        <TableCell className="text-xs text-slate-700">
                          {tx.reason ? (
                            <span className="font-medium text-slate-800">
                              {tx.reason}
                            </span>
                          ) : tx.orderId ? (
                            <span className="font-mono text-[11px] text-slate-500 flex items-center gap-1">
                              <FileText className="h-3 w-3 text-slate-400" />
                              Order: {tx.orderId}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={limit}
                onPageChange={(newPage) => setPage(newPage)}
              />
            )}
          </div>
        )}

        <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
