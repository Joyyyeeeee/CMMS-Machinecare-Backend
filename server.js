const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const machineRoutes = require("./routes/machineRoutes");
const authRoutes = require("./routes/authRoutes");
const sparePartRoutes = require("./routes/sparePartRoutes");
const spareRoutes = require("./routes/spareRoutes");
const { ensureDefaultAdmin } = require("./controllers/authController");
const employeesRoutes = require("./routes/employeesRoutes");
const alertsRoutes = require("./routes/alertsRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("MachineCare Backend is Running!");
});

// Application routes
app.use("/api/auth", authRoutes);
app.use("/api/machines", machineRoutes);
app.use("/api/spare-parts", sparePartRoutes);
app.use("/api/spares", spareRoutes);
app.use("/api/employees", employeesRoutes);
app.use("/api/alerts", alertsRoutes);
// Centralized error handler
app.use(errorHandler);
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    await connectDB();
    await ensureDefaultAdmin();

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log("Default admin ready: admin@gmail.com / Admin@12345");
    });
};

startServer();
