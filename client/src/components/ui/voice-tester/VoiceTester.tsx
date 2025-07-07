import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
// Danh sách các giọng đọc tiếng Việt có sẵn
interface Voice {
  value: string;
  label: string;
}

const vietnameseVoices: Voice[] = [
  { value: "vi-VN-NamMinhNeural", label: "Nam Minh (Nam)" },
  { value: "vi-VN-HoaiMyNeural", label: "Hoài My (Nữ)" },
  { value: "vi-VN-ThanhTuNeural", label: "Thanh Tú (Nam trẻ)" },
  { value: "vi-VN-NgocHoangNeural", label: "Ngọc Hoàng (Nam trung niên)" }
];

interface ApiResponse {
  success: boolean;
  message?: string;
  audio?: string;
  downloadUrl?: string;
}

type ApiRequestOptions = {
  method: string;
  url: string;
  data?: any;
};

export default function VoiceTester() {
  const [text, setText] = useState("Xin chào, đây là bài kiểm tra tổng hợp giọng nói tiếng Việt.");
  const [voice, setVoice] = useState("vi-VN-NamMinhNeural");
  const [speed, setSpeed] = useState(1.0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!text) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập văn bản để tạo audio",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsGenerating(true);
      setAudioSrc(null);

      // Gọi API tạo giọng nói
      const response = await fetch('/api/generate-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice,
          speed: parseFloat(speed.toString())
        })
      });
      
      const data = await response.json() as ApiResponse;

      if (data.success && data.audio) {
        // Chuyển đổi base64 thành URL để phát
        const audioBase64 = data.audio;
        const audioUrl = `data:audio/mp3;base64,${audioBase64}`;
        setAudioSrc(audioUrl);
        
        toast({
          title: "Thành công",
          description: "Đã tạo file audio thành công",
        });
      } else {
        throw new Error(data.message || "Không thể tạo file audio");
      }
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message || "Đã có lỗi xảy ra khi tạo audio",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!audioSrc) return;

    try {
      // Lấy base64 từ data URL
      const base64Audio = audioSrc.split(',')[1];
      
      // Gọi API để lưu file và lấy đường dẫn tải về
      const response = await fetch('/api/download-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioBase64: base64Audio,
          fileName: `voice_${Date.now()}.mp3`
        })
      });

      const data = await response.json() as ApiResponse;

      if (data.success && data.downloadUrl) {
        // Tạo link tải file
        const a = document.createElement('a');
        a.href = data.downloadUrl;
        a.download = 'voice.mp3';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        toast({
          title: "Thành công",
          description: "Đã tải file audio thành công",
        });
      } else {
        throw new Error(data.message || "Không thể tải file audio");
      }
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message || "Đã có lỗi xảy ra khi tải audio",
        variant: "destructive"
      });
    }
  };

  const handlePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Trình tạo giọng nói</CardTitle>
        <CardDescription>
          Chuyển đổi văn bản thành giọng nói với nhiều tùy chọn khác nhau
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="text">Văn bản</Label>
          <Textarea 
            id="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Nhập văn bản cần chuyển thành giọng nói"
            rows={4}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="voice">Giọng đọc</Label>
            <Select 
              value={voice} 
              onValueChange={setVoice}
            >
              <SelectTrigger id="voice">
                <SelectValue placeholder="Chọn giọng đọc" />
              </SelectTrigger>
              <SelectContent>
                {vietnameseVoices.map((v: Voice) => (
                  <SelectItem key={v.value} value={v.value}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Tốc độ đọc: {speed.toFixed(1)}</Label>
            <Slider
              min={0.5}
              max={2.0}
              step={0.1}
              value={[speed]}
              onValueChange={(values) => setSpeed(values[0])}
            />
          </div>
        </div>
        
        {audioSrc && (
          <div className="space-y-2 pt-4">
            <audio 
              ref={audioRef}
              src={audioSrc}
              onEnded={handleAudioEnded}
              controls
              className="w-full"
            />
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={handlePlay} 
          disabled={!audioSrc || isGenerating}
        >
          {isPlaying ? "Tạm dừng" : "Phát"}
        </Button>
        
        <div className="space-x-2">
          <Button 
            variant="outline" 
            onClick={handleDownload} 
            disabled={!audioSrc || isGenerating}
          >
            Tải xuống
          </Button>
          
          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating}
          >
            {isGenerating ? "Đang tạo..." : "Tạo giọng nói"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}