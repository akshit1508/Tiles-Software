import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from '@/components/ui';
import { CustomerListItem, customersApi } from '@/lib/api/customers';
import { ApiError } from '@/lib/api';
import { AlertCircle } from 'lucide-react';

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customer?: CustomerListItem | null;
}

interface FormState {
  name: string;
  phone: string;
  address: string;
}

const initialFormState: FormState = {
  name: '',
  phone: '',
  address: '',
};

export function CustomerFormModal({
  isOpen,
  onClose,
  onSuccess,
  customer,
}: CustomerFormModalProps) {
  const isEdit = !!customer;
  const [form, setForm] = useState<FormState>(initialFormState);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (customer) {
        setForm({
          name: customer.name,
          phone: customer.phone,
          address: customer.address || '',
        });
      } else {
        setForm(initialFormState);
      }
      setFieldErrors({});
      setServerError(null);
    }
  }, [isOpen, customer]);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const errors: Partial<Record<keyof FormState, string>> = {};

    if (!form.name.trim()) {
      errors.name = 'Customer name is required';
    }

    if (!form.phone.trim()) {
      errors.phone = 'Phone number is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    try {
      setIsSubmitting(true);

      if (isEdit && customer) {
        await customersApi.update(customer._id, {
          name: form.name.trim(),
          phone: form.phone.trim(),
          address: form.address.trim() || undefined,
        });
      } else {
        await customersApi.create({
          name: form.name.trim(),
          phone: form.phone.trim(),
          address: form.address.trim() || undefined,
        });
      }

      onSuccess();
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
          setServerError(err.message || 'Failed to save customer. Please try again.');
        }
      } else if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Customer' : 'Register New Customer'}
      description={
        isEdit
          ? `Update profile information for ${customer?.name}`
          : 'Create a new customer master account for order management'
      }
      size="md"
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

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            label="Customer Full Name *"
            placeholder="e.g. Ramesh Kumar Patel"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            error={fieldErrors.name}
            disabled={isSubmitting}
            required
          />
        </div>

        <div>
          <Input
            label="Phone Number *"
            placeholder="e.g. 9876543210"
            value={form.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            error={fieldErrors.phone}
            helperText="Primary contact number for order notifications and invoices"
            disabled={isSubmitting}
            required
          />
        </div>

        <div>
          <label
            htmlFor="customer-address"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Delivery / Billing Address (Optional)
          </label>
          <textarea
            id="customer-address"
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50"
            placeholder="e.g. Plot No. 12, Shubham Enclave, Near Civil Lines, Kota, Rajasthan"
            value={form.address}
            onChange={(e) => handleChange('address', e.target.value)}
            disabled={isSubmitting}
          />
        </div>

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
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Customer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
