import type { Request, Response } from 'express';
import { ok, fail } from '@/shared/http/response-envelope';
import { BASE_URL } from '@/config/seo';
import { Prisma } from '@/generated/prisma/client';
import type {
  AdminListProductsQueryDto,
  CreateProductVariantDto,
  CreateProductDto,
  ListProductsQueryDto,
  UpdateProductVariantDto,
  UpdateProductDto,
} from './catalog.schemas';
import { adminListProductsQuerySchema, listProductsQuerySchema } from './catalog.schemas';
import { createProductSchema, updateProductSchema } from './catalog.schemas';
import { CatalogService } from './catalog.service';
import { withAbort } from '@/shared/infra/with-abort';
import { parseFieldsParam, selectFields } from '@/shared/http/response-fields';
import { isPerfBenchmarkMode } from '@/config/perf-benchmark';

const service = new CatalogService();

function setAdminNoStore(res: Response): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function mapPrismaError(err: unknown): { status: number; code: string; msg: string } | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return null;
  if (err.code === 'P2002') {
    const fields = Array.isArray(err.meta?.['target']) ? (err.meta['target'] as string[]).join(', ') : 'campo';
    return { status: 409, code: 'CONFLICT', msg: `Conflito: o valor de "${fields}" já está em uso.` };
  }
  if (err.code === 'P2003') {
    return { status: 422, code: 'FOREIGN_KEY_ERROR', msg: 'Referência inválida: registro relacionado não encontrado.' };
  }
  return null;
}

function mapError(message: string): { status: number; code: string; msg: string } {
  if (message === 'PRODUCT_NOT_FOUND')
    return { status: 404, code: 'PRODUCT_NOT_FOUND', msg: 'Product not found' };
  if (message === 'PRODUCT_CODE_CONFLICT')
    return { status: 409, code: 'PRODUCT_CODE_CONFLICT', msg: 'Product code already in use' };
  if (message === 'REQUEST_ABORTED' || message === 'REQUEST_TIMEOUT')
    return { status: 503, code: 'REQUEST_TIMEOUT', msg: 'Request timed out' };
  if (message.startsWith('CATEGORY_NOT_FOUND:'))
    return {
      status: 422,
      code: 'CATEGORY_NOT_FOUND',
      msg: `Category not found: ${message.split(':')[1]}`,
    };
  if (message === 'CATEGORY_REQUIRED')
    return {
      status: 422,
      code: 'CATEGORY_REQUIRED',
      msg: 'At least one category must be provided',
    };
  if (message === 'VARIANT_NOT_FOUND')
    return {
      status: 404,
      code: 'VARIANT_NOT_FOUND',
      msg: 'Variant not found',
    };
  if (message === 'VARIANT_SKU_CONFLICT')
    return {
      status: 409,
      code: 'VARIANT_SKU_CONFLICT',
      msg: 'Variant SKU already exists in this product',
    };
  if (message === 'VARIANT_STOCK_INVALID' || message === 'VARIANT_INVALID')
    return {
      status: 422,
      code: 'VARIANT_INVALID',
      msg: 'Variant payload is invalid',
    };
  return { status: 500, code: 'INTERNAL_ERROR', msg: 'Internal server error' };
}

// ---- Public ----

