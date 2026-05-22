import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockFindAll,
  mockFindPaginated,
  mockCreate,
  mockFindById,
  mockUpdate,
  mockDelete,
  mockFindAllActive,
  mockSafeGet,
  mockSafeSet,
  mockDelByPrefix,
} = vi.hoisted(() => ({
  mockFindAll: vi.fn(),
  mockFindPaginated: vi.fn(),
  mockCreate: vi.fn(),
  mockFindById: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockFindAllActive: vi.fn(),
  mockSafeGet: vi.fn(),
  mockSafeSet: vi.fn(),
  mockDelByPrefix: vi.fn(),
}));

vi.mock('@/shared/infra/memory-cache', () => ({
  cache: {
    safeGet: mockSafeGet,
    safeSet: mockSafeSet,
    delByPrefix: mockDelByPrefix,
    setNX: vi.fn(),
  },
}));

vi.mock('../seo.repository', () => ({
  SeoRepository: class SeoRepository {
    findAll = mockFindAll;
    findPaginated = mockFindPaginated;
    create = mockCreate;
    findById = mockFindById;
    update = mockUpdate;
    delete = mockDelete;
    findAllActive = mockFindAllActive;
  },
}));

import { RedirectsService } from '../redirects.service';

describe('RedirectsService', () => {
  let service: RedirectsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RedirectsService();
  });

  it('creates redirect and invalidates cache', async () => {
    mockCreate.mockResolvedValue({ id: 'r1', fromPath: '/old', toPath: '/new' });
    mockDelByPrefix.mockImplementation(() => 1);

    const result = await service.create({ fromPath: '/old', toPath: '/new', type: 301 } as any);

    expect(result).toMatchObject({ id: 'r1' });
    expect(mockDelByPrefix).toHaveBeenCalledWith('seo:');
  });

  it('throws REDIRECT_NOT_FOUND on update when redirect does not exist', async () => {
    mockFindById.mockResolvedValue(null);
    await expect(service.update('missing', { toPath: '/x' } as any)).rejects.toThrow('REDIRECT_NOT_FOUND');
  });

  it('updates redirect and invalidates cache', async () => {
    mockFindById.mockResolvedValue({ id: 'r1' });
    mockUpdate.mockResolvedValue({ id: 'r1', toPath: '/new' });

    const result = await service.update('r1', { toPath: '/new' } as any);

    expect(result).toMatchObject({ id: 'r1', toPath: '/new' });
    expect(mockDelByPrefix).toHaveBeenCalledWith('seo:');
  });

  it('throws REDIRECT_NOT_FOUND on delete when redirect does not exist', async () => {
    mockFindById.mockResolvedValue(null);
    await expect(service.delete('missing')).rejects.toThrow('REDIRECT_NOT_FOUND');
  });

  it('returns redirect map from cache when available', async () => {
    mockSafeGet.mockReturnValue([{ fromPath: '/a', toPath: '/b' }]);

    const map = await service.getActiveRedirectMap();

    expect(map.get('/a')).toBe('/b');
    expect(mockFindAllActive).not.toHaveBeenCalled();
  });

  it('invalidates malformed cache and rebuilds redirect map from repository', async () => {
    mockSafeGet.mockReturnValue(null);
    mockFindAllActive.mockResolvedValue([{ fromPath: '/legacy', toPath: '/novo' }]);
    mockSafeSet.mockImplementation(() => true);

    const map = await service.getActiveRedirectMap();

    expect(map.get('/legacy')).toBe('/novo');
    expect(mockSafeSet).toHaveBeenCalled();
  });

  it('builds redirect map from repository and stores in cache when miss', async () => {
    mockSafeGet.mockReturnValue(null);
    mockFindAllActive.mockResolvedValue([{ fromPath: '/legacy', toPath: '/novo' }]);
    mockSafeSet.mockImplementation(() => true);

    const map = await service.getActiveRedirectMap();

    expect(map.get('/legacy')).toBe('/novo');
    expect(mockSafeSet).toHaveBeenCalledWith(
      'seo:redirects',
      [{ fromPath: '/legacy', toPath: '/novo' }],
      300,
    );
  });
});
