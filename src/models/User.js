const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const EXTRA_CATEGORIES = ['coffee', 'printing', 'locker', 'other'];

const PlanSchema = new mongoose.Schema(
  {
    planName: {
      type: String,
      enum: ['hot_desk', 'dedicated_desk', 'private_office'],
      default: 'hot_desk'
    },
    price: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['inactive', 'pending', 'active', 'expired'],
      default: 'inactive'
    },
    startDate: Date,
    endDate: Date,
    lastPaidAt: Date,
    autoRenew: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

const ExtrasLedgerSchema = new mongoose.Schema(
  {
    extra: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Extra'
    },
    itemName: String,
    category: {
      type: String,
      enum: EXTRA_CATEGORIES,
      default: 'other'
    },
    quantity: {
      type: Number,
      default: 1
    },
    unitPrice: {
      type: Number,
      default: 0
    },
    subtotal: {
      type: Number,
      default: 0
    },
    amountPaid: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['owed', 'partial', 'paid'],
      default: 'owed'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters']
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email'
      ]
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false
    },
    role: {
      type: String,
      enum: ['admin', 'tenant'],
      default: 'tenant'
    },
    plan: {
      type: PlanSchema,
      default: () => ({})
    },
    extrasBalance: {
      type: Number,
      default: 0
    },
    extrasLedger: {
      type: [ExtrasLedgerSchema],
      default: []
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
module.exports.EXTRA_CATEGORIES = EXTRA_CATEGORIES;
