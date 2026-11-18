const express = require('express');
const router = express.Router();
const {
  createExtra,
  getExtras,
  purchaseExtra,
  payExtrasBalance,
  getExtrasBalance
} = require('../controllers/extraController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router
  .route('/')
  .get(getExtras)
  .post(authorize('admin'), createExtra);

router.post('/purchase', authorize('tenant'), purchaseExtra);
router.post('/pay', authorize('tenant'), payExtrasBalance);
router.get('/balance/me', authorize('tenant'), getExtrasBalance);

module.exports = router;
