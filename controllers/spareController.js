const mongoose = require('mongoose');

const Spare = require('../models/Spare');
const MachineSpare = require('../models/MachineSpare');
const StockTransaction = require('../models/StockTransaction');
const StockAlert = require('../models/StockAlert');
const MaintenanceLog = require('../models/MaintenanceLog');

const { changeStock } = require('../services/stockService');
const asyncHandler = require('../utils/asyncHandler');

const getMachineModel = () => mongoose.model('Machine');

const validateMachineIds = async (machineIds) => {
    if (!Array.isArray(machineIds)) {
        return { error: 'Machine IDs must be provided as a list' };
    }

    const uniqueIds = [...new Set(machineIds.map(String))];
    if (uniqueIds.some((id) => !mongoose.isValidObjectId(id))) {
        return { error: 'One or more selected machines are invalid' };
    }

    const Machine = getMachineModel();
    const existingMachines = await Machine.countDocuments({
        _id: { $in: uniqueIds }
    });
    if (existingMachines !== uniqueIds.length) {
        return { error: 'One or more selected machines no longer exist' };
    }

    return { machineIds: uniqueIds };
};

const syncSpareMachines = async (spareId, machineIds) => {
    if (machineIds.length) {
        await MachineSpare.bulkWrite(machineIds.map((machineId) => ({
            updateOne: {
                filter: { machine: machineId, spare: spareId },
                update: { $setOnInsert: { requiredQty: 1 } },
                upsert: true
            }
        })));
    }

    await MachineSpare.deleteMany({
        spare: spareId,
        machine: { $nin: machineIds }
    });
};

// 1. CREATE SPARE

