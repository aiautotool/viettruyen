import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import GenreSelector from "@/components/GenreSelector";
import TopicInput from "@/components/TopicInput";
import ResultsSection from "@/components/ResultsSection";
import ApiKeyButton from "@/components/ApiKeyButton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Scene, StoryOutline, FullStory, StoryHistoryItem } from "@/lib/types";
import { getGenreBorderColor, getGenreTextColor, getGenreIcon, getGenreButtonColor } from "@/lib/genreUtils";
import { v4 as uuidv4 } from 'uuid';
import StoryHistory from "@/components/StoryHistory";
import copy from 'clipboard-copy';
import LoadingOverlay from "@/components/ui/LoadingOverlay";
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import DraggableSceneItem from "@/components/DraggableSceneItem";
import StoryContent from "@/components/ui/story-generator/StoryContent";
import AudioPlayer from "@/components/ui/story-generator/AudioPlayer";
import VideoCreator from "@/components/VideoCreator";
import { featureConfig } from "@/config/features";


// Định nghĩa các bước trong quy trình tạo truyện
enum StoryStep {
  INITIAL = 0,
  OUTLINE = 1,
  FULL_STORY = 2,
  VIDEO = 3, // Thay thế SCENES bằng VIDEO
  SCENES = 4  // Để lại để không làm hỏng mã hiện có, nhưng sẽ không sử dụng
}

interface HomeProps {
  defaultTab?: 'content' | 'podcast' | 'gptvoice';
}

