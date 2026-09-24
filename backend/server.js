const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const { Order, Product } = require('./models');

const app = express();

// Enable CORS & Body Parser
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CẤU HÌNH PHỤC VỤ FILE TĨNH (HTML, CSS, JS, UPLOADS)
app.use(express.static(path.join(__dirname)));

// Cấu hình thư mục uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'));
    }
});
const upload = multer({ storage });

app.use('/uploads', express.static(uploadDir));

// KẾT NỐI MONGODB ATLAS
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/inbanme";
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Kết nối thành công tới Database MongoDB"))
    .catch(err => console.error("❌ Lỗi kết nối MongoDB:", err));

// ==========================================
// THÊM ROUTE HIỂN THỊ GIAO DIỆN (SỬA LỖI CANNOT GET /)
// ==========================================

// Trang chủ hiển thị index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Trang quản trị hiển thị admin.html
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Ping check
app.get('/api/ping', (req, res) => {
    res.json({ success: true, message: "Server is active" });
});

// ==========================================
// 1. API CHO KHÁCH HÀNG (PUBLIC API)
// ==========================================

// Lấy danh sách sản phẩm
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách sản phẩm" });
    }
});

// Khách hàng gửi đơn
app.post('/api/orders', (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) console.error("Multer error:", err);
        next();
    });
}, async (req, res) => {
    try {
        const { fullname, phone, product, quantity, note } = req.body;
        
        if (!fullname || !phone || !product) {
            return res.status(400).json({ success: false, message: "Vui lòng điền đầy đủ các thông tin bắt buộc!" });
        }

        const orderData = { 
            fullname, 
            phone, 
            product, 
            quantity: quantity || '1', 
            note: note || '' 
        };
        
        if (req.file) {
            orderData.fileUrl = `/uploads/${req.file.filename}`;
        }
        
        const newOrder = new Order(orderData);
        await newOrder.save();
        
        res.status(201).json({ 
            success: true, 
            data: newOrder, 
            message: "Gửi yêu cầu báo giá thành công!" 
        });
    } catch (error) {
        console.error("Lỗi lưu đơn hàng:", error);
        res.status(500).json({ success: false, message: "Lỗi lưu dữ liệu đơn hàng: " + error.message });
    }
});

// ==========================================
// 2. API CHO QUẢN TRỊ VIÊN (ADMIN API)
// ==========================================

app.get('/api/admin/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json({ success: true, data: orders });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách đơn hàng" });
    }
});

app.patch('/api/admin/orders/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const updatedOrder = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
        res.json({ success: true, data: updatedOrder });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi cập nhật trạng thái đơn" });
    }
});

app.delete('/api/admin/orders/:id', async (req, res) => {
    try {
        await Order.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Đã xóa đơn hàng" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi khi xóa đơn hàng" });
    }
});

app.post('/api/admin/products', upload.single('image'), async (req, res) => {
    try {
        const { title, category, priceNote, desc } = req.body;
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : 'https://via.placeholder.com/300x200?text=In+Ban+Me';
        
        const newProduct = new Product({ title, category, priceNote, desc, imageUrl });
        await newProduct.save();
        
        res.status(201).json({ success: true, data: newProduct });
    } catch (error) {
        console.error("Lỗi thêm sản phẩm:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống khi thêm sản phẩm" });
    }
});

app.delete('/api/admin/products/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Đã xóa sản phẩm" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi khi xóa sản phẩm" });
    }
});

app.post('/api/admin/orders/archive-completed', async (req, res) => {
    try {
        const result = await Order.deleteMany({ status: 'COMPLETED' });
        res.json({ success: true, archivedCount: result.deletedCount });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi khi dọn dẹp đơn hoàn thành" });
    }
});

// Khởi chạy Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại cổng ${PORT}`);
});