exports.createSpare = asyncHandler(async (req, res) => {

    const {
        code,
        name,
        description,
        category,
        unit,
        stock,
        minStock,
        maxStock,
        location,
        supplier,
        unitCost,
        machineIds = []
    } = req.body;

    const initialStock = stock === undefined ? 0 : Number(stock);
    const initialMinStock = minStock === undefined ? 0 : Number(minStock);
    const initialMaxStock = maxStock === undefined ? 10 : Number(maxStock);

    if (!code || !name) {
        return res.status(400).json({
            success: false,
            message: 'Spare code and name are required'
        });
    }

    const cleanCode = String(code).trim().toUpperCase();
    const cleanName = String(name).trim();

    const validatedMachines = await validateMachineIds(machineIds);
    if (validatedMachines.error) {
        return res.status(400).json({
            success: false,
            message: validatedMachines.error
        });
    }

    // Check if a spare with this code already exists
    const existing = await Spare.findOne({ code: cleanCode });
    if (existing) {
        if (!existing.isActive) {
            const nextMinStock = minStock === undefined
                ? existing.minStock
                : initialMinStock;
            const nextMaxStock = maxStock === undefined
                ? existing.maxStock
                : initialMaxStock;
            if (nextMaxStock < nextMinStock) {
                return res.status(400).json({
                    success: false,
                    message: 'Maximum stock must be greater than or equal to minimum stock'
                });
            }

            // It was previously soft-deleted or deactivated: Reactivate it with the new info!
            existing.isActive = true;
            existing.name = cleanName;
            existing.partCode = cleanCode;
            existing.partName = cleanName;
            existing.description = description || existing.description;
            existing.category = category || existing.category;
            existing.unit = unit || existing.unit;
            const previousStock = existing.stock;
            if (stock !== undefined) existing.stock = initialStock;
            if (minStock !== undefined) existing.minStock = initialMinStock;
            if (maxStock !== undefined) existing.maxStock = initialMaxStock;
            existing.location = location || existing.location;
            existing.supplier = supplier || existing.supplier;
            if (unitCost !== undefined) existing.unitCost = Number(unitCost);
            existing.updatedBy = req.user?._id;
            await existing.save();

            if (Object.prototype.hasOwnProperty.call(req.body, 'machineIds')) {
                await syncSpareMachines(existing._id, validatedMachines.machineIds);
            }

            if (stock !== undefined && initialStock !== previousStock) {
                await StockTransaction.create({
                    spare: existing._id,
                    type: initialStock > previousStock ? 'IN' : 'OUT',
                    quantity: Math.abs(initialStock - previousStock),
                    balanceAfter: initialStock,
                    reason: 'Stock adjusted on reactivation',
                    referenceType: 'MANUAL',
                    performedByName: req.user?.name || 'Admin',
                    transactionAt: new Date()
                });
            }

            if (initialMaxStock < initialMinStock) {
                return res.status(400).json({
                    success: false,
                    message: 'Maximum stock must be greater than or equal to minimum stock'
                });
            }

            return res.status(200).json({
                success: true,
                message: `Spare part "${cleanCode}" reactivated and updated successfully`,
                data: {
                    ...existing.toJSON(),
                    machines: await MachineSpare.find({ spare: existing._id })
                        .populate('machine', 'code name location')
                        .lean()
                }
            });
        }

        return res.status(409).json({
            success: false,
            message: `A spare part with code "${cleanCode}" already exists ("${existing.name}"). Please use a different code or edit the existing part.`
        });
    }

    const spareData = {
        code: cleanCode,
        name: cleanName,
        partCode: cleanCode,
        partName: cleanName,
        description,
        category,
        unit,
        stock: initialStock,
        minStock: initialMinStock,
        maxStock: initialMaxStock,
        location,
        supplier,
        unitCost,
        isActive: true,
        createdBy: req.user?._id
    };

    let spare;
    try {
        spare = await Spare.create(spareData);
    } catch (err) {
        const obsoleteUniqueField = ['partCode', 'partName'].find((field) =>
            err.code === 11000 && (
                err.keyPattern?.[field] ||
                err.keyValue?.[field] !== undefined ||
                err.message?.includes(`${field}_`)
            )
        );

        if (obsoleteUniqueField) {
            try {
                await mongoose.connection.db.collection('spares').dropIndex(`${obsoleteUniqueField}_1`);
            } catch (dropErr) {
                if (dropErr.code !== 27 && dropErr.codeName !== 'IndexNotFound') {
                    throw dropErr;
                }
            }
            spare = await Spare.create(spareData);
        } else {
            throw err;
        }
    }

    await syncSpareMachines(spare._id, validatedMachines.machineIds);

    // Record opening stock transaction
    if (initialStock > 0) {
        await StockTransaction.create({
            spare: spare._id,
            type: 'IN',
            quantity: initialStock,
            balanceAfter: initialStock,
            reason: 'Opening stock',
            referenceType: 'MANUAL',
            performedByName: req.user?.name || 'Admin',
            transactionAt: new Date()
        });
    }

    res.status(201).json({
        success: true,
        message: 'Spare created successfully',
        data: spare
    });
});


