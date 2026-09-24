const mongoose = require('mongoose');

// Schema Đơn Hàng
const orderSchema = new mongoose.Schema({
    fullname: { type: String, required: true },
    phone: { type: String, required: true },
    product: { type: String, required: true },
    quantity: { type: String, required: true },
    note: { type: String, default: '' },
    fileUrl: { type: String, default: '' },
    status: { type: String, enum: ['NEW', 'PROCESSING', 'COMPLETED'], default: 'NEW' }
}, { timestamps: true });

// Schema Sản Phẩm Dịch Vụ
const productSchema = new mongoose.Schema({
    title: { type: String, required: true },
    category: { type: String, required: true },
    priceNote: { type: String, required: true },
    desc: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    icon: { type: String, default: 'fas fa-box' }
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);
const Product = mongoose.model('Product', productSchema);

module.exports = { Order, Product };