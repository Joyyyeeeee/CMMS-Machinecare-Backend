exports.validateSparePart = (req, res, next) => {
  const {
    partCode,
    partName,
    category,
    quantity,
    minimumStock,
    unitCost
  } = req.body;

  if (!partCode || !partName || !category) {
    return res.status(400).json({
      success: false,
      message: "Part code, name, and category are required"
    });
  }

  if (
    quantity !== undefined &&
    (!Number.isInteger(quantity) || quantity < 0)
  ) {
    return res.status(400).json({
      success: false,
      message: "Quantity must be a non-negative whole number"
    });
  }

  if (
    minimumStock !== undefined &&
    (!Number.isInteger(minimumStock) || minimumStock < 0)
  ) {
    return res.status(400).json({
      success: false,
      message: "Minimum stock must be a non-negative whole number"
    });
  }

  if (
    unitCost !== undefined &&
    (typeof unitCost !== "number" || unitCost < 0)
  ) {
    return res.status(400).json({
      success: false,
      message: "Unit cost must be a valid non-negative number"
    });
  }

  next();
};