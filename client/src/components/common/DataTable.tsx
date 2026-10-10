import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { TableSkeleton } from './Skeletons';
import { EmptyState } from './EmptyState';
import { cn } from '../../lib/utils';
import type { PaginationMeta } from '../../types/models';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data?: T[];
  isLoading?: boolean;
  meta?: PaginationMeta;
  onPageChange?: (page: number) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

export function DataTable<T extends { id?: string; _id?: string }>({
  columns,
  data = [],
  isLoading = false,
  meta,
  onPageChange,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items to display matching the criteria.',
  className,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <TableSkeleton rows={5} columns={columns.length} />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className={cn('rounded-2xl border border-border/70 bg-card shadow-xs overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-muted/40 text-muted-foreground text-[11px] font-bold uppercase tracking-wider border-b border-border/60">
            <tr>
              {columns.map((col, index) => (
                <th
                  key={index}
                  scope="col"
                  className={cn('px-4 py-3.5 font-bold', col.className)}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {data.map((row, rowIndex) => {
              const rowKey = row.id || row._id || String(rowIndex);
              return (
                <tr
                  key={rowKey}
                  className="hover:bg-muted/30 transition-colors"
                >
                  {columns.map((col, colIndex) => (
                    <td
                      key={colIndex}
                      className={cn('px-4 py-3 align-middle', col.className)}
                    >
                      {col.cell
                        ? col.cell(row)
                        : col.accessorKey
                        ? (row[col.accessorKey] as React.ReactNode)
                        : null}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {meta && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-border bg-card/60">
          <p className="text-xs text-muted-foreground">
            Showing Page <span className="font-semibold">{meta.page}</span> of{' '}
            <span className="font-semibold">{meta.totalPages}</span> (
            {meta.total} total items)
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => onPageChange && onPageChange(meta.page - 1)}
              className="gap-1 h-8 px-2 text-xs"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => onPageChange && onPageChange(meta.page + 1)}
              className="gap-1 h-8 px-2 text-xs"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