async function seedInitialDataIfEmpty() {
    return;

    try {
        const shouldSeedDemoData = process.env.SEED_DEMO_DATA === 'true';
        if (!shouldSeedDemoData) return;

        const count = await Spare.countDocuments();
        if (count > 0) return;

        const Machine = getMachineModel();
        const defaultMachines = [
            { code: 'L-01', name: 'Lathe Machine 01', location: 'Shop Floor A', status: 'Running' },
            { code: 'P-02', name: 'Hydraulic Press 02', location: 'Stamping Bay', status: 'Running' },
            { code: 'C-03', name: 'CNC Milling 03', location: 'Shop Floor B', status: 'Running' },
            { code: 'K-04', name: 'Conveyor Line 04', location: 'Assembly Line', status: 'Running' }
        ];

        const machineMap = {};
        for (const m of defaultMachines) {
            let doc = await Machine.findOne({ code: m.code });
            if (!doc) {
                doc = await Machine.create(m);
            }
            machineMap[m.code] = doc._id;
        }

        const initialSpares = [
            {
                name: 'Bearing 6205',
                code: 'BRG-6205',
                stock: 5,
                minStock: 2,
                maxStock: 10,
                category: 'Mechanical',
                unit: 'Nos',
                machines: ['L-01', 'P-02', 'C-03', 'K-04'],
                lastUsed: new Date('2026-10-15T11:20:00Z'),
                lastRestocked: new Date('2026-10-05T09:15:00Z')
            },
            {
                name: 'V-belt B52',
                code: 'BLT-B52',
                stock: 4,
                minStock: 2,
                maxStock: 10,
                category: 'Transmission',
                unit: 'Nos',
                machines: ['C-03', 'K-04'],
                lastUsed: new Date('2026-10-28T15:40:00Z'),
                lastRestocked: new Date('2026-10-08T14:30:00Z')
            },
            {
                name: 'Hydraulic seal kit',
                code: 'SEL-HK1',
                stock: 3,
                minStock: 1,
                maxStock: 6,
                category: 'Hydraulic',
                unit: 'Kit',
                machines: ['P-02'],
                lastUsed: null,
                lastRestocked: new Date('2026-09-22T10:00:00Z')
            },
            {
                name: 'Proximity sensor',
                code: 'SEN-PRX',
                stock: 6,
                minStock: 2,
                maxStock: 12,
                category: 'Electrical',
                unit: 'Nos',
                machines: ['L-01', 'K-04'],
                lastUsed: null,
                lastRestocked: new Date('2026-09-20T11:30:00Z')
            },
            {
                name: 'Motor brush set',
                code: 'MTR-BRS',
                stock: 2,
                minStock: 1,
                maxStock: 5,
                category: 'Electrical',
                unit: 'Set',
                machines: ['C-03'],
                lastUsed: null,
                lastRestocked: new Date('2026-10-02T14:15:00Z')
            },
            {
                name: 'Oil filter',
                code: 'FLT-OIL',
                stock: 5,
                minStock: 2,
                maxStock: 10,
                category: 'Filtration',
                unit: 'Nos',
                machines: ['L-01', 'P-02'],
                lastUsed: new Date('2026-10-15T16:45:00Z'),
                lastRestocked: new Date('2026-10-05T09:30:00Z')
            }
        ];

        for (const item of initialSpares) {
            const spareDoc = await Spare.create({
                name: item.name,
                code: item.code,
                stock: item.stock,
                minStock: item.minStock,
                maxStock: item.maxStock,
                category: item.category,
                unit: item.unit,
                isActive: true
            });

            for (const mCode of item.machines) {
                if (machineMap[mCode]) {
                    await MachineSpare.create({
                        machine: machineMap[mCode],
                        spare: spareDoc._id,
                        requiredQty: 1
                    });
                }
            }

            if (item.lastRestocked) {
                await StockTransaction.create([{
                    spare: spareDoc._id,
                    type: 'IN',
                    quantity: item.stock + (item.lastUsed ? 1 : 0),
                    balanceAfter: item.stock + (item.lastUsed ? 1 : 0),
                    reason: 'Stock received',
                    referenceType: 'MANUAL',
                    performedByName: 'Meena',
                    transactionAt: item.lastRestocked
                }]);
            }
            if (item.lastUsed) {
                await StockTransaction.create([{
                    spare: spareDoc._id,
                    type: 'OUT',
                    quantity: 1,
                    balanceAfter: item.stock,
                    reason: `Used in maintenance on ${item.machines[0]}`,
                    referenceType: 'MAINTENANCE',
                    performedByName: item.code === 'BLT-B52' ? 'Ravi' : 'Karthik',
                    transactionAt: item.lastUsed
                }]);
            }
        }
    } catch (e) {
        console.error('Seeding error:', e.message);
    }
}

// 2. GET ALL SPARES

