const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.statusCode || (err.name === 'MulterError' ? 400 : 500);
  console.error(`Request ${req.id || 'unknown'} failed:`, err.message);
  res.status(status).json({
    success: false,
    message: status >= 500 ? 'Internal Server Error' : err.message,
    ...(process.env.NODE_ENV === 'development' && status >= 500 ? { error: err.message } : {}),
  });
};

module.exports = { errorHandler };
