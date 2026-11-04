const mongoose = require('mongoose');

const stockAlertSchema = new mongoose.Schema({

    spare: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Spare',
        required: true
    },

    severity: {
        type: String,
        enum: ['LOW', 'OUT'],
        required: true
    },

    message: {
        type: String,
        required: true
    },

    status: {
        type: String,
        enum: ['OPEN', 'RESOLVED'],
        default: 'OPEN'
    },

    resolvedAt: {
        type: Date,
        default: null
    },

    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    }

}, { timestamps: true });

stockAlertSchema.index({ spare: 1, status: 1 });

module.exports = mongoose.model('StockAlert', stockAlertSchema);