export async function listProductsController(req: Request, res: Response): Promise<void> {
  try {
    const query: ListProductsQueryDto =
      isPerfBenchmarkMode() || process.env['PERF_FAST_PRODUCTS_QUERY'] === 'true'
        ? {
            category_id:
              typeof req.query['category_id'] === 'string' ? req.query['category_id'] : undefined,
            search: typeof req.query['search'] === 'string' ? req.query['search'] : undefined,
            orderBy:
              req.query['orderBy'] === 'pricing' ||
              req.query['orderBy'] === 'title' ||
              req.query['orderBy'] === 'createdAt'
                ? req.query['orderBy']
                : 'createdAt',
            page: Math.max(1, Number(req.query['page'] ?? 1) || 1),
            limit: Math.min(100, Math.max(1, Number(req.query['limit'] ?? 20) || 20)),
          }
        : listProductsQuerySchema.parse(req.query);
    const result = await withAbort(req.abortSignal, service.listPublic(query));
    const fields = parseFieldsParam(req.query?.['fields']);
    const payload = selectFields(result.items as Array<Record<string, unknown>>, fields);
    res
      .status(200)
      .json(ok(payload, { total: result.total, page: result.page, limit: result.limit }));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function getProductController(req: Request, res: Response): Promise<void> {
  try {
    const product = await withAbort(
      req.abortSignal,
      service.getPublicByCode(String(req.params['code'] ?? '')),
    );
    const fields = parseFieldsParam(req.query?.['fields']);
    const payload = selectFields(product as Record<string, unknown>, fields);
    // D-12: canonical header
    res.setHeader('Link', `<${BASE_URL}/products/${product.code}>; rel="canonical"`);
    res.status(200).json(ok(payload));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

// ---- Admin product CRUD ----

export async function getAdminProductController(req: Request, res: Response): Promise<void> {
  try {
    setAdminNoStore(res);
    const product = await service.adminGetById(String(req.params['id'] ?? ''));
    res.status(200).json(ok(product));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function listAdminProductsController(req: Request, res: Response): Promise<void> {
  try {
    setAdminNoStore(res);
    const query = adminListProductsQuerySchema.parse(req.query) as AdminListProductsQueryDto;
    const result = await service.listAdminProducts(query);
    res
      .status(200)
      .json(ok(result.items, { total: result.total, page: result.page, limit: result.limit }));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function createProductController(req: Request, res: Response): Promise<void> {
  try {
    setAdminNoStore(res);
    const product = await service.create(createProductSchema.parse(req.body) as CreateProductDto);
    res.status(201).json(ok(product));
  } catch (err) {
    const prismaErr = mapPrismaError(err);
    if (prismaErr) { res.status(prismaErr.status).json(fail(prismaErr.code, prismaErr.msg)); return; }
    console.error('[createProduct]', err);
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function updateProductController(req: Request, res: Response): Promise<void> {
  try {
    setAdminNoStore(res);
    const product = await service.update(
      String(req.params['id'] ?? ''),
      updateProductSchema.parse(req.body) as UpdateProductDto,
    );
    res.status(200).json(ok(product));
  } catch (err) {
    const prismaErr = mapPrismaError(err);
    if (prismaErr) { res.status(prismaErr.status).json(fail(prismaErr.code, prismaErr.msg)); return; }
    console.error('[updateProduct]', err);
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function deleteProductController(req: Request, res: Response): Promise<void> {
  try {
    await service.delete(String(req.params['id'] ?? ''));
    res.status(204).send();
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function listProductVariantsController(req: Request, res: Response): Promise<void> {
  try {
    setAdminNoStore(res);
    const variants = await service.listVariants(String(req.params['id'] ?? ''));
    res.status(200).json(ok(variants));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function createProductVariantController(req: Request, res: Response): Promise<void> {
  try {
    setAdminNoStore(res);
    const variant = await service.addVariant(
      String(req.params['id'] ?? ''),
      req.body as CreateProductVariantDto,
    );
    res.status(201).json(ok(variant));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function updateProductVariantController(req: Request, res: Response): Promise<void> {
  try {
    setAdminNoStore(res);
    const variant = await service.updateVariant(
      String(req.params['id'] ?? ''),
      String(req.params['variantId'] ?? ''),
      req.body as UpdateProductVariantDto,
    );
    res.status(200).json(ok(variant));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function deleteProductVariantController(req: Request, res: Response): Promise<void> {
  try {
    await service.deleteVariant(
      String(req.params['id'] ?? ''),
      String(req.params['variantId'] ?? ''),
    );
    res.status(204).send();
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}