exports.getSpares = asyncHandler(async (req, res) => {
    const {
        search,
        status,
        machineId,
        page = 1,
        limit = 50,
        active = 'true'
    } = req.query;

    const filter = {};

    if (search !== undefined && typeof search !== 'string') {
        return res.status(400).json({
            success: false,
            message: 'Search must be a string'
        });
    }

    if (!['true', 'false', 'all'].includes(active)) {
        return res.status(400).json({
            success: false,
            message: 'Active filter must be true, false, or all'
        });
    }

    if (status && !['Out', 'Low', 'OK'].includes(status)) {
        return res.status(400).json({
            success: false,
            message: 'Status filter must be Out, Low, or OK'
        });
    }

    if (active !== 'all') {
        filter.isActive = active !== 'false';
    }

    if (search) {

        const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$or = [
            { code: { $regex: escapedSearch, $options: 'i' } },
            { name: { $regex: escapedSearch, $options: 'i' } },
            { description: { $regex: escapedSearch, $options: 'i' } }
        ];
    }

    if (status === 'Out') {
        filter.$expr = {
            $lte: ['$stock', 0]
        };
    }

    if (status === 'Low') {
        filter.$expr = {
            $and: [
                { $gt: ['$stock', 0] },
                { $lte: ['$stock', '$minStock'] }
            ]
        };
    }

    if (status === 'OK') {
        filter.$expr = {
            $gt: ['$stock', '$minStock']
        };
    }

    if (machineId) {
        if (!mongoose.isValidObjectId(machineId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid machine ID'
            });
        }

        const mappings = await MachineSpare.find({
            machine: machineId
        }).select('spare');

        filter._id = {
            $in: mappings.map(item => item.spare)
        };
    }

    const pageNum = Number(page);
    const requestedPageSize = Number(limit);
    if (!Number.isInteger(pageNum) || pageNum < 1 ||
        !Number.isInteger(requestedPageSize) || requestedPageSize < 1) {
        return res.status(400).json({
            success: false,
            message: 'Page and limit must be positive whole numbers'
        });
    }
    const pageSize = Math.min(200, requestedPageSize);

    const [items, total] = await Promise.all([

        Spare.find(filter)
            .sort({ name: 1, _id: 1 })
            .skip((pageNum - 1) * pageSize)
            .limit(pageSize)
            .lean(),

        Spare.countDocuments(filter)

    ]);

    const ids = items.map(item => item._id);

    const [mappings, latestTransactions] = await Promise.all([
        MachineSpare.find({
            spare: { $in: ids }
        })
            .populate('machine', 'code name location')
            .lean(),
        StockTransaction.aggregate([
            { $match: { spare: { $in: ids }, type: { $in: ['IN', 'OUT'] } } },
            { $sort: { transactionAt: -1, _id: -1 } },
            {
                $group: {
                    _id: { spare: '$spare', type: '$type' },
                    transactionAt: { $first: '$transactionAt' }
                }
            }
        ])
    ]);

    const mappingBySpare = new Map();

    mappings.forEach(mapping => {
        if (!mapping.machine) return;

        const key = String(mapping.spare);

        if (!mappingBySpare.has(key)) {
            mappingBySpare.set(key, new Map());
        }

        mappingBySpare.get(key).set(String(mapping.machine._id), {
            machine: mapping.machine,
            requiredQty: mapping.requiredQty
        });
    });

    const latestBySpare = new Map();
    latestTransactions.forEach(transaction => {
        const spareId = String(transaction._id.spare);
        const dates = latestBySpare.get(spareId) || {
            lastUsed: null,
            lastRestocked: null
        };
        if (transaction._id.type === 'OUT') {
            dates.lastUsed = transaction.transactionAt;
        } else {
            dates.lastRestocked = transaction.transactionAt;
        }
        latestBySpare.set(spareId, dates);
    });

    const data = items.map(spare => ({

        ...spare,

        stockStatus:
            !Number.isFinite(spare.stock) || !Number.isFinite(spare.minStock) ? 'Unknown' :
            spare.stock <= 0 ? 'Out' :
            spare.stock <= spare.minStock ? 'Low' : 'OK',

        machines: Array.from(
            (mappingBySpare.get(String(spare._id)) || new Map()).values()
        ),
        ...(latestBySpare.get(String(spare._id)) || {
            lastUsed: null,
            lastRestocked: null
        })

    }));

    res.json({
        success: true,
        data,
        pagination: {
            total,
            page: pageNum,
            limit: pageSize,
            pages: Math.ceil(total / pageSize)
        }
    });
});


// 3. GET SPARE DETAILS

exports.getSpareById = asyncHandler(async (req, res) => {

    const spare = await Spare.findById(req.params.id);

    if (!spare) {
        return res.status(404).json({
            success: false,
            message: 'Spare not found'
        });
    }

    const mappings = await MachineSpare.find({
        spare: spare._id
    }).populate('machine', 'code name location status');

    res.json({
        success: true,
        data: {
            ...spare.toJSON(),
            machines: mappings
        }
    });
});


