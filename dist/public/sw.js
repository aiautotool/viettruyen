// Service Worker rỗng - tắt chức năng offline
// Ngày 8 tháng 4 năm 2025 - Đã vô hiệu hóa tính năng offline theo yêu cầu

self.addEventListener('install', event => {
  console.log('[Service Worker] Đang cài đặt Service Worker rỗng (tắt chức năng offline)');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('[Service Worker] Đang kích hoạt Service Worker rỗng');
  // Xóa tất cả các cache cũ
  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(keyList.map(key => caches.delete(key)));
    })
  );
});

// Không xử lý fetch events
// Để tất cả các request sẽ đi thẳng đến server