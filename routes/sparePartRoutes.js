const express = require("express");
const router = express.Router();

const {
  getSpareParts,
  getSparePartSummary,
  getStockAlerts,
  getSparePartById,
  createSparePart,
  updateSparePart,
  deleteSparePart,
  updateStock,
  getStockHistory
} = require("../controllers/sparePartController");

const { protect, authorize } = require("../middleware/authMiddleware");

const {
  validateSparePart
} = require("../middleware/validateSparePart");

// All routes require authentication
router.use(protect);

// Dashboard routes
router.get("/summary", getSparePartSummary);
router.get("/alerts", getStockAlerts);

// Inventory routes
router.get("/", getSpareParts);
router.get("/:id", getSparePartById);

// Add spare part
router.post(
  "/",
  authorize("Admin", "Storekeeper"),
  validateSparePart,
  createSparePart
);

// Update spare part
router.put(
  "/:id",
  authorize("Admin", "Storekeeper"),
  updateSparePart
);

// Delete spare part
router.delete(
  "/:id",
  authorize("Admin"),
  deleteSparePart
);

// Stock operations
router.post(
  "/:id/stock",
  authorize("Admin", "Storekeeper", "Technician"),
  updateStock
);

// Stock history
router.get("/:id/history", getStockHistory);

module.exports = router;
