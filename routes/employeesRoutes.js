const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middleware/authMiddleware");

const {
    createEmployee,
    getAllEmployees,
    getEmployeeById,
    updateEmployee,
    deleteEmployee,
    getEmployeeStats
} = require("../controllers/employeesController");

router.use(authMiddleware);

// GET EMPLOYEE STATISTICS
router.get("/stats/summary", getEmployeeStats);

// GET ALL EMPLOYEES
router.get("/", getAllEmployees);

// ADD EMPLOYEE
router.post("/", createEmployee);

// GET EMPLOYEE BY ID
router.get("/:id", getEmployeeById);

// UPDATE EMPLOYEE
router.put("/:id", updateEmployee);

// DELETE EMPLOYEE
router.delete("/:id", deleteEmployee);

module.exports = router;