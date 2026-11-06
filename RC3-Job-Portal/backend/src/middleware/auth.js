const jwt = require('jsonwebtoken');
const User = require('../models/note.models');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/AsyncHandler');
const { jwtSecret } = require('../config/env');

const requireAuth = asyncHandler(async (req, res, next) => {
  const authorization = req.get('authorization') || '';
  const bearerToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = bearerToken || req.cookies?.token;
  if (!token) throw new AppError('Not authenticated', 401);

  const payload = jwt.verify(token, jwtSecret);
  const user = await User.findById(payload.id);
  if (!user) throw new AppError('User no longer exists', 401);

  req.user = user;
  next();
});

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new AppError('You do not have permission to access this resource', 403));
  }
  next();
};

module.exports = { requireAuth, requireRole };