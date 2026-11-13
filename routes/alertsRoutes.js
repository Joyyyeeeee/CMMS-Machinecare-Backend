const express = require("express");
const router = express.Router();

const {
  createAlert,
  getAllAlerts,
  getAlertById,
  updateAlert,
  deleteAlert,
  getAlertStats
} = require("../controllers/alertController");

const { authMiddleware } = require("../middleware/authMiddleware");
const alertMiddleware = require("../middleware/alertMiddleware");

// Protect all alert routes
router.use(authMiddleware);

// Dashboard statistics
router.get("/stats/summary", getAlertStats);

// Alert CRUD
router.post("/", alertMiddleware, createAlert);
router.get("/", getAllAlerts);
router.get("/:id", getAlertById);
router.put("/:id", alertMiddleware, updateAlert);
router.delete("/:id", deleteAlert);

module.exports = router;