const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Tự động tạo thư mục 'uploads' nếu chưa có
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Public thư mục 'uploads' để giao diện index.html đọc được ảnh
app.use('/uploads', express.static(uploadDir));

// Cấu hình multer để lưu file hình ảnh
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Mảng lưu trữ dữ liệu tạm thời
let products = [
    {
        id: '1',
        title: 'In Ly Nhựa PET 500ml',
        category: 'In Ly Nhựa',
        priceNote: 'Giá từ 380đ / ly',
        desc: 'Ly nhựa PET cao cấp, trong suốt, thích hợp đựng cà phê, trà trái cây.',
        imageUrl: 'https://via.placeholder.com/300x200?text=Ly+Nhua+PET'
    }
];

let orders = [];

/* ==================== API PUBLIC (KHÁCH HÀNG) ==================== */

// Lấy danh sách sản phẩm
app.get('/api/products', (req, res) => {
    res.json({ success: true, data: products });
});

// Tạo đơn hàng mới từ form đặt in
app.post('/api/orders', (req, res) => {
    const { fullname, phone, product, quantity, note } = req.body;
    if (!fullname || !phone || !product) {
        return res.status(400).json({ success: false, message: 'Thừa thông tin bắt buộc!' });
    }

    const newOrder = {
        id: Date.now().toString(),
        fullname,
        phone,
        product,
        quantity: quantity || '1',
        note: note || '',
        status: 'NEW',
        createdAt: new Date()
    };

    orders.unshift(newOrder);
    res.json({ success: true, data: newOrder });
});

/* ==================== API ADMIN (QUẢN TRỊ) ==================== */

// Lấy danh sách đơn hàng
app.get('/api/admin/orders', (req, res) => {
    res.json({ success: true, data: orders });
});

// Cập nhật trạng thái đơn hàng
app.patch('/api/admin/orders/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const order = orders.find(o => o.id === id);
    
    if (order) {
        order.status = status;
        return res.json({ success: true, data: order });
    }
    res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
});

// Xóa đơn hàng
app.delete('/api/admin/orders/:id', (req, res) => {
    const { id } = req.params;
    orders = orders.filter(o => o.id !== id);
    res.json({ success: true, message: 'Đã xóa đơn hàng' });
});

// Thêm sản phẩm mới kèm tải ảnh
app.post('/api/admin/products', upload.single('image'), (req, res) => {
    try {
        const { title, category, priceNote, desc } = req.body;
        
        const imageUrl = req.file 
            ? `http://localhost:${PORT}/uploads/${req.file.filename}` 
            : 'https://via.placeholder.com/300x200?text=In+Ban+Me';

        const newProduct = {
            id: Date.now().toString(),
            title,
            category,
            priceNote,
            desc,
            imageUrl
        };

        products.unshift(newProduct);
        res.json({ success: true, data: newProduct });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi upload hình ảnh' });
    }
});

// Xóa sản phẩm
app.delete('/api/admin/products/:id', (req, res) => {
    const { id } = req.params;
    products = products.filter(p => p.id !== id);
    res.json({ success: true, message: 'Đã xóa sản phẩm' });
});

// Khởi chạy Server
app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`Backend Server IN BAN ME running!`);
    console.log(`URL: http://localhost:${PORT}`);
    console.log(`=================================`);
});

// Schema cho đơn lưu trữ (dùng chung cấu trúc với đơn hàng chính)
const ArchivedOrder = mongoose.model('ArchivedOrder', new mongoose.Schema({}, { strict: false, timestamps: true }));

// API: Lưu trữ các đơn hoàn thành
app.post('/api/admin/orders/archive-completed', async (req, res) => {
    try {
        // 1. Tìm tất cả đơn có trạng thái COMPLETED
        const completedOrders = await Order.find({ status: 'COMPLETED' });

        if (completedOrders.length > 0) {
            // 2. Chuyển (chép) các đơn này vào collection lưu trữ "archivedorders"
            const plainOrders = completedOrders.map(doc => doc.toObject());
            await ArchivedOrder.insertMany(plainOrders);

            // 3. Xóa các đơn này khỏi bảng đơn hàng hiện tại
            await Order.deleteMany({ status: 'COMPLETED' });
        }

        res.json({ 
            success: true, 
            message: `Đã chuyển ${completedOrders.length} đơn hoàn thành vào Database lưu trữ.`,
            archivedCount: completedOrders.length 
        });
    } catch (error) {
        console.error('Lỗi khi lưu trữ đơn:', error);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lưu trữ đơn' });
    }
});