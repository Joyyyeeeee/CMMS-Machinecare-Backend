const mongoose = require("mongoose");

const sparePartSchema = new mongoose.Schema(
  {
    partCode: {
      type: String,
      required: [true, "Part code is required"],
      unique: true,
      uppercase: true,
      trim: true
    },
    partName: {
      type: String,
      required: [true, "Part name is required"],
      trim: true
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true
    },
    quantity: {
      type: Number,
      default: 0,
      min: 0
    },
    minimumStock: {
      type: Number,
      default: 5,
      min: 0
    },
    unitCost: {
      type: Number,
      default: 0,
      min: 0
    },
    location: {
      type: String,
      default: "",
      trim: true
    },
    unit: {
      type: String,
      default: "Nos"
    },
    description: {
      type: String,
      default: ""
    },
    compatibleMachines: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Machine"
      }
    ],
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("SparePart", sparePartSchema);
