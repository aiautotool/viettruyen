import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { KeyStatus } from "@/lib/types";
import ApiKeyModal from "./ApiKeyModal";

export default function ApiKeyButton() {
  const [showModal, setShowModal] = useState(false);
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);
  
  useEffect(() => {
    // Kiểm tra xem người dùng có không muốn hiển thị modal khi khởi động không
    const dontShow = localStorage.getItem("dontShowApiKeyModal") === "true";
    
    if (!dontShow) {
      // Kiểm tra trạng thái API key khi component được mount
      checkKeyStatus();
    }
  }, []);
  
  const checkKeyStatus = async () => {
    try {
      const response = await apiRequest("GET", "/api/key-status");
      const data = await response.json();
      setKeyStatus(data);
      
      // Nếu không có key nào được thiết lập, mở modal
      if (!data.gemini && !data.openai) {
        // Chỉ mở modal tự động nếu người dùng chưa chọn "đừng hiện lại"
        if (localStorage.getItem("dontShowApiKeyModal") !== "true") {
          setShowModal(true);
        }
      }
    } catch (error) {
      console.error("Error checking key status:", error);
    }
  };
  
  return (
    <>
      <Button 
        variant="outline" 
        size="sm"
        className="flex items-center gap-1 text-sm bg-gradient-to-r from-blue-700 to-indigo-800 text-gray-200 border-indigo-600 hover:bg-blue-700 shadow-md"
        onClick={() => setShowModal(true)}
      >
        <div className="flex items-center justify-center bg-yellow-500 text-blue-900 rounded-full w-5 h-5 mr-1.5">
          <i className="fas fa-key text-xs"></i>
        </div>
        <span>API Key</span>
        {keyStatus && (
          <div className={`w-2 h-2 rounded-full ml-1.5 ${keyStatus.gemini ? 'bg-green-400' : 'bg-red-400'}`}></div>
        )}
      </Button>
      
      <ApiKeyModal 
        open={showModal} 
        onOpenChange={setShowModal} 
      />
    </>
  );
}