// 4. UPDATE SPARE

exports.updateSpare = asyncHandler(async (req, res) => {

    const allowed = [
        'code',
        'name',
        'description',
        'category',
        'unit',
        'minStock',
        'maxStock',
        'location',
        'supplier',
        'unitCost',
        'isActive'
    ];

    const updates = {};
    let selectedMachineIds;

    allowed.forEach(key => {
        if (req.body[key] !== undefined) {
            updates[key] = req.body[key];
        }
    });

    const spare = await Spare.findById(req.params.id);

    if (!spare) {
        return res.status(404).json({
            success: false,
            message: 'Spare not found'
        });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'machineIds')) {
        const validatedMachines = await validateMachineIds(req.body.machineIds);
        if (validatedMachines.error) {
            return res.status(400).json({
                success: false,
                message: validatedMachines.error
            });
        }
        selectedMachineIds = validatedMachines.machineIds;
    }

    // Check code collision if code is updated
    if (updates.code) {
        updates.code = String(updates.code).trim().toUpperCase();
        if (updates.code !== spare.code) {
            const conflict = await Spare.findOne({
                code: updates.code,
                _id: { $ne: spare._id }
            });
            if (conflict) {
                return res.status(409).json({
                    success: false,
                    message: `Another spare part already uses code "${updates.code}" ("${conflict.name}").`
                });
            }
        }
    }

    if (updates.name) {
        updates.name = String(updates.name).trim();
    }

    const nextMin = updates.minStock !== undefined ? Number(updates.minStock) : spare.minStock;
    const nextMax = updates.maxStock !== undefined ? Number(updates.maxStock) : spare.maxStock;

    if (Number(nextMax) < Number(nextMin)) {
        return res.status(400).json({
            success: false,
            message: 'Maximum stock must be greater than or equal to minimum stock'
        });
    }

    Object.assign(updates, {
        updatedBy: req.user?._id || null
    });

    Object.assign(spare, updates);

    await spare.save();

    if (selectedMachineIds) {
        await syncSpareMachines(spare._id, selectedMachineIds);
    }

    // Fetch refreshed mappings
    const mappings = await MachineSpare.find({ spare: spare._id })
        .populate('machine', 'code name location')
        .lean();

    res.json({
        success: true,
        message: 'Spare updated successfully',
        data: {
            ...spare.toJSON(),
            machines: mappings
        }
    });
});


// 5. DELETE / DEACTIVATE SPARE

exports.deleteSpare = asyncHandler(async (req, res) => {

    const spare = await Spare.findById(req.params.id);

    if (!spare) {
        return res.status(404).json({
            success: false,
            message: 'Spare not found'
        });
    }

    // Clean up machine mappings
    await MachineSpare.deleteMany({ spare: spare._id });

    spare.isActive = false;
    await spare.save();

    res.json({
        success: true,
        message: 'Spare deactivated successfully'
    });
});


// 6. MAP SPARE TO MACHINE

exports.mapSpareToMachine = asyncHandler(async (req, res) => {

    const {
        machineId,
        requiredQty = 1,
        notes = ''
    } = req.body;

    if (!mongoose.isValidObjectId(machineId)) {
        return res.status(400).json({
            success: false,
            message: 'Valid machineId is required'
        });
    }

    if (!Number.isInteger(Number(requiredQty)) || Number(requiredQty) < 1) {
        return res.status(400).json({
            success: false,
            message: 'Required quantity must be a positive whole number'
        });
    }

    const Machine = getMachineModel();

    const [machine, spare] = await Promise.all([

        Machine.findById(machineId),

        Spare.findById(req.params.id)

    ]);

    if (!machine) {
        return res.status(404).json({
            success: false,
            message: 'Machine not found'
        });
    }

    if (!spare || !spare.isActive) {
        return res.status(404).json({
            success: false,
            message: 'Spare not found or inactive'
        });
    }

    const mapping = await MachineSpare.findOneAndUpdate(

        {
            machine: machineId,
            spare: spare._id
        },

        {
            $set: {
                requiredQty: Number(requiredQty),
                notes
            }
        },

        {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true
        }

    )
        .populate('machine', 'code name location')
        .populate('spare', 'code name stock');

    res.json({
        success: true,
        message: 'Spare mapped to machine',
        data: mapping
    });
});


