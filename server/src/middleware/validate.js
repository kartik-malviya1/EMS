import { ApiError } from '../utils/ApiError.js';

export const validate = (schemas) => {
  return (req, _res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        const parsed = schemas.query.parse(req.query);
        Object.defineProperty(req, 'query', {
          value: parsed,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      if (schemas.params) {
        const parsed = schemas.params.parse(req.params);
        Object.defineProperty(req, 'params', {
          value: parsed,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      next();
    } catch (error) {
      if (error?.issues) {
        const details = error.issues.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        }));
        return next(new ApiError(400, 'VALIDATION_ERROR', 'Validation failed', details));
      }
      next(error);
    }
  };
};

export default validate;
