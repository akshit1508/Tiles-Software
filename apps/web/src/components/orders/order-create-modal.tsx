import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Select, Badge, SearchableSelect } from '@/components/ui';
import { CustomerListItem, customersApi } from '@/lib/api/customers';
import { Product, productsApi, parseDecimalValue, formatCurrencyINR } from '@/lib/api/products';
import { CreateOrderInput, ordersApi, Order } from '@/lib/api/orders';
import { PaymentMethod } from '@/lib/api/payments';
import { ApiError } from '@/lib/api';
import { Plus, Trash2, AlertCircle, ShoppingCart, CreditCard, Check, ArrowRight } from 'lucide-react';

interface OrderCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdOrder: Order) => void;
}

interface FormItem {
  id: string; // client-side unique id for key
  productId: string;
  quantityBoxes: string;
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
      quantityBoxes: '1',
      unitPrice: '',
    },
  ]);

  // Payment section state
  const [paidNow, setPaidNow] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

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
          quantityBoxes: '1',
          unitPrice: '',
        },
      ]);
      setPaidNow('0');
      setPaymentMethod('CASH');
      setPaymentNotes('');

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
          defaultPrice = sellingBox.toString();
        }
        return {
          ...item,
          productId: newProductId,
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
        quantityBoxes: '1',
        unitPrice: '',
      },
    ]);
  };

  const handleRemoveItem = (itemId: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  // Live estimated order total
  const estimatedTotal = items.reduce((sum, item) => {
    const boxes = parseInt(item.quantityBoxes, 10) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    return sum + boxes * price;
  }, 0);

  const parsedPaidNow = parseFloat(paidNow) || 0;
  const liveOutstanding = Math.max(0, estimatedTotal - parsedPaidNow);

  // Derived payment status preview
  let livePaymentStatus: 'PAID' | 'PARTIALLY PAID' | 'UNPAID' = 'UNPAID';
  if (estimatedTotal > 0 && parsedPaidNow >= estimatedTotal) {
    livePaymentStatus = 'PAID';
  } else if (parsedPaidNow > 0) {
    livePaymentStatus = 'PARTIALLY PAID';
  }

  const handlePaidFull = () => {
    setPaidNow(estimatedTotal.toString());
    setFieldErrors((prev) => ({ ...prev, paidNow: '' }));
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!selectedCustomerId) {
      errors.customerId = 'Please select a customer';
    }

    if (items.length === 0) {
      errors.items = 'Sale must contain at least one tile product';
    }

    items.forEach((item, index) => {
      if (!item.productId) {
        errors[`item_${index}_product`] = 'Product is required';
      }

      const boxes = parseInt(item.quantityBoxes, 10);
      if (isNaN(boxes) || boxes <= 0) {
        errors[`item_${index}_qty`] = 'Quantity must be at least 1 box';
      } else if (!Number.isInteger(parseFloat(item.quantityBoxes))) {
        errors[`item_${index}_qty`] = 'Quantity in boxes must be an integer';
      }

      if (item.unitPrice.trim() !== '') {
        const price = parseFloat(item.unitPrice);
        if (isNaN(price) || price < 0) {
          errors[`item_${index}_price`] = 'Price cannot be negative';
        }
      }
    });

    const paidNum = parseFloat(paidNow);
    if (isNaN(paidNum) || paidNum < 0) {
      errors.paidNow = 'Paid Now cannot be negative';
    } else if (paidNum > estimatedTotal && estimatedTotal > 0) {
      errors.paidNow = `Payment cannot exceed order total (₹${estimatedTotal.toLocaleString('en-IN')})`;
    }

    if (paidNum > 0 && !paymentMethod) {
      errors.paymentMethod = 'Please select a payment method for the initial payment';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (isSubmitting) return; // Prevent double submission
    if (!validate()) return;

    try {
      setIsSubmitting(true);

      const paidNum = parseFloat(paidNow) || 0;

      const orderPayload: CreateOrderInput = {
        customerId: selectedCustomerId,
        items: items.map((item) => ({
          productId: item.productId,
          quantityBoxes: parseInt(item.quantityBoxes, 10),
          salesUnit: 'BOX',
          unitPrice: item.unitPrice.trim() !== '' ? parseFloat(item.unitPrice) : undefined,
        })),
        initialPayment:
          paidNum > 0
            ? {
                amount: Math.round(paidNum * 100) / 100,
                paymentMethod,
                notes: paymentNotes.trim() || undefined,
              }
            : undefined,
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
          setServerError(err.message || 'Failed to create sale. Please check box inventory availability.');
        }
      } else if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError('An unexpected error occurred while processing the sale.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Sale (Combined Order & Payment)"
      description="Create a box-only tile sale, atomically deduct inventory, and record any initial payment at sale."
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Customer Section */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            Customer Details
          </h4>
          <SearchableSelect
            label="Select Customer *"
            value={selectedCustomerId}
            onChange={(val) => {
              setSelectedCustomerId(val);
              setFieldErrors((prev) => ({ ...prev, customerId: '' }));
            }}
            error={fieldErrors.customerId}
            disabled={isSubmitting || isLoadingMasterData}
            isLoading={isLoadingMasterData}
            loadingText="Loading customers..."
            placeholder="Search customer by name or phone..."
            emptyText="No matching customers found"
            options={customers.map((c) => ({
              value: c._id,
              label: c.name,
              sublabel: c.phone,
              tag: c.outstandingBalance > 0 ? `Pending: ${formatCurrencyINR(c.outstandingBalance)}` : undefined,
              searchTerms: [c.name, c.phone, c.address || ''],
            }))}
          />
        </div>

        {/* 2. Items Section (BOX-ONLY) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <ShoppingCart className="h-4 w-4 text-slate-500" />
              Tile Products (Boxes Only) — {items.length} {items.length === 1 ? 'Item' : 'Items'}
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
              Add Product
            </Button>
          </div>

          <div className="space-y-2.5">
            {items.map((item, index) => {
              const boxes = parseInt(item.quantityBoxes, 10) || 0;
              const price = parseFloat(item.unitPrice) || 0;
              const itemTotal = boxes * price;

              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2"
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    {/* Product */}
                    <div className="md:col-span-6">
                      <Select
                        label={`Product #${index + 1} *`}
                        value={item.productId}
                        onChange={(e) => handleProductChange(item.id, e.target.value)}
                        error={fieldErrors[`item_${index}_product`]}
                        disabled={isSubmitting || isLoadingMasterData}
                        options={[
                          { label: 'Select tile product...', value: '' },
                          ...products.map((p) => ({
                            label: `${p.productName} (${p.brand} - ${p.gallaNumber}) [${formatCurrencyINR(p.sellingPrice)}/box]`,
                            value: p._id,
                          })),
                        ]}
                      />
                    </div>

                    {/* Quantity in BOXES */}
                    <div className="md:col-span-3">
                      <Input
                        label="Quantity (BOXES) *"
                        type="number"
                        min="1"
                        step="1"
                        placeholder="e.g. 20"
                        value={item.quantityBoxes}
                        onChange={(e) => handleItemChange(item.id, 'quantityBoxes', e.target.value)}
                        error={fieldErrors[`item_${index}_qty`]}
                        disabled={isSubmitting}
                        required
                      />
                    </div>

                    {/* Unit Price (₹ / BOX) */}
                    <div className="md:col-span-2">
                      <Input
                        label="Price (₹ / BOX)"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Price/box"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)}
                        error={fieldErrors[`item_${index}_price`]}
                        disabled={isSubmitting}
                      />
                    </div>

                    {/* Delete Item */}
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

                  {/* Line Total */}
                  {itemTotal > 0 && (
                    <div className="text-right text-xs font-mono text-slate-600">
                      Line Total: <span className="font-bold text-slate-900">{formatCurrencyINR(itemTotal)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Order Summary & Totals */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between shadow-xs">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Order Total</div>
            <div className="text-xs text-slate-400">Calculated from box quantities & unit prices</div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {formatCurrencyINR(estimatedTotal)}
          </div>
        </div>

        {/* 4. PAYMENT AT SALE (Initial Payment Section) */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-blue-100 pb-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900">
                Payment at Sale
              </h4>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Status:</span>
              <Badge
                variant={
                  livePaymentStatus === 'PAID'
                    ? 'success'
                    : livePaymentStatus === 'PARTIALLY PAID'
                      ? 'warning'
                      : 'neutral'
                }
                size="sm"
              >
                {livePaymentStatus}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            {/* Paid Now */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="paid-now-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Paid Now (₹)
                </label>
                {estimatedTotal > 0 && (
                  <button
                    type="button"
                    onClick={handlePaidFull}
                    disabled={isSubmitting}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Paid Full
                  </button>
                )}
              </div>
              <Input
                id="paid-now-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={paidNow}
                onChange={(e) => {
                  setPaidNow(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, paidNow: '' }));
                }}
                error={fieldErrors.paidNow}
                disabled={isSubmitting}
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Enter ₹0 for Unpaid / Credit sale.
              </p>
            </div>

            {/* Payment Method */}
            <div>
              <Select
                label={`Payment Method ${parsedPaidNow > 0 ? '*' : '(Optional)'}`}
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value as PaymentMethod);
                  setFieldErrors((prev) => ({ ...prev, paymentMethod: '' }));
                }}
                error={fieldErrors.paymentMethod}
                disabled={isSubmitting || parsedPaidNow === 0}
                options={[
                  { label: 'Cash', value: 'CASH' },
                  { label: 'UPI', value: 'UPI' },
                  { label: 'Bank Transfer', value: 'BANK_TRANSFER' },
                  { label: 'Cheque', value: 'CHEQUE' },
                ]}
              />
              {parsedPaidNow === 0 && (
                <p className="text-[11px] text-slate-400 mt-1">Not required for credit sale.</p>
              )}
            </div>

            {/* Remaining Outstanding Display */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Remaining Outstanding
              </div>
              <div
                className={`mt-1 font-mono text-xl font-bold ${
                  liveOutstanding > 0 ? 'text-amber-800' : 'text-emerald-700'
                }`}
              >
                {formatCurrencyINR(liveOutstanding)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {liveOutstanding > 0 ? 'To be collected later' : 'Fully settled'}
              </div>
            </div>
          </div>

          {/* Payment Notes */}
          {parsedPaidNow > 0 && (
            <div>
              <Input
                label="Payment Notes / Transaction Reference (Optional)"
                placeholder="e.g. UPI ref #, Cash received by owner, Cheque number"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
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
            {isSubmitting ? 'Creating Sale...' : 'Create Sale'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