// 7. GET MACHINE-WISE SPARES

exports.getMachineSpares = asyncHandler(async (req, res) => {

    const Machine = getMachineModel();

    const machine = await Machine.findById(req.params.machineId);

    if (!machine) {
        return res.status(404).json({
            success: false,
            message: 'Machine not found'
        });
    }

    const mappings = await MachineSpare.find({
        machine: machine._id
    }).populate(
        'spare',
        'code name stock minStock maxStock unit isActive'
    ).sort({ _id: 1 });
    const seenSpares = new Set();
    const uniqueMappings = mappings.filter(mapping => {
        if (!mapping.spare) return false;
        const spareId = String(mapping.spare._id);
        if (seenSpares.has(spareId)) return false;
        seenSpares.add(spareId);
        return true;
    });

    res.json({
        success: true,
        data: uniqueMappings
    });
});


// 8. UNMAP SPARE FROM MACHINE

exports.unmapSpareFromMachine = asyncHandler(async (req, res) => {

    const result = await MachineSpare.findOneAndDelete({
        machine: req.params.machineId,
        spare: req.params.spareId
    });

    if (!result) {
        return res.status(404).json({
            success: false,
            message: 'Machine spare mapping not found'
        });
    }

    res.json({
        success: true,
        message: 'Spare removed from machine'
    });
});


// 9. ADD STOCK

exports.addStock = asyncHandler(async (req, res) => {

    const quantity = Number(req.body.quantity);

    if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({
            success: false,
            message: 'Enter a valid positive quantity'
        });
    }

    const session = await mongoose.startSession();

    try {

        let updated;

        try {
            await session.withTransaction(async () => {
                updated = await changeStock({
                    spareId: req.params.id,
                    quantity,
                    direction: 'IN',
                    reason: req.body.reason || 'Stock received',
                    referenceType: 'MANUAL',
                    user: req.user,
                    session
                });
            });
        } catch (txErr) {
            if (txErr.message && (txErr.message.includes('replica set') || txErr.message.includes('Transaction numbers'))) {
                updated = await changeStock({
                    spareId: req.params.id,
                    quantity,
                    direction: 'IN',
                    reason: req.body.reason || 'Stock received',
                    referenceType: 'MANUAL',
                    user: req.user
                });
            } else {
                throw txErr;
            }
        }

        res.json({
            success: true,
            message: 'Stock added successfully',
            data: updated
        });

    } finally {

        await session.endSession();

    }
});


// 10. REMOVE STOCK

exports.removeStock = asyncHandler(async (req, res) => {

    const quantity = Number(req.body.quantity);

    if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({
            success: false,
            message: 'Enter a valid positive quantity'
        });
    }

    const reason = req.body.reason || 'Manual stock reduction';

    const session = await mongoose.startSession();

    try {

        let updated;

        try {
            await session.withTransaction(async () => {
                updated = await changeStock({
                    spareId: req.params.id,
                    quantity,
                    direction: 'OUT',
                    reason: req.body.reason || 'Manual stock adjustment',
                    referenceType: 'MANUAL',
                    machineId: req.body.machineId || null,
                    user: req.user,
                    session
                });
            });
        } catch (txErr) {
            if (txErr.message && (txErr.message.includes('replica set') || txErr.message.includes('Transaction numbers'))) {
                updated = await changeStock({
                    spareId: req.params.id,
                    quantity,
                    direction: 'OUT',
                    reason: req.body.reason || 'Manual stock adjustment',
                    referenceType: 'MANUAL',
                    machineId: req.body.machineId || null,
                    user: req.user
                });
            } else {
                throw txErr;
            }
        }

        res.json({
            success: true,
            message: 'Stock removed successfully',
            data: updated
        });

    } finally {

        await session.endSession();

    }
});


// 11. GET STOCK LEDGER

