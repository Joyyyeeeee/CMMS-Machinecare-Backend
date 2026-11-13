const Employee = require("../models/employeesModel");

const initialEmployees = [
    { employeeId: "EMP-001", name: "Karthik S", department: "Maintenance", designation: "Maintenance Engineer", email: "karthik.s@machinecare.io", phone: "+91 98765 43210", status: "Active", joiningDate: new Date("2023-01-11") },
    { employeeId: "EMP-002", name: "Anita R", department: "Production", designation: "Technician", email: "anita.r@machinecare.io", phone: "+91 98765 43211", status: "Active", joiningDate: new Date("2023-02-15") },
    { employeeId: "EMP-003", name: "Suresh P", department: "Quality", designation: "Quality Engineer", email: "suresh.p@machinecare.io", phone: "+91 98765 43212", status: "On Leave", joiningDate: new Date("2023-03-10") },
    { employeeId: "EMP-004", name: "Abi M", department: "Maintenance", designation: "Supervisor", email: "abi.m@machinecare.io", phone: "+91 98765 43213", status: "Active", joiningDate: new Date("2023-04-01") },
    { employeeId: "EMP-005", name: "Joy D", department: "Production", designation: "Operator", email: "joy.d@machinecare.io", phone: "+91 98765 43214", status: "Inactive", joiningDate: new Date("2023-04-12") },
    { employeeId: "EMP-006", name: "Ramesh K", department: "Maintenance", designation: "Electrical Tech", email: "ramesh.k@machinecare.io", phone: "+91 98765 43215", status: "Active", joiningDate: new Date("2023-05-18") },
    { employeeId: "EMP-007", name: "Pooja V", department: "Quality", designation: "QA Analyst", email: "pooja.v@machinecare.io", phone: "+91 98765 43216", status: "Active", joiningDate: new Date("2023-06-20") },
    { employeeId: "EMP-008", name: "Vikram N", department: "Production", designation: "Line Supervisor", email: "vikram.n@machinecare.io", phone: "+91 98765 43217", status: "Active", joiningDate: new Date("2023-07-04") },
    { employeeId: "EMP-009", name: "Meena B", department: "Maintenance", designation: "Mechanical Tech", email: "meena.b@machinecare.io", phone: "+91 98765 43218", status: "Active", joiningDate: new Date("2023-08-14") },
    { employeeId: "EMP-010", name: "Deepak T", department: "Safety", designation: "Safety Officer", email: "deepak.t@machinecare.io", phone: "+91 98765 43219", status: "Active", joiningDate: new Date("2023-09-01") },
    { employeeId: "EMP-011", name: "Kavitha L", department: "Production", designation: "Machine Operator", email: "kavitha.l@machinecare.io", phone: "+91 98765 43220", status: "Active", joiningDate: new Date("2023-09-15") },
    { employeeId: "EMP-012", name: "Arun C", department: "Maintenance", designation: "Maintenance Tech", email: "arun.c@machinecare.io", phone: "+91 98765 43221", status: "Active", joiningDate: new Date("2023-10-02") },
    { employeeId: "EMP-013", name: "Divya M", department: "Quality", designation: "Quality Inspector", email: "divya.m@machinecare.io", phone: "+91 98765 43222", status: "Active", joiningDate: new Date("2023-10-25") },
    { employeeId: "EMP-014", name: "Manoj G", department: "Production", designation: "Operator", email: "manoj.g@machinecare.io", phone: "+91 98765 43223", status: "Active", joiningDate: new Date("2023-11-10") },
    { employeeId: "EMP-015", name: "Sneha P", department: "Safety", designation: "EHS Specialist", email: "sneha.p@machinecare.io", phone: "+91 98765 43224", status: "Active", joiningDate: new Date("2023-11-28") },
    { employeeId: "EMP-016", name: "Praveen S", department: "Maintenance", designation: "HVAC Tech", email: "praveen.s@machinecare.io", phone: "+91 98765 43225", status: "On Leave", joiningDate: new Date("2023-12-05") },
    { employeeId: "EMP-017", name: "Nisha R", department: "Production", designation: "Assembly Tech", email: "nisha.r@machinecare.io", phone: "+91 98765 43226", status: "Active", joiningDate: new Date("2024-01-15") },
    { employeeId: "EMP-018", name: "Rajesh V", department: "Maintenance", designation: "Hydraulics Tech", email: "rajesh.v@machinecare.io", phone: "+91 98765 43227", status: "Active", joiningDate: new Date("2024-02-01") },
    { employeeId: "EMP-019", name: "Bhavana K", department: "Quality", designation: "QA Tech", email: "bhavana.k@machinecare.io", phone: "+91 98765 43228", status: "Active", joiningDate: new Date("2024-02-20") },
    { employeeId: "EMP-020", name: "Girish D", department: "Production", designation: "CNC Machinist", email: "girish.d@machinecare.io", phone: "+91 98765 43229", status: "Active", joiningDate: new Date("2024-03-05") },
    { employeeId: "EMP-021", name: "Keerthi N", department: "Maintenance", designation: "PLC Specialist", email: "keerthi.n@machinecare.io", phone: "+91 98765 43230", status: "Active", joiningDate: new Date("2024-03-22") },
    { employeeId: "EMP-022", name: "Mohan T", department: "Production", designation: "Press Operator", email: "mohan.t@machinecare.io", phone: "+91 98765 43231", status: "Active", joiningDate: new Date("2024-04-10") },
    { employeeId: "EMP-023", name: "Swathi A", department: "Management", designation: "Plant Manager", email: "swathi.a@machinecare.io", phone: "+91 98765 43232", status: "Active", joiningDate: new Date("2024-05-02") },
    { employeeId: "EMP-024", name: "Vimal R", department: "Maintenance", designation: "Apprentice", email: "vimal.r@machinecare.io", phone: "+91 98765 43233", status: "Inactive", joiningDate: new Date("2024-06-15") }
];

