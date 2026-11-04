const mongoose = require("mongoose");

/**
 * Validates that the specified request parameter is a valid MongoDB ObjectId.
 * Supports both `validateObjectId` (defaults to req.params.id) and `validateObjectId('customParam')`.
 */
const validateObjectId = (paramNameOrReq = "id") => {
  // If used directly as middleware: router.get('/:id', validateObjectId, ...)
  if (paramNameOrReq && paramNameOrReq.params) {
    const id = paramNameOrReq.params.id;
    if (id && !mongoose.Types.ObjectId.isValid(id)) {
      return paramNameOrReq.res?.status(400).json({
        success: false,
        message: `Invalid ID format: ${id}`
      });
    }
    const nextFn = arguments[2];
    return typeof nextFn === "function" ? nextFn() : null;
  }

  // If used as a higher-order factory: router.get('/:spareId', validateObjectId('spareId'), ...)
  const param = typeof paramNameOrReq === "string" ? paramNameOrReq : "id";
  return (req, res, next) => {
    const id = req.params[param];
    if (id && !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ID format: ${id}`
      });
    }
    next();
  };
};

module.exports = validateObjectId;

