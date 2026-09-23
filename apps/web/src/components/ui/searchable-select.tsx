'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, X, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  tag?: string;
  searchTerms?: string[];
}

export interface SearchableSelectProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  emptyText?: string;
  error?: string;
  className?: string;
  helperText?: string;
  maxVisibleOptions?: number;
}

export const SearchableSelect = React.forwardRef<HTMLInputElement, SearchableSelectProps>(
  (
    {
      id,
      label,
      value,
      onChange,
      options,
      placeholder = 'Search...',
      disabled = false,
      isLoading = false,
      loadingText = 'Loading options...',
      emptyText = 'No matching results found',
      error,
      className,
      helperText,
      maxVisibleOptions = 15,
    },
    ref,
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'searchable-select');
    const containerRef = useRef<HTMLDivElement>(null);
    const internalInputRef = useRef<HTMLInputElement>(null);

    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    // Find the currently selected option
    const selectedOption = useMemo(() => {
      return options.find((opt) => opt.value === value) || null;
    }, [options, value]);

    // Keep display text synchronized with selectedOption
    useEffect(() => {
      if (selectedOption) {
        setSearchQuery(selectedOption.label);
      } else if (!value) {
        setSearchQuery('');
      }
    }, [selectedOption, value]);

    // Close dropdown on outside click
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setIsOpen(false);
          setHighlightedIndex(-1);
          if (selectedOption) {
            setSearchQuery(selectedOption.label);
          } else {
            setSearchQuery('');
          }
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [selectedOption]);

    // Filter options based on typed search query
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const isActivelySearching = isOpen && (!selectedOption || normalizedQuery !== selectedOption.label.toLowerCase());

    const filteredOptions = useMemo(() => {
      if (!isActivelySearching || !normalizedQuery) {
        return options;
      }

      return options.filter((opt) => {
        if (opt.label.toLowerCase().includes(normalizedQuery)) return true;
        if (opt.value.toLowerCase().includes(normalizedQuery)) return true;
        if (opt.sublabel && opt.sublabel.toLowerCase().includes(normalizedQuery)) return true;
        if (opt.tag && opt.tag.toLowerCase().includes(normalizedQuery)) return true;
        if (opt.searchTerms && opt.searchTerms.some((term) => term.toLowerCase().includes(normalizedQuery))) {
          return true;
        }
        return false;
      });
    }, [isActivelySearching, normalizedQuery, options]);

    // Top visible options when not searching to avoid rendering an overwhelming list
    const visibleOptions = useMemo(() => {
      if (!isActivelySearching && maxVisibleOptions && options.length > maxVisibleOptions) {
        return options.slice(0, maxVisibleOptions);
      }
      return filteredOptions;
    }, [filteredOptions, isActivelySearching, maxVisibleOptions, options]);

    const handleSelectOption = (opt: SearchableSelectOption) => {
      onChange(opt.value);
      setSearchQuery(opt.label);
      setIsOpen(false);
      setHighlightedIndex(-1);
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange('');
      setSearchQuery('');
      setIsOpen(false);
      setHighlightedIndex(-1);
      const inputEl = (ref && 'current' in ref && ref.current) || internalInputRef.current;
      inputEl?.focus();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;

      // Direct programmatic or value match (e.g. testing with fireEvent.change(..., { target: { value: 'cust-1' } }))
      const directOptionMatch = options.find((opt) => opt.value === val);
      if (directOptionMatch) {
        handleSelectOption(directOptionMatch);
        return;
      }

      if (!val) {
        onChange('');
        setSearchQuery('');
        setIsOpen(true);
        setHighlightedIndex(-1);
        return;
      }

      setSearchQuery(val);
      setIsOpen(true);
      setHighlightedIndex(0);
    };

    const handleInputFocus = () => {
      if (!disabled && !isLoading) {
        setIsOpen(true);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled || isLoading) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setHighlightedIndex(0);
        } else {
          setHighlightedIndex((prev) => (prev < visibleOptions.length - 1 ? prev + 1 : 0));
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setHighlightedIndex(visibleOptions.length - 1);
        } else {
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : visibleOptions.length - 1));
        }
      } else if (e.key === 'Enter') {
        if (isOpen && visibleOptions.length > 0) {
          e.preventDefault();
          const targetIndex = highlightedIndex >= 0 && highlightedIndex < visibleOptions.length ? highlightedIndex : 0;
          handleSelectOption(visibleOptions[targetIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        if (selectedOption) {
          setSearchQuery(selectedOption.label);
        }
      }
    };

    const hasValue = Boolean(value || (selectedOption && searchQuery));

    return (
      <div ref={containerRef} className={cn('relative w-full space-y-1.5', className)}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400" />

          <input
            ref={(node) => {
              // Assign internal ref
              (internalInputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
              // Forward ref if provided
              if (typeof ref === 'function') {
                ref(node);
              } else if (ref) {
                (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
              }
            }}
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            aria-controls={`${inputId}-listbox`}
            value={searchQuery}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onClick={() => !isOpen && !disabled && !isLoading && setIsOpen(true)}
            onKeyDown={handleKeyDown}
            disabled={disabled || isLoading}
            placeholder={isLoading ? loadingText : placeholder}
            autoComplete="off"
            className={cn(
              'w-full rounded-lg border bg-white py-2 pl-9 pr-16 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
              error
                ? 'border-red-400 focus:border-red-500 focus:ring-red-400'
                : 'border-slate-300 hover:border-slate-400 focus:border-blue-600 focus:ring-blue-500/20',
            )}
          />

          <div className="absolute right-2 flex items-center gap-1">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400 mr-1" />
            ) : (
              <>
                {hasValue && !disabled && (
                  <button
                    type="button"
                    onClick={handleClear}
                    aria-label="Clear selection"
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Toggle dropdown"
                  onClick={() => !disabled && !isLoading && setIsOpen((prev) => !prev)}
                  className="rounded p-1 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  <ChevronDown
                    className={cn('h-4 w-4 transition-transform duration-200', isOpen && 'rotate-180')}
                  />
                </button>
              </>
            )}
          </div>
        </div>

        {error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-slate-500">{helperText}</p>
        ) : null}

        {/* Dropdown Options Popup */}
        {isOpen && !disabled && !isLoading && (
          <div
            id={`${inputId}-listbox`}
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-black/5"
          >
            {visibleOptions.length === 0 ? (
              <div className="px-4 py-3 text-center text-sm text-slate-500">
                {emptyText}
              </div>
            ) : (
              visibleOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelectOption(opt)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between px-3.5 py-2 text-sm transition-colors',
                      isSelected && 'bg-blue-50 font-medium text-blue-900',
                      isHighlighted && !isSelected && 'bg-slate-100/80 text-slate-900',
                      !isSelected && !isHighlighted && 'text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="truncate font-medium text-slate-900">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="truncate text-xs text-slate-500">{opt.sublabel}</span>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {opt.tag && (
                        <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
                          {opt.tag}
                        </span>
                      )}
                      {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                    </div>
                  </div>
                );
              })
            )}

            {!isActivelySearching && options.length > visibleOptions.length && (
              <div className="border-t border-slate-100 bg-slate-50/70 px-3 py-1.5 text-center text-[11px] text-slate-500">
                Showing top {visibleOptions.length} of {options.length}. Type to search all...
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);

SearchableSelect.displayName = 'SearchableSelect';
