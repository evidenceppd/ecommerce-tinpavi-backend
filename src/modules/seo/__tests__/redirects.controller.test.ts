import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockList,
  mockCreate,
  mockUpdate,
  mockDelete,
  mockListRedirectsQueryParse,
} = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockListRedirectsQueryParse: vi.fn(),
}));

vi.mock('../redirects.service', () => ({
  RedirectsService: class RedirectsService {
    list = mockList;
    create = mockCreate;
    update = mockUpdate;
    delete = mockDelete;
  },
}));

vi.mock('../seo.schemas', async () => {
  const actual = await vi.importActual<typeof import('../seo.schemas')>('../seo.schemas');
  return {
    ...actual,
    listRedirectsQuerySchema: { parse: mockListRedirectsQueryParse },
  };
});

import {
  createRedirectController,
  deleteRedirectController,
  listRedirectsController,
  updateRedirectController,
} from '../redirects.controller';

function createResponse() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
  };

  res.status.mockReturnValue(res);
  return res;
}

describe('redirects.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListRedirectsQueryParse.mockImplementation((query: unknown) => query);
  });

  it('listRedirectsController returns paginated payload', async () => {
    const req = { query: { page: '1', limit: '10' } };
    const res = createResponse();
    mockListRedirectsQueryParse.mockReturnValue({ page: 1, limit: 10 });
    mockList.mockResolvedValue({ items: [{ id: 'r1' }], total: 1 });

    await listRedirectsController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        meta: expect.objectContaining({ total: 1, page: 1, limit: 10 }),
      }),
    );
  });

  it('createRedirectController returns 201 on success', async () => {
    const req = { body: { fromPath: '/old', toPath: '/new', isActive: true } };
    const res = createResponse();
    mockCreate.mockResolvedValue({ id: 'r1' });

    await createRedirectController(req as any, res as any);

    expect(mockCreate).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('updateRedirectController maps REDIRECT_NOT_FOUND to 404', async () => {
    const req = { params: { id: 'missing' }, body: { toPath: '/new' } };
    const res = createResponse();
    mockUpdate.mockRejectedValue(new Error('REDIRECT_NOT_FOUND'));

    await updateRedirectController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'REDIRECT_NOT_FOUND' }),
      }),
    );
  });

  it('deleteRedirectController returns 204 on success', async () => {
    const req = { params: { id: 'r1' } };
    const res = createResponse();
    mockDelete.mockResolvedValue(undefined);

    await deleteRedirectController(req as any, res as any);

    expect(mockDelete).toHaveBeenCalledWith('r1');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledTimes(1);
  });
});
