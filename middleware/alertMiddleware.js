const alertMiddleware = (req, res, next) => {
  const {
    title,
    description,
    machineCode,
    alertType,
    priority,
    status
  } = req.body;

  const allowedTypes = [
    "Machine",
    "Maintenance",
    "Spare Parts",
    "Inspection",
    "Other"
  ];

  const allowedPriorities = ["Critical", "Warning", "Info"];
  const allowedStatuses = ["Open", "Pending", "Resolved"];

  if (req.method === "POST") {
    if (!title || !description || !machineCode || !alertType) {
      return res.status(400).json({
        message: "Title, description, machine code and alert type are required"
      });
    }
  }

  if (alertType && !allowedTypes.includes(alertType)) {
    return res.status(400).json({ message: "Invalid alert type" });
  }

  if (priority && !allowedPriorities.includes(priority)) {
    return res.status(400).json({ message: "Invalid priority" });
  }

  if (status && !allowedStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  next();
};

module.exports = alertMiddleware;