const SparePart = require("../models/SparePart");
const StockTransaction = require("../models/StockTransaction");

// GET all spare parts with search, filters, and pagination
exports.getSpareParts = async (req, res, next) => {
  try {
    const {
      search,
      category,
      status,
      location,
      page = 1,
      limit = 10
    } = req.query;

    const filter = {
      isActive: true
    };

    // Search by part code, name, or category
    if (search) {
      filter.$or = [
        { partCode: { $regex: search, $options: "i" } },
        { partName: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } }
      ];
    }

    if (category) {
      filter.category = category;
    }

    if (location) {
      filter.location = location;
    }

    // Stock status filtering
    if (status === "In Stock") {
      filter.$expr = {
        $gt: ["$quantity", "$minimumStock"]
      };
    }

    if (status === "Low Stock") {
      filter.$expr = {
        $and: [
          { $gt: ["$quantity", 0] },
          { $lte: ["$quantity", "$minimumStock"] }
        ]
      };
    }

    if (status === "Out of Stock") {
      filter.quantity = 0;
    }

    const pageNumber = Math.max(1, Number(page));
    const pageSize = Math.min(100, Math.max(1, Number(limit)));

    const total = await SparePart.countDocuments(filter);

    const spareParts = await SparePart.find(filter)
      .populate("compatibleMachines", "code name")
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize);

    res.status(200).json({
      success: true,
      total,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
      spareParts
    });
  } catch (error) {
    next(error);
  }
};


// GET dashboard summary
exports.getSparePartSummary = async (req, res, next) => {
  try {
    const totalParts = await SparePart.countDocuments({
      isActive: true
    });

    const inStock = await SparePart.countDocuments({
      isActive: true,
      $expr: {
        $gt: ["$quantity", "$minimumStock"]
      }
    });

    const lowStock = await SparePart.countDocuments({
      isActive: true,
      $expr: {
        $and: [
          { $gt: ["$quantity", 0] },
          { $lte: ["$quantity", "$minimumStock"] }
        ]
      }
    });

    const outOfStock = await SparePart.countDocuments({
      isActive: true,
      quantity: 0
    });

    res.status(200).json({
      success: true,
      summary: {
        totalParts,
        inStock,
        lowStock,
        outOfStock
      }
    });
  } catch (error) {
    next(error);
  }
};


// GET low-stock and out-of-stock alerts
exports.getStockAlerts = async (req, res, next) => {
  try {
    const alerts = await SparePart.find({
      isActive: true,
      $expr: {
        $lte: ["$quantity", "$minimumStock"]
      }
    })
      .populate("compatibleMachines", "code name")
      .sort({ quantity: 1 });

    res.status(200).json({
      success: true,
      count: alerts.length,
      alerts
    });
  } catch (error) {
    next(error);
  }
};


// GET single spare part
exports.getSparePartById = async (req, res, next) => {
  try {
    const sparePart = await SparePart.findOne({
      _id: req.params.id,
      isActive: true
    }).populate(
      "compatibleMachines",
      "code name"
    );

    if (!sparePart) {
      return res.status(404).json({
        success: false,
        message: "Spare part not found"
      });
    }

    res.status(200).json({
      success: true,
      sparePart
    });
  } catch (error) {
    next(error);
  }
};


// ADD spare part
exports.createSparePart = async (req, res, next) => {
  try {
    const existingPart = await SparePart.findOne({
      partCode: req.body.partCode.toUpperCase()
    });

    if (existingPart) {
      return res.status(409).json({
        success: false,
        message: "Part code already exists"
      });
    }

    const sparePart = await SparePart.create(req.body);

    res.status(201).json({
      success: true,
      message: "Spare part added successfully",
      sparePart
    });
  } catch (error) {
    next(error);
  }
};


// UPDATE spare part details
exports.updateSparePart = async (req, res, next) => {
  try {
    // Stock quantity must be changed through stock transactions
    const { quantity, ...details } = req.body;

    const sparePart = await SparePart.findOneAndUpdate(
      {
        _id: req.params.id,
        isActive: true
      },
      details,
      {
        new: true,
        runValidators: true
      }
    );

    if (!sparePart) {
      return res.status(404).json({
        success: false,
        message: "Spare part not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Spare part updated successfully",
      sparePart
    });
  } catch (error) {
    next(error);
  }
};


// DELETE spare part (soft delete)
exports.deleteSparePart = async (req, res, next) => {
  try {
    const sparePart = await SparePart.findOneAndUpdate(
      {
        _id: req.params.id,
        isActive: true
      },
      {
        isActive: false
      },
      {
        new: true
      }
    );

    if (!sparePart) {
      return res.status(404).json({
        success: false,
        message: "Spare part not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Spare part deleted successfully"
    });
  } catch (error) {
    next(error);
  }
};


// STOCK IN / STOCK OUT / RETURN
exports.updateStock = async (req, res, next) => {
  try {
    const {
      transactionType,
      quantity,
      machine,
      reason
    } = req.body;

    if (!["IN", "OUT", "RETURN"].includes(transactionType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction type"
      });
    }

    const amount = Number(quantity);

    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive whole number"
      });
    }

    let sparePart;

    // Atomic stock update prevents concurrent issues
    if (transactionType === "OUT") {
      sparePart = await SparePart.findOneAndUpdate(
        {
          _id: req.params.id,
          isActive: true,
          quantity: { $gte: amount }
        },
        {
          $inc: { quantity: -amount }
        },
        { new: true }
      );

      if (!sparePart) {
        return res.status(400).json({
          success: false,
          message: "Insufficient stock or spare part not found"
        });
      }
    } else {
      sparePart = await SparePart.findOneAndUpdate(
        {
          _id: req.params.id,
          isActive: true
        },
        {
          $inc: { quantity: amount }
        },
        { new: true }
      );

      if (!sparePart) {
        return res.status(404).json({
          success: false,
          message: "Spare part not found"
        });
      }
    }

    const transaction = await StockTransaction.create({
      sparePart: sparePart._id,
      machine: machine || null,
      transactionType,
      quantity: amount,
      balanceAfter: sparePart.quantity,
      reason,
      performedBy: req.user ? req.user._id : null
    });

    res.status(200).json({
      success: true,
      message: "Stock updated successfully",
      sparePart,
      transaction
    });
  } catch (error) {
    next(error);
  }
};


// GET spare part transaction history
exports.getStockHistory = async (req, res, next) => {
  try {
    const history = await StockTransaction.find({
      sparePart: req.params.id
    })
      .populate("performedBy", "name")
      .populate("machine", "code name")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      history
    });
  } catch (error) {
    next(error);
  }
};
