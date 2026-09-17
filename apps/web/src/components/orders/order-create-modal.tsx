import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Select } from '@/components/ui';
import { CustomerListItem, customersApi } from '@/lib/api/customers';
import { Product, productsApi, parseDecimalValue, formatCurrencyINR } from '@/lib/api/products';
import { CreateOrderInput, CreateOrderItemInput, SalesUnit, ordersApi, Order } from '@/lib/api/orders';
import { ApiError } from '@/lib/api';
import { Plus, Trash2, AlertCircle, ShoppingCart, Info } from 'lucide-react';

interface OrderCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdOrder: Order) => void;
}

interface FormItem {
  id: string; // client-side unique id for key
  productId: string;
  salesQuantity: string;
  salesUnit: SalesUnit;
  unitPrice: string;
}

export function OrderCreateModal({
  isOpen,
  onClose,
  onSuccess,
}: OrderCreateModalProps) {
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [items, setItems] = useState<FormItem[]>([
    {
      id: '1',
      productId: '',
      salesQuantity: '1',
      salesUnit: 'BOX',
      unitPrice: '',
    },
  ]);

  const [isLoadingMasterData, setIsLoadingMasterData] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load active customers and products when modal opens
  useEffect(() => {
    if (isOpen) {
      setServerError(null);
      setFieldErrors({});
      setSelectedCustomerId('');
      setItems([
        {
          id: Math.random().toString(),
          productId: '',
          salesQuantity: '1',
          salesUnit: 'BOX',
          unitPrice: '',
        },
      ]);

      const loadData = async () => {
        try {
          setIsLoadingMasterData(true);
          const [customersRes, productsRes] = await Promise.all([
            customersApi.list({ limit: 100, isActive: true }),
            productsApi.list({ limit: 100, isActive: true }),
          ]);
          setCustomers(customersRes.data);
          setProducts(productsRes.data);
        } catch {
          setServerError('Failed to load customers or product catalog.');
        } finally {
          setIsLoadingMasterData(false);
        }
      };

      loadData();
    }
  }, [isOpen]);

  const handleProductChange = (itemId: string, newProductId: string) => {
    const prod = products.find((p) => p._id === newProductId);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        let defaultPrice = '';
        if (prod) {
          const sellingBox = parseDecimalValue(prod.sellingPrice);
          if (item.salesUnit === 'BOX') {
            defaultPrice = sellingBox.toString();
          } else if (item.salesUnit === 'PIECE' && prod.piecesPerBox > 0) {
            defaultPrice = (sellingBox / prod.piecesPerBox).toFixed(2);
          } else if (item.salesUnit === 'SQ_FT') {
            const area = parseDecimalValue(prod.areaPerBox);
            defaultPrice = area > 0 ? (sellingBox / area).toFixed(2) : sellingBox.toString();
          }
        }
        return {
          ...item,
          productId: newProductId,
          unitPrice: defaultPrice,
        };
      }),
    );
  };

  const handleUnitChange = (itemId: string, newUnit: SalesUnit) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const prod = products.find((p) => p._id === item.productId);
        let defaultPrice = item.unitPrice;
        if (prod) {
          const sellingBox = parseDecimalValue(prod.sellingPrice);
          if (newUnit === 'BOX') {
            defaultPrice = sellingBox.toString();
          } else if (newUnit === 'PIECE' && prod.piecesPerBox > 0) {
            defaultPrice = (sellingBox / prod.piecesPerBox).toFixed(2);
          } else if (newUnit === 'SQ_FT') {
            const area = parseDecimalValue(prod.areaPerBox);
            defaultPrice = area > 0 ? (sellingBox / area).toFixed(2) : sellingBox.toString();
          }
        }
        return {
          ...item,
          salesUnit: newUnit,
          unitPrice: defaultPrice,
        };
      }),
    );
  };

  const handleItemChange = (itemId: string, field: keyof FormItem, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)),
    );
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        productId: '',
        salesQuantity: '1',
        salesUnit: 'BOX',
        unitPrice: '',
      },
    ]);
  };

  const handleRemoveItem = (itemId: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!selectedCustomerId) {
      errors.customerId = 'Please select a customer';
    }

    if (items.length === 0) {
      errors.items = 'Order must contain at least one product item';
    }

    items.forEach((item, index) => {
      if (!item.productId) {
        errors[`item_${index}_product`] = 'Product is required';
      }

      const qty = parseFloat(item.salesQuantity);
      if (isNaN(qty) || qty <= 0) {
        errors[`item_${index}_qty`] = 'Quantity must be > 0';
      } else if (item.salesUnit !== 'SQ_FT' && !Number.isInteger(qty)) {
        errors[`item_${index}_qty`] = `${item.salesUnit} quantity must be a whole integer`;
      }

      if (item.unitPrice.trim() !== '') {
        const price = parseFloat(item.unitPrice);
        if (isNaN(price) || price < 0) {
          errors[`item_${index}_price`] = 'Price must be >= 0';
        }
      }
    });

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Preview estimation for UX only
  const estimatedSubtotal = items.reduce((sum, item) => {
    const qty = parseFloat(item.salesQuantity) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    try {
      setIsSubmitting(true);

      const orderPayload: CreateOrderInput = {
        customerId: selectedCustomerId,
        items: items.map((item) => ({
          productId: item.productId,
          salesQuantity: parseFloat(item.salesQuantity),
          salesUnit: item.salesUnit,
          unitPrice: item.unitPrice.trim() !== '' ? parseFloat(item.unitPrice) : undefined,
        })),
      };

      const createdOrder = await ordersApi.create(orderPayload);
      onSuccess(createdOrder);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.validationErrors) {
          setServerError(
            Array.isArray(err.validationErrors)
              ? err.validationErrors.join(', ')
              : err.message,
          );
        } else {
          setServerError(err.message || 'Failed to create order. Please verify stock availability.');
        }
      } else if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError('An unexpected error occurred while processing order creation.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Sales Order"
      description="Create a tile order directly in COMPLETED status. The backend will atomically assign an order number and deduct inventory."
      size="xl"
    >
      {serverError && (
        <div
          className="mb-4 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-600 mt-0.5" />
          <span className="font-medium">{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Customer Selector */}
        <div>
          <Select
            label="Customer *"
            value={selectedCustomerId}
            onChange={(e) => {
              setSelectedCustomerId(e.target.value);
              setFieldErrors((prev) => ({ ...prev, customerId: '' }));
            }}
            error={fieldErrors.customerId}
            disabled={isSubmitting || isLoadingMasterData}
            options={[
              { label: 'Select customer account...', value: '' },
              ...customers.map((c) => ({
                label: `${c.name} (${c.phone}) ${c.outstandingBalance > 0 ? `[Pending: ${formatCurrencyINR(c.outstandingBalance)}]` : ''}`,
                value: c._id,
              })),
            ]}
          />
        </div>

        {/* Order Items Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Order Items ({items.length})
            </h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              disabled={isSubmitting}
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Product Line
            </Button>
          </div>

          <div className="space-y-2.5">
            {items.map((item, index) => {
              const itemTotal = (parseFloat(item.salesQuantity) || 0) * (parseFloat(item.unitPrice) || 0);

              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2"
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    {/* Product */}
                    <div className="md:col-span-5">
                      <Select
                        label={`Item #${index + 1} Product *`}
                        value={item.productId}
                        onChange={(e) => handleProductChange(item.id, e.target.value)}
                        error={fieldErrors[`item_${index}_product`]}
                        disabled={isSubmitting || isLoadingMasterData}
                        options={[
                          { label: 'Select product...', value: '' },
                          ...products.map((p) => ({
                            label: `${p.productName} (${p.gallaNumber}) — Ref: ${formatCurrencyINR(p.sellingPrice)}/box`,
                            value: p._id,
                          })),
                        ]}
                      />
                    </div>

                    {/* Sales Unit */}
                    <div className="md:col-span-2">
                      <Select
                        label="Unit *"
                        value={item.salesUnit}
                        onChange={(e) => handleUnitChange(item.id, e.target.value as SalesUnit)}
                        disabled={isSubmitting}
                        options={[
                          { label: 'BOX', value: 'BOX' },
                          { label: 'PIECE', value: 'PIECE' },
                          { label: 'SQ_FT', value: 'SQ_FT' },
                        ]}
                      />
                    </div>

                    {/* Quantity */}
                    <div className="md:col-span-2">
                      <Input
                        label="Quantity *"
                        type="number"
                        min={item.salesUnit === 'SQ_FT' ? '0.01' : '1'}
                        step={item.salesUnit === 'SQ_FT' ? '0.01' : '1'}
                        value={item.salesQuantity}
                        onChange={(e) => handleItemChange(item.id, 'salesQuantity', e.target.value)}
                        error={fieldErrors[`item_${index}_qty`]}
                        disabled={isSubmitting}
                        required
                      />
                    </div>

                    {/* Transaction Unit Price */}
                    <div className="md:col-span-2">
                      <Input
                        label="Unit Price (₹)"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Ref price"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)}
                        error={fieldErrors[`item_${index}_price`]}
                        disabled={isSubmitting}
                      />
                    </div>

                    {/* Actions */}
                    <div className="md:col-span-1 flex items-center justify-end pb-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={items.length <= 1 || isSubmitting}
                        className="h-9 w-9 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Line Total Preview */}
                  {itemTotal > 0 && (
                    <div className="text-right text-xs text-slate-600 font-mono">
                      Line Total Est: <span className="font-semibold text-slate-900">{formatCurrencyINR(itemTotal)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Estimated Order Summary */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2 text-xs text-slate-600">
            <Info className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <span>
              Authoritative order number (<span className="font-mono font-medium">GT-YYYYMMDD-XXXX</span>) and exact total amounts are generated atomically by the backend server.
            </span>
          </div>

          <div className="text-right whitespace-nowrap">
            <div className="text-xs text-slate-500 font-medium">Estimated Total Preview</div>
            <div className="text-xl font-bold font-mono text-slate-900">
              {formatCurrencyINR(estimatedSubtotal)}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || !selectedCustomerId}
          >
            {isSubmitting ? 'Creating Order...' : 'Confirm & Complete Sale'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
