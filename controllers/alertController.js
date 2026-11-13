const Alert = require("../models/alertModel");
const Machine = require("../models/Machine");
const MachineSpare = require("../models/MachineSpare");
const Spare = require("../models/Spare");

const DEMO_ALERT_IDS = Array.from({ length: 18 }, (_, index) =>
  `ALT-${String(index + 1).padStart(3, "0")}`
);

async function getCurrentAlerts() {
  const [storedAlerts, machines, spares, mappings] = await Promise.all([
    Alert.find({ alertId: { $nin: DEMO_ALERT_IDS } })
      .sort({ dateTime: -1, createdAt: -1 })
      .lean(),
    Machine.find()
      .populate("assignedEmployees", "employeeId name")
      .lean(),
    Spare.find({ isActive: { $ne: false } }).lean(),
    MachineSpare.find()
      .populate({
        path: "machine",
        select: "_id code",
        populate: { path: "assignedEmployees", select: "name" }
      })
      .lean()
  ]);

  const machineAlerts = machines
    .filter((machine) => machine.status === "Stopped" || machine.status === "Under maintenance")
    .map((machine) => {
      const stopped = machine.status === "Stopped";
      const employeeNames = (machine.assignedEmployees || [])
        .map((employee) => employee.name)
        .filter(Boolean);
      const assignment = employeeNames.length
        ? ` Assigned to: ${employeeNames.join(", ")}.`
        : "";
      return {
        _id: `live-machine-${machine._id}`,
        alertId: `MCH-${machine.code}`,
        title: stopped ? "Machine stopped" : "Machine under maintenance",
        description: `${machine.name} (${machine.code}) is currently ${machine.status.toLowerCase()}.${assignment}`,
        machineCode: machine.code,
        alertType: "Machine",
        priority: stopped ? "Critical" : "Warning",
        status: "Open",
        dateTime: machine.updatedAt || machine.createdAt || new Date(),
        source: "machine"
      };
    });

  const mappingsBySpare = new Map();
  mappings.forEach((mapping) => {
    if (!mapping.machine) return;
    const spareId = String(mapping.spare);
    if (!mappingsBySpare.has(spareId)) mappingsBySpare.set(spareId, []);
    mappingsBySpare.get(spareId).push(mapping.machine);
  });

  const spareAlerts = spares
    .filter((spare) => spare.stock <= spare.minStock)
    .flatMap((spare) => {
      const relatedMachines = mappingsBySpare.get(String(spare._id)) || [null];
      return relatedMachines.map((machine) => {
        const machineKey = machine ? String(machine._id) : "unassigned";
        const outOfStock = spare.stock <= 0;
        const assignedEmployees = (machine?.assignedEmployees || [])
          .map((employee) => employee.name)
          .filter(Boolean);
        const employeeDescription = assignedEmployees.length
          ? `, assigned to ${assignedEmployees.join(", ")}`
          : "";
        const machineDescription = machine
          ? ` for machine ${machine.code}${employeeDescription}`
          : "";
        return {
          _id: `live-spare-${spare._id}-${machineKey}`,
          alertId: `SPR-${spare.code}-${machine ? machine.code : "UNASSIGNED"}`,
          title: outOfStock ? "Spare part out of stock" : "Spare part stock low",
          description: `${spare.name} (${spare.code}) has ${spare.stock} ${spare.unit || "units"} in stock; minimum is ${spare.minStock}${machineDescription}.`,
          machineCode: machine ? machine.code : "",
          spareCode: spare.code,
          alertType: "Spare Parts",
          priority: outOfStock ? "Critical" : "Warning",
          status: "Open",
          dateTime: spare.updatedAt || spare.createdAt || new Date(),
          source: "spare"
        };
      });
    });

  return [...storedAlerts, ...machineAlerts, ...spareAlerts].sort(
    (a, b) => new Date(b.dateTime) - new Date(a.dateTime)
  );
}

// CREATE ALERT
exports.createAlert = async (req, res) => {
  try {
    const machineCode = String(req.body.machineCode || "").trim().toUpperCase();
    const machine = await Machine.findOne({ code: machineCode });
    if (!machine) {
      return res.status(400).json({
        success: false,
        message: "Select an existing machine for this alert"
      });
    }

    let alertId = req.body.alertId;
    if (!alertId) {
      const existingAlerts = await Alert.find({}, "alertId").lean();
      const lastNumber = existingAlerts.reduce((maximum, alert) => {
        const number = Number(alert.alertId?.match(/^ALT-(\d+)$/)?.[1]);
        return Number.isFinite(number) ? Math.max(maximum, number) : maximum;
      }, 0);
      alertId = `ALT-${String(lastNumber + 1).padStart(3, "0")}`;
    }

    const alert = await Alert.create({
      ...req.body,
      alertId,
      machineCode: machine.code,
      dateTime: req.body.dateTime || new Date()
    });

    res.status(201).json({
      success: true,
      message: "Alert created successfully",
      alert
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create alert",
      error: error.message
    });
  }
};

// GET ALL STORED AND LIVE CONDITION ALERTS
exports.getAllAlerts = async (req, res) => {
  try {
    const { search, priority, status, alertType } = req.query;
    let alerts = await getCurrentAlerts();

    if (priority && priority !== "all") {
      alerts = alerts.filter((alert) => alert.priority === priority);
    }
    if (status && status !== "all") {
      alerts = alerts.filter((alert) => alert.status === status);
    }
    if (alertType && alertType !== "all") {
      alerts = alerts.filter((alert) => alert.alertType === alertType);
    }
    if (search) {
      const query = search.toLowerCase();
      alerts = alerts.filter((alert) =>
        [alert.alertId, alert.title, alert.description, alert.machineCode, alert.spareCode]
          .some((value) => String(value || "").toLowerCase().includes(query))
      );
    }

    res.status(200).json({
      success: true,
      count: alerts.length,
      alerts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch alerts",
      error: error.message
    });
  }
};

// GET SINGLE ALERT
exports.getAlertById = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ message: "Alert not found" });
    }
    res.status(200).json(alert);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE STORED ALERT
exports.updateAlert = async (req, res) => {
  try {
    const allowedFields = [
      "title",
      "description",
      "machineCode",
      "alertType",
      "priority",
      "status",
      "dateTime"
    ];
    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    if (updateData.machineCode !== undefined) {
      const machine = await Machine.findOne({
        code: String(updateData.machineCode).trim().toUpperCase()
      });
      if (!machine) {
        return res.status(400).json({
          success: false,
          message: "Select an existing machine for this alert"
        });
      }
      updateData.machineCode = machine.code;
    }

    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    if (!alert) {
      return res.status(404).json({ message: "Alert not found" });
    }
    res.status(200).json({
      message: "Alert updated successfully",
      alert
    });
  } catch (error) {
    res.status(400).json({
      message: "Failed to update alert",
      error: error.message
    });
  }
};

// DELETE STORED ALERT
exports.deleteAlert = async (req, res) => {
  try {
    const alert = await Alert.findByIdAndDelete(req.params.id);
    if (!alert) {
      return res.status(404).json({ message: "Alert not found" });
    }
    res.status(200).json({
      message: "Alert deleted successfully"
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ALERT STATISTICS
exports.getAlertStats = async (req, res) => {
  try {
    const alerts = await getCurrentAlerts();
    res.status(200).json({
      success: true,
      total: alerts.length,
      critical: alerts.filter((alert) => alert.priority === "Critical").length,
      warnings: alerts.filter((alert) => alert.priority === "Warning").length,
      resolved: alerts.filter((alert) => alert.status === "Resolved").length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
