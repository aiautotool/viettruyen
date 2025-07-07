import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { FullStory } from '@/lib/types';
import { Progress } from '@/components/ui/progress';

interface VideoCreatorProps {
  fullStory?: FullStory;
  genre?: string;
  // Thêm các props mới
  title?: string;
  audioPath?: string;
  coverImagePath?: string;
  onVideoCreated?: (videoUrl: string) => void;
}

// Interface cho Task từ TaskManager
interface Task {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VideoCreator = ({ 
  fullStory, 
  genre, 
  title: propTitle,
  audioPath: propAudioPath,
  coverImagePath: propCoverImagePath,
  onVideoCreated
}: VideoCreatorProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(propCoverImagePath || null);
  const [audioPath, setAudioPath] = useState<string | null>(propAudioPath || null);
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<'pending' | 'processing' | 'completed' | 'failed' | null>(null);
  const [taskProgress, setTaskProgress] = useState<number>(0);
  const [isPollingTask, setIsPollingTask] = useState(false);
  const { toast } = useToast();
  
  // Poll task status
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    if (taskId && (taskStatus === 'pending' || taskStatus === 'processing')) {
      setIsPollingTask(true);
      intervalId = setInterval(async () => {
        try {
          const response = await fetch(`/api/task/${taskId}`);
          const data = await response.json();
          
          if (data.success && data.task) {
            const task = data.task as Task;
            setTaskStatus(task.status);
            setTaskProgress(task.progress);
            
            // Process completed task
            if (task.status === 'completed' && task.result) {
              setVideoUrl(task.result.videoUrl || null);
              setImageUrl(task.result.imageUrl || null);
              setAudioPath(task.result.audioPath || null);
              
              // Call onVideoCreated callback
              if (onVideoCreated && task.result.videoUrl) {
                onVideoCreated(task.result.videoUrl);
              }
              
              toast({
                title: "Tạo video thành công",
                description: "Video đã được tạo thành công, bạn có thể xem ngay bây giờ",
              });
              
              // Stop polling
              setIsPollingTask(false);
              if (intervalId) clearInterval(intervalId);
            } 
            // Process failed task
            else if (task.status === 'failed') {
              // Set partial results if available
              if (task.result) {
                if (task.result.imageUrl) setImageUrl(task.result.imageUrl);
                if (task.result.audioPath) setAudioPath(task.result.audioPath);
              }
              
              setError(task.error || "Đã xảy ra lỗi khi tạo video");
              toast({
                title: "Lỗi khi tạo video",
                description: task.error || "Đã xảy ra lỗi khi tạo video",
                variant: "destructive"
              });
              
              // Stop polling
              setIsPollingTask(false);
              if (intervalId) clearInterval(intervalId);
            }
          }
        } catch (err) {
          console.error("Lỗi khi kiểm tra trạng thái task:", err);
        }
      }, 2000); // Poll every 2 seconds
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [taskId, taskStatus, onVideoCreated, toast]);

  const createVideo = async () => {
    // Kiểm tra nếu có đủ thông tin để tạo video (nội dung truyện hoặc audio + hình ảnh)
    if (!fullStory && (!propAudioPath || !propCoverImagePath)) {
      toast({
        title: "Thiếu thông tin",
        description: "Bạn cần có nội dung truyện hoặc audio và hình ảnh để tạo video",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);
    setError(null);
    setTaskId(null);
    setTaskStatus(null);
    setTaskProgress(0);
    
    // Nếu API không thành công thì không nên xóa các giá trị hiện tại
    if (!videoUrl) {
      // Chỉ reset nếu không có video
      setVideoUrl(null);
    }

    try {
      // Sử dụng API khác nhau tùy theo loại dữ liệu đầu vào
      let response;
      
      if (propAudioPath && propCoverImagePath) {
        // Trường hợp tạo video từ audio và ảnh có sẵn
        response = await apiRequest(
          "POST",
          "/api/create-video",
          {
            audioPath: propAudioPath,
            imagePath: propCoverImagePath,
            title: propTitle || (fullStory ? fullStory.title : "Video Truyện"),
            resolution: "576x1024" // Định dạng 9:16 cho mobile
          }
        );
      } else {
        // Trường hợp tạo tự động từ nội dung truyện
        response = await apiRequest(
          "POST",
          "/api/auto-create-video",
          {
            title: fullStory?.title || propTitle || "Video Truyện",
            content: fullStory?.content || "",
            genre: genre || 'Tình cảm'
          }
        );
      }

      const data = await response.json();
      
      if (data.success) {
        // Nếu có video URL trả về ngay lập tức (tạo video đồng bộ)
        if (data.videoUrl) {
          setVideoUrl(data.videoUrl);
          setImageUrl(data.imageUrl || null);
          setAudioPath(data.audioPath || null);
          
          // Callback để thông báo cho component cha biết video đã được tạo
          if (onVideoCreated && data.videoUrl) {
            onVideoCreated(data.videoUrl);
          }
          
          toast({
            title: "Tạo video thành công",
            description: "Video đã được tạo thành công, bạn có thể xem ngay bây giờ",
          });
        } 
        // Nếu có task_id (tạo video bất đồng bộ)
        else if (data.taskId) {
          setTaskId(data.taskId);
          setTaskStatus('pending');
          
          toast({
            title: "Bắt đầu tạo video",
            description: data.message || "Quá trình tạo video đã bắt đầu và sẽ mất vài phút. Bạn có thể theo dõi tiến độ ở phía dưới.",
          });
        } 
        // Trường hợp API trả về thành công nhưng không có video URL hoặc task_id
        else {
          // Nếu lỗi tạo video nhưng vẫn có audio và hình ảnh
          if (data.imageUrl) setImageUrl(data.imageUrl);
          if (data.audioPath) setAudioPath(data.audioPath);
          
          setError("API trả về thành công nhưng không có video hoặc task_id");
          toast({
            title: "Thiếu thông tin",
            description: "Không nhận được thông tin video hoặc tiến trình tạo video",
            variant: "destructive"
          });
        }
      } else {
        // Nếu lỗi tạo video nhưng vẫn có audio và hình ảnh
        if (data.imageUrl) setImageUrl(data.imageUrl);
        if (data.audioPath) setAudioPath(data.audioPath);
        
        setError(data.message || "Đã xảy ra lỗi khi tạo video");
        toast({
          title: "Lỗi khi tạo video",
          description: data.message || "Đã xảy ra lỗi khi tạo video",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error("Lỗi khi gọi API tạo video:", err);
      setError("Đã xảy ra lỗi khi kết nối đến server");
      toast({
        title: "Lỗi kết nối",
        description: "Không thể kết nối đến server để tạo video",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const downloadVideo = () => {
    if (videoUrl) {
      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = `story_video_${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-blue-400">
          <i className="fas fa-film mr-2"></i> Tạo Video Từ Truyện
        </h3>
        <Button
          onClick={createVideo}
          disabled={isCreating || (!fullStory && (!propAudioPath || !propCoverImagePath))}
          className="bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white"
        >
          {isCreating ? (
            <>
              <i className="fas fa-spinner fa-spin mr-2"></i> Đang tạo...
            </>
          ) : (
            <>
              <i className="fas fa-magic mr-2"></i> Tạo Video Tự Động
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="bg-red-500 bg-opacity-10 border border-red-500 text-red-500 p-3 rounded-md">
          <p className="flex items-start">
            <i className="fas fa-exclamation-triangle mr-2 mt-1"></i>
            <span>{error}</span>
          </p>
        </div>
      )}

      {videoUrl && (
        <div className="space-y-4">
          <div className="bg-gray-800 p-4 rounded-xl">
            <h4 className="text-blue-400 mb-2">
              <i className="fas fa-video mr-2"></i> Video Của Bạn
            </h4>
            <video 
              controls 
              className="w-full rounded-lg" 
              poster={imageUrl || undefined}
            >
              <source src={videoUrl} type="video/mp4" />
              Trình duyệt của bạn không hỗ trợ thẻ video.
            </video>
            <div className="flex justify-end mt-2">
              <Button onClick={downloadVideo} className="bg-blue-600 hover:bg-blue-700 text-white">
                <i className="fas fa-download mr-2"></i> Tải Xuống
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hiển thị trạng thái task đang tạo video */}
      {taskId && (taskStatus === 'pending' || taskStatus === 'processing') && (
        <div className="bg-blue-900 bg-opacity-30 border border-blue-500 p-4 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <i className="fas fa-cog fa-spin mr-2 text-blue-400"></i>
              <span className="text-blue-300">
                {taskStatus === 'pending' ? 'Đang chuẩn bị tạo video...' : 'Đang tạo video...'}
              </span>
            </div>
            <span className="text-blue-300 font-medium">{taskProgress}%</span>
          </div>
          
          <Progress value={taskProgress} className="h-2" />
          
          <p className="text-gray-400 text-sm">
            Quá trình này có thể mất vài phút. Hệ thống đang xử lý các bước tạo video (tạo hình ảnh, audio, và ghép video).
          </p>
        </div>
      )}
      
      {/* Hiển thị hình ảnh và audio đã tạo */}
      {!videoUrl && imageUrl && audioPath && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800 p-4 rounded-xl">
            <h4 className="text-blue-400 mb-2">
              <i className="fas fa-image mr-2"></i> Hình Ảnh
            </h4>
            <img 
              src={imageUrl} 
              alt="Story cover" 
              className="w-full rounded-lg"
            />
          </div>
          <div className="bg-gray-800 p-4 rounded-xl">
            <h4 className="text-blue-400 mb-2">
              <i className="fas fa-volume-up mr-2"></i> Audio
            </h4>
            <audio controls className="w-full mt-2">
              <source src={audioPath} type="audio/mpeg" />
              Trình duyệt của bạn không hỗ trợ thẻ audio.
            </audio>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCreator;