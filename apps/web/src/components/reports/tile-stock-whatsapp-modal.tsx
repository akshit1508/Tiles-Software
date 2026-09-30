'use client';

import React, { useState, useEffect, useId } from 'react';
import {
  Modal,
  Button,
  Badge,
} from '@/components/ui';
import { CustomerListItem, customersApi } from '@/lib/api/customers';
import { TileStockReportResponse, reportsApi } from '@/lib/api/reports';
import {
  normalizeWhatsAppPhone,
  generateTileStockWhatsAppMessage,
  buildWhatsAppChatUrl,
} from '@/lib/whatsapp';
import {
  Send,
  Loader2,
  AlertCircle,
  Search,
  User,
  Phone,
  Sparkles,
  FileDown,
  Info,
} from 'lucide-react';

interface TileStockWhatsappModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: TileStockReportResponse;
  availableOnly: boolean;
  onSuccess: (customerName: string, filename: string) => void;
}

export function TileStockWhatsappModal({
  isOpen,
  onClose,
  reportData,
  availableOnly,
  onSuccess,
}: TileStockWhatsappModalProps) {
  const searchInputId = useId();
  const messageInputId = useId();

  // Search & Customers state
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerListItem | null>(null);

  // Message state
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // PDF + WhatsApp sending state
  const [isSending, setIsSending] = useState(false);

  const cleanSize = reportData.filterSize.replace(/\*/g, ' × ');

  // Reset state and load customers when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedCustomer(null);
      setErrorMessage(null);
      setIsSending(false);
      loadCustomers('');

      const defaultMsg = generateTileStockWhatsAppMessage({
        customerName: 'Customer',
        size: reportData.filterSize,
        totalDesigns: reportData.summary.totalDesigns,
        totalBoxes: reportData.summary.totalAvailableBoxes,
      });
      setMessage(defaultMsg);
    }
  }, [isOpen, reportData.filterSize, reportData.summary.totalDesigns, reportData.summary.totalAvailableBoxes]);

  // When customer changes, update message recipient greeting
  const handleSelectCustomer = (customer: CustomerListItem) => {
    setSelectedCustomer(customer);
    setErrorMessage(null);
    const updatedMsg = generateTileStockWhatsAppMessage({
      customerName: customer.name,
      size: reportData.filterSize,
      totalDesigns: reportData.summary.totalDesigns,
      totalBoxes: reportData.summary.totalAvailableBoxes,
    });
    setMessage(updatedMsg);
  };

  // Load customers with search
  const loadCustomers = async (search: string) => {
    try {
      setIsLoadingCustomers(true);
      const res = await customersApi.list({
        search: search.trim() || undefined,
        limit: 10,
        isActive: true,
      });
      setCustomers(res.data || []);
    } catch {
      // Non-blocking fallback
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    loadCustomers(val);
  };

  /**
   * Main action: generate PDF → save to device → open WhatsApp with pre-filled message.
   * All three happen in one click. Customer just attaches the saved PDF in WhatsApp.
   */
  const handleSendOnWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomer) {
      setErrorMessage('Please select a customer recipient.');
      return;
    }

    const phoneResult = normalizeWhatsAppPhone(selectedCustomer.phone);
    if (!phoneResult.normalized) {
      setErrorMessage(
        phoneResult.error ||
          `Customer "${selectedCustomer.name}" does not have a valid mobile number for WhatsApp.`,
      );
      return;
    }

    if (!message.trim()) {
      setErrorMessage('Message cannot be empty.');
      return;
    }

    setIsSending(true);
    setErrorMessage(null);

    let filename = `Goverdhan_Stock_${reportData.filterSize.replace(/[*×]/g, 'x')}.pdf`;

    try {
      // Step 1: Fetch PDF from backend as a blob
      const result = await reportsApi.fetchTileStockPdfBlob(
        reportData.filterSize,
        availableOnly,
      );
      filename = result.filename;

      // Step 2: Trigger browser download of the PDF
      const downloadUrl = window.URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      // Step 3: Open WhatsApp with pre-filled message in a new tab
      // (slight delay so download dialog isn't interrupted by popup)
      await new Promise((resolve) => setTimeout(resolve, 400));
      const waUrl = buildWhatsAppChatUrl(phoneResult.normalized!, message);
      window.open(waUrl, '_blank', 'noopener,noreferrer');

      // Notify parent
      onSuccess(selectedCustomer.name, filename);
      onClose();
    } catch {
      setErrorMessage(
        'Failed to generate the PDF report. Please check your connection and try again.',
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Send Tile Stock Report on WhatsApp"
      size="md"
    >
      <form onSubmit={handleSendOnWhatsApp} className="space-y-4">
        {/* Error message banner */}
        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Info banner explaining the flow */}
        <div className="flex items-start gap-2.5 rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-700">
          <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">How it works: </span>
            The PDF will be saved to your device and WhatsApp will open with the message pre-filled.
            Attach the saved PDF in WhatsApp and press Send.
          </div>
        </div>

        {/* Report summary preview card */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-blue-500" />
            Report to be sent
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="text-slate-400 block text-[10px]">Catalogue Size</span>
              <span className="font-semibold text-slate-800 text-sm">{cleanSize}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Total Designs</span>
              <span className="font-semibold text-slate-800 text-sm">
                {reportData.summary.totalDesigns} Models
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Available Stock</span>
              <span className="font-semibold text-emerald-700 text-sm">
                {reportData.summary.totalAvailableBoxes} Boxes
              </span>
            </div>
          </div>
        </div>

        {/* Customer Selection Section */}
        <div>
          <label
            htmlFor={searchInputId}
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Select Customer Recipient <span className="text-red-500">*</span>
          </label>

          {!selectedCustomer ? (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id={searchInputId}
                  type="text"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  placeholder="Search customer by name or phone..."
                  className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                {isLoadingCustomers && (
                  <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-slate-400" />
                )}
              </div>

              {/* Customer results list */}
              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 shadow-xs">
                {customers.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400">
                    {isLoadingCustomers
                      ? 'Loading customers...'
                      : 'No active customers found matching your search.'}
                  </div>
                ) : (
                  customers.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => handleSelectCustomer(c)}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600">
                          <User className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-900">
                            {c.name}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Phone className="h-3 w-3 text-slate-400" />
                            {c.phone || 'No phone number'}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        Select
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Selected customer summary card */
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
                  {selectedCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    {selectedCustomer.name}
                    <Badge variant="success" size="sm">
                      Selected
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-600 flex items-center gap-1.5 mt-0.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>{selectedCustomer.phone}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline px-2 py-1"
              >
                Change
              </button>
            </div>
          )}
        </div>

        {/* Message / Caption Input */}
        <div>
          <label
            htmlFor={messageInputId}
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Pre-filled WhatsApp Message
          </label>
          <textarea
            id={messageInputId}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            maxLength={600}
            className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none font-mono"
            placeholder="Type your message here..."
          />
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>Edit the message before sending if needed.</span>
            <span>{message.length}/600</span>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSending}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            size="sm"
            disabled={!selectedCustomer || isSending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium min-w-[160px]"
          >
            {isSending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Preparing PDF...
              </>
            ) : (
              <>
                <FileDown className="h-3.5 w-3.5 mr-1.5" />
                Save PDF &amp; Open WhatsApp
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
