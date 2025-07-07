import { useState, useEffect } from 'react';
import VoiceTester from '@/components/ui/voice-tester/VoiceTester';
import { useToast } from '@/hooks/use-toast';

export default function VoiceTestPage() {
  const [isTtsAvailable, setIsTtsAvailable] = useState(true);
  const { toast } = useToast();
  
  useEffect(() => {
    // Kiểm tra trạng thái khả dụng của TTS khi trang được tải
    const checkTtsAvailability = async () => {
      try {
        const response = await fetch('/api/check-tts');
        const data = await response.json();
        
        setIsTtsAvailable(data.success);
        
        if (!data.success) {
          toast({
            title: "Không thể kết nối dịch vụ TTS",
            description: data.message || "Không thể kết nối đến dịch vụ tạo giọng nói",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error("Lỗi khi kiểm tra trạng thái TTS:", error);
        setIsTtsAvailable(false);
        
        toast({
          title: "Lỗi kết nối",
          description: "Không thể kiểm tra trạng thái dịch vụ tạo giọng nói",
          variant: "destructive"
        });
      }
    };
    
    checkTtsAvailability();
  }, [toast]);
  
  return (
    <div className="container py-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-6 text-center">
        Công cụ chuyển văn bản thành giọng nói
      </h1>
      
      {isTtsAvailable ? (
        <VoiceTester />
      ) : (
        <div className="text-center p-8 bg-red-50 rounded-lg">
          <h2 className="text-xl font-semibold text-red-800 mb-2">
            Dịch vụ tạo giọng nói hiện không khả dụng
          </h2>
          <p className="text-red-600">
            Không thể kết nối đến dịch vụ tạo giọng nói. Vui lòng thử lại sau hoặc liên hệ quản trị viên.
          </p>
        </div>
      )}
    </div>
  );
}