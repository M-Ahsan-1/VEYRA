const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const { clientUrl, nodeEnv } = require('./config/env');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const AppError = require('./utils/AppError');

const app = express();

app.use(helmet({
	contentSecurityPolicy: {
		directives: {
			scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
			styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
			fontSrc: ["'self'", 'https://fonts.gstatic.com']
		}
	}
}));
app.use(cors({ origin: clientUrl, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
if (nodeEnv !== 'test') app.use(morgan('dev'));

app.use('/api', (req, res, next) => {
	if (req.path === '/health' || mongoose.connection.readyState === 1) return next();
	res.status(503).json({
		success: false,
		message: 'Database is unavailable. Please try again shortly.',
	});
});

app.use('/api', routes);

const frontendPath = path.resolve(__dirname, '../../frontend/frontend');
app.use(express.static(frontendPath));
app.get('/', (req, res) => res.redirect('/login.html'));

app.use((req, res, next) => next(new AppError(`Route not found: ${req.originalUrl}`, 404)));
app.use(errorHandler);

module.exports = app;