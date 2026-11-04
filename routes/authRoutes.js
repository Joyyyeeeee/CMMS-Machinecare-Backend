
const express = require("express");
const router = express.Router();

const {
    registerUser,
    loginUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser
} = require("../controllers/authController");

const {
    authMiddleware,
    authorizeRoles
} = require("../middleware/authMiddleware");

// POST - Register
router.post("/register", registerUser);

// POST - Login
router.post("/login", loginUser);

// GET - All users (Admin only)
router.get(
    "/",
    authMiddleware,
    authorizeRoles("Admin"),
    getAllUsers
);

// GET - User by ID (Admin or own profile)
router.get(
    "/:id",
    authMiddleware,
    getUserById
);

// PUT - Update user (Admin or own profile)
router.put(
    "/:id",
    authMiddleware,
    updateUser
);

// DELETE - Delete user (Admin only)
router.delete(
    "/:id",
    authMiddleware,
    authorizeRoles("Admin"),
    deleteUser
);

module.exports = router;
