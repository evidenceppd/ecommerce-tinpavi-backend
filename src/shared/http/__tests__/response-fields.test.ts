import { describe, expect, it } from 'vitest';

import { parseFieldsParam, selectFields } from '../response-fields';

describe('response field selection', () => {
  it('parses and deduplicates fields query parameter', () => {
    expect(parseFieldsParam('id,title,title, code ')).toEqual(['id', 'title', 'code']);
  });

  it('selects object keys when fields are provided', () => {
    const result = selectFields({ id: 'p1', title: 'Product', pricing: 10 }, ['id', 'pricing']);
    expect(result).toEqual({ id: 'p1', pricing: 10 });
  });

  it('selects array keys for each item', () => {
    const result = selectFields(
      [
        { id: 'a', title: 'A', hidden: true },
        { id: 'b', title: 'B', hidden: false },
      ],
      ['id', 'title'],
    );

    expect(result).toEqual([
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
    ]);
  });

  it('returns original payload when fields are empty', () => {
    const payload = { id: 'x', title: 'No filter' };
    expect(selectFields(payload, [])).toEqual(payload);
  });
});
