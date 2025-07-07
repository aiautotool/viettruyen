import { useState } from "react";
import { Scene } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getGenreBorderColor, getGenreTextColor, getGenreIcon, getGenreButtonColor } from "@/lib/genreUtils";

interface SceneCardProps {
  scene: Scene & { 
    image?: string; 
    imageUrl?: string; // Thêm trường imageUrl cho URL hình ảnh 
    isGenerating?: boolean 
  };
  index: number;
  genre: string;
  onGenerateImage?: () => void;
}

export default function SceneCard({ 
  scene, 
  index, 
  genre, 
  onGenerateImage 
}: SceneCardProps) {
  // Sử dụng state từ props nếu có, hoặc tự quản lý state nếu không
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [image, setImage] = useState<string | null>(scene.image || null);
  const [imageUrl, setImageUrl] = useState<string | null>(scene.imageUrl || null);

  const { toast } = useToast();

  const generateImage = async () => {
    // Sử dụng hàm callback từ component cha nếu có
    if (onGenerateImage) {
      onGenerateImage();
      return;
    }
    
    // Nếu không có callback từ cha, dùng xử lý local
    setIsGeneratingImage(true);
    
    try {
      const response = await apiRequest(
        "POST", 
        "/api/generate-image", 
        { prompt: scene.promptanh }
      );
      
      const data = await response.json();
      
      if (data && data.success) {
        if (data.imageUrl) {
          // Ưu tiên sử dụng URL của hình ảnh nếu có
          setImageUrl(data.imageUrl);
          console.log("Image URL received:", data.imageUrl);
        }
        
        if (data.image) {
          // Vẫn lưu trữ base64 để tương thích
          setImage(data.image);
        }
      } else if (data && data.error) {
        // Xử lý lỗi cụ thể từ server
        throw new Error(data.message || "API tạo ảnh hiện không khả dụng. Vui lòng thử lại sau.");
      } else {
        throw new Error("Không có ảnh trả về từ API");
      }
    } catch (error) {
      console.error("Error generating image:", error);
      
      // Hiển thị thông báo lỗi chi tiết
      const errorMessage = 
        (error as any)?.response?.data?.message || // Lỗi từ response
        (error instanceof Error ? error.message : "API tạo ảnh hiện không khả dụng");
      
      toast({
        title: "Không thể tạo ảnh",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        toast({
          title: "Đã sao chép!",
          description: "Đã sao chép prompt vào clipboard",
        });
      })
      .catch(err => {
        toast({
          title: "Lỗi sao chép",
          description: err.message,
          variant: "destructive",
        });
      });
  };

  const downloadImage = () => {
    // Nếu có URL hình ảnh, sử dụng URL để tải về
    if (displayImageUrl) {
      // Tạo thẻ a để tải xuống
      const link = document.createElement('a');
      link.href = displayImageUrl;
      link.download = `truyen-scene-${Date.now()}.jpg`;
      link.target = '_blank'; // Mở trong tab mới nếu trình duyệt không hỗ trợ tải xuống trực tiếp
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    
    // Nếu chỉ có base64, sử dụng phương pháp cũ
    if (!image) return;
    
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${image}`;
    link.download = `truyen-scene-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Chức năng tạo âm thanh đã bị loại bỏ

  const buttonColor = getGenreButtonColor(genre);

  // Xác định trạng thái hiển thị
  const isLoadingImage = scene.isGenerating || isGeneratingImage;
  const displayImage = image || scene.image;
  // Ưu tiên sử dụng URL nếu có, nếu không thì dùng base64
  const displayImageUrl = imageUrl || scene.imageUrl;

  return (
    <div className={`scene-card bg-gray-800 rounded-xl p-6 mb-6 border border-gray-700 ${getGenreBorderColor(genre)} transition-all hover:transform hover:translate-y-[-2px]`}>
      <div className="flex items-start justify-between mb-3">
        <h3 className={`text-lg font-medium ${getGenreTextColor(genre)}`}>
          <i className={`${getGenreIcon(genre)} mr-2`}></i> Phân cảnh {index + 1}
        </h3>
        <span className="text-xs bg-gray-700 px-2 py-1 rounded-full">#{index + 1}</span>
      </div>
      
      <div className="mb-4">
        <div className="flex justify-between items-center">
          <p className="text-gray-300 mb-1">
            <span className="font-semibold text-gray-400">
              <i className="fas fa-align-left mr-1"></i> Mô tả:
            </span>
          </p>
          <Button
            onClick={() => copyToClipboard(scene.text)}
            variant="ghost"
            className="h-7 px-2 text-xs text-gray-400 hover:text-white"
          >
            <i className="fas fa-copy mr-1"></i> Sao chép
          </Button>
        </div>
        <p className="bg-gray-700 bg-opacity-50 p-3 rounded-lg">{scene.text}</p>
      </div>
      
      <div className="mb-4">
        <div className="flex justify-between items-center">
          <p className="text-gray-300 mb-1">
            <span className="font-semibold text-gray-400">
              <i className="fas fa-image mr-1"></i> Prompt ảnh (EN):
            </span>
          </p>
          <Button
            onClick={() => copyToClipboard(scene.promptanh)}
            variant="ghost"
            className="h-7 px-2 text-xs text-gray-400 hover:text-white"
          >
            <i className="fas fa-copy mr-1"></i> Sao chép
          </Button>
        </div>
        <p className="bg-gray-700 bg-opacity-50 p-3 rounded-lg font-mono text-sm">{scene.promptanh}</p>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3">
        <Button 
          onClick={generateImage} 
          disabled={isLoadingImage}
          className={`flex-1 ${buttonColor} text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center`}
        >
          {isLoadingImage ? (
            <>
              <div className="spinner border-2 border-white border-t-transparent rounded-full w-4 h-4 mr-2"></div>
              Đang tạo...
            </>
          ) : (
            <>
              <i className="fas fa-camera-retro mr-2"></i> Tạo Ảnh
            </>
          )}
        </Button>
        
        <Button 
          onClick={() => copyToClipboard(`Phân cảnh ${index + 1}\n\n${scene.text}\n\nPrompt ảnh: ${scene.promptanh}`)} 
          className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center sm:w-auto"
        >
          <i className="fas fa-copy mr-2"></i> 
          <span className="md:inline">Sao chép cả phân cảnh</span>
        </Button>
      </div>
      
      {/* Hiển thị hình ảnh nếu có URL hoặc base64 */}
      {(displayImageUrl || displayImage) && (
        <div className="mt-4">
          <img 
            src={displayImageUrl ? displayImageUrl : `data:image/png;base64,${displayImage}`}
            alt="AI Generated Image" 
            className="rounded-lg border border-gray-700 w-full h-auto object-cover shadow-lg" 
            onError={(e) => {
              // Nếu URL bị lỗi và có base64, sử dụng base64 thay thế
              if (displayImageUrl && displayImage) {
                (e.target as HTMLImageElement).src = `data:image/png;base64,${displayImage}`;
                console.log("URL hình ảnh không tải được, đã chuyển sang dùng base64");
              }
            }}
          />
          <div className="flex justify-between mt-2">
            <span className="text-xs text-gray-500">
              {displayImageUrl && (
                <span className="font-mono">URL: {displayImageUrl.substring(0, 20)}...</span>
              )}
            </span>
            <Button 
              onClick={downloadImage} 
              variant="outline" 
              className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg"
            >
              <i className="fas fa-download mr-1"></i> Tải xuống
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
