// Usage: router.post('/x', validate(schema), controller)
module.exports = (schema) => (req, res, next) => {
  req.body = schema.parse(req.body); // throws ZodError, handled centrally
  next();
};