exports.getLedger = asyncHandler(async (req, res) => {

    const {
        spareId,
        type,
        from,
        to,
        page = 1,
        limit = 100
    } = req.query;

    const filter = {};

    if (spareId) {
        if (!mongoose.isValidObjectId(spareId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid spare ID'
            });
        }
        filter.spare = spareId;
    }

    if (type) {
        if (!['IN', 'OUT'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Transaction type must be IN or OUT'
            });
        }
        filter.type = type;
    }

    if (from || to) {

        filter.transactionAt = {};

        const fromDate = from ? new Date(from) : null;
        const toDate = to ? new Date(to) : null;
        if ((fromDate && Number.isNaN(fromDate.getTime())) ||
            (toDate && Number.isNaN(toDate.getTime())) ||
            (fromDate && toDate && fromDate > toDate)) {
            return res.status(400).json({
                success: false,
                message: 'Transaction date range is invalid'
            });
        }

        if (fromDate) filter.transactionAt.$gte = fromDate;
        if (toDate) filter.transactionAt.$lte = toDate;

    }

    const pageNum = Number(page);
    const requestedPageSize = Number(limit);
    if (!Number.isInteger(pageNum) || pageNum < 1 ||
        !Number.isInteger(requestedPageSize) || requestedPageSize < 1) {
        return res.status(400).json({
            success: false,
            message: 'Page and limit must be positive whole numbers'
        });
    }
    const pageSize = Math.min(500, requestedPageSize);

    const [data, total] = await Promise.all([

        StockTransaction.find(filter)
            .populate('spare', 'code name unit')
            .populate('machine', 'code name')
            .sort({ transactionAt: -1, _id: -1 })
            .skip((pageNum - 1) * pageSize)
            .limit(pageSize),

        StockTransaction.countDocuments(filter)

    ]);

    res.json({
        success: true,
        data,
        pagination: {
            total,
            page: pageNum,
            limit: pageSize,
            pages: Math.ceil(total / pageSize)
        }
    });
});


// 12. GET STOCK ALERTS

exports.getAlerts = asyncHandler(async (req, res) => {

    const filter = req.query.status === 'all'
        ? {}
        : { status: req.query.status || 'OPEN' };

    const data = await StockAlert.find(filter)
        .populate(
            'spare',
            'code name stock minStock maxStock unit'
        )
        .sort({ createdAt: -1 });

    res.json({
        success: true,
        data,
        count: data.length
    });
});


// 13. RESTORE STOCK FROM ALERT

exports.restoreStockFromAlert = asyncHandler(async (req, res) => {

    const alert = await StockAlert.findById(req.params.alertId);

    if (!alert) {
        return res.status(404).json({
            success: false,
            message: 'Alert not found'
        });
    }

    const spare = await Spare.findById(alert.spare);

    if (!spare) {
        return res.status(404).json({
            success: false,
            message: 'Spare not found'
        });
    }

    const quantity = Math.max(
        0,
        spare.maxStock - spare.stock
    );

    if (!quantity) {
        return res.json({
            success: true,
            message: 'Stock is already at maximum level'
        });
    }

    const session = await mongoose.startSession();

    try {

        let updated;

        await session.withTransaction(async () => {

            updated = await changeStock({

                spareId: spare._id,
                quantity,
                direction: 'IN',
                reason: 'Stock restored from low-stock alert',
                referenceType: 'RESTORE',
                referenceId: alert._id,
                user: req.user,
                session

            });

        });

        res.json({
            success: true,
            message: 'Stock restored successfully',
            data: updated
        });

    } finally {

        await session.endSession();

    }
});


// 14. SAVE MAINTENANCE AND DEDUCT SPARES

