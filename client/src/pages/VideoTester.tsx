import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";

export default function VideoTester() {
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [audioPath, setAudioPath] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("Test Video");
  const [voice, setVoice] = useState("vi-VN-NamMinhNeural");
  const [videoUrl, setVideoUrl] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  // Tạo audio từ text
  const generateAudio = async () => {
    if (!text) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng nhập nội dung văn bản để tạo audio",
      });
      return;
    }

    setIsLoadingAudio(true);
    try {
      console.log("Gửi yêu cầu tạo audio với văn bản:", text.substring(0, 30) + "...");
      
      const response = await axios.post("/api/voice", {
        text,
        voice,
        name: title || "test_audio"
      });

      console.log("Phản hồi từ API:", response.data);
      
      if (response.data.audioPath) {
        setAudioPath(response.data.audioPath);
        
        // Thông báo và log đường dẫn audio
        console.log("Đường dẫn audio:", response.data.audioPath);
        
        toast({
          title: "Thành công",
          description: "Đã tạo audio thành công"
        });
        
        // Kiểm tra xem audio có tồn tại không
        try {
          await axios.head(response.data.audioPath);
          console.log("File audio có thể truy cập được");
        } catch (err) {
          console.error("Không thể truy cập file audio:", err);
        }
      } else {
        throw new Error("Không nhận được đường dẫn audio từ API");
      }
    } catch (error) {
      console.error("Lỗi khi tạo audio:", error);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể tạo audio. Vui lòng thử lại."
      });
    } finally {
      setIsLoadingAudio(false);
    }
  };

  // Tạo video từ audio và hình ảnh
  const createVideo = async () => {
    if (!audioPath) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng tạo audio trước khi tạo video",
      });
      return;
    }

    if (!imagePath) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng chọn hoặc tạo hình ảnh trước khi tạo video",
      });
      return;
    }

    setIsLoadingVideo(true);
    try {
      // Tạo video với định dạng 9:16 (dọc) phù hợp cho các nền tảng như TikTok, Instagram, YouTube Shorts
      const resolution = "576x1024"; // Tỷ lệ 9:16
      
      console.log("Gửi yêu cầu tạo video với:", { audioPath, imagePath, title, resolution });
      
      const response = await axios.post("/api/create-video", {
        audioPath,
        imagePath,
        title: title || "Test Video",
        resolution
      });

      console.log("Phản hồi từ API tạo video:", response.data);
      
      if (response.data.videoUrl) {
        setVideoUrl(response.data.videoUrl);
        console.log("Đường dẫn video:", response.data.videoUrl);
        
        toast({
          title: "Thành công",
          description: "Đã tạo video thành công với độ phân giải 9:16",
        });
      } else {
        throw new Error("Không nhận được đường dẫn video từ API");
      }
    } catch (error: any) {
      console.error("Lỗi khi tạo video:", error);
      
      // Hiển thị thông báo lỗi chi tiết hơn
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          "Không thể tạo video. Vui lòng thử lại.";
      
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: errorMessage
      });
    } finally {
      setIsLoadingVideo(false);
    }
  };

  // Tạo hình ảnh đại diện
  const generateCoverImage = async () => {
    if (!title) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng nhập tiêu đề để tạo hình ảnh",
      });
      return;
    }

    try {
      console.log("Gửi yêu cầu tạo hình ảnh cho tiêu đề:", title);
      
      const response = await axios.post("/api/generate-cover", {
        title,
        genre: "Fantasy"
      });

      console.log("Phản hồi từ API tạo ảnh:", response.data);
      
      if (response.data.imageUrl) {
        setImagePath(response.data.imageUrl);
        console.log("Đã nhận đường dẫn hình ảnh:", response.data.imageUrl);
        
        toast({
          title: "Thành công",
          description: "Đã tạo hình ảnh thành công",
        });
      } else if (response.data.image) {
        // Nếu có chuỗi base64 nhưng không có URL
        console.log("Nhận được chuỗi base64 ảnh nhưng không có URL");
        
        // Chuyển chuỗi base64 thành URL blob
        const base64Image = response.data.image;
        const imageType = base64Image.startsWith("/9j/") ? "image/jpeg" : "image/png";
        const blob = await (await fetch(`data:${imageType};base64,${base64Image}`)).blob();
        const imageUrl = URL.createObjectURL(blob);
        
        setImagePath(imageUrl);
        toast({
          title: "Thành công",
          description: "Đã tạo hình ảnh thành công (dạng blob URL)",
        });
      } else {
        throw new Error("Không nhận được dữ liệu hình ảnh từ API");
      }
    } catch (error) {
      console.error("Lỗi khi tạo hình ảnh:", error);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể tạo hình ảnh. Vui lòng thử lại."
      });
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Công cụ kiểm thử tạo video truyện</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="audio" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="audio">Tạo Audio</TabsTrigger>
              <TabsTrigger value="image">Hình Ảnh</TabsTrigger>
              <TabsTrigger value="video">Tạo Video</TabsTrigger>
            </TabsList>

            <TabsContent value="audio" className="space-y-4">
              <div className="grid w-full gap-1.5">
                <Label htmlFor="title">Tiêu đề</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nhập tiêu đề"
                />
              </div>

              <div className="grid w-full gap-1.5">
                <Label htmlFor="voice">Giọng đọc</Label>
                <select
                  id="voice"
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="vi-VN-NamMinhNeural">Nam Minh (Nam)</option>
                  <option value="vi-VN-HoaiMyNeural">Hoài My (Nữ)</option>
                </select>
              </div>

              <div className="grid w-full gap-1.5">
                <Label htmlFor="text">Nội dung văn bản</Label>
                <Textarea
                  id="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Nhập nội dung văn bản để tạo audio"
                  className="min-h-[200px]"
                />
              </div>

              <Button onClick={generateAudio} disabled={isLoadingAudio || !text}>
                {isLoadingAudio ? "Đang tạo audio..." : "Tạo Audio"}
              </Button>

              {audioPath && (
                <div className="mt-4">
                  <p className="text-sm text-gray-500 mb-2">Audio đã tạo:</p>
                  <audio ref={audioRef} controls className="w-full">
                    <source src={audioPath} type="audio/mpeg" />
                    Trình duyệt của bạn không hỗ trợ thẻ audio.
                  </audio>
                  <p className="text-xs text-gray-400 mt-1">Đường dẫn: {audioPath}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="image" className="space-y-4">
              <div className="grid w-full gap-1.5">
                <Label htmlFor="image-title">Tiêu đề cho hình ảnh</Label>
                <Input
                  id="image-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nhập tiêu đề cho hình ảnh"
                />
              </div>

              <Button onClick={generateCoverImage}>
                Tạo hình ảnh đại diện
              </Button>

              <div className="grid w-full gap-1.5">
                <Label htmlFor="image-path">Hoặc nhập đường dẫn hình ảnh có sẵn</Label>
                <Input
                  id="image-path"
                  value={imagePath}
                  onChange={(e) => setImagePath(e.target.value)}
                  placeholder="Ví dụ: /images/example.jpg"
                />
              </div>

              {imagePath && (
                <div className="mt-4">
                  <p className="text-sm text-gray-500 mb-2">Hình ảnh:</p>
                  <img 
                    src={imagePath} 
                    alt="Cover" 
                    className="max-w-full h-auto max-h-[300px] border rounded"
                  />
                  <p className="text-xs text-gray-400 mt-1">Đường dẫn: {imagePath}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="video" className="space-y-4">
              <div className="grid gap-4 p-4 border rounded bg-gray-50">
                <div>
                  <Label className="font-bold">Audio:</Label>
                  <p className="text-sm">{audioPath || "Chưa có audio"}</p>
                </div>
                <div>
                  <Label className="font-bold">Hình ảnh:</Label>
                  <p className="text-sm">{imagePath || "Chưa có hình ảnh"}</p>
                </div>
                <div>
                  <Label className="font-bold">Tiêu đề:</Label>
                  <p className="text-sm">{title || "Chưa có tiêu đề"}</p>
                </div>
              </div>

              <Button 
                onClick={createVideo} 
                disabled={isLoadingVideo || !audioPath || !imagePath}
                className="w-full"
              >
                {isLoadingVideo ? "Đang tạo video..." : "Tạo Video"}
              </Button>

              {videoUrl && (
                <div className="mt-4">
                  <p className="text-sm text-gray-500 mb-2">Video đã tạo:</p>
                  <video controls className="w-full">
                    <source src={videoUrl} type="video/mp4" />
                    Trình duyệt của bạn không hỗ trợ thẻ video.
                  </video>
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-gray-400">Đường dẫn: {videoUrl}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(videoUrl, "_blank")}
                    >
                      Tải xuống
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}