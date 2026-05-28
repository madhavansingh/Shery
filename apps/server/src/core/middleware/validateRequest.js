import ApiResponse from '../../utils/ApiResponse.js';

export const validateRequest = (schema) => async (req, res, next) => {
  try {
    const parsed = await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    req.body = parsed.body;
    req.query = parsed.query;
    req.params = parsed.params;
    next();
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json(
        ApiResponse.error('Validation failed', 400, {
          errors: error.errors.map((err) => ({
            field: err.path.slice(1).join('.'),
            message: err.message,
          })),
        })
      );
    }
    next(error);
  }
};

export default validateRequest;
