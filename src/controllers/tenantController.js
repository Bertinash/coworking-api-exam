const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const computeEndDate = (startDate, durationInDays) => {
  if (!durationInDays) {
    return null;
  }
  return new Date(startDate.getTime() + Number(durationInDays) * DAY_IN_MS);
};

const findTenant = async (id, projection) => {
  const query = User.findById(id);
  if (projection) query.select(projection);
  const tenant = await query;
  return tenant && tenant.role === 'tenant' ? tenant : null;
};

exports.createTenant = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return next(new ErrorResponse('Name, email and password are required', 400));
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return next(new ErrorResponse('Tenant with this email already exists', 400));
    }

    const tenant = await User.create({ name, email, password, role: 'tenant' });

    res.status(201).json({
      success: true,
      tenant: {
        id: tenant._id,
        name: tenant.name,
        email: tenant.email,
        plan: tenant.plan
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getTenants = async (req, res, next) => {
  try {
    const tenants = await User.find({ role: 'tenant' }).select('-password');
    res.status(200).json({
      success: true,
      count: tenants.length,
      tenants
    });
  } catch (error) {
    next(error);
  }
};

exports.getTenantById = async (req, res, next) => {
  try {
    const tenant = await User.findById(req.params.tenantId)
      .select('-password')
      .populate('extrasLedger.extra', 'name category price');

    if (!tenant || tenant.role !== 'tenant') {
      return next(new ErrorResponse('Tenant not found', 404));
    }

    res.status(200).json({ success: true, tenant });
  } catch (error) {
    next(error);
  }
};

exports.assignPlan = async (req, res, next) => {
  try {
    const {
      planName,
      price,
      startDate,
      endDate,
      durationInDays,
      status,
      markPaid,
      autoRenew
    } = req.body;

    const tenant = await findTenant(req.params.tenantId);
    if (!tenant) {
      return next(new ErrorResponse('Tenant not found', 404));
    }

    const plan = tenant.plan || {};
    if (planName) plan.planName = planName;
    if (price !== undefined) plan.price = price;

    if (startDate) {
      plan.startDate = new Date(startDate);
    } else if (!plan.startDate) {
      plan.startDate = new Date();
    }

    if (endDate) {
      plan.endDate = new Date(endDate);
    } else if (durationInDays) {
      plan.endDate = computeEndDate(plan.startDate, durationInDays);
    }

    if (autoRenew !== undefined) {
      plan.autoRenew = autoRenew;
    }

    if (status) {
      plan.status = status;
    } else if (plan.endDate && plan.endDate < new Date()) {
      plan.status = 'expired';
    } else if (!markPaid) {
      plan.status = plan.status === 'active' ? 'active' : 'pending';
    }

    if (markPaid) {
      plan.lastPaidAt = new Date();
      plan.status = 'active';
    }

    tenant.plan = plan;
    await tenant.save();

    res.status(200).json({ success: true, plan: tenant.plan });
  } catch (error) {
    next(error);
  }
};

exports.deleteTenant = async (req, res, next) => {
  try {
    const tenant = await findTenant(req.params.tenantId);
    if (!tenant) {
      return next(new ErrorResponse('Tenant not found', 404));
    }

    await tenant.deleteOne();

    res.status(200).json({ success: true, message: 'Tenant deleted' });
  } catch (error) {
    next(error);
  }
};

exports.getTenantBalance = async (req, res, next) => {
  try {
    const tenant = await findTenant(
      req.params.tenantId,
      'name email role plan extrasBalance extrasLedger'
    );
    if (!tenant) {
      return next(new ErrorResponse('Tenant not found', 404));
    }

    res.status(200).json({
      success: true,
      tenant: {
        id: tenant._id,
        name: tenant.name,
        email: tenant.email,
        plan: tenant.plan,
        extrasBalance: tenant.extrasBalance,
        extrasLedger: tenant.extrasLedger
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getMyPlan = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('plan extrasBalance');
    res.status(200).json({
      success: true,
      plan: user.plan,
      extrasBalance: user.extrasBalance
    });
  } catch (error) {
    next(error);
  }
};

exports.payPlan = async (req, res, next) => {
  try {
    const {
      planName,
      price,
      durationInDays = 30,
      startDate,
      endDate,
      autoRenew
    } = req.body;

    const tenant = await User.findById(req.user.id);
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate
      ? new Date(endDate)
      : computeEndDate(start, durationInDays) || tenant.plan?.endDate;

    if (end && end <= start) {
      return next(new ErrorResponse('End date must be after the start date', 400));
    }

    tenant.plan = {
      planName: planName || tenant.plan?.planName || 'hot_desk',
      price: price !== undefined ? price : tenant.plan?.price || 0,
      startDate: start,
      endDate: end,
      status: 'active',
      lastPaidAt: new Date(),
      autoRenew:
        autoRenew !== undefined ? autoRenew : tenant.plan?.autoRenew || false
    };

    await tenant.save();

    res.status(200).json({ success: true, plan: tenant.plan });
  } catch (error) {
    next(error);
  }
};
