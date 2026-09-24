const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    customerName: String,
    phone: String,
    note: String,
    status: { type: String, default: 'Chờ xử lý' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);