export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function parsePagination(
  query: Record<string, unknown>,
  maxLimit = 100,
): { page: number; limit: number } {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || 20));
  return { page, limit };
}

export function paginateArray<T>(items: T[], page: number, limit: number): { data: T[]; pagination: PaginationMeta } {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;
  return {
    data: items.slice(start, start + limit),
    pagination: { page: safePage, limit, total, totalPages },
  };
}

export function paginationOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}
