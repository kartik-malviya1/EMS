import { ApiError } from '../utils/ApiError.js';

export const validate = (schemas) => {
  return (req, _res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
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
