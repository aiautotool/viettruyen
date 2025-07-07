import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { createTheme } from "./lib/utils";
import { AppProvider } from "./context/AppContext";

// Apply theme
createTheme({
  primary: "hsl(222.2 47.4% 11.2%)",
  appearance: "dark",
  radius: 0.6,
  variant: "vibrant"
});

// Đăng ký Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('Service Worker đăng ký thành công với phạm vi:', registration.scope);
      })
      .catch(error => {
        console.error('Lỗi đăng ký Service Worker:', error);
      });
      
    // Giữ service worker luôn cập nhật
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
    
    // Hiển thị thông báo khi có cập nhật mới
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
        // Hiện thông báo cho người dùng
        if (confirm('Có phiên bản mới! Bạn có muốn cập nhật không?')) {
          window.location.reload();
        }
      }
    });
  });
}

// Thêm hỗ trợ cho "Add to Home Screen" trên iOS
const isIOS = 
  ['iPad', 'iPhone', 'iPod'].includes(navigator.platform) || 
  (navigator.userAgent.includes("Mac") && "ontouchend" in document);

const isBrowser = () => {
  // Check if running in standalone mode (PWA)
  return !(window.matchMedia('(display-mode: standalone)').matches);
};

window.addEventListener('DOMContentLoaded', () => {
  if (isIOS && isBrowser()) {
    const addToHomeScreen = document.createElement('div');
    addToHomeScreen.id = 'add-to-home-screen';
    addToHomeScreen.innerHTML = `
      <div class="pwa-instruction">
        <p>Cài đặt ứng dụng này vào thiết bị của bạn: Nhấn <strong>Chia sẻ</strong> <span class="pwa-share-icon">&#x25B2;</span> rồi <strong>"Thêm vào màn hình chính"</strong></p>
        <button id="close-pwa-instruction">Đóng</button>
      </div>
    `;
    
    // Chèn vào DOM sau khi app đã tải
    setTimeout(() => {
      document.body.appendChild(addToHomeScreen);
      document.getElementById('close-pwa-instruction')?.addEventListener('click', () => {
        document.body.removeChild(addToHomeScreen);
      });
    }, 2000);
  }
});

createRoot(document.getElementById("root")!).render(
  <AppProvider>
    <App />
  </AppProvider>
);