async function seedInitialEmployeesIfEmpty() {
    try {
        const count = await Employee.countDocuments();
        if (count === 0) {
            await Employee.insertMany(initialEmployees);
        }
    } catch (e) {
        console.warn("Employee seeding notice:", e.message);
    }
}

// ADD EMPLOYEE
exports.createEmployee = async (req, res) => {
    try {
        const employee = await Employee.create(req.body);

        res.status(201).json({
            success: true,
            message: "Employee added successfully",
            data: employee
        });

    } catch (error) {
        res.status(error.code === 11000 ? 409 : 400).json({
            success: false,
            message: error.code === 11000
                ? "Employee ID or Email already exists"
                : error.message
        });
    }
};

// GET ALL EMPLOYEES
exports.getAllEmployees = async (req, res) => {
    try {
        await seedInitialEmployeesIfEmpty();

        const { search, status, department } = req.query;

        let filter = {};

        if (status && status !== 'all') filter.status = status;
        if (department && department !== 'all') filter.department = department;

        if (search) {
            filter.$or = [
                { employeeId: { $regex: search, $options: "i" } },
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { department: { $regex: search, $options: "i" } },
                { designation: { $regex: search, $options: "i" } }
            ];
        }

        const employees = await Employee.find(filter)
            .sort({ employeeId: 1, createdAt: 1 });

        res.status(200).json({
            success: true,
            count: employees.length,
            data: employees
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// GET EMPLOYEE BY ID
exports.getEmployeeById = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        res.status(200).json({
            success: true,
            data: employee
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: "Invalid employee ID"
        });
    }
};

// UPDATE EMPLOYEE
exports.updateEmployee = async (req, res) => {
    try {
        const allowedFields = [
            "employeeId",
            "name",
            "department",
            "designation",
            "email",
            "phone",
            "status",
            "joiningDate"
        ];

        const updates = {};

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        const employee = await Employee.findByIdAndUpdate(
            req.params.id,
            updates,
            {
                new: true,
                runValidators: true
            }
        );

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Employee updated successfully",
            data: employee
        });

    } catch (error) {
        res.status(error.code === 11000 ? 409 : 400).json({
            success: false,
            message: error.code === 11000
                ? "Employee ID or Email already exists"
                : error.message
        });
    }
};

// DELETE EMPLOYEE
exports.deleteEmployee = async (req, res) => {
    try {
        const employee = await Employee.findByIdAndDelete(req.params.id);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Employee deleted successfully"
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: "Invalid employee ID"
        });
    }
};

// EMPLOYEE STATISTICS
exports.getEmployeeStats = async (req, res) => {
    try {
        await seedInitialEmployeesIfEmpty();

        const total = await Employee.countDocuments();

        const active = await Employee.countDocuments({
            status: "Active"
        });

        const onLeave = await Employee.countDocuments({
            status: "On Leave"
        });

        const inactive = await Employee.countDocuments({
            status: "Inactive"
        });

        res.status(200).json({
            success: true,
            data: {
                total,
                active,
                onLeave,
                inactive
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
