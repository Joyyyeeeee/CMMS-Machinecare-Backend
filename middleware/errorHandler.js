module.exports = (err, req, res, next) => {

    if (err.code === 11000) {
        console.error('MongoDB Duplicate Key 11000:', err.keyValue, err.keyPattern);
        const duplicateField = Object.keys(err.keyValue || {})[0] || 'record';
        const duplicateVal = err.keyValue ? err.keyValue[duplicateField] : '';
        return res.status(409).json({
            success: false,
            message: `A spare part with ${duplicateField} "${duplicateVal}" already exists in the system. Please use a unique value or edit the existing part.`
        });
    }

    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }

    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: 'Invalid identifier'
        });
    }

    console.error(err);

    return res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
};