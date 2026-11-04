
const User = require("../models/user");
const jwt = require("jsonwebtoken");

// Generate JWT token
const generateToken = (id) => {
    return jwt.sign(
        { id },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    );
};

// POST - Register user
const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters."
            });
        }

        const existingUser = await User.findOne({
            email: email.toLowerCase()
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email already registered."
            });
        }

        // First registered user becomes Admin
        const userCount = await User.countDocuments();

        const user = await User.create({
            name,
            email,
            password,
            role: userCount === 0 ? "Admin" : "Technician"
        });

        res.status(201).json({
            success: true,
            message: "User registered successfully.",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// POST - Login user
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const user = await User.findOne({
            email: email.toLowerCase()
        }).select("+password");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: "Your account is disabled."
            });
        }

        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const token = generateToken(user._id);

        res.status(200).json({
            success: true,
            message: "Login successful.",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// GET - Get all users (Admin)
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select("-password");

        res.status(200).json({
            success: true,
            count: users.length,
            users
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// GET - Get user by ID (Admin or own profile)
const getUserById = async (req, res) => {
    try {
        const isAdmin = req.user.role === "Admin";
        const isOwnProfile = req.user._id.toString() === req.params.id;

        if (!isAdmin && !isOwnProfile) {
            return res.status(403).json({
                success: false,
                message: "You can only view your own profile."
            });
        }

        const user = await User.findById(req.params.id)
            .select("-password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        res.status(200).json({
            success: true,
            user
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// PUT - Update user (Admin or own profile)
const updateUser = async (req, res) => {
    try {
        const isAdmin = req.user.role === "Admin";
        const isOwnProfile = req.user._id.toString() === req.params.id;

        if (!isAdmin && !isOwnProfile) {
            return res.status(403).json({
                success: false,
                message: "You can only update your own profile."
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const { name, email, password, role, isActive } = req.body;

        if (name !== undefined) user.name = name;

        if (email !== undefined) {
            const normalizedEmail = email.toLowerCase();

            const duplicate = await User.findOne({
                email: normalizedEmail,
                _id: { $ne: user._id }
            });

            if (duplicate) {
                return res.status(409).json({
                    success: false,
                    message: "Email already in use."
                });
            }

            user.email = normalizedEmail;
        }

        // Only Admin can change roles and account status
        if (isAdmin) {
            if (role !== undefined) {
                if (!["Admin", "Technician"].includes(role)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid role."
                    });
                }

                user.role = role;
            }

            if (isActive !== undefined) {
                user.isActive = isActive;
            }
        } else if (role !== undefined || isActive !== undefined) {
            return res.status(403).json({
                success: false,
                message: "Only Admin can change role or account status."
            });
        }

        if (password !== undefined) {
            if (password.length < 8) {
                return res.status(400).json({
                    success: false,
                    message: "Password must contain at least 8 characters."
                });
            }

            user.password = password;
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: "User updated successfully.",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// DELETE - Delete user (Admin only)
const deleteUser = async (req, res) => {
    try {
        if (req.user._id.toString() === req.params.id) {
            return res.status(400).json({
                success: false,
                message: "You cannot delete your own account."
            });
        }

        const user = await User.findByIdAndDelete(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        res.status(200).json({
            success: true,
            message: "User deleted successfully."
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser
};
