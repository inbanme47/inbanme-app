const mongoose = require('mongoose');

// Schema Sản phẩm / Dịch vụ
const productSchema = new mongoose.Schema({
    title: { type: String, required: true },
    category: { type: String, required: true },
    priceNote: { type: String, required: true },
    desc: { type: String, required: true },
    images: [{ type: String }]
}, { timestamps: true });

// Schema Đơn hàng / Yêu cầu báo giá
const orderSchema = new mongoose.Schema({
    fullname: { type: String, required: true },
    phone: { type: String, required: true },
    product: { type: String, required: true },
    quantity: { type: String, required: true },
    note: { type: String, default: '' },
    status: { type: String, default: 'Chờ xử lý' }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);

module.exports = { Product, Order };