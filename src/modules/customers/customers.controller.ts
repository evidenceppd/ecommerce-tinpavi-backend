import type { Request, Response } from 'express';
import { fail, ok } from '@/shared/http/response-envelope';
import { CustomersService } from './customers.service';
import type {
  AdminCreateCustomerDto,
  AdminUpdateCustomerDto,
  ChangePasswordDto,
  CreateAddressDto,
  UpdateAddressDto,
  UpdateProfileDto,
  VerifyMfaSetupDto,
} from './customers.schemas';
import { adminListCustomersQuerySchema } from './customers.schemas';

const customersService = new CustomersService();

function requireUser(req: Request, res: Response): string | null {
  if (!req.user?.id || req.user.subjectType !== 'CUSTOMER') {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return null;
  }
  return req.user.id;
}

export async function getProfileController(req: Request, res: Response): Promise<void> {
  const customerId = requireUser(req, res);
  if (!customerId) return;
  try {
    const profile = await customersService.getProfile(customerId);
    res.status(200).json(ok(profile));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json(fail('NOT_FOUND', e.message));
  }
}

export async function updateProfileController(req: Request, res: Response): Promise<void> {
  const customerId = requireUser(req, res);
  if (!customerId) return;
  try {
    const profile = await customersService.updateProfile(customerId, req.body as UpdateProfileDto);
    res.status(200).json(ok(profile));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    const code = e.statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR';
    res.status(e.statusCode ?? 500).json(fail(code, e.message));
  }
}

export async function listAddressesController(req: Request, res: Response): Promise<void> {
  const customerId = requireUser(req, res);
  if (!customerId) return;
  const addresses = await customersService.listAddresses(customerId);
  res.status(200).json(ok(addresses));
}

export async function createAddressController(req: Request, res: Response): Promise<void> {
  const customerId = requireUser(req, res);
  if (!customerId) return;
  try {
    const address = await customersService.createAddress(customerId, req.body as CreateAddressDto);
    res.status(201).json(ok(address));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json(fail('INTERNAL_ERROR', e.message));
  }
}

export async function deleteAddressController(req: Request, res: Response): Promise<void> {
  const customerId = requireUser(req, res);
  if (!customerId) return;
  try {
    await customersService.deleteAddress(customerId, String(req.params['addressId'] ?? ''));
    res.status(204).send();
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json(fail('NOT_FOUND', e.message));
  }
}

export async function changePasswordController(req: Request, res: Response): Promise<void> {
  const customerId = requireUser(req, res);
  if (!customerId) return;
  try {
    await customersService.changePassword(customerId, req.body as ChangePasswordDto);
    res.status(204).send();
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json(fail('UNAUTHORIZED', e.message));
  }
}

export async function requestMfaSetupController(req: Request, res: Response): Promise<void> {
  const customerId = requireUser(req, res);
  if (!customerId) return;
  try {
    const result = await customersService.requestMfaSetup(customerId);
    res.status(200).json(ok(result));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json(fail('INTERNAL_ERROR', e.message));
  }
}

export async function verifyMfaSetupController(req: Request, res: Response): Promise<void> {
  const customerId = requireUser(req, res);
  if (!customerId) return;
  try {
    const result = await customersService.verifyMfaSetup(customerId, req.body as VerifyMfaSetupDto);
    res.status(200).json(ok(result));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json(fail('UNAUTHORIZED', e.message));
  }
}

export async function disableMfaController(req: Request, res: Response): Promise<void> {
  const customerId = requireUser(req, res);
  if (!customerId) return;
  try {
    const result = await customersService.disableMfa(customerId);
    res.status(200).json(ok(result));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json(fail('INTERNAL_ERROR', e.message));
  }
}

export async function updateAddressController(req: Request, res: Response): Promise<void> {
  const customerId = requireUser(req, res);
  if (!customerId) return;
  try {
    const address = await customersService.updateAddress(
      customerId,
      String(req.params['addressId'] ?? ''),
      req.body as UpdateAddressDto,
    );
    res.status(200).json(ok(address));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    const code = e.statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR';
    res.status(e.statusCode ?? 500).json(fail(code, e.message));
  }
}

export async function getOrderHistoryController(req: Request, res: Response): Promise<void> {
  const customerId = requireUser(req, res);
  if (!customerId) return;
  try {
    const orders = await customersService.getOrderHistory(customerId);
    res.status(200).json(ok(orders));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json(fail('INTERNAL_ERROR', e.message));
  }
}

// CUST-04 admin endpoint — AUTH-04: only ADMIN role can access
export async function adminListCustomersController(req: Request, res: Response): Promise<void> {
  try {
    const query = adminListCustomersQuerySchema.parse(req.query);
    const result = await customersService.listAdminCustomers(query);
    res.status(200).json(
      ok(result.items, {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      }),
    );
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json(fail('INTERNAL_ERROR', e.message));
  }
}

export async function adminGetCustomerController(req: Request, res: Response): Promise<void> {
  try {
    const customer = await customersService.getAdminCustomer(String(req.params['id'] ?? ''));
    res.status(200).json(ok(customer));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json(fail('NOT_FOUND', e.message));
  }
}

export async function adminUpdateCustomerController(req: Request, res: Response): Promise<void> {
  try {
    const customer = await customersService.updateCustomerAsAdmin(
      String(req.params['id'] ?? ''),
      req.body as AdminUpdateCustomerDto,
    );
    res.status(200).json(ok(customer));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json(fail('INTERNAL_ERROR', e.message));
  }
}

export async function adminCreateCustomerController(req: Request, res: Response): Promise<void> {
  try {
    const customer = await customersService.createCustomerAsAdmin(req.body as AdminCreateCustomerDto);
    res.status(201).json(ok(customer));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    const code = e.statusCode === 409 ? 'CONFLICT' : 'INTERNAL_ERROR';
    res.status(e.statusCode ?? 500).json(fail(code, e.message));
  }
}

export async function adminDeleteCustomerController(req: Request, res: Response): Promise<void> {
  if (!req.user?.id) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  try {
    await customersService.deleteCustomerAsAdmin(String(req.params['id'] ?? ''), req.user.id);
    res.status(204).send();
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    const code = e.statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR';
    res.status(e.statusCode ?? 500).json(fail(code, e.message));
  }
}