export default function Home({ defaultTab }: HomeProps = {}) {
  const [currentStep, setCurrentStep] = useState<StoryStep>(StoryStep.INITIAL);
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const [storyTopic, setStoryTopic] = useState("");
  const [readingTime, setReadingTime] = useState<string>("15"); // Mặc định 15 phút
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Lưu trữ dữ liệu cho từng bước
  const [storyOutline, setStoryOutline] = useState<StoryOutline | null>(null);
  const [fullStory, setFullStory] = useState<FullStory | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  
  // State cho việc chỉnh sửa cốt truyện
  const [isEditingOutline, setIsEditingOutline] = useState(false);
  const [editedOutline, setEditedOutline] = useState<StoryOutline | null>(null);
  
  // State cho thông tin kênh và lời dẫn trong tùy chọn nâng cao
  const [channelInfo, setChannelInfo] = useState<string>("");
  const [introduction, setIntroduction] = useState<string>("");
  
  // State cho lịch sử truyện
  const [storyHistories, setStoryHistories] = useState<StoryHistoryItem[]>([]);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  
  // State để theo dõi tab đang hiển thị (nội dung thuần túy, nội dung podcast, hoặc GPT voice)
  const [activeTab, setActiveTab] = useState<'content' | 'podcast' | 'gptvoice'>(defaultTab || 'content');
  
  // State cho hình ảnh đại diện
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [coverImagePath, setCoverImagePath] = useState<string | null>(null); // Đường dẫn thực tế tới file hình ảnh đã lưu
  
  // Ref để lưu trữ đường dẫn file audio đã tạo gần nhất
  const audioPathRef = useRef<string | null>(null);
  
  // State cho video đã tạo
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  const { toast } = useToast();

  const handleGenreSelect = (genre: string | null) => {
    setSelectedGenre(genre || "");
  };

  const handleTopicChange = (topic: string) => {
    setStoryTopic(topic);
  };

  // Chuyển đến bước trước
  const goToPreviousStep = () => {
    if (currentStep > StoryStep.INITIAL) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Chuyển đến bước tiếp theo
  const goToNextStep = () => {
    if (currentStep < StoryStep.SCENES) {
      setCurrentStep(currentStep + 1);
    }
  };

  // 1. Tạo cốt truyện
  const generateOutline = async () => {
    if (!selectedGenre || !storyTopic.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn thể loại và nhập chủ đề truyện",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setStoryOutline(null);

    try {
      const response = await apiRequest(
        "POST", 
        "/api/generate-outline", 
        { 
          genre: selectedGenre, 
          topic: storyTopic, 
          readingTime: readingTime,
          channelInfo: channelInfo,
          introduction: introduction
        }
      );
      
      const data = await response.json();
      if (data.success && data.outline) {
        setStoryOutline(data.outline);
        setCurrentStep(StoryStep.OUTLINE);
      } else {
        throw new Error(data.message || "Không thể tạo cốt truyện");
      }
      
      // Tự động lưu vào lịch sử ở bước cốt truyện
      const newHistoryItem: StoryHistoryItem = {
        id: uuidv4(),
        date: new Date().toISOString(),
        genre: selectedGenre,
        topic: storyTopic,
        outline: data.outline,
        fullStory: null,
        scenes: []
      };
      
      // Thêm vào mảng lịch sử và lưu vào localStorage
      const updatedHistory = [newHistoryItem, ...storyHistories];
      setStoryHistories(updatedHistory);
      localStorage.setItem('storyHistory', JSON.stringify(updatedHistory));
      
      toast({
        title: "Đã lưu cốt truyện tự động",
        description: "Cốt truyện đã được tự động lưu vào lịch sử để tránh mất nội dung",
      });
    } catch (error) {
      console.error("Error generating outline:", error);
      toast({
        title: "Lỗi khi tạo cốt truyện",
        description: error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Chuyển sang bước tạo video
  const goToVideoStep = () => {
    if (!fullStory) {
      toast({
        title: "Lỗi",
        description: "Cần tạo truyện đầy đủ trước khi tạo video",
        variant: "destructive",
      });
      return;
    }
    
    setCurrentStep(StoryStep.VIDEO);
  };

  // 2. Tạo truyện đầy đủ từ cốt truyện
  const generateFullStory = async () => {
    if (!storyOutline || !selectedGenre) {
      toast({
        title: "Lỗi",
        description: "Cần tạo cốt truyện trước",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setFullStory(null);

    try {
      const response = await apiRequest(
        "POST", 
        "/api/generate-full-story", 
        { 
          outline: storyOutline, 
          genre: selectedGenre,
          channelInfo: channelInfo,
          introduction: introduction 
        }
      );
      
      const data = await response.json();
      
      if (!data.success || !data.story) {
        throw new Error(data.message || "Không thể tạo truyện đầy đủ");
      }
      
      // Log để kiểm tra nội dung podcast
      console.log("FullStory nhận được:", {
        hasContent: !!data.story.content,
        contentLength: data.story.content?.length || 0,
        hasPodcastContent: !!data.story.podcastContent,
        podcastContentLength: data.story.podcastContent?.length || 0
      });
      
      setFullStory(data.story);
      setCurrentStep(StoryStep.FULL_STORY);
      
      // Tự động lưu vào lịch sử ngay sau khi tạo truyện thành công
      const newHistoryItem: StoryHistoryItem = {
        id: uuidv4(),
        date: new Date().toISOString(),
        genre: selectedGenre,
        topic: storyTopic,
        outline: storyOutline,
        fullStory: data.story,
        scenes: [] // Hiện tại chưa có cảnh
      };
      
      // Thêm vào mảng lịch sử và lưu vào localStorage
      const updatedHistory = [newHistoryItem, ...storyHistories];
      setStoryHistories(updatedHistory);
      localStorage.setItem('storyHistory', JSON.stringify(updatedHistory));
      
      // Thông báo đã tự động lưu
      toast({
        title: "Đã lưu truyện tự động",
        description: "Truyện đã được tự động lưu vào lịch sử để tránh mất nội dung",
      });
    } catch (error) {
      console.error("Error generating full story:", error);
      toast({
        title: "Lỗi khi tạo truyện đầy đủ",
        description: error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Bắt đầu chỉnh sửa cốt truyện
  const startEditingOutline = () => {
    if (storyOutline) {
      // Clone cốt truyện hiện tại để chỉnh sửa
      const outlineClone = JSON.parse(JSON.stringify(storyOutline)) as StoryOutline;
      setEditedOutline(outlineClone);
      setIsEditingOutline(true);
    }
  };
  
  // Lưu thay đổi sau khi chỉnh sửa cốt truyện
  const saveOutlineChanges = () => {
    if (editedOutline) {
      // Cập nhật cốt truyện với phiên bản đã chỉnh sửa
      setStoryOutline(editedOutline);
      setIsEditingOutline(false);
      
      toast({
        title: "Đã lưu thay đổi",
        description: "Cốt truyện đã được cập nhật thành công",
      });
    }
  };
  
  // 3. Tạo phân cảnh từ truyện đầy đủ
  const generateScenes = async () => {
    if (!fullStory && (!selectedGenre || !storyTopic.trim())) {
      toast({
        title: "Lỗi",
        description: "Vui lòng tạo truyện đầy đủ trước hoặc chọn thể loại và nhập chủ đề",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setScenes([]);

    try {
      // Thêm thời gian đọc vào payload để tính toán số phân cảnh
      const payload = fullStory 
        ? { genre: selectedGenre, story: fullStory, channelInfo, introduction } 
        : { 
            genre: selectedGenre, 
            topic: storyTopic,
            readingTime: readingTime || "15", // Truyền thời gian đọc
            channelInfo: channelInfo,
            introduction: introduction
          };

      const response = await apiRequest("POST", "/api/generate-scenes", payload);
      
      const data = await response.json();
      
      if (!data.success || !data.scenes) {
        throw new Error(data.message || "Không thể tạo phân cảnh");
      }
      
      setScenes(data.scenes);
      setCurrentStep(StoryStep.SCENES);
      
      // Tìm ID lịch sử hiện tại nếu đã có truyện này trong lịch sử
      let existingHistoryItemId: string | null = null;
      
      // Nếu đã có truyện đầy đủ, tìm kiếm trong lịch sử
      if (fullStory) {
        const existingItem = storyHistories.find(
          item => item.fullStory && item.fullStory.title === fullStory.title
        );
        if (existingItem) {
          existingHistoryItemId = existingItem.id;
        }
      }
      
      if (existingHistoryItemId) {
        // Nếu đã tồn tại, cập nhật lịch sử hiện có
        const updatedHistory = storyHistories.map(item => {
          if (item.id === existingHistoryItemId) {
            return {
              ...item,
              scenes: data.scenes
            };
          }
          return item;
        });
        setStoryHistories(updatedHistory);
        localStorage.setItem('storyHistory', JSON.stringify(updatedHistory));
        
        toast({
          title: "Đã cập nhật lịch sử",
          description: "Phân cảnh mới đã được cập nhật vào lịch sử truyện",
        });
      } else {
        // Nếu chưa tồn tại, tạo lịch sử mới
        const newHistoryItem: StoryHistoryItem = {
          id: uuidv4(),
          date: new Date().toISOString(),
          genre: selectedGenre || "",
          topic: storyTopic,
          outline: storyOutline,
          fullStory: fullStory,
          scenes: data.scenes
        };
        
        // Thêm vào mảng lịch sử và lưu vào localStorage
        const updatedHistory = [newHistoryItem, ...storyHistories];
        setStoryHistories(updatedHistory);
        localStorage.setItem('storyHistory', JSON.stringify(updatedHistory));
        
        toast({
          title: "Đã lưu truyện tự động",
          description: "Truyện đã được tự động lưu vào lịch sử để tránh mất nội dung",
        });
      }
    } catch (error) {
      console.error("Error generating scenes:", error);
      toast({
        title: "Lỗi khi tạo phân cảnh",
        description: error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Lấy tiêu đề dựa trên bước hiện tại
  const getStepTitle = () => {
    switch (currentStep) {
      case StoryStep.INITIAL:
        return "Thông tin truyện";
      case StoryStep.OUTLINE:
        return "Cốt truyện";
      case StoryStep.FULL_STORY:
        return "Truyện đầy đủ";
      case StoryStep.VIDEO:
        return "Tạo Video Truyện";
      case StoryStep.SCENES:
        return "Phân cảnh truyện";
      default:
        return "Thông tin truyện";
    }
  };

  // Hàm để lưu đường dẫn file audio khi được tạo
  const handleAudioPathCreated = (audioPath: string) => {
    audioPathRef.current = audioPath;
  };

  // Lấy nội dung dựa trên bước hiện tại
  const getStepContent = () => {
    switch (currentStep) {
      case StoryStep.INITIAL:
        return (
          <>
            {/* Nhập chủ đề - Hiển thị đầu tiên và nổi bật */}
            <div className="mb-8 bg-gradient-to-br from-blue-900/50 to-indigo-900/30 p-5 rounded-xl border border-blue-700/50 shadow-lg">
              <TopicInput 
                onTopicChange={handleTopicChange} 
                onChannelInfoChange={(info) => setChannelInfo(info)}
                onIntroductionChange={(intro) => setIntroduction(intro)}
              />
            </div>
            
            {/* Thời gian đọc */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-blue-400 mb-2">
                <i className="fas fa-clock mr-2"></i>
                Thời gian đọc (phút):
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 3, 5, 10, 15, 30, 45, 60].map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => setReadingTime(time.toString())}
                    className={`py-2 px-3 rounded-lg ${
                      readingTime === time.toString()
                        ? 'bg-blue-600 text-white border-blue-700 shadow-md'
                        : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                    } transition-all`}
                  >
                    {time}
                  </button>
                ))}
              </div>
              <p className="text-xs text-blue-300/70 mt-2">
                <i className="fas fa-info-circle mr-1"></i>
                Chọn thời gian để tạo truyện có độ dài phù hợp với thời gian đọc
              </p>
            </div>
            
            {/* Phần chọn thể loại - Thu nhỏ lại */}
            <div className="mt-6">
              <GenreSelector onGenreSelect={handleGenreSelect} />
            </div>
            
            <div className="flex justify-center mt-6">
              <Button
                onClick={generateOutline}
                disabled={!selectedGenre || !storyTopic.trim() || isGenerating}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-6 px-6 rounded-lg transition-all btn-glow"
              >
                {isGenerating ? (
                  <>
                    <div className="spinner spinner-sm spinner-moc mr-2"></div>
                    Đang tạo...
                  </>
                ) : (
                  <>
                    <i className="fas fa-scroll mr-2"></i> Tạo cốt truyện
                  </>
                )}
              </Button>
            </div>
          </>
        );
        
      case StoryStep.OUTLINE:
        return (
          <div className="space-y-4">
            {storyOutline && (
              <>
                {isEditingOutline && editedOutline ? (
                  // Chế độ chỉnh sửa cốt truyện
                  <div className="bg-gray-700 rounded-xl p-5 mb-4">
                    <div className="mb-4">
                      <label className="block text-gray-400 font-medium mb-1">Tiêu đề:</label>
                      <input
                        value={editedOutline.title}
                        onChange={(e) => {
                          if (editedOutline) {
                            setEditedOutline({
                              ...editedOutline,
                              title: e.target.value
                            } as StoryOutline);
                          }
                        }}
                        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-gray-400 font-medium mb-1">Thời gian đọc (phút):</label>
                      <input
                        type="number"
                        value={editedOutline.estimatedReadingTime}
                        onChange={(e) => {
                          if (editedOutline) {
                            setEditedOutline({
                              ...editedOutline,
                              estimatedReadingTime: e.target.value
                            } as StoryOutline);
                          }
                        }}
                        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-gray-400 font-medium mb-1">Tóm tắt cốt truyện:</label>
                      <textarea
                        value={editedOutline.outline}
                        onChange={(e) => {
                          if (editedOutline) {
                            setEditedOutline({
                              ...editedOutline,
                              outline: e.target.value
                            } as StoryOutline);
                          }
                        }}
                        rows={5}
                        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-gray-400 font-medium mb-1">Nhân vật chính:</label>
                      {editedOutline.characters.map((character, index) => (
                        <div key={index} className="bg-gray-800 p-3 rounded-lg mb-2">
                          <div className="flex justify-between mb-1">
                            <label className="text-gray-400 text-sm">Tên:</label>
                            <button 
                              type="button" 
                              onClick={() => {
                                if (editedOutline) {
                                  const newCharacters = [...editedOutline.characters];
                                  newCharacters.splice(index, 1);
                                  setEditedOutline({
                                    ...editedOutline,
                                    characters: newCharacters
                                  } as StoryOutline);
                                }
                              }}
                              className="text-red-400 hover:text-red-300 text-sm"
                            >
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          </div>
                          <input
                            value={character.name}
                            onChange={(e) => {
                              if (editedOutline) {
                                const newCharacters = [...editedOutline.characters];
                                newCharacters[index].name = e.target.value;
                                setEditedOutline({
                                  ...editedOutline,
                                  characters: newCharacters
                                } as StoryOutline);
                              }
                            }}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-300 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <label className="text-gray-400 text-sm">Mô tả:</label>
                          <textarea
                            value={character.description}
                            onChange={(e) => {
                              if (editedOutline) {
                                const newCharacters = [...editedOutline.characters];
                                newCharacters[index].description = e.target.value;
                                setEditedOutline({
                                  ...editedOutline,
                                  characters: newCharacters
                                } as StoryOutline);
                              }
                            }}
                            rows={2}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          if (editedOutline) {
                            setEditedOutline({
                              ...editedOutline,
                              characters: [
                                ...editedOutline.characters,
                                { name: "Nhân vật mới", description: "Mô tả nhân vật" }
                              ]
                            } as StoryOutline);
                          }
                        }}
                        className="w-full bg-gray-800 text-blue-400 hover:text-blue-300 border border-dashed border-gray-600 rounded-lg py-2 mt-2"
                      >
                        <i className="fas fa-plus mr-2"></i> Thêm nhân vật
                      </button>
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-gray-400 font-medium mb-1">
                        Phân cảnh chính: <span className="text-xs text-gray-500">(kéo thả để sắp xếp lại thứ tự)</span>
                      </label>
                      <DndProvider backend={HTML5Backend}>
                        {editedOutline && editedOutline.mainScenes && Array.isArray(editedOutline.mainScenes) ? (
                          editedOutline.mainScenes.map((scene, index) => (
                            <DraggableSceneItem
                              key={index}
                              id={index}
                              index={index}
                              scene={scene}
                              isFirst={index === 0}
                              isLast={index === editedOutline.mainScenes.length - 1}
                              onEdit={(e, sceneIndex) => {
                                if (editedOutline) {
                                  const newScenes = [...editedOutline.mainScenes];
                                  newScenes[sceneIndex] = e.target.value;
                                  setEditedOutline({
                                    ...editedOutline,
                                    mainScenes: newScenes
                                  } as StoryOutline);
                                }
                              }}
                              onDelete={(sceneIndex: number) => {
                                if (editedOutline) {
                                  const newScenes = [...editedOutline.mainScenes];
                                  newScenes.splice(sceneIndex, 1);
                                  setEditedOutline({
                                    ...editedOutline,
                                    mainScenes: newScenes
                                  } as StoryOutline);
                                }
                              }}
                              moveScene={(dragIndex, hoverIndex) => {
                                if (editedOutline) {
                                  // Đảm bảo hoverIndex nằm trong phạm vi hợp lệ
                                  if (hoverIndex < 0 || hoverIndex >= editedOutline.mainScenes.length) return;
                                  
                                  const newScenes = [...editedOutline.mainScenes];
                                  const draggedScene = newScenes[dragIndex];
                                  
                                  // Xóa phần tử đang kéo khỏi mảng
                                  newScenes.splice(dragIndex, 1);
                                  
                                  // Chèn phần tử đó vào vị trí mới
                                  newScenes.splice(hoverIndex, 0, draggedScene);
                                  
                                  setEditedOutline({
                                    ...editedOutline,
                                    mainScenes: newScenes
                                  } as StoryOutline);
                                }
                              }}
                            />
                          ))
                        ) : (
                          <div className="bg-gray-800 p-3 rounded-lg text-gray-400 mb-2">
                            Không có thông tin về phân cảnh
                          </div>
                        )}
                      </DndProvider>
                      
                      <button
                        type="button"
                        onClick={() => {
                          if (editedOutline) {
                            setEditedOutline({
                              ...editedOutline,
                              mainScenes: [
                                ...editedOutline.mainScenes,
                                "Cảnh mới trong truyện"
                              ]
                            } as StoryOutline);
                          }
                        }}
                        className="w-full bg-gray-800 text-blue-400 hover:text-blue-300 border border-dashed border-gray-600 rounded-lg py-2 mt-2"
                      >
                        <i className="fas fa-plus mr-2"></i> Thêm cảnh
                      </button>
                    </div>
                    
                    <div className="flex justify-end gap-3 mt-4">
                      <Button
                        variant="outline"
                        onClick={() => setIsEditingOutline(false)}
                        className="text-gray-400 border-gray-600"
                      >
                        <i className="fas fa-times mr-2"></i> Hủy
                      </Button>
                      <Button
                        onClick={saveOutlineChanges}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <i className="fas fa-save mr-2"></i> Lưu thay đổi
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Chế độ xem cốt truyện
                  <div className="bg-gray-700 rounded-xl p-5 mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-xl font-semibold text-blue-400">
                        <i className="fas fa-book-open mr-2"></i> {storyOutline?.title || 'Tiêu đề chưa có'}
                      </h3>
                      <Button
                        variant="outline"
                        onClick={() => startEditingOutline()}
                        className="text-blue-400 border-gray-600 h-8 px-3"
                      >
                        <i className="fas fa-edit mr-2"></i> Chỉnh sửa
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-sm font-medium px-3 py-1 rounded-full ${getGenreTextColor(selectedGenre || "")} bg-opacity-20 ${getGenreBorderColor(selectedGenre || "")} border`}>
                        <i className={`${getGenreIcon(selectedGenre || "")} mr-1`}></i> {selectedGenre}
                      </span>
                      <p className="text-gray-300 text-sm">
                        <span className="text-gray-400">Thời gian đọc dự kiến:</span> {storyOutline?.estimatedReadingTime || '0'} phút
                      </p>
                    </div>
                    <div className="mb-4">
                      <h4 className="text-gray-400 font-medium mb-1">Tóm tắt cốt truyện:</h4>
                      <p className="text-gray-300 bg-gray-800 p-3 rounded-lg">{storyOutline?.outline || 'Chưa có nội dung tóm tắt'}</p>
                    </div>
                    
                    <div className="mb-4">
                      <h4 className="text-gray-400 font-medium mb-1">Nhân vật chính:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {storyOutline && storyOutline.characters && Array.isArray(storyOutline.characters) ? (
                          storyOutline.characters.map((character, index) => (
                            <div key={index} className="bg-gray-800 p-3 rounded-lg">
                              <p className="font-medium text-blue-400">{character.name}</p>
                              <p className="text-gray-300 text-sm">{character.description}</p>
                            </div>
                          ))
                        ) : (
                          <div className="bg-gray-800 p-3 rounded-lg col-span-2">
                            <p className="text-gray-400">Không có thông tin về nhân vật</p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-gray-400 font-medium mb-1">Phân cảnh chính:</h4>
                      <ul className="bg-gray-800 p-3 rounded-lg">
                        {storyOutline && storyOutline.mainScenes && Array.isArray(storyOutline.mainScenes) ? (
                          storyOutline.mainScenes.map((scene, index) => (
                            <li key={index} className="text-gray-300 mb-1">• {scene}</li>
                          ))
                        ) : (
                          <li className="text-gray-400">Không có thông tin về phân cảnh</li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-center mt-6">
                  <Button
                    onClick={generateFullStory}
                    disabled={isGenerating}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-6 px-6 rounded-lg transition-all btn-glow"
                  >
                    {isGenerating ? (
                      <>
                        <div className="spinner spinner-sm spinner-moc mr-2"></div>
                        Đang tạo...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-book mr-2"></i> Tạo truyện đầy đủ
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        );
        
      case StoryStep.FULL_STORY:
        return (
          <div className="space-y-4">
            {fullStory && (
              <>
                <div className="bg-gray-700 rounded-xl p-5 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-semibold text-blue-400">
                      <i className="fas fa-book mr-2"></i> {fullStory.title}
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        onClick={goToVideoStep}
                        variant="outline"
                        className="flex items-center gap-1 text-sm bg-green-800 text-gray-200 border-green-700 hover:bg-green-700"
                      >
                        <i className="fas fa-video mr-1"></i> Tạo Video
                      </Button>
                      <Button
                        onClick={() => {
                          copy(fullStory.content).then(() => {
                            toast({
                              title: "Đã sao chép",
                              description: "Nội dung truyện đã được sao chép vào clipboard",
                            });
                          }).catch(err => {
                            console.error("Copy failed: ", err);
                            toast({
                              title: "Lỗi",
                              description: "Không thể sao chép nội dung truyện",
                              variant: "destructive",
                            });
                          });
                        }}
                        variant="outline"
                        className="flex items-center gap-1 text-sm bg-indigo-800 text-gray-200 border-indigo-700 hover:bg-indigo-700"
                      >
                        <i className="fas fa-copy mr-1"></i> Sao chép truyện
                      </Button>
                      {fullStory.podcastContent && (
                        <Button
                          onClick={() => {
                            copy(fullStory.podcastContent || "").then(() => {
                              toast({
                                title: "Đã sao chép",
                                description: "Nội dung podcast đã được sao chép vào clipboard",
                              });
                            }).catch(err => {
                              console.error("Copy failed: ", err);
                              toast({
                                title: "Lỗi",
                                description: "Không thể sao chép nội dung podcast",
                                variant: "destructive",
                              });
                            });
                          }}
                          variant="outline"
                          className="flex items-center gap-1 text-sm bg-purple-800 text-gray-200 border-purple-700 hover:bg-purple-700"
                        >
                          <i className="fas fa-microphone-alt mr-1"></i> Sao chép podcast
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`text-sm font-medium px-3 py-1 rounded-full ${getGenreTextColor(selectedGenre || "")} bg-opacity-20 ${getGenreBorderColor(selectedGenre || "")} border`}>
                      <i className={`${getGenreIcon(selectedGenre || "")} mr-1`}></i> {selectedGenre}
                    </span>
                    <p className="text-gray-300 text-sm">
                      <span className="text-gray-400">Số từ:</span> {fullStory.wordCount} | 
                      <span className="text-gray-400 ml-2">Thời gian đọc:</span> {fullStory.readingTime} phút
                    </p>
                  </div>
                  
                  {/* Hiển thị hình ảnh đại diện nếu có */}
                  {coverImage && (
                    <div className="mb-4 relative group">
                      <div className="overflow-hidden rounded-lg border-2 border-gray-600 mb-2 flex justify-center bg-gray-800 aspect-w-16 aspect-h-9">
                        <img 
                          src={`data:image/png;base64,${coverImage}`} 
                          alt={`Hình ảnh đại diện cho truyện ${fullStory.title}`}
                          className="object-cover max-h-[300px] rounded-lg"
                        />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-60 rounded-lg">
                        <div className="flex gap-2">
                          <Button
                            onClick={handleDownloadCoverImage}
                            variant="secondary"
                            className="flex items-center gap-1 bg-moc-primary text-white hover:bg-moc-secondary"
                          >
                            <i className="fas fa-download mr-1"></i> Tải hình ảnh
                          </Button>
                          <Button
                            onClick={generateCoverImage}
                            variant="secondary"
                            className="flex items-center gap-1 bg-moc-accent text-white hover:bg-moc-highlight"
                          >
                            <i className="fas fa-sync-alt mr-1"></i> Tạo lại
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Nút tạo hình đại diện - chỉ hiển thị khi tính năng tạo hình ảnh được bật */}
                  {!coverImage && !isGeneratingCover && featureConfig.showImageGeneration && (
                    <div className="mb-4">
                      <Button
                        onClick={generateCoverImage}
                        className="w-full py-2 flex items-center justify-center bg-gradient-to-r from-moc-primary to-moc-accent hover:from-moc-dark hover:to-moc-secondary text-white"
                      >
                        <i className="fas fa-image mr-2"></i> Tạo hình ảnh đại diện cho truyện
                      </Button>
                    </div>
                  )}
                  
                  {/* Trạng thái đang tạo hình ảnh */}
                  {isGeneratingCover && featureConfig.showImageGeneration && (
                    <div className="mb-4 bg-gray-800 rounded-lg p-4 flex items-center justify-center">
                      <div className="spinner spinner-moc spinner-md rounded-full mr-3"></div>
                      <p className="text-moc-accent">Đang tạo hình ảnh đại diện cho truyện...</p>
                    </div>
                  )}
                  
                  {/* Tabs cho nội dung truyện, podcast và GPT Voice */}
                  <div className="tabs-container">
                    <div className="flex border-b border-gray-600 mb-3 sm:mb-4">
                      <button 
                        className={`py-1.5 sm:py-2 px-2 sm:px-4 text-xs sm:text-sm font-medium ${activeTab === 'content' ? 'text-moc-primary border-b-2 border-moc-primary' : 'text-gray-400 hover:text-gray-300'}`}
                        onClick={() => setActiveTab('content')}
                      >
                        <i className="fas fa-book mr-1 sm:mr-2"></i> <span className="hidden xs:inline">Nội dung</span> Truyện
                      </button>
                      <button 
                        className={`py-1.5 sm:py-2 px-2 sm:px-4 text-xs sm:text-sm font-medium ${activeTab === 'podcast' ? 'text-moc-accent border-b-2 border-moc-accent' : 'text-gray-400 hover:text-gray-300'}`}
                        onClick={() => setActiveTab('podcast')}
                      >
                        <i className="fas fa-microphone-alt mr-1 sm:mr-2"></i> <span className="hidden xs:inline">Nội dung</span> Podcast
                      </button>
                      <button 
                        className={`py-1.5 sm:py-2 px-2 sm:px-4 text-xs sm:text-sm font-medium ${activeTab === 'gptvoice' ? 'text-green-500 border-b-2 border-green-500' : 'text-gray-400 hover:text-gray-300'}`}
                        onClick={() => setActiveTab('gptvoice')}
                      >
                        <i className="fas fa-robot mr-1 sm:mr-2"></i> GPT Voice
                      </button>
                    </div>
                    
                    <div className="bg-gray-800 p-2 sm:p-4 rounded-lg max-h-72 sm:max-h-96 overflow-y-auto">
                      {activeTab === 'content' && (
                        <StoryContent 
                          content={fullStory.content}
                          outline={{
                            title: storyOutline?.title || '',
                            characters: storyOutline?.characters || [],
                            outline: storyOutline?.outline || '',
                            estimatedReadingTime: storyOutline?.estimatedReadingTime || '',
                            mainScenes: storyOutline?.mainScenes || []
                          }}
                          genre={selectedGenre || ""}
                          onGenerateScene={generateScenes}
                          isLoading={isGenerating}
                          onContentUpdate={(newContent) => {
                            setFullStory({
                              ...fullStory,
                              content: newContent
                            });
                          }}
                        />
                      )}
                      
                      {activeTab === 'podcast' && (
                        <>
                          {/* Luôn hiển thị nội dung podcast vì server sẽ tự tạo nội dung mặc định nếu không có thông tin được cung cấp */}
                          <>
                            {featureConfig.showAudioGeneration && (
                              <div className="mb-4">
                                <AudioPlayer 
                                  text={fullStory.podcastContent || fullStory.content} 
                                  isPodcast={true} 
                                  title={fullStory.title}
                                  onAudioPathCreated={(path) => { audioPathRef.current = path; }}
                                />
                              </div>
                            )}
                            
                            {/* Phần tạo video trong tab podcast */}
                            {audioPathRef.current && coverImagePath && (
                              <div className="mb-4 bg-gray-700 rounded-lg p-4">
                                <h4 className="text-blue-400 font-medium mb-2 flex items-center">
                                  <i className="fas fa-video mr-2"></i> Tạo video podcast theo định dạng 9:16 (dọc)
                                </h4>
                                <VideoCreator 
                                  title={fullStory.title}
                                  audioPath={audioPathRef.current}
                                  coverImagePath={coverImagePath}
                                  onVideoCreated={(videoUrl) => setVideoUrl(videoUrl)}
                                />
                              </div>
                            )}
                            
                            {audioPathRef.current && (!coverImage || !coverImagePath) && (
                              <div className="mb-4 bg-amber-900/30 border border-amber-800 rounded-lg p-4">
                                <p className="text-amber-400 flex items-center">
                                  <i className="fas fa-exclamation-triangle mr-2"></i>
                                  Bạn cần tạo hình ảnh đại diện trước khi có thể tạo video.
                                </p>
                                {coverImage && !coverImagePath && (
                                  <p className="text-gray-300 text-sm mt-2">
                                    <i className="fas fa-info-circle mr-2"></i>
                                    Đã có hình ảnh nhưng cần được lưu lại. Vui lòng tạo hình ảnh lại để lưu vào server.
                                  </p>
                                )}
                                <Button
                                  onClick={generateCoverImage}
                                  disabled={isGeneratingCover || !fullStory}
                                  className="mt-2 bg-amber-700 hover:bg-amber-600 text-white w-full"
                                >
                                  {isGeneratingCover ? (
                                    <>
                                      <div className="spinner spinner-sm spinner-white mr-2"></div>
                                      Đang tạo hình ảnh...
                                    </>
                                  ) : (
                                    <>
                                      <i className="fas fa-image mr-2"></i> Tạo hình ảnh đại diện
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}
                            
                            <p className="text-gray-300 whitespace-pre-wrap text-xs sm:text-base">
                              {(() => {
                                // Xử lý hiển thị nội dung podcast - thay thế [SEPARATOR] nếu cần
                                if (fullStory.podcastContent && fullStory.podcastContent.includes("[SEPARATOR]")) {
                                  return fullStory.podcastContent.replace("[SEPARATOR]", `\n\n${fullStory.content}\n\n`);
                                }
                                return fullStory.podcastContent || fullStory.content;
                              })()}
                            </p>
                          </>
                        </>
                      )}
                      
                      {activeTab === 'gptvoice' && (
                        <>
                          {fullStory.content ? (
                            <div className="text-gray-300 whitespace-pre-wrap text-xs sm:text-base">
                              <div className="bg-gray-700 p-3 rounded-md mb-3 border-l-4 border-green-500 relative">
                                <p className="font-medium text-green-400 mb-2">Yêu cầu lặp lại toàn bộ nội dung sau đây mà không thêm bất kì từ nào. Yêu cầu giữ nguyên bản toàn bộ nội dung sau:</p>
                                <Button
                                  onClick={() => {
                                    // Chỉ nối chuỗi vào truyện có sẵn, không sử dụng podcastContent
                                    const gptVoiceContent = `Yêu cầu lặp lại toàn bộ nội dung sau đây mà không thêm bất kì từ nào. Yêu cầu giữ nguyên bản toàn bộ nội dung sau:\n\n${fullStory.content}`;
                                    
                                    copy(gptVoiceContent).then(() => {
                                      toast({
                                        title: "Đã sao chép",
                                        description: "Nội dung GPT Voice đã được sao chép vào clipboard",
                                      });
                                    }).catch(err => {
                                      console.error("Copy failed: ", err);
                                      toast({
                                        title: "Lỗi",
                                        description: "Không thể sao chép nội dung GPT Voice",
                                        variant: "destructive",
                                      });
                                    });
                                  }}
                                  variant="outline"
                                  className="absolute right-3 top-3 flex items-center gap-1 text-sm bg-green-800 text-gray-200 border-green-700 hover:bg-green-700"
                                >
                                  <i className="fas fa-copy mr-1"></i> Sao chép GPT Voice
                                </Button>
                              </div>
                              <p className="text-gray-300">{fullStory.content}</p>
                            </div>
                          ) : (
                            <div className="bg-green-900/30 border border-green-800 rounded-lg p-4">
                              <p className="text-green-400 flex items-center">
                                <i className="fas fa-info-circle mr-2"></i>
                                Nội dung GPT Voice sẽ được hiển thị sau khi tạo truyện đầy đủ.
                              </p>
                              <p className="text-gray-300 text-sm mt-2">
                                GPT Voice sẽ tạo ra định dạng phù hợp để copy vào ChatGPT để tạo đoạn audio có giọng nói tự nhiên.
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-center mt-6">
                  <Button
                    onClick={generateScenes}
                    disabled={isGenerating}
                    className="bg-gradient-to-r from-moc-primary to-moc-accent hover:from-moc-secondary hover:to-moc-highlight text-white font-medium py-4 sm:py-6 px-4 sm:px-6 rounded-lg transition-all text-xs sm:text-base"
                  >
                    {isGenerating ? (
                      <>
                        <div className="spinner spinner-moc spinner-sm rounded-full mr-2"></div>
                        <span className="hidden xs:inline">Đang</span> tạo...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-images mr-2"></i> Tạo <span className="hidden xs:inline">phân</span> cảnh & hình ảnh
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        );
        
      case StoryStep.VIDEO:
        return (
          <div className="space-y-4">
            {fullStory && (
              <>
                <div className="bg-gray-700 rounded-xl p-5 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-semibold text-blue-400">
                      <i className="fas fa-video mr-2"></i> Tạo Video cho Truyện
                    </h3>
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-gray-300 text-sm mb-4">
                      Sử dụng công cụ này để tạo video kết hợp giữa hình ảnh và âm thanh từ truyện của bạn.
                    </p>
                    
                    {/* Video Creator Component */}
                    <VideoCreator 
                      fullStory={fullStory}
                      genre={selectedGenre}
                    />
                  </div>
                </div>
                
                <div className="bg-gray-700 rounded-xl p-5 mb-4">
                  <h3 className="text-lg font-semibold text-blue-400 mb-3">
                    <i className="fas fa-image mr-2"></i> Hình ảnh đại diện
                  </h3>
                  
                  {coverImage ? (
                    <div className="mb-4">
                      <div className="relative w-full h-48 bg-gray-800 rounded-lg overflow-hidden mb-2">
                        <img 
                          src={coverImage} 
                          alt="Hình ảnh đại diện" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-blue-400 border-gray-600"
                          onClick={() => setCoverImage(null)}
                        >
                          <i className="fas fa-trash-alt mr-2"></i> Xóa ảnh
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      disabled={isGeneratingCover}
                      onClick={async () => {
                        try {
                          setIsGeneratingCover(true);
                          
                          // Tạo prompt cho hình ảnh từ tiêu đề và thể loại
                          const imagePrompt = `${fullStory.title} - ${selectedGenre} style`;
                          
                          const response = await apiRequest(
                            "POST",
                            "/api/generate-image",
                            { prompt: imagePrompt }
                          );
                          
                          const result = await response.json();
                          if (result && result.image) {
                            setCoverImage(result.image);
                            toast({
                              title: "Đã tạo hình ảnh",
                              description: "Hình ảnh đại diện đã được tạo thành công",
                            });
                          }
                        } catch (error) {
                          console.error("Error generating cover image:", error);
                          toast({
                            title: "Lỗi khi tạo hình ảnh",
                            description: "Không thể tạo hình ảnh đại diện. Vui lòng thử lại sau.",
                            variant: "destructive",
                          });
                        } finally {
                          setIsGeneratingCover(false);
                        }
                      }}
                      className="w-full bg-gray-800 hover:bg-gray-700 text-blue-400"
                    >
                      {isGeneratingCover ? (
                        <>
                          <div className="spinner spinner-sm spinner-blue mr-2"></div>
                          Đang tạo hình ảnh...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-image mr-2"></i> Tạo hình ảnh đại diện
                        </>
                      )}
                    </Button>
                  )}
                </div>
                
                {/* Tạo audio cho video - chỉ hiển thị khi tính năng tạo audio được bật */}
                {featureConfig.showAudioGeneration && (
                  <div className="bg-gray-700 rounded-xl p-5 mb-4">
                    <h3 className="text-lg font-semibold text-blue-400 mb-3">
                      <i className="fas fa-headphones mr-2"></i> Tạo audio cho video
                    </h3>
                    
                    <div className="mb-4">
                      <Tabs defaultValue="content" className="w-full" onValueChange={(value) => setActiveTab(value as 'content' | 'podcast' | 'gptvoice')}>
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                          <TabsTrigger value="content">Nội dung truyện</TabsTrigger>
                          <TabsTrigger value="podcast">Phong cách podcast</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="content" className="mt-0">
                          <AudioPlayer 
                            text={fullStory.content} 
                            onAudioPathCreated={handleAudioPathCreated}
                          />
                        </TabsContent>
                        
                        <TabsContent value="podcast" className="mt-0">
                          <AudioPlayer 
                            text={fullStory.podcastContent || fullStory.content} 
                            isPodcast={true}
                            title={fullStory.title}
                            onAudioPathCreated={handleAudioPathCreated}
                          />
                        </TabsContent>
                      </Tabs>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
        
      case StoryStep.SCENES:
        return (
          <>
            <ResultsSection 
              scenes={scenes} 
              genre={selectedGenre || ""} 
              isLoading={isGenerating} 
            />
            
            {/* Nút lưu lịch sử */}
            <div className="flex justify-center mt-8">
              <Button
                onClick={saveStoryToHistory}
                className="bg-gradient-to-r from-moc-secondary to-moc-primary hover:from-moc-dark hover:to-moc-secondary text-moc-light"
              >
                <i className="fas fa-save mr-2"></i> Lưu vào lịch sử
              </Button>
            </div>
          </>
        );
        
      default:
        return <p className="text-gray-400">Chọn một thể loại và nhập chủ đề để bắt đầu.</p>;
    }
  };

  // Hiển thị dãy bước tiến độ
  const renderProgressBar = () => {
    const steps = [
      { 
        id: StoryStep.INITIAL, 
        name: "Thông tin", 
        shortName: "Thông tin",
        icon: "fa-info-circle", 
        shape: "rounded-lg",
        color: "from-moc-primary to-moc-secondary",
        inactiveColor: "from-gray-700 to-gray-800"
      },
      { 
        id: StoryStep.OUTLINE, 
        name: "Cốt truyện", 
        shortName: "Cốt truyện",
        icon: "fa-scroll", 
        shape: "rounded-full",
        color: "from-moc-secondary to-moc-dark", 
        inactiveColor: "from-gray-700 to-gray-800"
      },
      { 
        id: StoryStep.FULL_STORY, 
        name: "Truyện đầy đủ", 
        shortName: "Truyện",
        icon: "fa-book", 
        shape: "rounded-md",
        color: "from-moc-highlight to-moc-primary", 
        inactiveColor: "from-gray-700 to-gray-800"
      },
      { 
        id: StoryStep.VIDEO, 
        name: "Tạo Video", 
        shortName: "Video",
        icon: "fa-video", 
        shape: "rounded-sm",
        color: "from-moc-accent to-moc-highlight", 
        inactiveColor: "from-gray-700 to-gray-800"
      }
    ];

    return (
      <div className="flex justify-between mb-6 relative">
        <div className="absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-moc-dark via-moc-primary to-moc-accent opacity-30 -z-10 transform -translate-y-1/2"></div>
        
        {steps.map((step) => (
          <div 
            key={step.id} 
            className={`flex flex-col items-center z-10 cursor-pointer progress-step`}
            onClick={() => step.id <= currentStep && setCurrentStep(step.id)}
          >
            <div
              className={`w-8 h-8 sm:w-10 sm:h-10 ${step.shape} flex items-center justify-center mb-1 sm:mb-1.5 transition-all duration-300 bg-gradient-to-b
                ${step.id <= currentStep 
                  ? step.color
                  : step.inactiveColor}
                ${step.id === currentStep ? 'ring-2 ring-moc-accent shadow-lg' : ''}
              `}
            >
              <i className={`fas ${step.icon} text-xs sm:text-sm text-moc-light`}></i>
            </div>
            <span 
              className={`text-[10px] xs:text-xs ${step.id === currentStep ? 'text-moc-highlight font-bold' : 'text-moc-accent'}`}
            >
              <span className="hidden xs:inline">{step.name}</span>
              <span className="inline xs:hidden">{step.shortName}</span>
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Tạo hình ảnh đại diện cho truyện
  const generateCoverImage = async () => {
    if (!fullStory || !selectedGenre) {
      toast({
        title: "Lỗi",
        description: "Cần tạo truyện đầy đủ trước khi tạo hình ảnh đại diện",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingCover(true);

    try {
      const response = await apiRequest(
        "POST",
        "/api/generate-cover",
        {
          title: fullStory.title,
          genre: selectedGenre,
          content: fullStory.content.substring(0, 500) // Chỉ gửi 500 ký tự đầu tiên để giảm kích thước request
        }
      );

      const data = await response.json();
      setCoverImage(data.image);
      
      // Lưu hình ảnh vào server để sử dụng cho video
      if (data.image) {
        try {
          const saveResponse = await apiRequest(
            "POST",
            "/api/save-image",
            {
              image: data.image,
              title: fullStory.title.replace(/[^a-zA-Z0-9]/g, '_'),
              format: "jpg"
            }
          );
          
          const saveResult = await saveResponse.json();
          if (saveResult.success && saveResult.filePath) {
            setCoverImagePath(saveResult.filePath);
            console.log("Đã lưu hình ảnh vào:", saveResult.filePath);
          }
        } catch (saveError) {
          console.error("Không thể lưu hình ảnh vào server:", saveError);
        }
      }

      toast({
        title: "Tạo hình ảnh thành công",
        description: "Đã tạo hình ảnh đại diện cho truyện",
      });
    } catch (error) {
      console.error("Error generating cover image:", error);
      toast({
        title: "Lỗi khi tạo hình ảnh đại diện",
        description: error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingCover(false);
    }
  };

  // Tải về hình ảnh đại diện
  const handleDownloadCoverImage = () => {
    if (!coverImage || !fullStory) return;

    // Tạo một thẻ a tạm thời để tải xuống
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${coverImage}`;
    link.download = `${fullStory.title.replace(/[^a-zA-Z0-9]/g, '_')}_cover.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Đang tải xuống",
      description: "Hình ảnh đại diện đang được tải xuống",
    });
  };

  // Lưu truyện vào lịch sử
  const saveStoryToHistory = () => {
    // Chỉ lưu khi đã có các cảnh
    if (!selectedGenre || !storyTopic || scenes.length === 0) {
      toast({
        title: "Không thể lưu",
        description: "Vui lòng tạo đầy đủ các cảnh trước khi lưu",
        variant: "destructive",
      });
      return;
    }

    // Tạo hình ảnh đại diện nếu chưa có
    const createHistoryItem = async () => {
      let historyItemCoverImage = coverImage;

      // Nếu chưa có hình ảnh đại diện và có truyện đầy đủ, tự động tạo
      if (historyItemCoverImage === null && fullStory && !isGeneratingCover) {
        try {
          setIsGeneratingCover(true);
          toast({
            title: "Đang tạo hình ảnh",
            description: "Đang tự động tạo hình ảnh đại diện cho truyện trước khi lưu",
          });

          const response = await apiRequest(
            "POST",
            "/api/generate-cover",
            {
              title: fullStory.title,
              genre: selectedGenre,
              content: fullStory.content.substring(0, 500)
            }
          );

          const data = await response.json();
          historyItemCoverImage = data.image;
          setCoverImage(data.image);
        } catch (error) {
          console.error("Error auto-generating cover image:", error);
        } finally {
          setIsGeneratingCover(false);
        }
      }

      // Tạo đối tượng lịch sử mới
      const newHistoryItem: StoryHistoryItem = {
        id: uuidv4(),
        date: new Date().toISOString(),
        genre: selectedGenre,
        topic: storyTopic,
        outline: storyOutline,
        fullStory: fullStory,
        scenes: scenes,
        coverImage: historyItemCoverImage || undefined
      };

      // Thêm vào mảng lịch sử và lưu vào localStorage
      const updatedHistory = [newHistoryItem, ...storyHistories];
      setStoryHistories(updatedHistory);
      localStorage.setItem('storyHistory', JSON.stringify(updatedHistory));

      toast({
        title: "Đã lưu truyện",
        description: "Truyện đã được lưu vào lịch sử thành công",
      });
    };

    // Thực hiện lưu truyện (có hoặc không có hình ảnh)
    createHistoryItem();
  };

  // Xóa truyện khỏi lịch sử
  const deleteStoryFromHistory = (id: string) => {
    const updatedHistory = storyHistories.filter(item => item.id !== id);
    setStoryHistories(updatedHistory);
    localStorage.setItem('storyHistory', JSON.stringify(updatedHistory));
    
    toast({
      title: "Đã xóa truyện",
      description: "Truyện đã được xóa khỏi lịch sử",
    });
  };

  // Tải truyện từ lịch sử
  const loadStoryFromHistory = (item: StoryHistoryItem) => {
    setSelectedGenre(item.genre);
    setStoryTopic(item.topic);
    setStoryOutline(item.outline);
    setFullStory(item.fullStory);
    setScenes(item.scenes);
    
    // Xác định bước hiện tại dựa trên dữ liệu có sẵn
    if (item.scenes.length > 0) {
      setCurrentStep(StoryStep.SCENES);
    } else if (item.fullStory) {
      setCurrentStep(StoryStep.FULL_STORY);
    } else if (item.outline) {
      setCurrentStep(StoryStep.OUTLINE);
    } else {
      setCurrentStep(StoryStep.INITIAL);
    }
    
    setHistoryModalOpen(false);
    
    toast({
      title: "Đã tải truyện",
      description: "Truyện đã được tải từ lịch sử thành công",
    });
  };

  // Tải lịch sử từ localStorage khi component được mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('storyHistory');
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory) as StoryHistoryItem[];
        setStoryHistories(parsedHistory);
      } catch (error) {
        console.error("Error parsing story history:", error);
      }
    }
  }, []);

  // Navigation buttons (Prev & Next)
  const renderNavigationButtons = () => {
    return (
      <div className="flex justify-between mt-8">
        <Button
          onClick={goToPreviousStep}
          disabled={currentStep === StoryStep.INITIAL || isGenerating}
          variant="outline"
          className="btn-moc disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
        >
          <i className="fas fa-arrow-left mr-1 sm:mr-2"></i> <span className="hidden xs:inline">Quay lại</span>
        </Button>
        
        <Button
          onClick={goToNextStep}
          disabled={
            (currentStep === StoryStep.INITIAL && !storyOutline) || 
            (currentStep === StoryStep.OUTLINE && !fullStory) ||
            (currentStep === StoryStep.FULL_STORY && scenes.length === 0) ||
            currentStep === StoryStep.SCENES ||
            isGenerating
          }
          variant="outline"
          className="btn-moc disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
        >
          <span className="hidden xs:inline">Tiếp tục</span> <i className="fas fa-arrow-right ml-1 sm:ml-2"></i>
        </Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-moc-light font-sans">
      {/* Full-screen loading overlay */}
      <LoadingOverlay 
        show={isGenerating} 
        message={
          currentStep === StoryStep.INITIAL 
            ? "Đang tạo cốt truyện..."
            : currentStep === StoryStep.OUTLINE 
              ? "Đang tạo truyện đầy đủ..."
              : currentStep === StoryStep.FULL_STORY 
                ? "Đang tạo phân cảnh truyện..."
                : "Đang xử lý..."
        }
        size="lg"
      />
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header Section */}
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text-moc text-shadow-light text-center sm:text-left mb-4 sm:mb-0">
              Trợ Lý Sáng Tạo Truyện AI
            </h1>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setHistoryModalOpen(true)}
                variant="outline"
                className="flex items-center gap-1 text-xs sm:text-sm btn-moc"
              >
                <i className="fas fa-history mr-1"></i> <span className="hidden xs:inline">Lịch sử</span>
              </Button>
              <ApiKeyButton />
            </div>
          </div>
          <p className="text-moc-accent max-w-2xl text-center sm:text-left text-sm sm:text-base">
            Chọn thể loại, nhập chủ đề và để AI tạo ra truyện độc đáo theo quy trình: cốt truyện → truyện đầy đủ → phân cảnh trực quan.
          </p>
        </header>

        {/* Progress Bar */}
        {renderProgressBar()}

        {/* Main Content Area */}
        <main className="space-y-6">
          {/* Current Step Content */}
          <Card className="card-moc rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl text-moc-highlight mb-4 flex items-center">
              <i className="fas fa-magic mr-2"></i> {getStepTitle()}
            </h2>
            
            {getStepContent()}
          </Card>

          {/* Navigation Buttons */}
          {renderNavigationButtons()}
        </main>

        {/* Footer */}
        <footer className="mt-12 text-center text-moc-accent text-sm">
          <p>© 2025 Trợ Lý Sáng Tạo Truyện AI | Powered by AItoolseo.com</p>
        </footer>
      </div>
      
      {/* Hiển thị modal lịch sử */}
      <StoryHistory
        open={historyModalOpen}
        onOpenChange={setHistoryModalOpen}
        histories={storyHistories}
        onLoadStory={loadStoryFromHistory}
        onDeleteStory={deleteStoryFromHistory}
      />
    </div>
  );
}
