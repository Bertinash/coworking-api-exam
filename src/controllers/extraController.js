const Extra = require('../models/Extra');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');

// Pays off the oldest unpaid ledger entries first.
const applyPaymentToLedger = (ledger, amount) => {
  let remaining = amount;

  ledger.forEach((entry) => {
    if (remaining <= 0 || entry.status === 'paid') {
      return;
    }

    const outstanding = entry.subtotal - entry.amountPaid;
    if (remaining >= outstanding) {
      entry.amountPaid = entry.subtotal;
      entry.status = 'paid';
      remaining -= outstanding;
    } else {
      entry.amountPaid += remaining;
      entry.status = 'partial';
      remaining = 0;
    }
  });
};

exports.createExtra = async (req, res, next) => {
  try {
    const extra = await Extra.create(req.body);
    res.status(201).json({ success: true, extra });
  } catch (error) {
    next(error);
  }
};

exports.getExtras = async (req, res, next) => {
  try {
    const extras = await Extra.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: extras.length,
      extras
    });
  } catch (error) {
    next(error);
  }
};

exports.purchaseExtra = async (req, res, next) => {
  try {
    const { extraId, quantity = 1 } = req.body;

    if (!extraId) {
      return next(new ErrorResponse('extraId is required', 400));
    }

    const qty = Number(quantity);
    if (Number.isNaN(qty) || qty <= 0) {
      return next(new ErrorResponse('Quantity must be greater than zero', 400));
    }

    const extra = await Extra.findById(extraId);
    if (!extra || !extra.isAvailable) {
      return next(new ErrorResponse('Extra is unavailable', 404));
    }

    const subtotal = extra.price * qty;
    const tenant = await User.findById(req.user.id);

    tenant.extrasBalance += subtotal;
    tenant.extrasLedger.push({
      extra: extra._id,
      itemName: extra.name,
      category: extra.category,
      quantity: qty,
      unitPrice: extra.price,
      subtotal
    });

    await tenant.save();

    res.status(201).json({
      success: true,
      message: 'Extra added to balance',
      extrasBalance: tenant.extrasBalance
    });
  } catch (error) {
    next(error);
  }
};

exports.payExtrasBalance = async (req, res, next) => {
  try {
    const paymentAmount = Number(req.body.amount);

    if (Number.isNaN(paymentAmount) || paymentAmount <= 0) {
      return next(new ErrorResponse('Payment amount must be greater than zero', 400));
    }

    const tenant = await User.findById(req.user.id);

    if (paymentAmount > tenant.extrasBalance) {
      return next(new ErrorResponse('Payment exceeds outstanding extras balance', 400));
    }

    tenant.extrasBalance -= paymentAmount;
    applyPaymentToLedger(tenant.extrasLedger, paymentAmount);

    await tenant.save();

    res.status(200).json({
      success: true,
      extrasBalance: tenant.extrasBalance,
      extrasLedger: tenant.extrasLedger
    });
  } catch (error) {
    next(error);
  }
};

exports.getExtrasBalance = async (req, res, next) => {
  try {
    const tenant = await User.findById(req.user.id).select('extrasBalance extrasLedger');
    res.status(200).json({
      success: true,
      extrasBalance: tenant.extrasBalance,
      extrasLedger: tenant.extrasLedger
    });
  } catch (error) {
    next(error);
  }
};
