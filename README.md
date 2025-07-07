# Ứng dụng tạo truyện AI

Ứng dụng giúp tạo tự động cốt truyện, nội dung truyện đầy đủ, phân cảnh và âm thanh sử dụng trí tuệ nhân tạo.

## Các tính năng

- **Tạo cốt truyện**: Tạo tự động cốt truyện dựa vào chủ đề và thể loại.
- **Tạo truyện đầy đủ**: Mở rộng cốt truyện thành nội dung truyện hoàn chỉnh.
- **Tạo phân cảnh**: Chia truyện thành nhiều cảnh với mô tả và yêu cầu để tạo hình ảnh.
- **Tạo âm thanh**: Chuyển văn bản thành giọng nói sử dụng công nghệ edge-tts.
- **Tạo hình ảnh**: Tạo hình ảnh cho các phân cảnh sử dụng AI.
- **Tạo video**: Kết hợp âm thanh và hình ảnh để tạo video truyện.

## Cài đặt

### 1. Clone dự án

```bash
git clone [url-repository]
cd [folder-name]
```

### 2. Cài đặt Node.js dependencies

```bash
npm install
```

### 3. Cài đặt Python và edge-tts (bắt buộc cho tính năng chuyển văn bản thành giọng nói)

#### Cài đặt Python

```bash
# Trên Windows
# Tải và cài đặt Python từ https://www.python.org/downloads/

# Trên macOS
brew install python

# Trên Linux (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install python3 python3-pip
```

#### Cài đặt edge-tts

```bash
pip install edge-tts
```

Xác nhận edge-tts đã được cài đặt bằng cách kiểm tra danh sách giọng đọc:

```bash
python -m edge_tts --list-voices
```

### 4. Cài đặt FFmpeg (bắt buộc cho tính năng tạo video)

#### Windows
Tải FFmpeg từ https://ffmpeg.org/download.html và thêm vào biến môi trường PATH.

#### macOS
```bash
brew install ffmpeg
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install ffmpeg
```

### 5. API Keys (tùy chọn)

Ứng dụng sử dụng các API sau:
- API n8n.aiautotool.com (mặc định)
- Google Gemini API (dự phòng, yêu cầu API key)

Để cấu hình API key Gemini, mở trang cài đặt và nhập API key của bạn.

## Chạy ứng dụng

```bash
npm run dev
```

Truy cập ứng dụng tại địa chỉ: http://localhost:5000

## Xử lý sự cố

### Lỗi khi tạo âm thanh 

Nếu gặp lỗi "python not found" khi tạo audio, hãy đảm bảo:

1. Python đã được cài đặt đúng cách và có trong biến môi trường PATH
2. edge-tts đã được cài đặt: `pip install edge-tts`
3. Kiểm tra bằng lệnh: `python -m edge_tts --list-voices`

### Lỗi khi tạo hình ảnh

Nếu không hiển thị được hình ảnh sau khi tạo, kiểm tra:

1. Thư mục `public/images` đã tồn tại
2. API tạo hình ảnh có đang hoạt động không
3. Kiểm tra URL trong console browser

## Cấu trúc thư mục

- `client/` - Mã nguồn frontend
- `server/` - Mã nguồn backend
- `public/` - File tĩnh, hình ảnh
  - `public/images/` - Hình ảnh được tạo bởi AI
  - `public/videos/` - Video được tạo từ audio và hình ảnh
- `uploads/` - File audio được tạo# viettruyen
# viettruyen
# viettruyen
