const mongoose = require('mongoose');

const stockTransactionSchema = new mongoose.Schema({

    spare: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Spare',
        required: true
    },

    type: {
        type: String,
        enum: ['IN', 'OUT'],
        required: true
    },

    quantity: {
        type: Number,
        required: true,
        min: 1
    },

    balanceAfter: {
        type: Number,
        required: true,
        min: 0
    },

    reason: {
        type: String,
        required: true
    },

    referenceType: {
        type: String,
        enum: ['MANUAL', 'MAINTENANCE', 'RESTORE', 'OPENING'],
        default: 'MANUAL'
    },

    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },

    machine: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Machine',
        default: null
    },

    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },

    performedByName: {
        type: String,
        default: ''
    },

    transactionAt: {
        type: Date,
        default: Date.now
    }

}, { timestamps: true });

module.exports = mongoose.model(
    'StockTransaction',
    stockTransactionSchema
);