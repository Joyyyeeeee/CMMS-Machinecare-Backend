const express = require('express');
const router = express.Router();

const controller = require('../controllers/spareController');

const { protect } = require('../middleware/auth');

const validateObjectId = require('../middleware/validateObjectId');

// Authentication
router.use(protect);

// Dashboard
router.get('/summary', controller.getSpareSummary);

// Alerts
router.get('/alerts', controller.getAlerts);

router.post(
    '/alerts/:alertId/restore',
    validateObjectId('alertId'),
    controller.restoreStockFromAlert
);

// Stock ledger
router.get('/ledger', controller.getLedger);

// Maintenance history
router.get(
    '/maintenance-history',
    controller.getMaintenanceHistory
);

// Machine-wise spare mapping
router.get(
    '/machine/:machineId',
    validateObjectId('machineId'),
    controller.getMachineSpares
);

router.post(
    '/machine/:machineId/:spareId/unmap',
    validateObjectId('machineId'),
    validateObjectId('spareId'),
    controller.unmapSpareFromMachine
);

// Maintenance
router.post(
    '/maintenance',
    controller.createMaintenanceLog
);

// Spare master
router.get('/', controller.getSpares);

router.post('/', controller.createSpare);

router.get(
    '/:id',
    validateObjectId('id'),
    controller.getSpareById
);

router.put(
    '/:id',
    validateObjectId('id'),
    controller.updateSpare
);

router.delete(
    '/:id',
    validateObjectId('id'),
    controller.deleteSpare
);

// Machine mapping
router.post(
    '/:id/map-machine',
    validateObjectId('id'),
    controller.mapSpareToMachine
);

// Stock management
router.post(
    '/:id/stock-in',
    validateObjectId('id'),
    controller.addStock
);

router.post(
    '/:id/stock-out',
    validateObjectId('id'),
    controller.removeStock
);

module.exports = router;