module.exports = (req, res) => {
    res.status(200).json({ 
        message: "Hello from test endpoint",
        timestamp: new Date().toISOString()
    });
};