const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// Bật CORS cho phép kết nối từ mọi nguồn
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Tạo thư mục uploads nếu chưa có
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình lưu trữ file upload bằng Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });

// Cho phép truy cập công khai thư mục /uploads để xem ảnh
app.use('/uploads', express.static(uploadDir));

// Dữ liệu tạm trong bộ nhớ (hoặc kết nối MongoDB của bạn)
let productsList = [
    {
        _id: "1",
        title: "In NameCard / Danh thiếp theo yêu cầu",
        category: "In Namecard",
        priceNote: "69.000đ/hộp",
        desc: "Giấy Couche 300gsm dày dặn, Cán màng mờ/bóng 2 mặt chống nước nhẹ, tùy chọn bo góc hoặc vuông cạnh theo yêu cầu.",
        images: ["https://via.placeholder.com/300x200?text=Namecard"]
    }
];

let ordersList = [];

// API: Lấy danh sách sản phẩm
app.get('/api/products', (req, res) => {
    res.json({ success: true, data: productsList });
});

// API: Thêm sản phẩm mới (Hỗ trợ upload ảnh file)
app.post('/api/products', upload.single('image'), (req, res) => {
    try {
        const { title, category, priceNote, desc, description, price } = req.body;
        
        // Tạo đường dẫn ảnh nếu có file upload
        let imageUrl = '';
        if (req.file) {
            imageUrl = `/uploads/${req.file.filename}`;
        }

        const newProduct = {
            _id: Date.now().toString(),
            title: title || 'Sản phẩm mới',
            category: category || 'Khác',
            priceNote: priceNote || price || 'Báo giá Zalo',
            desc: desc || description || '',
            images: imageUrl ? [imageUrl] : ['https://via.placeholder.com/300x200?text=No+Image']
        };

        productsList.unshift(newProduct);
        console.log("Đã thêm sản phẩm thành công:", newProduct);

        return res.json({
            success: true,
            message: "Thêm sản phẩm thành công!",
            data: newProduct
        });
    } catch (error) {
        console.error("Lỗi khi thêm sản phẩm:", error);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi lưu sản phẩm" });
    }
});

// API: Xóa sản phẩm
app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    productsList = productsList.filter(p => p._id !== id);
    res.json({ success: true, message: "Đã xóa sản phẩm thành công!" });
});

// API: Đặt hàng
app.post('/api/orders', (req, res) => {
    try {
        const orderData = req.body;
        orderData._id = Date.now().toString();
        orderData.createdAt = new Date();
        ordersList.unshift(orderData);
        res.json({ success: true, message: "Đặt hàng thành công!", data: orderData });
    } catch (err) {
        res.status(500).json({ success: false, message: "Không thể tạo đơn hàng" });
    }
});

// API: Lấy danh sách đơn hàng cho admin
app.get('/api/orders', (req, res) => {
    res.json({ success: true, data: ordersList });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));