import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  Download, 
  Headphones, 
  Mic,
  MessageSquare,
  FileAudio,
  Loader
} from 'lucide-react';

// Interface cho các props của component
interface AudioPlayerProps {
  text: string;
  isPodcast?: boolean;
  title?: string;
  onAudioPathCreated?: (audioPath: string) => void;
}

// Interface cho tiếng nói
interface Voice {
  value: string;
  label: string;
}

const AudioPlayer = ({ text, isPodcast = false, title = "", onAudioPathCreated }: AudioPlayerProps) => {
  // Xử lý text khi có [SEPARATOR]
  const processedText = React.useMemo(() => {
    // Nếu là nội dung podcast có chứa [SEPARATOR], xử lý thay thế
    if (isPodcast && text.includes("[SEPARATOR]")) {
      // Tìm nội dung truyện thực tế từ text (sau dấu hiệu [SEPARATOR])
      const parts = text.split("[SEPARATOR]");
      if (parts.length === 2) {
        // Chỉ thay thế [SEPARATOR] với nội dung trống để tránh text quá dài
        return text.replace("[SEPARATOR]", "\n\n...\n\n");
      }
    }
    return text;
  }, [text, isPodcast]);

  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('vi-VN-NamMinhNeural');
  const [speed, setSpeed] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // Toast
  const { toast } = useToast();

  // Lấy danh sách các giọng đọc tiếng Việt khi component được mount
  useEffect(() => {
    const fetchVoices = async () => {
      setIsLoadingVoices(true);
      try {
        const response = await fetch('/api/vietnamese-voices');
        const data = await response.json();
        if (Array.isArray(data)) {
          setVoices(data);
        } else {
          console.error('Dữ liệu giọng đọc không hợp lệ:', data);
          // Dùng một số giọng mặc định nếu không lấy được từ API
          setVoices([
            { value: 'vi-VN-NamMinhNeural', label: 'Nam Minh (Nam)' },
            { value: 'vi-VN-HoaiMyNeural', label: 'Hoài My (Nữ)' },
            { value: 'vi-VN-ThanhTuNeural', label: 'Thanh Tú (Nam trẻ)' },
            { value: 'vi-VN-NgocHoangNeural', label: 'Ngọc Hoàng (Nam trung niên)' }
          ]);
        }
      } catch (error) {
        console.error('Lỗi khi lấy danh sách giọng đọc:', error);
        // Dùng một số giọng mặc định nếu có lỗi
        setVoices([
          { value: 'vi-VN-NamMinhNeural', label: 'Nam Minh (Nam)' },
          { value: 'vi-VN-HoaiMyNeural', label: 'Hoài My (Nữ)' },
          { value: 'vi-VN-ThanhTuNeural', label: 'Thanh Tú (Nam trẻ)' },
          { value: 'vi-VN-NgocHoangNeural', label: 'Ngọc Hoàng (Nam trung niên)' }
        ]);
      } finally {
        setIsLoadingVoices(false);
      }
    };

    fetchVoices();

    // Cleanup
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, []);

  // Cập nhật thời gian hiện tại của audio
  const updateTime = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      animationRef.current = requestAnimationFrame(updateTime);
    }
  };

  // Xử lý khi ấn nút play/pause
  const togglePlayPause = () => {
    const prevValue = isPlaying;
    setIsPlaying(!prevValue);

    if (!prevValue) {
      if (audioRef.current) {
        audioRef.current.play();
        animationRef.current = requestAnimationFrame(updateTime);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      }
    }
  };

  // Xử lý khi tạo audio mới
  const handleGenerateAudio = async () => {
    // Sử dụng text từ processedText đã được xử lý
    if (!processedText || processedText.trim() === "") {
      toast({
        title: "Thiếu nội dung",
        description: "Vui lòng nhập nội dung để tạo audio",
        variant: "destructive"
      });
      return;
    }
    
    console.log("Tạo audio với text độ dài:", processedText.length, "isPodcast:", isPodcast ? "true" : "false");

    try {
      setIsLoading(true);
      
      // Cắt bớt text nếu quá dài (giới hạn ở 4000 ký tự)
      const textForAudio = processedText.length > 4000 ? processedText.substring(0, 4000) + "..." : processedText;
      
      console.log("Bắt đầu tạo audio...");
      const response = await apiRequest(
        "POST",
        "/api/generate-audio",
        {
          text: textForAudio,
          voice: selectedVoice,
          speed: speed
        }
      );
      
      console.log("Đã nhận phản hồi từ API");
      const result = await response.json();
      console.log("Kết quả API:", result);

      // Kiểm tra nếu API trả về audioPath (định dạng mới)
      if (result && result.success && result.audioPath) {
        console.log("Đã nhận được đường dẫn audio:", result.audioPath);
        
        try {
          // Sử dụng đường dẫn audio trực tiếp
          const audioUrl = result.audioPath;
          console.log("Audio URL:", audioUrl);
          setAudioUrl(audioUrl);
          
          // Tạo tên file mặc định từ đường dẫn
          const pathParts = audioUrl.split('/');
          const fileName = pathParts[pathParts.length - 1];
          setFileName(fileName);

          // Đặt URL tải xuống
          setDownloadUrl(audioUrl);

          // Gọi callback để thông báo đường dẫn đã tạo cho component cha
          if (onAudioPathCreated) {
            onAudioPathCreated(audioUrl);
          }

          toast({
            title: "Tạo audio thành công",
            description: "Audio đã được tạo thành công. Bạn có thể phát hoặc tải về.",
            duration: 3000
          });
          
          console.log("Đã thiết lập player với audio mới");
        } catch (error) {
          console.error("Lỗi khi xử lý đường dẫn audio:", error);
          toast({
            title: "Lỗi xử lý audio",
            description: "Không thể xử lý đường dẫn audio. Chi tiết: " + (error instanceof Error ? error.message : "Lỗi không xác định"),
            variant: "destructive"
          });
        }
      } 
      // Xử lý định dạng cũ (base64)
      else if (result && result.audio) {
        console.log("Độ dài audio nhận được:", result.audio.length);
        
        try {
          // Giải mã base64 string đúng cách
          const base64Audio = result.audio.replace(/^data:audio\/mp3;base64,/, '');
          console.log("Chuỗi base64 đã được xử lý");
          
          // Tạo blob từ base64 string
          const byteCharacters = atob(base64Audio);
          console.log("Chuỗi byte sau khi giải mã:", byteCharacters.length, "bytes");
          
          // Chuyển đổi thành một mảng byte
          const byteArrays = [];
          const sliceSize = 1024;
          
          for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
            const slice = byteCharacters.slice(offset, offset + sliceSize);
            const byteNumbers = new Array(slice.length);
            
            for (let i = 0; i < slice.length; i++) {
              byteNumbers[i] = slice.charCodeAt(i);
            }
            
            byteArrays.push(new Uint8Array(byteNumbers));
          }
          
          // Tạo blob từ các mảng byte
          const blob = new Blob(byteArrays, { type: 'audio/mpeg' });
          console.log("Kích thước của Blob:", blob.size, "bytes");
          
          if (blob.size > 0) {
            // Tạo URL object từ blob
            const audioUrl = URL.createObjectURL(blob);
            console.log("Audio URL được tạo:", audioUrl);
            setAudioUrl(audioUrl);
            
            // Tạo tên file mặc định
            const defaultFileName = isPodcast 
              ? `podcast_${title || Date.now()}.mp3`
              : `audio_${Date.now()}.mp3`;
            
            setFileName(defaultFileName);

            // Lưu audio để tải về
            saveAudioForDownload(result.audio, defaultFileName);

            toast({
              title: "Tạo audio thành công",
              description: "Audio đã được tạo thành công. Bạn có thể phát hoặc tải về.",
              duration: 3000
            });
            
            console.log("Đã thiết lập player với audio mới");
          } else {
            throw new Error("Dữ liệu audio trống hoặc không hợp lệ");
          }
        } catch (blobError) {
          console.error("Lỗi chi tiết khi xử lý dữ liệu audio:", blobError);
          toast({
            title: "Lỗi định dạng audio",
            description: "Không thể xử lý dữ liệu audio nhận được. Chi tiết: " + (blobError instanceof Error ? blobError.message : "Lỗi không xác định"),
            variant: "destructive"
          });
        }
      } else {
        console.error("Không nhận được dữ liệu audio từ API", result);
        toast({
          title: "Lỗi tạo audio",
          description: "Không nhận được dữ liệu audio từ máy chủ. Chi tiết: " + (result.message || "Lỗi không xác định"),
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Lỗi khi tạo audio:", error);
      toast({
        title: "Lỗi khi tạo audio",
        description: error instanceof Error ? error.message : "Đã xảy ra lỗi khi tạo audio. Vui lòng thử lại sau.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Lưu audio để tải xuống
  const saveAudioForDownload = async (audioBase64: string, fileName: string) => {
    try {
      const response = await apiRequest(
        "POST",
        "/api/download-audio",
        {
          audioBase64,
          fileName
        }
      );
      
      const result = await response.json();

      if (result.success && result.downloadUrl) {
        setDownloadUrl(result.downloadUrl);
        
        // Gọi callback để thông báo đường dẫn đã tạo cho component cha
        if (onAudioPathCreated) {
          onAudioPathCreated(result.downloadUrl);
        }
      } else {
        console.error("Không thể lưu audio:", result);
      }
    } catch (error) {
      console.error("Lỗi khi lưu audio:", error);
    }
  };

  // Xử lý khi audio được load
  const handleLoadedData = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      audioRef.current.volume = volume;
    }
  };

  // Xử lý khi audio kết thúc
  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  // Xử lý khi thay đổi âm lượng
  const handleVolumeChange = (newValue: number[]) => {
    const value = newValue[0];
    setVolume(value);
    if (audioRef.current) {
      audioRef.current.volume = value;
    }
  };

  // Xử lý khi thay đổi tốc độ
  const handleSpeedChange = (value: string) => {
    const speedValue = parseFloat(value);
    setSpeed(speedValue);
  };

  // Xử lý khi thay đổi giọng đọc
  const handleVoiceChange = (value: string) => {
    setSelectedVoice(value);
  };

  // Định dạng thời gian từ giây thành mm:ss
  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full bg-gray-800 p-4 rounded-lg shadow-lg">
      <div className="flex flex-col">
        {/* Thông tin về nội dung */}
        <div className="mb-4 flex items-center">
          {isPodcast ? (
            <MessageSquare className="h-5 w-5 mr-2 text-green-400" />
          ) : (
            <FileAudio className="h-5 w-5 mr-2 text-blue-400" />
          )}
          <span className="text-gray-300 text-sm font-medium">
            {isPodcast ? "Podcast" : "Audio"} - {text.length} ký tự
          </span>
        </div>
        
        {/* Panel chọn giọng đọc và tốc độ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div className="flex flex-col">
            <label className="text-gray-300 text-xs mb-1 flex items-center">
              <Mic className="h-3 w-3 mr-1" />
              Giọng đọc
            </label>
            <Select disabled={isLoading} value={selectedVoice} onValueChange={handleVoiceChange}>
              <SelectTrigger className="w-full bg-gray-700 border-gray-600 h-8 text-sm">
                <SelectValue placeholder="Chọn giọng đọc" />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                {isLoadingVoices ? (
                  <div className="flex items-center justify-center p-2">
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    <span>Đang tải...</span>
                  </div>
                ) : (
                  voices.map((voice) => (
                    <SelectItem key={voice.value} value={voice.value}>
                      {voice.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex flex-col">
            <label className="text-gray-300 text-xs mb-1 flex items-center">
              <Headphones className="h-3 w-3 mr-1" />
              Tốc độ đọc
            </label>
            <Select 
              disabled={isLoading} 
              value={speed.toString()} 
              onValueChange={handleSpeedChange}
            >
              <SelectTrigger className="w-full bg-gray-700 border-gray-600 h-8 text-sm">
                <SelectValue placeholder="Chọn tốc độ đọc" />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                <SelectItem value="0.8">Chậm (0.8x)</SelectItem>
                <SelectItem value="1">Bình thường (1x)</SelectItem>
                <SelectItem value="1.2">Nhanh (1.2x)</SelectItem>
                <SelectItem value="1.5">Rất nhanh (1.5x)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Các nút điều khiển */}
        <div className="flex gap-2 mb-4">
          {/* Nút tạo audio */}
          <Button 
            variant="outline" 
            className="bg-gray-700 hover:bg-gray-600 border-gray-600 text-green-400 hover:text-green-300"
            onClick={handleGenerateAudio}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                Đang tạo audio...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Tạo audio
              </>
            )}
          </Button>

          {/* Nút tải xuống audio */}
          {downloadUrl && (
            <a 
              href={downloadUrl} 
              download={fileName} 
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium h-10 px-4 py-2 text-sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Tải xuống
            </a>
          )}
        </div>

        {/* Trình phát audio */}
        {audioUrl && (
          <>
            <audio 
              ref={audioRef}
              src={audioUrl}
              onLoadedData={handleLoadedData}
              onEnded={handleEnded}
              onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
            />
            
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300 text-xs">{formatTime(currentTime)}</span>
              <span className="text-gray-300 text-xs">{formatTime(duration)}</span>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-gray-700 rounded-full h-1.5 mb-4 overflow-hidden">
              <div 
                className="bg-green-500 h-1.5 rounded-full" 
                style={{ width: `${(currentTime / duration) * 100}%` }}
              ></div>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-white bg-gray-700 hover:bg-gray-600 rounded-full"
                  onClick={togglePlayPause}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-white bg-gray-700 hover:bg-gray-600 rounded-full ml-2"
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </Button>
                
                <div className="w-24 ml-2">
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    min={0}
                    max={1}
                    step={0.01}
                    onValueChange={handleVolumeChange}
                    className="h-1"
                  />
                </div>
              </div>
              
              {downloadUrl && (
                <a 
                  href={downloadUrl} 
                  download={fileName} 
                  className="text-white bg-green-600 hover:bg-green-700 rounded-md px-3 py-1 text-xs flex items-center"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Tải về
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AudioPlayer;