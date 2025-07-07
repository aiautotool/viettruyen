import { useContext, useEffect, useRef, useState } from "react";
import { AppContext } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Camera, Upload, Image } from "lucide-react";

interface ImageCaptureProps {
  onImageAnalyzed?: (text: string) => void;
}

const ImageCapture = ({ onImageAnalyzed }: ImageCaptureProps) => {
  const { setSelectedFile, setQuestionText, setSelectedSubject } = useContext(AppContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [facingMode, setFacingMode] = useState<string>("environment");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();
  
  // Start camera when modal is opened
  useEffect(() => {
    if (isModalOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [isModalOpen, facingMode]);
  
  // Start the camera
  const startCamera = async () => {
    try {
      setIsCapturing(true);
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      const constraints = {
        video: {
          facingMode: facingMode,
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({
        title: "Lỗi camera",
        description: "Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.",
        variant: "destructive",
      });
    } finally {
      setIsCapturing(false);
    }
  };
  
  // Stop the camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };
  
  // Switch between front and back cameras
  const switchCamera = () => {
    setFacingMode(prev => (prev === "environment" ? "user" : "environment"));
  };
  
  // Analyze image and extract topic
  const analyzeImage = async (file: File) => {
    if (!file) return;
    
    setIsAnalyzing(true);
    
    try {
      // Reset content
      setQuestionText("");
      
      // Create a FormData instance
      const formData = new FormData();
      formData.append("image", file);
      
      // Show loading toast
      toast({
        title: "Đang phân tích ảnh...",
        description: "Vui lòng đợi trong giây lát",
      });
      
      // Send the image for analysis
      const response = await fetch("/api/analyze-image", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Không thể phân tích hình ảnh");
      }
      
      const data = await response.json();
      
      // Update the text with the analyzed content
      console.log("Analyzed image data:", data);
      console.log("Setting questionText to:", data.description);
      setQuestionText(data.description);
      
      // Gọi callback để thông báo cho component cha biết về kết quả phân tích
      if (onImageAnalyzed) {
        onImageAnalyzed(data.description);
      }
      
      // Update the detected subject if available
      if (data.subject) {
        console.log("Setting selectedSubject to:", data.subject);
        setSelectedSubject(data.subject);
      }
      
      // Show success toast
      toast({
        title: "Phân tích thành công",
        description: `Nội dung đã được trích xuất từ ảnh.`,
        variant: "default",
      });
    } catch (error) {
      console.error("Error analyzing image:", error);
      toast({
        title: "Lỗi phân tích ảnh",
        description: "Không thể phân tích nội dung ảnh. Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      analyzeImage(file);
    }
  };
  
  // Trigger file input click
  const openFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Take a photo
  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw the video frame to the canvas
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to file
        canvas.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
            setSelectedFile(file);
            
            toast({
              title: "Ảnh đã được chụp",
              description: "Đang phân tích nội dung ảnh...",
            });
            
            setIsModalOpen(false);
            
            // Analyze the captured image automatically
            await analyzeImage(file);
          }
        }, "image/jpeg", 0.8);
      }
    }
  };
  
  return (
    <>
      <div className="flex gap-1 h-full">
        <button
          type="button"
          onClick={openFileDialog}
          className="h-full flex items-center justify-center text-gray-300 hover:bg-gray-600 transition-colors px-2"
          title="Tải ảnh lên"
        >
          <Upload size={18} />
        </button>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="h-full w-px bg-gray-600"></div>
        
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="h-full flex items-center justify-center text-gray-300 hover:bg-gray-600 transition-colors px-2"
          title="Chụp ảnh"
        >
          <Camera size={18} />
        </button>
      </div>
      
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chụp ảnh</DialogTitle>
          </DialogHeader>
          
          <div className="p-2">
            <div className="w-full h-64 bg-gray-200 dark:bg-gray-800 rounded-lg mb-4 overflow-hidden">
              <video 
                ref={videoRef} 
                className="w-full h-full object-cover" 
                autoPlay 
                playsInline
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={switchCamera}
                disabled={isCapturing}
              >
                <Image size={16} className="mr-2" />
                Đổi camera
              </Button>
              
              <Button
                onClick={takePhoto}
                disabled={isCapturing}
              >
                <Camera size={16} className="mr-2" />
                Chụp ảnh
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ImageCapture;