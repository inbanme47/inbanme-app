const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Product, Order } = require('./models');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cấu hình phục vụ file tĩnh (HTML, CSS, JS, Uploads)
app.use(express.static(__dirname)); // Phục vụ index.html, admin.html ở thư mục gốc

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// ================= ROUTE GIAO DIỆN (FIX LỖI CANNOT GET /) ================= //

// Trang chủ dành cho khách hàng
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Trang quản trị dành cho admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// ================= CẤU HÌNH MULTER UPLOAD ================= //

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'img-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// ================= KẾT NỐI DATABASE ================= //

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/inbanme';
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Đã kết nối Database MongoDB thành công'))
    .catch(err => console.log('⚠️ Chưa kết nối MongoDB (Đang chạy chế độ Memory tạm thời):', err.message));

let memoryProducts = [
    {
        _id: "1",
        title: "In NameCard / Danh thiếp theo yêu cầu",
        category: "In Namecard",
        priceNote: "69.000đ/hộp",
        desc: "Giấy Couche 300gsm dày dặn, Cán màng mờ/bóng 2 mặt chống nước nhẹ, tùy chọn bo góc hoặc vuông cạnh theo yêu cầu.",
        images: ["https://via.placeholder.com/300x200?text=NameCard"]
    }
];
let memoryOrders = [];

// ================= API SẢN PHẨM ================= //

// Lấy danh sách sản phẩm
app.get('/api/products', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            const products = await Product.find().sort({ createdAt: -1 });
            return res.json({ success: true, data: products });
        }
        res.json({ success: true, data: memoryProducts });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi tải sản phẩm' });
    }
});

// Thêm sản phẩm mới (Có upload ảnh)
app.post('/api/products', upload.single('image'), async (req, res) => {
    try {
        const { title, category, priceNote, desc } = req.body;
        let imagePath = req.file ? `/uploads/${req.file.filename}` : 'https://via.placeholder.com/300x200?text=InBanMe';

        if (mongoose.connection.readyState === 1) {
            const newProduct = new Product({
                title,
                category,
                priceNote,
                desc,
                images: [imagePath]
            });
            await newProduct.save();
            return res.json({ success: true, message: 'Thêm sản phẩm thành công', data: newProduct });
        } else {
            const newProduct = {
                _id: Date.now().toString(),
                title,
                category,
                priceNote,
                desc,
                images: [imagePath]
            };
            memoryProducts.unshift(newProduct);
            return res.json({ success: true, message: 'Thêm sản phẩm thành công', data: newProduct });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Không thể lưu sản phẩm' });
    }
});

// Xóa sản phẩm
app.delete('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (mongoose.connection.readyState === 1) {
            await Product.findByIdAndDelete(id);
        } else {
            memoryProducts = memoryProducts.filter(p => p._id !== id);
        }
        res.json({ success: true, message: 'Đã xóa sản phẩm' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Không thể xóa sản phẩm' });
    }
});

// ================= API ĐƠN HÀNG ================= //

app.get('/api/orders', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            const orders = await Order.find().sort({ createdAt: -1 });
            return res.json({ success: true, data: orders });
        }
        res.json({ success: true, data: memoryOrders });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi tải đơn hàng' });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        const { fullname, phone, product, quantity, note } = req.body;
        if (mongoose.connection.readyState === 1) {
            const newOrder = new Order({ fullname, phone, product, quantity, note });
            await newOrder.save();
            return res.json({ success: true, message: 'Tạo đơn thành công', data: newOrder });
        } else {
            const newOrder = { _id: Date.now().toString(), fullname, phone, product, quantity, note, createdAt: new Date() };
            memoryOrders.unshift(newOrder);
            return res.json({ success: true, message: 'Tạo đơn thành công', data: newOrder });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: 'Không thể gửi đơn' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server đang chạy tại Port: ${PORT}`));