exports.createMaintenanceLog = asyncHandler(async (req, res) => {

    const {
        machineId,
        maintenanceType,
        description,
        statusAfter,
        technicianId,
        technicianName,
        sparesUsed = [],
        performedAt
    } = req.body;

    if (!mongoose.isValidObjectId(machineId)) {
        return res.status(400).json({
            success: false,
            message: 'Valid machineId is required'
        });
    }

    if (![
        'Breakdown',
        'Preventive',
        'Inspection',
        'Other'
    ].includes(maintenanceType)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid maintenance type'
        });
    }

    if (!Array.isArray(sparesUsed)) {
        return res.status(400).json({
            success: false,
            message: 'sparesUsed must be an array'
        });
    }

    const Machine = getMachineModel();

    const session = await mongoose.startSession();

    try {

        let log;

        await session.withTransaction(async () => {

            const machine = await Machine.findById(machineId)
                .session(session);

            if (!machine) {
                const error = new Error('Machine not found');
                error.statusCode = 404;
                throw error;
            }

            // Combine duplicate spare entries.

            const quantities = new Map();

            for (const line of sparesUsed) {

                if (
                    !mongoose.isValidObjectId(line.spareId) ||
                    !Number.isInteger(Number(line.quantity)) ||
                    Number(line.quantity) < 1
                ) {

                    const error = new Error(
                        'Invalid spare ID or quantity'
                    );

                    error.statusCode = 400;
                    throw error;
                }

                const id = String(line.spareId);

                quantities.set(
                    id,
                    (quantities.get(id) || 0) +
                    Number(line.quantity)
                );

            }

            const usedLines = [];

            for (const [spareId, quantity] of quantities) {

                const updated = await changeStock({

                    spareId,
                    quantity,
                    direction: 'OUT',

                    reason: `Used in maintenance on ${machine.code || machine.name}`,

                    referenceType: 'MAINTENANCE',
                    machineId: machine._id,
                    user: req.user,
                    session

                });

                usedLines.push({
                    spare: updated._id,
                    quantity
                });

            }

            const created = await MaintenanceLog.create([{

                machine: machine._id,
                maintenanceType,
                description: description || 'No description',
                statusAfter: statusAfter || 'Running',
                technician: technicianId || null,
                technicianName: technicianName || '',
                sparesUsed: usedLines,
                performedAt: performedAt
                    ? new Date(performedAt)
                    : new Date(),
                createdBy: req.user?._id || null

            }], { session });

            log = created[0];

            if (
                statusAfter &&
                machine.status !== undefined
            ) {

                machine.status = statusAfter;
                await machine.save({ session });

            }

        });

        const populated = await MaintenanceLog.findById(log._id)
            .populate('machine', 'code name location')
            .populate('sparesUsed.spare', 'code name unit');

        res.status(201).json({
            success: true,
            message: 'Maintenance saved and spare stock updated',
            data: populated
        });

    } finally {

        await session.endSession();

    }
});


// 15. MAINTENANCE HISTORY

exports.getMaintenanceHistory = asyncHandler(async (req, res) => {

    const filter = {};

    if (req.query.machineId) {
        filter.machine = req.query.machineId;
    }

    const data = await MaintenanceLog.find(filter)
        .populate('machine', 'code name')
        .populate('sparesUsed.spare', 'code name unit')
        .sort({ performedAt: -1 })
        .limit(Math.min(500, Number(req.query.limit) || 100));

    res.json({
        success: true,
        data
    });
});


// 16. SPARE DASHBOARD SUMMARY

exports.getSpareSummary = asyncHandler(async (req, res) => {
    const [
        total,
        inStock,
        low,
        out,
        alerts,
        recentTransactions
    ] = await Promise.all([

        Spare.countDocuments({ isActive: true }),

        Spare.countDocuments({
            isActive: true,
            $expr: {
                $gt: ['$stock', '$minStock']
            }
        }),

        Spare.countDocuments({
            isActive: true,
            $expr: {
                $and: [
                    { $gt: ['$stock', 0] },
                    { $lte: ['$stock', '$minStock'] }
                ]
            }
        }),

        Spare.countDocuments({
            isActive: true,
            $expr: {
                $lte: ['$stock', 0]
            }
        }),

        StockAlert.countDocuments({
            status: 'OPEN'
        }),

        StockTransaction.find()
            .populate('spare', 'code name')
            .sort({ transactionAt: -1, _id: -1 })
            .limit(10)

    ]);

    res.json({
        success: true,

        data: {
            totalParts: total,
            totalSpares: total,
            inStock,
            lowStock: low,
            outOfStock: out,
            openAlerts: alerts,
            recentTransactions
        }
    });
});