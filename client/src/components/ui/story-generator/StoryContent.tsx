import React, { FC, useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { StoryOutline } from "@/lib/types";
import { useIsMobile } from "@/hooks/use-mobile";
import AudioPlayer from "./AudioPlayer";

interface StoryContentProps {
  content: string;
  outline: StoryOutline;
  genre: string;
  onGenerateScene: () => void;
  isLoading: boolean;
  onContentUpdate?: (newContent: string) => void;
}

const StoryContent: FC<StoryContentProps> = ({ 
  content, 
  outline,
  genre,
  onGenerateScene, 
  isLoading,
  onContentUpdate 
}) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isContinuing, setIsContinuing] = useState(false);
  const [previousVersions, setPreviousVersions] = useState<string[]>([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0);
  const [newContentAdded, setNewContentAdded] = useState(false);
  const [previousContentLength, setPreviousContentLength] = useState(0);
  const [showAudioPlayer, setShowAudioPlayer] = useState(false);
  const contentEndRef = useRef<HTMLDivElement>(null);

  // Cuộn đến nội dung mới khi đã thêm
  useEffect(() => {
    if (newContentAdded && contentEndRef.current) {
      // Đợi một chút để DOM cập nhật hoàn toàn trước khi cuộn
      setTimeout(() => {
        contentEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
      
      // Đặt một hẹn giờ để bỏ đánh dấu nội dung mới sau 5 giây
      const timer = setTimeout(() => {
        setNewContentAdded(false);
        setPreviousContentLength(0);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [newContentAdded]);

  // Lấy phần cuối của nội dung hiện tại để làm ngữ cảnh cho việc viết tiếp
  const getEndingContext = () => {
    // Tách thành các đoạn văn
    const paragraphs = content.split("\n").filter(p => p.trim() !== "");
    
    // Nếu không có đoạn văn nào, trả về chuỗi rỗng
    if (paragraphs.length === 0) return "";
    
    // Lấy tối đa 3 đoạn văn cuối
    const lastParagraphs = paragraphs.slice(-3);
    let context = lastParagraphs.join("\n");
    
    // Nếu vẫn quá dài, cắt bớt xuống còn khoảng 500 ký tự
    if (context.length > 500) {
      context = context.slice(-500);
      
      // Tìm vị trí câu đầu tiên (sau dấu chấm và khoảng trắng)
      const firstSentencePos = context.search(/[.!?]\s\w/);
      if (firstSentencePos > 0) {
        // Cắt từ sau dấu chấm đầu tiên
        context = context.slice(firstSentencePos + 2);
      }
    }
    
    console.log("Ngữ cảnh để viết tiếp:", context);
    return context;
  };

  // Tiếp tục viết nội dung
  const continueWriting = async () => {
    try {
      setIsContinuing(true);
      
      // Lưu phiên bản hiện tại vào lịch sử
      if (previousVersions.length === 0 || previousVersions[previousVersions.length - 1] !== content) {
        setPreviousVersions([...previousVersions, content]);
        setCurrentVersionIndex(previousVersions.length);
      }
      
      // Lấy ngữ cảnh cuối (3-5 câu cuối)
      const endingContext = getEndingContext();
      
      // Gửi request API để tiếp tục viết
      const response = await apiRequest(
        "POST",
        "/api/continue-story",
        {
          content: content,
          outline: outline,
          genre: genre,
          endingContext: endingContext
        }
      );
      
      const result = await response.json();
      
      // Cập nhật nội dung truyện với nội dung mới
      if (result.continuedContent && onContentUpdate) {
        // Xử lý nhiều trường hợp phản hồi khác nhau từ API
        let continuedText = '';
        
        if (typeof result.continuedContent === 'string') {
          // Trường hợp 1: continuedContent là string
          continuedText = result.continuedContent;
        } else if (typeof result.continuedContent === 'object') {
          // Trường hợp 2: continuedContent là object
          if (result.continuedContent.content) {
            // Kết quả có thể có nhiều cấp lồng nhau hoặc chứa các ký tự đánh dấu
            let extractedContent = '';
            
            if (typeof result.continuedContent.content === 'string') {
              // Nếu content là chuỗi, sử dụng trực tiếp
              extractedContent = result.continuedContent.content;
            } else if (typeof result.continuedContent.content === 'object') {
              // Trường hợp content là object (có thể có content lồng nhau)
              if (result.continuedContent.content.content) {
                // Thử lấy nội dung từ trường content lồng
                extractedContent = typeof result.continuedContent.content.content === 'string'
                  ? result.continuedContent.content.content
                  : JSON.stringify(result.continuedContent.content.content);
              } else {
                // Nếu không có content lồng nhau, chuyển đổi object thành chuỗi
                extractedContent = JSON.stringify(result.continuedContent.content);
              }
            } else {
              // Trường hợp khác, chuyển đổi sang chuỗi
              extractedContent = String(result.continuedContent.content);
            }
            
            // Loại bỏ cú pháp Markdown ```json và ``` nếu có
            continuedText = extractedContent
              .replace(/```json\n/g, '')
              .replace(/```\n/g, '')
              .replace(/```/g, '');
              
            // Nếu kết quả vẫn có cấu trúc JSON, thử phân tích nó
            if (continuedText.trim().startsWith('{') && continuedText.trim().endsWith('}')) {
              try {
                const parsed = JSON.parse(continuedText);
                // Nếu JSON có trường content, sử dụng nó
                if (parsed.content) {
                  continuedText = parsed.content;
                }
              } catch (e) {
                // Không phải JSON hợp lệ, giữ nguyên nội dung
                console.log('Không thể parse JSON trong continuedText:', e);
              }
            }
          } else {
            // Trường hợp 2.2: Không có thuộc tính content, chuyển đổi object thành chuỗi có định dạng
            try {
              const jsonString = JSON.stringify(result.continuedContent);
              // Loại bỏ dấu ngoặc và xử lý để có định dạng văn bản đẹp hơn
              continuedText = jsonString
                .replace(/[{}"]/g, '')
                .replace(/,/g, '\n')
                .replace(/:/g, ': ');
            } catch (e) {
              console.error('Lỗi khi xử lý đối tượng continuedContent:', e);
              continuedText = 'Không thể xử lý nội dung mới. Vui lòng thử lại.';
            }
          }
        }
        
        // Đảm bảo continuedText là string trước khi sử dụng .trim()
        const textContent = typeof continuedText === 'string' ? continuedText : 
                          (continuedText ? String(continuedText) : '');
        
        // Đảm bảo có nội dung để thêm vào
        if (textContent && textContent.trim() !== '') {
          // Lưu độ dài nội dung cũ để theo dõi phần mới thêm vào
          setPreviousContentLength(content.length);
          
          const newContent = content + "\n\n" + textContent;
          onContentUpdate(newContent);
          
          // Đánh dấu đã thêm nội dung mới để kích hoạt cuộn
          setNewContentAdded(true);
          
          // Thông báo thành công
          toast({
            title: "Viết tiếp thành công",
            description: "Nội dung mới đã được thêm vào truyện",
          });
        } else {
          // Thông báo lỗi nếu không có nội dung
          toast({
            title: "Lỗi khi viết tiếp",
            description: "Không nhận được nội dung mới từ hệ thống",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Error continuing story:", error);
      toast({
        title: "Lỗi khi viết tiếp truyện",
        description: error instanceof Error ? error.message : "Đã xảy ra lỗi khi viết tiếp truyện",
        variant: "destructive",
      });
    } finally {
      setIsContinuing(false);
    }
  };

  // Quay lại phiên bản trước đó
  const undoToLastVersion = () => {
    if (previousVersions.length > 0 && currentVersionIndex > 0) {
      const newIndex = currentVersionIndex - 1;
      setCurrentVersionIndex(newIndex);
      
      // Xóa đánh dấu nội dung mới khi hoàn tác
      setPreviousContentLength(0);
      setNewContentAdded(false);
      
      if (onContentUpdate) {
        onContentUpdate(previousVersions[newIndex]);
      }
      toast({
        title: "Đã quay lại phiên bản trước",
        description: "Nội dung truyện đã được khôi phục về phiên bản trước đó",
      });
    } else {
      toast({
        title: "Không thể quay lại",
        description: "Không có phiên bản trước đó để khôi phục",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="text-gray-300 whitespace-pre-wrap text-xs sm:text-base">
      {previousVersions.length > 0 && currentVersionIndex > 0 && (
        <div className="flex justify-end mb-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={undoToLastVersion}
            className="text-xs flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-gray-300 border-gray-600"
          >
            <i className="fas fa-history mr-1"></i>
            Khôi phục bản trước
          </Button>
        </div>
      )}

      <div className="whitespace-pre-wrap leading-relaxed">
        {content && content.split("\n").map((paragraph, index, paragraphs) => {
          // Kiểm tra nếu đây là đoạn mới thêm vào
          const paragraphStart = paragraphs.slice(0, index).join("\n").length + (index > 0 ? 1 : 0);
          const isNewParagraph = previousContentLength > 0 && paragraphStart >= previousContentLength;
          
          return (
            <p 
              key={index} 
              className={`
                ${paragraph.trim() === "" ? "h-4" : "mb-4"}
                ${isNewParagraph ? "text-green-300 animate-pulse" : ""}
              `}
              // Đặt ref cho đoạn cuối cùng để cuộn đến
              ref={index === paragraphs.length - 1 ? contentEndRef : undefined}
            >
              {isNewParagraph && (
                <span className="inline-block bg-green-900 bg-opacity-20 px-1 mr-1 text-[8px] text-green-300 rounded-sm">
                  MỚI
                </span>
              )}
              {paragraph}
            </p>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Button
          onClick={continueWriting}
          className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white rounded-md flex items-center justify-center transition-colors text-xs sm:text-sm"
          disabled={isLoading || isContinuing}
        >
          {isContinuing ? (
            <>
              <div className="spinner spinner-moc spinner-sm rounded-full mr-2"></div>
              <span className="hidden xs:inline">Đang</span> viết tiếp...
            </>
          ) : (
            <>
              <i className="fas fa-pen-fancy mr-2"></i>
              <span className="hidden xs:inline">Tiếp tục</span> viết
            </>
          )}
        </Button>

        <Button
          onClick={onGenerateScene}
          className="bg-gradient-to-r from-moc-primary to-moc-accent hover:from-moc-secondary hover:to-moc-highlight text-white rounded-md flex items-center justify-center transition-colors text-xs sm:text-sm"
          disabled={isLoading || isContinuing}
        >
          {isLoading ? (
            <>
              <div className="spinner spinner-moc spinner-sm rounded-full mr-2"></div>
              <span className="hidden xs:inline">Đang</span> tạo...
            </>
          ) : (
            <>
              <i className="fas fa-images mr-2"></i>
              Tạo <span className="hidden xs:inline">phân</span> cảnh & hình ảnh
            </>
          )}
        </Button>

        <Button
          onClick={() => setShowAudioPlayer(!showAudioPlayer)}
          className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-md flex items-center justify-center transition-colors text-xs sm:text-sm"
          disabled={isLoading || isContinuing}
        >
          <i className="fas fa-headphones mr-2"></i>
          {showAudioPlayer ? "Ẩn" : "Tạo"} audio
        </Button>
      </div>
      
      {showAudioPlayer && (
        <div className="mt-4">
          <AudioPlayer text={content} />
        </div>
      )}
    </div>
  );
};

export default StoryContent;
