const jwt = require('jsonwebtoken');

exports.protect = (req, res, next) => {

    try {

        const header = req.headers.authorization || '';

        const token = header.startsWith('Bearer ')
            ? header.slice(7)
            : null;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = {
            _id: decoded.id || decoded._id,
            name: decoded.name || '',
            role: decoded.role || ''
        };

        next();

    } catch (error) {

        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
};

exports.allowRoles = (...roles) => {

    return (req, res, next) => {

        if (!req.user || !req.user.role) {
            return res.status(403).json({
                success: false,
                message: 'Permission denied'
            });
        }

        const normalizedRoles = roles.map((r) => r.toLowerCase());
        if (!normalizedRoles.includes(req.user.role.toLowerCase())) {
            return res.status(403).json({
                success: false,
                message: 'Permission denied'
            });
        }

        next();
    };
};