const mongoose = require("mongoose");

const machineSchema = new mongoose.Schema({

    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },

    name: {
        type: String,
        required: true,
        trim: true
    },

    location: {
        type: String,
        required: true,
        trim: true
    },

    status: {
        type: String,
        enum: ["Running", "Under maintenance", "Stopped"],
        default: "Running"
    },

    spares: {
        type: Number,
        default: 0,
        min: 0
    },

    handledBy: [{
        type: String,
        trim: true
    }],

    assignedEmployees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee"
    }]

}, { timestamps: true });

module.exports = mongoose.model("Machine", machineSchema);  
