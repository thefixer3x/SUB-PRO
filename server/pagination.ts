/** PostgREST caps each response; fetch stable ordered pages until exhausted. */

export interface QueryPage<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export async function readAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<QueryPage<T>>,
  context: string,
  pageSize = 500,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError('pageSize must be a positive integer');
  }

  const rows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(`${context}: ${error.message}`);
    const page = data ?? [];
    if (page.length === 0) return rows;
    rows.push(...page);
    // Advance by the returned count, not the requested count: PostgREST may
    // enforce a project max_rows limit smaller than pageSize.
    from += page.length;
  }
}

export function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    result.push(values.slice(i, i + size));
  }
  return result;
}
