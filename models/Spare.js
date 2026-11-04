const mongoose = require('mongoose');

const spareSchema = new mongoose.Schema({
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

    // Mirrored aliases to satisfy any legacy indexes or queries
    partCode: {
        type: String,
        uppercase: true,
        trim: true
    },

    partName: {
        type: String,
        trim: true
    },

    description: {
        type: String,
        default: ''
    },

    category: {
        type: String,
        default: ''
    },

    unit: {
        type: String,
        default: 'Nos'
    },

    stock: {
        type: Number,
        default: 0,
        min: 0
    },

    minStock: {
        type: Number,
        default: 0,
        min: 0
    },

    maxStock: {
        type: Number,
        default: 0,
        min: 0
    },

    location: {
        type: String,
        default: ''
    },

    supplier: {
        type: String,
        default: ''
    },

    unitCost: {
        type: Number,
        default: 0,
        min: 0
    },

    isActive: {
        type: Boolean,
        default: true
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },

    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    }

}, { timestamps: true });

// Ensure partCode and partName always mirror code and name
spareSchema.pre('save', function () {
    if (this.code) {
        this.partCode = this.code;
    }
    if (this.name) {
        this.partName = this.name;
    }
});

spareSchema.virtual('stockStatus').get(function () {
    if (this.stock <= 0) return 'Out';
    if (this.stock <= this.minStock) return 'Low';
    return 'OK';
});

spareSchema.set('toJSON', { virtuals: true });
spareSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Spare', spareSchema);
