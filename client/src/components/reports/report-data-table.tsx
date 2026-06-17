import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Search, Pencil, Trash2 } from "lucide-react";

export type ReportColumn<T> = {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  /** Hide on mobile card (e.g. internal IDs) */
  hideOnMobile?: boolean;
};

export type ReportRowActions<T> = {
  canManage: boolean;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  editLabel?: string;
  deleteLabel?: string;
};

function deepSearchMatch(row: Record<string, unknown>, query: string): boolean {
  const q = query.toLowerCase();
  const walk = (value: unknown): boolean => {
    if (value == null) return false;
    if (typeof value === "object") {
      if (Array.isArray(value)) return value.some(walk);
      return Object.values(value as Record<string, unknown>).some(walk);
    }
    return String(value).toLowerCase().includes(q);
  };
  return walk(row);
}

type Props<T extends Record<string, unknown>> = {
  columns: ReportColumn<T>[];
  rows: T[];
  searchKeys?: (keyof T | string)[];
  deepSearch?: boolean;
  rowActions?: ReportRowActions<T>;
  pageSize?: number;
  emptyMessage?: string;
};

export function ReportDataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  searchKeys,
  deepSearch = true,
  rowActions,
  pageSize = 15,
  emptyMessage = "No records found.",
}: Props<T>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const showActions = rowActions?.canManage && (rowActions.onEdit || rowActions.onDelete);
  const mobileColumns = columns.filter((c) => !c.hideOnMobile);

  const filtered = useMemo(() => {
    let list = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (deepSearch) {
        list = list.filter((row) => deepSearchMatch(row, q));
      } else {
        const keys = searchKeys ?? columns.map((c) => String(c.key));
        list = list.filter((row) =>
          keys.some((k) => String(row[k as keyof T] ?? "").toLowerCase().includes(q))
        );
      }
    }
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const av = String(a[sortKey as keyof T] ?? "");
        const bv = String(b[sortKey as keyof T] ?? "");
        const cmp = av.localeCompare(bv, undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [rows, search, sortKey, sortDir, searchKeys, columns, deepSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const renderActions = (row: T) => {
    if (!showActions) return null;
    return (
      <div className="flex items-center justify-end gap-1">
        {rowActions?.onEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => rowActions.onEdit?.(row)}
            aria-label={rowActions.editLabel ?? "Edit"}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ) : null}
        {rowActions?.onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => rowActions.onDelete?.(row)}
            aria-label={rowActions.deleteLabel ?? "Delete"}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="relative max-w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Deep search all fields…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className="pl-9 h-11"
        />
      </div>

      {/* Mobile: card layout */}
      <div className="space-y-3 md:hidden">
        {pageRows.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 text-sm">{emptyMessage}</div>
        ) : (
          pageRows.map((row, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
              {mobileColumns.map((col) => (
                <div key={String(col.key)} className="flex justify-between gap-3 text-sm">
                  <span className="text-muted-foreground shrink-0">{col.label}</span>
                  <span className="font-medium text-right break-words">
                    {col.render ? col.render(row) : String(row[col.key as keyof T] ?? "")}
                  </span>
                </div>
              ))}
              {showActions ? <div className="pt-2 border-t">{renderActions(row)}</div> : null}
            </div>
          ))
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={String(col.key)}
                  className={col.sortable !== false ? "cursor-pointer select-none" : ""}
                  onClick={() => col.sortable !== false && toggleSort(String(col.key))}
                >
                  {col.label}
                  {sortKey === col.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                </TableHead>
              ))}
              {showActions ? <TableHead className="w-[88px] text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (showActions ? 1 : 0)} className="text-center text-muted-foreground py-8">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={String(col.key)}>
                      {col.render ? col.render(row) : String(row[col.key as keyof T] ?? "")}
                    </TableCell>
                  ))}
                  {showActions ? <TableCell className="text-right">{renderActions(row)}</TableCell> : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {filtered.length > pageSize && (
        <div className="flex items-center justify-between text-sm gap-2">
          <span className="text-muted-foreground text-xs sm:text-sm">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-11 w-11" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-11 w-11" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
