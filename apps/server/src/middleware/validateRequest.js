import ApiResponse from '../utils/ApiResponse.js';

const validateRequest = (schema, source = 'body') => async (req, res, next) => {
  if (schema && typeof schema.safeParse === 'function') {
    const result = await schema.safeParseAsync(req[source] || {});
    if (!result.success) {
      const messages = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      return res.status(400).json(ApiResponse.error(messages, 400));
    }
    req[source] = result.data;
    return next();
  }

  if (schema && typeof schema.validate === 'function') {
    const result = schema.validate(req[source] || {});
    if (!result.valid) {
      return res.status(400).json(ApiResponse.error(result.errors.join(', '), 400));
    }
    req[source] = result.value;
    return next();
  }

  return next();
};

export default validateRequest;
