const { z } = require('zod');
const jwt = require('jsonwebtoken');
const User = require('../models/note.models');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/AsyncHandler');
const { jwtSecret, jwtExpiresIn, nodeEnv } = require('../config/env');

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  role: z.enum(['recruiter', 'candidate']),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: nodeEnv === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function sendToken(res, user, status = 200) {
  const token = jwt.sign({ id: user._id, role: user.role }, jwtSecret, {
    expiresIn: jwtExpiresIn,
  });
  res.cookie('token', token, cookieOptions);
  res.status(status).json({ success: true, token, user: user.toSafeJSON() });
}

const register = asyncHandler(async (req, res) => {
  const user = await User.create(req.body);
  sendToken(res, user, 201);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');

  // Same message for both cases so attackers can't discover which emails exist
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }
  sendToken(res, user);
});

const logout = (req, res) => {
  res.clearCookie('token', { ...cookieOptions, maxAge: undefined });
  res.json({ success: true, message: 'Logged out' });
};

const me = (req, res) => {
  res.json({ success: true, user: req.user.toSafeJSON() });
};

module.exports = { register, login, logout, me, registerSchema, loginSchema };