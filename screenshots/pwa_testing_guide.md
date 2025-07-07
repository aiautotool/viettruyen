# Hướng dẫn kiểm tra tính năng PWA

## 1. Kiểm tra Service Worker

1. Mở ứng dụng trong Chrome hoặc Firefox
2. Nhấn F12 hoặc chuột phải > Kiểm tra để mở DevTools
3. Chọn tab "Application" (Chrome) hoặc "Application" (Firefox)
4. Bên trái, chọn mục "Service Workers"
5. Bạn sẽ thấy service worker đã được đăng ký với trạng thái "activated and is running"

## 2. Kiểm tra Web App Manifest

1. Trong DevTools (F12), chọn tab "Application"
2. Bên trái, chọn mục "Manifest"
3. Kiểm tra:
   - Identity: Tên và mô tả ứng dụng
   - Presentation: Màu chủ đạo, chế độ hiển thị
   - Icons: Danh sách biểu tượng ở các kích thước khác nhau

## 3. Kiểm tra khả năng cài đặt

1. Trong Chrome hoặc Edge, nhìn vào thanh địa chỉ
2. Nếu thấy biểu tượng cài đặt (hình +), nghĩa là ứng dụng đáp ứng các tiêu chí để cài đặt
3. Nhấp vào biểu tượng và chọn "Cài đặt" để cài đặt ứng dụng

## 4. Kiểm tra khả năng hoạt động ngoại tuyến

1. Mở ứng dụng và duyệt qua một vài trang để đảm bảo chúng được cache
2. Trong DevTools, chọn tab "Network"
3. Đánh dấu vào ô "Offline" để mô phỏng mất kết nối internet
4. Làm mới trang
5. Ứng dụng vẫn nên hiển thị hoặc hiển thị trang ngoại tuyến thay vì thông báo lỗi từ trình duyệt

## 5. Kiểm tra Performance

1. Truy cập ứng dụng lần đầu tiên và ghi nhớ thời gian tải
2. Đóng và mở lại ứng dụng
3. Lần thứ hai, ứng dụng nên tải nhanh hơn vì tài nguyên đã được cache

## 6. Kiểm tra trên thiết bị di động

1. Truy cập ứng dụng từ điện thoại hoặc máy tính bảng
2. Trong Chrome (Android), nhấn vào menu và chọn "Thêm vào màn hình chính"
3. Trong Safari (iOS), nhấn vào biểu tượng chia sẻ và chọn "Thêm vào màn hình chính"
4. Sau khi cài đặt, mở ứng dụng từ màn hình chính - nó nên mở như một ứng dụng độc lập
