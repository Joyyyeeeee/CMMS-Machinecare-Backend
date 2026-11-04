const mongoose = require('mongoose');

const usedSpareSchema = new mongoose.Schema({

    spare: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Spare',
        required: true
    },

    quantity: {
        type: Number,
        required: true,
        min: 1
    }

}, { _id: false });

const maintenanceLogSchema = new mongoose.Schema({

    machine: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Machine',
        required: true
    },

    maintenanceType: {
        type: String,
        enum: ['Breakdown', 'Preventive', 'Inspection', 'Other'],
        required: true
    },

    description: {
        type: String,
        default: 'No description'
    },

    statusAfter: {
        type: String,
        default: 'Running'
    },

    technician: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },

    technicianName: {
        type: String,
        default: ''
    },

    sparesUsed: {
        type: [usedSpareSchema],
        default: []
    },

    performedAt: {
        type: Date,
        default: Date.now
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    }

}, { timestamps: true });

module.exports = mongoose.model(
    'MaintenanceLog',
    maintenanceLogSchema
);