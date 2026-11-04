const mongoose = require('mongoose');

const machineSpareSchema = new mongoose.Schema({

    machine: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Machine',
        required: true
    },

    spare: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Spare',
        required: true
    },

    requiredQty: {
        type: Number,
        required: true,
        default: 1,
        min: 1
    },

    notes: {
        type: String,
        default: ''
    }

}, { timestamps: true });

machineSpareSchema.index(
    { machine: 1, spare: 1 },
    { unique: true }
);

module.exports = mongoose.model('MachineSpare', machineSpareSchema);