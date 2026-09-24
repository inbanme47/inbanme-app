const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const Order = require('./models');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cấu hình lưu trữ file với Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Serves static uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// KẾT NỐI MONGODB ATLAS
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/inbanme";
mongoose.connect(MONGO_URI)
    .then(() => console.log("Đã kết nối thành công tới MongoDB Atlas"))
    .catch(err => console.error("Lỗi kết nối MongoDB:", err));

// API 1: Người dùng gửi yêu cầu/đặt hàng (CUSTOMER)
app.post('/api/orders', upload.single('file'), async (req, res) => {
    try {
        const orderData = { ...req.body };
        if (req.file) {
            orderData.fileUrl = `/uploads/${req.file.filename}`;
        }
        const newOrder = new Order(orderData);
        await newOrder.save();
        res.status(201).json({ message: "Gửi yêu cầu thành công!", order: newOrder });
    } catch (error) {
        console.error("Lỗi lưu đơn hàng:", error);
        res.status(500).json({ error: "Lỗi lưu dữ liệu" });
    }
});

// API 2: Admin lấy toàn bộ danh sách đơn hàng (ADMIN)
app.get('/api/admin/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: "Lỗi lấy dữ liệu" });
    }
});

// Phục vụ Static Files cho Frontend
const customerPath = path.join(__dirname, '../frontend-customer');
const adminPath = path.join(__dirname, '../frontend-admin');

app.use(express.static(customerPath));
app.use('/admin', express.static(adminPath));

// Route Catch-all trả về trang giao diện

app.get('/admin/:splat*', (req, res) => {
    res.sendFile(path.join(adminPath, 'admin.html'));
});

app.get('/:splat*', (req, res) => {
    res.sendFile(path.join(customerPath, 'index.html'));
});

// Khởi chạy server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});