const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const { Order, Product } = require('./models');

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'TÊN_CLOUD_NAME_CỦA_BẠN',
  api_key: process.env.CLOUDINARY_API_KEY || 'API_KEY_CỦA_BẠN',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'API_SECRET_CỦA_BẠN'
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'inbanme_storage',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'pdf', 'rar', 'zip', 'ai', 'psd', 'cdr'],
    resource_type: 'auto'
  },
});

const upload = multer({ storage: storage, limits: { fileSize: 25 * 1024 * 1024, files: 20 } });
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const customerDir = path.join(__dirname, '..', 'frontend-customer');
const adminDir = path.join(__dirname, '..', 'frontend-admin');
app.use(express.static(customerDir));
app.use(express.static(adminDir));

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/inbanme";
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Kết nối thành công tới Database MongoDB"))
    .catch(err => console.error("❌ Lỗi kết nối MongoDB:", err));

app.get('/', (req, res) => res.sendFile(path.join(customerDir, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(adminDir, 'admin.html')));
app.get('/api/ping', (req, res) => res.json({ success: true, message: "Server is active" }));

// Lấy danh sách sản phẩm
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách sản phẩm" });
    }
});

// Khách gửi đơn hàng kèm file thiết kế/logo (nếu có)
app.post('/api/orders', upload.single('file'), async (req, res) => {
    try {
        const { fullname, phone, product, quantity, note } = req.body;
        if (!fullname || !phone || !product) {
            return res.status(400).json({ success: false, message: "Vui lòng điền đủ thông tin!" });
        }
        const orderData = { fullname, phone, product, quantity: quantity || '1', note: note || '' };
        if (req.file) orderData.fileUrl = req.file.path;
        
        const newOrder = new Order(orderData);
        await newOrder.save();
        res.status(201).json({ success: true, data: newOrder, message: "Gửi đơn thành công!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi lưu đơn hàng: " + error.message });
    }
});

// Admin lấy danh sách đơn hàng
app.get('/api/admin/orders', async (req, res) => {
    try {
        const orders = await Order.find({ status: { $ne: 'ARCHIVED' } }).sort({ createdAt: -1 });
        res.json({ success: true, data: orders });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi lấy danh sách đơn" });
    }
});

// Admin cập nhật trạng thái đơn hàng
app.patch('/api/admin/orders/:id/status', async (req, res) => {
    try {
        const updatedOrder = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
        res.json({ success: true, data: updatedOrder });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi cập nhật trạng thái" });
    }
});

// ADMIN: Upload file thiết kế hoàn chỉnh trả lại cho khách
app.post('/api/admin/orders/:id/upload-completed', upload.single('completedFile'), async (req, res) => {
    try {
        const orderId = req.params.id;
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Chưa chọn file hoàn chỉnh để tải lên!" });
        }
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId, 
            { 
                completedFileUrl: req.file.path,
                status: 'COMPLETED' // Tự động chuyển trạng thái đơn sang Hoàn thành
            }, 
            { new: true }
        );
        if (!updatedOrder) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
        res.json({ success: true, data: updatedOrder, message: "Đã tải lên và lưu file hoàn chỉnh thành công!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi upload file hoàn chỉnh: " + error.message });
    }
});

// Xóa đơn hàng
app.delete('/api/admin/orders/:id', async (req, res) => {
    try {
        await Order.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Đã xóa đơn hàng" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi xóa đơn" });
    }
});

// Admin thêm sản phẩm
app.post('/api/admin/products', upload.array('images', 20), async (req, res) => {
    try {
        const { title, category, priceNote, desc } = req.body;
        const images = req.files && req.files.length > 0 ? req.files.map(f => f.path) : ['https://via.placeholder.com/300x200?text=In+Ban+Me'];
        const newProduct = new Product({ title, category, priceNote, desc, images });
        await newProduct.save();
        res.status(201).json({ success: true, data: newProduct });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi lưu sản phẩm: " + error.message });
    }
});
// Đảm bảo route này tồn tại ở phía Server
app.post('/api/admin/orders/:id/upload-completed', upload.single('completedFile'), async (req, res) => {
    try {
        const orderId = req.params.id;
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Không tìm thấy file tải lên!' });
        }
        
        // Đường dẫn file trên Cloudinary (hoặc nơi lưu trữ của bạn)
        const fileUrl = req.file.path; 

        // Cập nhật vào Database và đổi trạng thái thành COMPLETED
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { 
                completedFileUrl: fileUrl,
                status: 'COMPLETED' 
            },
            { new: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng!' });
        }

        res.json({ success: true, data: updatedOrder });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Lỗi server khi upload file' });
    }
});
// Admin cập nhật sản phẩm
app.post('/api/admin/products/:id/update', upload.array('images', 20), async (req, res) => {
    try {
        const productId = req.params.id;
        const { title, category, priceNote, desc, existingImages } = req.body;
        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });

        let finalImages = [];
        try {
            finalImages = existingImages ? (typeof existingImages === 'string' ? JSON.parse(existingImages) : existingImages) : (product.images || []);
        } catch (e) {
            finalImages = product.images || [];
        }

        if (req.files && req.files.length > 0) {
            finalImages = finalImages.concat(req.files.map(f => f.path));
        }

        const updatedProduct = await Product.findByIdAndUpdate(productId, { title, category, priceNote, desc: desc || '', images: finalImages }, { new: true });
        res.json({ success: true, data: updatedProduct, message: "Cập nhật thành công!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi cập nhật sản phẩm: " + error.message });
    }
});

// Admin xóa sản phẩm
app.delete('/api/admin/products/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Đã xóa sản phẩm" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi xóa sản phẩm" });
    }
});

// Lưu trữ các đơn hoàn thành
app.post('/api/admin/orders/archive-completed', async (req, res) => {
    try {
        const result = await Order.updateMany({ status: 'COMPLETED' }, { $set: { status: 'ARCHIVED' } });
        res.json({ success: true, archivedCount: result.modifiedCount });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi lưu trữ đơn hoàn thành" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server đang chạy tại cổng ${PORT}`));