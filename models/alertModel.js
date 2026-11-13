const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    alertId: {
      type: String,
      unique: true,
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    machineCode: {
      type: String,
      required: true,
      trim: true
    },
    alertType: {
      type: String,
      enum: ["Machine", "Maintenance", "Spare Parts", "Inspection", "Other"],
      required: true
    },
    priority: {
      type: String,
      enum: ["Critical", "Warning", "Info"],
      default: "Info"
    },
    status: {
      type: String,
      enum: ["Open", "Pending", "Resolved"],
      default: "Open"
    },
    dateTime: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Alert", alertSchema);