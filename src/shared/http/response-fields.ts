type JsonRecord = Record<string, unknown>;

export function parseFieldsParam(value: unknown): string[] {
  if (typeof value !== 'string' || value.trim().length === 0) return [];

  return value
    .split(',')
    .map((field) => field.trim())
    .filter((field) => field.length > 0)
    .filter((field, index, arr) => arr.indexOf(field) === index);
}

function selectFromObject<T extends JsonRecord>(obj: T, fields: string[]): Partial<T> {
  if (fields.length === 0) return obj;

  const selected: Partial<T> = {};
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(obj, field)) {
      selected[field as keyof T] = obj[field as keyof T];
    }
  }
  return selected;
}

export function selectFields<T extends JsonRecord>(data: T | T[], fields: string[]): Partial<T> | Partial<T>[] {
  if (Array.isArray(data)) {
    return data.map((item) => selectFromObject(item, fields));
  }

  return selectFromObject(data, fields);
}
