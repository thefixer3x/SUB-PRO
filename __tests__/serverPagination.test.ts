import { chunks, readAllPages } from '../server/pagination';

describe('readAllPages', () => {
  it('continues through full PostgREST pages until the final short page', async () => {
    const calls: [number, number][] = [];
    const rows = await readAllPages<number>(async (from, to) => {
      calls.push([from, to]);
      const all = [0, 1, 2, 3, 4];
      return { data: all.slice(from, to + 1), error: null };
    }, 'test page', 2);

    expect(rows).toEqual([0, 1, 2, 3, 4]);
    expect(calls).toEqual([[0, 1], [2, 3], [4, 5], [5, 6]]);
  });

  it('stops when a full page is followed by an empty page', async () => {
    const rows = await readAllPages<number>(async (from) => ({
      data: from === 0 ? [1, 2] : [],
      error: null,
    }), 'test page', 2);
    expect(rows).toEqual([1, 2]);
  });

  it('continues when the server caps a page below the requested size', async () => {
    const all = [0, 1, 2, 3, 4, 5];
    const rows = await readAllPages<number>(async (from) => ({
      data: all.slice(from, from + 2),
      error: null,
    }), 'server-capped page', 5);
    expect(rows).toEqual(all);
  });

  it('throws a contextual error instead of silently truncating', async () => {
    await expect(readAllPages<number>(async () => ({
      data: null,
      error: { message: 'connection lost' },
    }), 'list envelopes', 2)).rejects.toThrow('list envelopes: connection lost');
  });
});

describe('chunks', () => {
  it('splits long filter lists into bounded groups', () => {
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunks([], 2)).toEqual([]);
  });
});
