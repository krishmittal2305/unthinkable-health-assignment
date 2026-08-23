// Wraps an async route handler so rejected promises reach errorHandler
// instead of crashing the process (Express 4 doesn't do this natively).
function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
