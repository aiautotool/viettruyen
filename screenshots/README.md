# Hướng dẫn sử dụng tính năng PWA

## Trợ Lý Sáng Tạo Truyện AI - Progressive Web App

Ứng dụng Trợ Lý Sáng Tạo Truyện AI đã được cập nhật với tính năng Progressive Web App (PWA), cho phép bạn:

1. Cài đặt ứng dụng trên màn hình chính của thiết bị
2. Sử dụng ứng dụng ngay cả khi không có kết nối internet
3. Tải nhanh hơn nhờ bộ nhớ cache

## Cách cài đặt ứng dụng trên thiết bị

### Trên điện thoại Android (Chrome)
1. Mở ứng dụng trong Chrome
2. Nhấn vào biểu tượng menu (ba chấm) ở góc trên bên phải
3. Chọn "Thêm vào màn hình chính" hoặc "Cài đặt ứng dụng"
4. Làm theo hướng dẫn trên màn hình

### Trên iPhone hoặc iPad (Safari)
1. Mở ứng dụng trong Safari
2. Nhấn vào biểu tượng Chia sẻ (hình vuông với mũi tên hướng lên)
3. Chọn "Thêm vào màn hình chính"
4. Xác nhận bằng cách nhấn "Thêm"

### Trên máy tính (Chrome, Edge)
1. Mở ứng dụng trong trình duyệt
2. Tìm biểu tượng cài đặt (hình +) ở thanh địa chỉ
3. Nhấn vào và chọn "Cài đặt"

## Sử dụng ứng dụng khi không có kết nối internet

Sau khi đã truy cập ứng dụng ít nhất một lần, nhiều tính năng sẽ hoạt động ngay cả khi bạn không có kết nối internet:

1. Giao diện chính và bố cục của ứng dụng
2. Tài nguyên cơ bản (hình ảnh, biểu tượng, styles)
3. Trang offline thông báo khi ứng dụng cần kết nối

**Lưu ý:** Tính năng tạo truyện và tạo hình ảnh vẫn cần kết nối internet để hoạt động.

## Xác minh tính năng PWA đang hoạt động

Bạn có thể xác minh rằng PWA đã được cài đặt đúng cách bằng cách:

1. Mở DevTools trong trình duyệt (F12)
2. Chuyển đến tab "Application" (Chrome) hoặc "Application Tools" (Firefox)
3. Kiểm tra mục "Service Workers" - bạn sẽ thấy service worker đã được đăng ký
4. Kiểm tra mục "Manifest" - bạn sẽ thấy manifest đã được nhận diện
5. Thử tắt kết nối internet và làm mới trang - bạn sẽ vẫn thấy giao diện ứng dụng hoặc trang offline
