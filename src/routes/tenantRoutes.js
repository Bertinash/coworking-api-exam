const express = require('express');
const router = express.Router();
const {
  createTenant,
  getTenants,
  getTenantById,
  assignPlan,
  deleteTenant,
  getTenantBalance,
  getMyPlan,
  payPlan
} = require('../controllers/tenantController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router
  .route('/')
  .get(authorize('admin'), getTenants)
  .post(authorize('admin'), createTenant);

// These must stay above '/:tenantId' so "me" and "plan" are not read as ids.
router.get('/me/plan', authorize('admin', 'tenant'), getMyPlan);
router.post('/plan/pay', authorize('tenant'), payPlan);

router
  .route('/:tenantId')
  .get(authorize('admin'), getTenantById)
  .delete(authorize('admin'), deleteTenant);

router.post('/:tenantId/plan', authorize('admin'), assignPlan);
router.get('/:tenantId/balance', authorize('admin'), getTenantBalance);

module.exports = router;
