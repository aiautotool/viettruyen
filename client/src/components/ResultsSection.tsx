import { useState } from "react";
import { Scene } from "@/lib/types";
import SceneCard from "@/components/SceneCard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ResultsSectionProps {
  scenes: Scene[];
  genre: string;
  isLoading: boolean;
}

export default function ResultsSection({ scenes, genre, isLoading }: ResultsSectionProps) {
  const { toast } = useToast();
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState<number | null>(null);
  const [scenesWithState, setScenesWithState] = useState<Array<Scene & {
    image?: string;
    imageUrl?: string;  // Thêm URL cho hình ảnh
    isGenerating?: boolean;
    hasAudio?: boolean;
  }>>([]);
  
  // Cập nhật state khi scenes thay đổi
  useState(() => {
    setScenesWithState(scenes.map(scene => ({ ...scene })));
  });

  const copyAllPrompts = () => {
    if (scenes.length === 0) return;

    let allText = '';
    
    scenes.forEach((scene, index) => {
      allText += `Phân cảnh ${index + 1}:\nMô tả: ${scene.text}\nPrompt: ${scene.promptanh}\n\n`;
    });
    
    navigator.clipboard.writeText(allText.trim())
      .then(() => {
        toast({
          title: "Thành công",
          description: "Đã sao chép tất cả phân cảnh vào clipboard",
        });
      })
      .catch(err => {
        toast({
          title: "Lỗi",
          description: "Không thể sao chép: " + err.message,
          variant: "destructive",
        });
      });
  };

  // Chức năng tạo audio đã bị loại bỏ

  // Tạo ảnh cho một phân cảnh
  const generateImageForScene = async (index: number) => {
    if (isGeneratingImages) return;
    
    try {
      // Cập nhật trạng thái đang tạo ảnh
      const updatedScenes = [...scenesWithState];
      updatedScenes[index] = { ...updatedScenes[index], isGenerating: true };
      setScenesWithState(updatedScenes);
      
      const scene = scenes[index];
      const response = await apiRequest('POST', '/api/generate-image', { 
        prompt: scene.promptanh 
      });
      
      const data = await response.json();
      
      // Cập nhật ảnh vào state
      const newScenes = [...scenesWithState];
      
      // Kiểm tra xem API trả về URL hay base64
      if (data.imageUrl) {
        // Nếu API trả về URL hình ảnh
        newScenes[index] = { 
          ...newScenes[index], 
          imageUrl: data.imageUrl,
          isGenerating: false
        };
      } else if (data.image) {
        // Nếu API trả về chuỗi base64
        newScenes[index] = { 
          ...newScenes[index], 
          image: data.image,
          isGenerating: false
        };
      }
      
      setScenesWithState(newScenes);
      
      toast({
        title: "Thành công",
        description: `Đã tạo ảnh cho phân cảnh ${index + 1}`,
      });
    } catch (error) {
      console.error("Error generating image:", error);
      toast({
        title: "Lỗi khi tạo ảnh",
        description: error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định",
        variant: "destructive",
      });
      
      const updatedScenes = [...scenesWithState];
      updatedScenes[index] = { ...updatedScenes[index], isGenerating: false };
      setScenesWithState(updatedScenes);
    }
  };

  // Tạo tất cả ảnh tuần tự
  const generateAllImages = async () => {
    if (isGeneratingImages || scenes.length === 0) return;
    
    setIsGeneratingImages(true);
    
    toast({
      title: "Bắt đầu tạo ảnh",
      description: "Hệ thống sẽ lần lượt tạo ảnh cho tất cả phân cảnh",
    });
    
    // Tạo ảnh tuần tự
    for (let i = 0; i < scenes.length; i++) {
      // Bỏ qua nếu đã có ảnh
      if (scenesWithState[i]?.image) continue;
      
      setCurrentImageIndex(i);
      
      try {
        // Cập nhật trạng thái
        const updatedScenes = [...scenesWithState];
        updatedScenes[i] = { ...updatedScenes[i], isGenerating: true };
        setScenesWithState(updatedScenes);
        
        // Gọi API
        const response = await apiRequest('POST', '/api/generate-image', { 
          prompt: scenes[i].promptanh 
        });
        
        const data = await response.json();
        
        // Cập nhật kết quả
        const newScenes = [...scenesWithState];
        
        // Kiểm tra xem API trả về URL hay base64
        if (data.imageUrl) {
          // Nếu API trả về URL hình ảnh
          newScenes[i] = { 
            ...newScenes[i], 
            imageUrl: data.imageUrl,
            isGenerating: false
          };
        } else if (data.image) {
          // Nếu API trả về chuỗi base64
          newScenes[i] = { 
            ...newScenes[i], 
            image: data.image,
            isGenerating: false
          };
        }
        
        setScenesWithState(newScenes);
        
        // Tạm dừng 1s giữa các API call để tránh quá tải
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error generating image for scene ${i}:`, error);
        
        // Cập nhật trạng thái lỗi nhưng vẫn tiếp tục
        const updatedScenes = [...scenesWithState];
        updatedScenes[i] = { ...updatedScenes[i], isGenerating: false };
        setScenesWithState(updatedScenes);
      }
    }
    
    setCurrentImageIndex(null);
    setIsGeneratingImages(false);
    
    toast({
      title: "Hoàn tất",
      description: "Đã tạo xong tất cả ảnh cho phân cảnh",
    });
  };

  if (isLoading) {
    return (
      <section className="min-h-[200px]">
        <div className="bg-gray-800 rounded-xl p-6 mb-6 border border-blue-900 border-opacity-50">
          <div className="flex items-center space-x-3">
            <div className="spinner border-2 border-blue-500 border-t-transparent rounded-full w-5 h-5"></div>
            <span className="text-blue-400 font-medium">
              <i className="fas fa-sparkles mr-1"></i> 
              Đang tạo phân cảnh {genre}...
            </span>
          </div>
          <p className="mt-2 text-gray-400 text-sm">
            AI đang tạo phân cảnh truyện dựa trên thể loại và chủ đề đã nhập
          </p>
        </div>
      </section>
    );
  }

  if (scenes.length === 0) {
    return <section className="min-h-[200px]"></section>;
  }

  return (
    <section className="min-h-[200px]">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-xl font-semibold text-blue-400">
          <i className="fas fa-book mr-2"></i> {scenes.length} Phân Cảnh {genre}
        </h2>
        
        <div className="flex items-center gap-2">
          <Button 
            onClick={generateAllImages} 
            disabled={isGeneratingImages}
            className="text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-3 py-1 rounded-lg"
          >
            {isGeneratingImages ? (
              <>
                <div className="spinner border-2 border-white border-t-transparent rounded-full w-4 h-4 mr-2 animate-spin"></div>
                Đang tạo ảnh {currentImageIndex !== null ? `(${currentImageIndex + 1}/${scenes.length})` : ''}
              </>
            ) : (
              <>
                <i className="fas fa-magic mr-1"></i> Tạo tất cả ảnh
              </>
            )}
          </Button>
          
          <Button 
            onClick={copyAllPrompts} 
            variant="outline" 
            className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg"
          >
            <i className="fas fa-copy mr-1"></i> Sao chép tất cả
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {scenes.map((scene, index) => {
          const sceneState = scenesWithState[index] || scene;
          
          return (
            <SceneCard 
              key={index} 
              scene={{
                ...scene, 
                image: sceneState.image,
                imageUrl: sceneState.imageUrl, // Thêm imageUrl
                isGenerating: sceneState.isGenerating
              }}
              index={index} 
              genre={genre}
              onGenerateImage={() => generateImageForScene(index)}
            />
          );
        })}
      </div>
    </section>
  );
}
