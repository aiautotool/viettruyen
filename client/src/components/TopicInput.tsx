import { useState, useEffect, useContext, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronUp,
  Mic,
  Radio,
  BookOpen,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import ImageCapture from "@/components/ImageCapture";
import { AppContext } from "@/context/AppContext";

interface TopicInputProps {
  onTopicChange: (topic: string) => void;
  onChannelInfoChange?: (info: string) => void;
  onIntroductionChange?: (intro: string) => void;
}

// Lưu các khóa trong localStorage
const STORAGE_KEYS = {
  CHANNEL_INFO: "story_generator_channel_info",
  INTRODUCTION: "story_generator_introduction",
  ADVANCED_OPEN: "story_generator_advanced_open",
};

export default function TopicInput({
  onTopicChange,
  onChannelInfoChange,
  onIntroductionChange,
}: TopicInputProps) {
  const [topic, setTopic] = useState("");
  const [channelInfo, setChannelInfo] = useState("");
  const [introduction, setIntroduction] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const { toast } = useToast();
  const { questionText, setQuestionText } = useContext(AppContext);

  // Load các giá trị lưu trữ từ localStorage khi component được tạo
  useEffect(() => {
    const savedChannelInfo = localStorage.getItem(STORAGE_KEYS.CHANNEL_INFO);
    const savedIntroduction = localStorage.getItem(STORAGE_KEYS.INTRODUCTION);
    const savedAdvancedOpen = localStorage.getItem(STORAGE_KEYS.ADVANCED_OPEN);

    if (savedChannelInfo) {
      setChannelInfo(savedChannelInfo);
    }

    if (savedIntroduction) {
      setIntroduction(savedIntroduction);
    }

    if (savedAdvancedOpen === "true") {
      setIsAdvancedOpen(true);
    }

    // Khởi tạo kích thước textarea ban đầu nếu có nội dung
    setTimeout(() => {
      const textarea = document.getElementById(
        "storyTopic",
      ) as HTMLTextAreaElement;
      if (textarea && textarea.value) {
        textarea.style.height = "auto";
        textarea.style.height = Math.min(textarea.scrollHeight, 128) + "px";
      }
    }, 100);
  }, []);

  // Cập nhật topic khi có thay đổi
  useEffect(() => {
    onTopicChange(topic);
  }, [topic, onTopicChange]);

  // Cập nhật topic khi questionText thay đổi (từ phân tích ảnh)
  // Sử dụng ref để theo dõi nguồn thay đổi
  const skipNextEffect = useRef(false);

  useEffect(() => {
    console.log("questionText changed:", questionText);

    // Chỉ cập nhật topic nếu questionText không được thay đổi từ input
    if (questionText && !skipNextEffect.current) {
      setTopic(questionText);
      console.log("Updated topic to:", questionText);

      // Trực tiếp kiểm tra và cập nhật input nếu giá trị hiển thị không khớp
      const inputElement = document.getElementById(
        "storyTopic",
      ) as HTMLInputElement;
      if (inputElement && inputElement.value !== questionText) {
        inputElement.value = questionText;
      }
    }

    // Reset flag
    skipNextEffect.current = false;
  }, [questionText]);

  // Cập nhật thông tin kênh và lưu vào localStorage khi có thay đổi
  useEffect(() => {
    if (onChannelInfoChange) {
      onChannelInfoChange(channelInfo);
    }

    if (channelInfo) {
      localStorage.setItem(STORAGE_KEYS.CHANNEL_INFO, channelInfo);
    }
  }, [channelInfo, onChannelInfoChange]);

  // Cập nhật lời dẫn và lưu vào localStorage khi có thay đổi
  useEffect(() => {
    if (onIntroductionChange) {
      onIntroductionChange(introduction);
    }

    if (introduction) {
      localStorage.setItem(STORAGE_KEYS.INTRODUCTION, introduction);
    }
  }, [introduction, onIntroductionChange]);

  // Lưu trạng thái mở/đóng của tùy chọn nâng cao
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ADVANCED_OPEN, isAdvancedOpen.toString());
  }, [isAdvancedOpen]);

  // Tự động điều chỉnh kích thước textarea khi giá trị topic thay đổi
  useEffect(() => {
    if (topic) {
      const textarea = document.getElementById(
        "storyTopic",
      ) as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = "auto";
        textarea.style.height = Math.min(textarea.scrollHeight, 128) + "px";
      }
    }
  }, [topic]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setTopic(e.target.value);

    // Đánh dấu là thay đổi từ input, để tránh vòng lặp useEffect
    skipNextEffect.current = true;
    setQuestionText(e.target.value);

    console.log("Input changed to:", e.target.value);

    // Auto-resize the textarea if it's a textarea element
    if (e.target instanceof HTMLTextAreaElement) {
      e.target.style.height = "auto";
      e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
    }
  };

  const handleChannelInfoChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setChannelInfo(e.target.value);
  };

  const handleIntroductionChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setIntroduction(e.target.value);
  };

  // Lưu các cài đặt vào localStorage và hiển thị thông báo
  const saveSettings = () => {
    localStorage.setItem(STORAGE_KEYS.CHANNEL_INFO, channelInfo);
    localStorage.setItem(STORAGE_KEYS.INTRODUCTION, introduction);

    toast({
      title: "Đã lưu cài đặt",
      description: "Thông tin kênh và lời dẫn đã được lưu cho lần sử dụng sau",
      duration: 3000,
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Label
          htmlFor="storyTopic"
          className="block text-white mb-2 sm:mb-3 font-medium text-base sm:text-lg flex items-center"
        >
          <i className="fas fa-magic text-blue-300 mr-2"></i>
          Nhập chủ đề truyện
        </Label>
        <div className="flex relative">
          <Textarea
            id="storyTopic"
            value={topic}
            onChange={handleInputChange}
            className="w-full min-h-16 max-h-40 bg-gray-800 border-2 border-blue-600/60 rounded-lg pl-4 pr-20 py-3 sm:py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-lg shadow-md overflow-y-auto resize-none"
            placeholder="Ví dụ: Một đứa trẻ phát hiện ra mình có khả năng nói chuyện với cây cối"
            rows={2}
            style={{
              overflow: "hidden",
              resize: "none",
              height: "auto",
              minHeight: "4rem",
            }}
          />
          <div className="absolute right-0 top-0 bottom-0 flex items-center h-full bg-blue-900/60 border-l border-blue-700 rounded-r-lg overflow-hidden">
            <ImageCapture
              onImageAnalyzed={(text) => {
                setTopic(text);
                // After setting text, trigger resize for the textarea
                setTimeout(() => {
                  const textarea = document.getElementById(
                    "storyTopic",
                  ) as HTMLTextAreaElement;
                  if (textarea) {
                    textarea.style.height = "auto";
                    textarea.style.height =
                      Math.min(textarea.scrollHeight, 160) + "px";
                  }
                }, 10);
              }}
            />
          </div>
        </div>
        <p className="text-blue-300 text-sm sm:text-base mt-2 sm:mt-3 font-medium">
          <i className="fas fa-lightbulb text-yellow-400 mr-2"></i>
          Chủ đề càng cụ thể, kết quả truyện càng thú vị
        </p>
      </div>

      <Collapsible
        open={isAdvancedOpen}
        onOpenChange={setIsAdvancedOpen}
        className="border border-gray-700 rounded-lg p-2 sm:p-3 bg-gray-800 bg-opacity-50"
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
          <div className="flex items-center space-x-2">
            <div className="bg-moc-primary h-5 sm:h-6 w-5 sm:w-6 rounded-full flex items-center justify-center">
              <i className="fas fa-sliders-h text-white text-[10px] sm:text-xs"></i>
            </div>
            <span className="font-medium text-moc-accent text-sm sm:text-base">
              Tùy chọn nâng cao
            </span>
          </div>
          {isAdvancedOpen ? (
            <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4 text-moc-accent" />
          ) : (
            <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 text-moc-accent" />
          )}
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-2 sm:mt-3 space-y-3 sm:space-y-4">
          <div>
            <Label
              htmlFor="channelInfo"
              className="flex items-center text-gray-300 mb-1.5 sm:mb-2 font-medium text-xs sm:text-sm"
            >
              <Radio className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 text-moc-accent" />
              Thông tin kênh
            </Label>
            <Textarea
              id="channelInfo"
              value={channelInfo}
              onChange={handleChannelInfoChange}
              placeholder="Thông tin giới thiệu về kênh phát truyện (Tên kênh, slogan, thông điệp,...)"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 sm:px-4 py-2 sm:py-3 focus:outline-none focus:ring-2 focus:ring-moc-accent text-white text-xs sm:text-sm min-h-[60px] sm:min-h-[80px] resize-y"
            />
            <p className="text-gray-400 text-[10px] sm:text-xs mt-1">
              Thông tin này sẽ được sử dụng khi tạo lời giới thiệu truyện
            </p>
          </div>

          <div>
            <Label
              htmlFor="introduction"
              className="flex items-center text-gray-300 mb-1.5 sm:mb-2 font-medium text-xs sm:text-sm"
            >
              <BookOpen className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 text-moc-accent" />
              Lời dẫn truyện
            </Label>
            <Textarea
              id="introduction"
              value={introduction}
              onChange={handleIntroductionChange}
              placeholder="Lời dẫn/mở đầu khi bắt đầu vào truyện (Ví dụ: Xin chào các bạn, hôm nay tôi sẽ kể cho các bạn nghe một câu chuyện về...)"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 sm:px-4 py-2 sm:py-3 focus:outline-none focus:ring-2 focus:ring-moc-accent text-white text-xs sm:text-sm min-h-[80px] sm:min-h-[100px] resize-y"
            />
            <p className="text-gray-400 text-[10px] sm:text-xs mt-1">
              Phần mở đầu này sẽ được đặt trước nội dung chính của truyện
            </p>
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-700 mt-3 sm:mt-4">
            <Button
              onClick={saveSettings}
              variant="outline"
              size="sm"
              className="text-[10px] sm:text-xs text-moc-highlight border-gray-600 hover:border-moc-highlight hover:bg-moc-primary/20"
            >
              <Save className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" /> Lưu thông tin
              cho lần sau
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
