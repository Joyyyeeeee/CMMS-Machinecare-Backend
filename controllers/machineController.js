const Machine = require("../models/Machine");
const MachineSpare = require("../models/MachineSpare");
const Spare = require("../models/Spare");
const Employee = require("../models/employeesModel");
const mongoose = require("mongoose");

const validateAssignedEmployees = async (employeeIds) => {
    if (!Array.isArray(employeeIds)) {
        return { error: "Assigned employees must be provided as a list" };
    }

    const uniqueIds = [...new Set(employeeIds.map(String))];
    if (uniqueIds.some((id) => !mongoose.isValidObjectId(id))) {
        return { error: "One or more selected employees are invalid" };
    }

    const activeEmployees = await Employee.countDocuments({
        _id: { $in: uniqueIds },
        status: "Active"
    });

    if (activeEmployees !== uniqueIds.length) {
        return { error: "One or more selected employees are no longer active" };
    }

    return { employeeIds: uniqueIds };
};

const populateAssignedEmployees = (query) =>
    query.populate("assignedEmployees", "employeeId name designation status");

const validateSpareIds = async (spareIds) => {
    if (!Array.isArray(spareIds)) {
        return { error: "Spare parts must be provided as a list" };
    }

    const uniqueIds = [...new Set(spareIds.map(String))];
    if (uniqueIds.some((id) => !mongoose.isValidObjectId(id))) {
        return { error: "One or more selected spare parts are invalid" };
    }

    const existingSpares = await Spare.countDocuments({
        _id: { $in: uniqueIds }
    });

    if (existingSpares !== uniqueIds.length) {
        return { error: "One or more selected spare parts no longer exist" };
    }

    return { spareIds: uniqueIds };
};

const syncMachineSpares = async (machineId, spareIds) => {
    await MachineSpare.deleteMany({
        machine: machineId,
        spare: { $nin: spareIds }
    });

    if (spareIds.length) {
        await MachineSpare.bulkWrite(spareIds.map((spareId) => ({
            updateOne: {
                filter: { machine: machineId, spare: spareId },
                update: { $setOnInsert: { requiredQty: 1 } },
                upsert: true
            }
        })));
    }
};

// POST - Add Machine
exports.createMachine = async (req, res) => {
    try {
        const {
            code,
            name,
            location,
            status,
            spares,
            spareIds,
            assignedEmployees = []
        } = req.body;

        if (!code || !name || !location) {
            return res.status(400).json({
                success: false,
                message: "Code, name and location are required"
            });
        }

        let selectedSpareIds;
        if (spareIds !== undefined) {
            const validated = await validateSpareIds(spareIds);
            if (validated.error) {
                return res.status(400).json({
                    success: false,
                    message: validated.error
                });
            }
            selectedSpareIds = validated.spareIds;
        }

        const validatedEmployees = await validateAssignedEmployees(assignedEmployees);
        if (validatedEmployees.error) {
            return res.status(400).json({
                success: false,
                message: validatedEmployees.error
            });
        }

        const machine = await Machine.create({
            code,
            name,
            location,
            status,
            spares: selectedSpareIds ? selectedSpareIds.length : spares,
            handledBy: [],
            assignedEmployees: validatedEmployees.employeeIds
        });

        if (selectedSpareIds) {
            await syncMachineSpares(machine._id, selectedSpareIds);
        }

        await populateAssignedEmployees(machine);
        res.status(201).json({
            success: true,
            message: "Machine added successfully",
            data: machine
        });

    } catch (error) {
        res.status(error.code === 11000 ? 409 : 500).json({
            success: false,
            message: error.code === 11000
                ? "Machine code already exists"
                : error.message
        });
    }
};


// GET - Get All Machines
exports.getAllMachines = async (req, res) => {
    try {
        const machines = await populateAssignedEmployees(
            Machine.find().sort({ createdAt: -1 })
        );

        res.status(200).json({
            success: true,
            count: machines.length,
            data: machines
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// GET - Get Machine By ID
exports.getMachineById = async (req, res) => {
    try {
        const machine = await populateAssignedEmployees(
            Machine.findById(req.params.id)
        );

        if (!machine) {
            return res.status(404).json({
                success: false,
                message: "Machine not found"
            });
        }

        res.status(200).json({
            success: true,
            data: machine
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: "Invalid machine ID"
        });
    }
};


// PUT - Update Machine
exports.updateMachine = async (req, res) => {
    try {
        const allowedFields = [
            "code",
            "name",
            "location",
            "status",
            "spares"
        ];

        let selectedSpareIds;
        if (req.body.spareIds !== undefined) {
            const validated = await validateSpareIds(req.body.spareIds);
            if (validated.error) {
                return res.status(400).json({
                    success: false,
                    message: validated.error
                });
            }
            selectedSpareIds = validated.spareIds;
        }

        let selectedEmployeeIds;
        if (req.body.assignedEmployees !== undefined) {
            const validated = await validateAssignedEmployees(req.body.assignedEmployees);
            if (validated.error) {
                return res.status(400).json({
                    success: false,
                    message: validated.error
                });
            }
            selectedEmployeeIds = validated.employeeIds;
        }

        const updates = {};

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        if (selectedSpareIds) {
            updates.spares = selectedSpareIds.length;
        }
        if (selectedEmployeeIds) {
            updates.assignedEmployees = selectedEmployeeIds;
            updates.handledBy = [];
        }

        const machine = await Machine.findById(req.params.id);

        if (!machine) {
            return res.status(404).json({
                success: false,
                message: "Machine not found"
            });
        }

        Object.assign(machine, updates);
        await machine.save();

        if (selectedSpareIds) {
            await syncMachineSpares(machine._id, selectedSpareIds);
        }

        await populateAssignedEmployees(machine);
        res.status(200).json({
            success: true,
            message: "Machine updated successfully",
            data: machine
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.code === 11000
                ? "Machine code already exists"
                : error.message
        });
    }
};


// DELETE - Delete Machine
exports.deleteMachine = async (req, res) => {
    try {
        const machine = await Machine.findByIdAndDelete(req.params.id);

        if (!machine) {
            return res.status(404).json({
                success: false,
                message: "Machine not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Machine deleted successfully"
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: "Invalid machine ID"
        });
    }
};