const Spare = require('../models/Spare');
const StockTransaction = require('../models/StockTransaction');
const StockAlert = require('../models/StockAlert');

async function syncStockAlert(spare, session, userId) {

    const alertQuery = StockAlert.findOne({
        spare: spare._id,
        status: 'OPEN'
    });
    if (session) alertQuery.session(session);
    const openAlert = await alertQuery;

    if (spare.stock <= spare.minStock) {

        const severity = spare.stock <= 0 ? 'OUT' : 'LOW';

        const message = severity === 'OUT'
            ? `${spare.name} is out of stock. Restore it now.`
            : `${spare.name} is down to ${spare.stock}. Minimum stock is ${spare.minStock}.`;

        if (openAlert) {

            openAlert.severity = severity;
            openAlert.message = message;

            await openAlert.save(session ? { session } : {});

        } else {

            await StockAlert.create([{
                spare: spare._id,
                severity,
                message
            }], session ? { session } : {});

        }

    } else if (openAlert) {

        openAlert.status = 'RESOLVED';
        openAlert.resolvedAt = new Date();
        openAlert.resolvedBy = userId || null;

        await openAlert.save(session ? { session } : {});
    }
}

async function changeStock({
    spareId,
    quantity,
    direction,
    reason,
    referenceType = 'MANUAL',
    referenceId = null,
    machineId = null,
    user = null,
    session = null
}) {

    if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error('Quantity must be a positive whole number');
    }

    const spareQuery = Spare.findById(spareId);
    if (session) spareQuery.session(session);
    const spare = await spareQuery;

    if (!spare || !spare.isActive) {
        const error = new Error('Spare part not found or inactive');
        error.statusCode = 404;
        throw error;
    }

    const nextStock = direction === 'IN'
        ? spare.stock + quantity
        : spare.stock - quantity;

    if (nextStock < 0) {
        const error = new Error(
            `Insufficient stock. Available quantity: ${spare.stock}`
        );

        error.statusCode = 409;
        throw error;
    }

    // Prevent concurrent stock updates from overwriting each other.
    const findOptions = {
        new: true,
        runValidators: true
    };
    if (session) findOptions.session = session;

    const updated = await Spare.findOneAndUpdate(
        {
            _id: spare._id,
            stock: spare.stock
        },
        {
            $set: {
                stock: nextStock,
                updatedBy: user?._id || null
            }
        },
        findOptions
    );

    if (!updated) {
        const error = new Error(
            'Stock changed by another user. Please refresh.'
        );
        error.statusCode = 409;
        throw error;
    }

    await StockTransaction.create([{
        spare: spare._id,
        type: direction,
        quantity,
        balanceAfter: updated.stock,
        reason,
        referenceType,
        referenceId,
        machine: machineId,
        performedBy: user?._id || null,
        performedByName: user?.name || ''
    }], session ? { session } : {});

    await syncStockAlert(updated, session, user?._id);

    return updated;
}

module.exports = {
    changeStock,
    syncStockAlert
};