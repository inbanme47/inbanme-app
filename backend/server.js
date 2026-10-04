const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const { Order, Product } = require('./models');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const customerDir = path.join(__dirname, '..', 'frontend-customer');
const adminDir = path.join(__dirname, '..', 'frontend-admin');

app.use(express.static(customerDir));
app.use(express.static(adminDir));

// Thư mục lưu tệp tải lên
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, 'prod-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 10 * 1024 * 1024,
        files: 20
    }
});

app.use('/uploads', express.static(uploadDir));

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/inbanme";
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Kết nối thành công tới Database MongoDB"))
    .catch(err => console.error("❌ Lỗi kết nối MongoDB:", err));

// GIAO DIỆN
app.get('/', (req, res) => {
    res.sendFile(path.join(customerDir, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(adminDir, 'admin.html'));
});

app.get('/api/ping', (req, res) => {
    res.json({ success: true, message: "Server is active" });
});

// API PUBLIC
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách sản phẩm" });
    }
});

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

// API ADMIN - ĐƠN HÀNG
app.get('/api/admin/orders', async (req, res) => {
    try {
        const orders = await Order.find({ status: { $ne: 'ARCHIVED' } }).sort({ createdAt: -1 });
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

// API ADMIN - SẢN PHẨM
// 1. Thêm mới
app.post('/api/admin/products', (req, res) => {
    upload.array('images', 20)(req, res, async (err) => {
        if (err) {
            console.error("Lỗi Upload Multer:", err);
            return res.status(400).json({ 
                success: false, 
                message: "Lỗi tải ảnh: " + (err.message || "Xảy ra lỗi khi nhận tệp") 
            });
        }

        try {
            const { title, category, priceNote, desc } = req.body;
            
            let images = [];
            if (req.files && req.files.length > 0) {
                images = req.files.map(f => `/uploads/${f.filename}`);
            } else {
                images = ['https://via.placeholder.com/300x200?text=In+Ban+Me'];
            }
            
            const newProduct = new Product({ title, category, priceNote, desc, images });
            await newProduct.save();
            
            return res.status(201).json({ success: true, data: newProduct });
        } catch (error) {
            console.error("Lỗi lưu cơ sở dữ liệu:", error);
            return res.status(500).json({ 
                success: false, 
                message: "Lỗi lưu sản phẩm vào database: " + error.message 
            });
        }
    });
});

// 2. Cập nhật/Sửa sản phẩm
app.post('/api/admin/products/:id/update', (req, res) => {
    upload.array('images', 20)(req, res, async (err) => {
        if (err) {
            console.error("Lỗi Upload Multer:", err);
            return res.status(400).json({ 
                success: false, 
                message: "Lỗi tải ảnh: " + (err.message || "Xảy ra lỗi khi nhận tệp") 
            });
        }

        try {
            const productId = req.params.id;
            if (!productId || productId === 'undefined') {
                return res.status(400).json({ success: false, message: "ID sản phẩm không hợp lệ!" });
            }

            const { title, category, priceNote, desc, existingImages } = req.body;
            const product = await Product.findById(productId);
            
            if (!product) {
                return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm!" });
            }

            let finalImages = [];
            if (existingImages) {
                try {
                    finalImages = typeof existingImages === 'string' ? JSON.parse(existingImages) : existingImages;
                } catch (e) {
                    finalImages = product.images || [];
                }
            } else {
                finalImages = product.images || [];
            }

            if (req.files && req.files.length > 0) {
                const newUploadedImages = req.files.map(f => `/uploads/${f.filename}`);
                finalImages = finalImages.concat(newUploadedImages);
            }

            const updatedProduct = await Product.findByIdAndUpdate(
                productId, 
                { 
                    title, 
                    category, 
                    priceNote, 
                    desc: desc || '', 
                    images: finalImages 
                }, 
                { new: true }
            );

            return res.json({ 
                success: true, 
                data: updatedProduct, 
                message: "Cập nhật sản phẩm thành công!" 
            });
        } catch (error) {
            console.error("Lỗi cập nhật sản phẩm:", error);
            return res.status(500).json({ 
                success: false, 
                message: "Lỗi cập nhật sản phẩm: " + error.message 
            });
        }
    });
});

// 3. Xóa sản phẩm
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
        const result = await Order.updateMany(
            { status: 'COMPLETED' },
            { $set: { status: 'ARCHIVED' } }
        );
        res.json({ success: true, archivedCount: result.modifiedCount });
    } catch (error) {
        console.error("Lỗi khi lưu trữ đơn hoàn thành:", error);
        res.status(500).json({ success: false, message: "Lỗi khi lưu trữ đơn hoàn thành" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại cổng ${PORT}`);
});