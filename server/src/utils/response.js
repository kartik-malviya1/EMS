export const sendSuccess = (res, data, statusCode = 200, meta = undefined) => {
  const payload = {
    success: true,
    data,
  };
  if (meta !== undefined) {
    payload.meta = meta;
  }
  return res.status(statusCode).json(payload);
};

export const sendError = (res, code, message, statusCode = 500, details = undefined) => {
  const payload = {
    success: false,
    error: {
      code,
      message,
    },
  };
  if (details !== undefined) {
    payload.details = details;
  }
  return res.status(statusCode).json(payload);
};
