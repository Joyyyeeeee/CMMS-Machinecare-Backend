const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middleware/authMiddleware");

const {
    createMachine,
    getAllMachines,
    getMachineById,
    updateMachine,
    deleteMachine
} = require("../controllers/machineController");

router.use(authMiddleware);

router.post("/", createMachine);

router.get("/", getAllMachines);

router.get("/:id", getMachineById);

router.put("/:id", updateMachine);

router.delete("/:id", deleteMachine);

module.exports = router;