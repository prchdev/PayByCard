import { useState, useMemo, useCallback } from 'react';
import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

export function useTableSort<T>(
  data: T[],
  accessor: (item: T, key: string) => string | number | null | undefined,
) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const handleSort = useCallback((key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  }, []);

  const sortedData = useMemo(() => {
    if (!sortConfig) return data;
    return [...data].sort((a, b) => {
      const aVal = accessor(a, sortConfig.key);
      const bVal = accessor(b, sortConfig.key);
      const aEmpty = aVal == null || aVal === '';
      const bEmpty = bVal == null || bVal === '';
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return sortConfig.direction === 'asc' ? -1 : 1;
      if (bEmpty) return sortConfig.direction === 'asc' ? 1 : -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig, accessor]);

  return { sortedData, sortConfig, handleSort };
}

interface SortableThProps {
  label: string;
  sortKey: string;
  sortConfig: SortConfig | null;
  onSort: (key: string) => void;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export function SortableTh({
  label,
  sortKey,
  sortConfig,
  onSort,
  className = '',
  align = 'left',
}: SortableThProps) {
  const isActive = sortConfig?.key === sortKey;
  const justify =
    align === 'center'
      ? 'justify-center'
      : align === 'right'
        ? 'justify-end'
        : 'justify-start';

  return (
    <th
      className={`cursor-pointer select-none hover:bg-black/5 transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className={`inline-flex items-center gap-1 ${justify}`}>
        <span>{label}</span>
        {isActive ? (
          sortConfig!.direction === 'asc' ? (
            <ArrowUp className="w-3 h-3 flex-shrink-0" />
          ) : (
            <ArrowDown className="w-3 h-3 flex-shrink-0" />
          )
        ) : (
          <ChevronsUpDown className="w-3 h-3 flex-shrink-0 opacity-30" />
        )}
      </div>
    </th>
  );
}
