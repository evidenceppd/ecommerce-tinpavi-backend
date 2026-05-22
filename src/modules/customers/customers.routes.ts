import { Router } from 'express';
import { requireAdmin } from '@/shared/middleware/require-admin';
import { validate } from '@/shared/middleware/validate';
import {
  adminUpdateCustomerSchema,
  changePasswordSchema,
  createAddressSchema,
  updateAddressSchema,
  updateProfileSchema,
  adminCreateCustomerSchema,
  verifyMfaSetupSchema,
} from './customers.schemas';
import {
  adminGetCustomerController,
  adminListCustomersController,
  adminUpdateCustomerController,
  adminCreateCustomerController,
  adminDeleteCustomerController,
  createAddressController,
  deleteAddressController,
  disableMfaController,
  getOrderHistoryController,
  getProfileController,
  listAddressesController,
  requestMfaSetupController,
  updateAddressController,
  updateProfileController,
  changePasswordController,
  verifyMfaSetupController,
} from './customers.controller';

// /me/* routes — authenticate applied in app.ts
export const customersRouter = Router();
customersRouter.get('/profile', getProfileController);
customersRouter.put('/profile', validate(updateProfileSchema), updateProfileController);
customersRouter.put('/security/password', validate(changePasswordSchema), changePasswordController);
customersRouter.post('/security/mfa/request', requestMfaSetupController);
customersRouter.post('/security/mfa/verify', validate(verifyMfaSetupSchema), verifyMfaSetupController);
customersRouter.delete('/security/mfa', disableMfaController);
customersRouter.get('/addresses', listAddressesController);
customersRouter.post('/addresses', validate(createAddressSchema), createAddressController);
customersRouter.put('/addresses/:addressId', validate(updateAddressSchema), updateAddressController);
customersRouter.delete('/addresses/:addressId', deleteAddressController);
customersRouter.get('/orders', getOrderHistoryController);

// /admin/customers/* routes — authenticate + requireAdmin applied in app.ts
export const adminCustomersRouter = Router();
adminCustomersRouter.use(requireAdmin);
adminCustomersRouter.get('/', adminListCustomersController);
adminCustomersRouter.post('/', validate(adminCreateCustomerSchema), adminCreateCustomerController);
adminCustomersRouter.get('/:id', adminGetCustomerController);
adminCustomersRouter.patch('/:id', validate(adminUpdateCustomerSchema), adminUpdateCustomerController);
adminCustomersRouter.delete('/:id', adminDeleteCustomerController);
