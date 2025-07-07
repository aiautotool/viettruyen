import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StoryHistoryItem } from '@/lib/types';
import { getGenreTextColor, getGenreIcon } from '@/lib/genreUtils';
import { X, Calendar, Clock, Book, Trash2, Save, History } from 'lucide-react';

interface StoryHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  histories: StoryHistoryItem[];
  onLoadStory: (item: StoryHistoryItem) => void;
  onDeleteStory: (id: string) => void;
}

export default function StoryHistory({ 
  open, 
  onOpenChange, 
  histories,
  onLoadStory,
  onDeleteStory
}: StoryHistoryProps) {

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getStoryProgress = (item: StoryHistoryItem) => {
    if (item.scenes && item.scenes.length > 0) return "Phân cảnh";
    if (item.fullStory) return "Truyện đầy đủ";
    if (item.outline) return "Cốt truyện";
    return "Mới bắt đầu";
  };

  const handleLoadStory = (item: StoryHistoryItem) => {
    onLoadStory(item);
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] bg-gray-800 text-gray-100 border border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <History className="w-5 h-5 mr-2 text-blue-400" />
            Lịch sử tạo truyện
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Danh sách các truyện bạn đã tạo trước đây
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[50vh] pr-4">
          {histories.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <div className="mx-auto bg-gray-700 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <Book className="w-8 h-8 text-gray-500" />
              </div>
              <p>Bạn chưa tạo truyện nào</p>
              <p className="text-sm text-gray-500 mt-1">
                Các truyện bạn tạo sẽ được lưu ở đây
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {histories.map((item) => (
                <div key={item.id} className="border border-gray-700 rounded-lg p-3 bg-gray-800 hover:bg-gray-750 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center">
                      {/* Hiển thị ảnh đại diện mini nếu có */}
                      {item.coverImage && (
                        <div className="w-8 h-8 rounded-md overflow-hidden mr-2 flex-shrink-0 bg-gray-900">
                          <img 
                            src={`data:image/png;base64,${item.coverImage}`}
                            alt="Ảnh đại diện"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <i className={`${getGenreIcon(item.genre)} text-lg ${getGenreTextColor(item.genre)} mr-2`}></i>
                      <h3 className="font-medium text-gray-200 truncate">
                        {item.outline?.title || item.topic}
                      </h3>
                    </div>
                    <div className="flex space-x-1">
                      <Badge variant="outline" className="text-xs px-2 py-0 h-5 bg-gray-700 text-blue-300 border-blue-800">
                        {getStoryProgress(item)}
                      </Badge>
                      <Badge variant="outline" className="text-xs px-2 py-0 h-5 bg-gray-700 text-gray-300 border-gray-700">
                        {item.genre}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-400 mb-3 flex items-center">
                    <Calendar className="w-3 h-3 mr-1" /> 
                    {formatDate(item.date)} 
                    {item.fullStory && (
                      <><span className="mx-1">•</span>
                      <Clock className="w-3 h-3 mr-1" /> 
                      {item.fullStory.readingTime} phút</>
                    )}
                  </div>
                  
                  <Accordion type="single" collapsible className="border-t border-gray-700 pt-2">
                    <AccordionItem value="details" className="border-b-0">
                      <AccordionTrigger className="text-xs text-gray-400 hover:text-blue-400 py-1">
                        Xem chi tiết
                      </AccordionTrigger>
                      <AccordionContent className="pt-2">
                        <div className="text-xs text-gray-300 space-y-2">
                          <div>
                            <span className="text-gray-400">Chủ đề:</span> {item.topic}
                          </div>
                          
                          {item.outline && (
                            <div>
                              <div className="text-gray-400 mb-1">Cốt truyện:</div>
                              <div className="bg-gray-700 p-2 rounded text-gray-300">
                                {typeof item.outline.outline === 'string' 
                                  ? item.outline.outline.substring(0, 200) + (item.outline.outline.length > 200 ? '...' : '')
                                  : 'Cốt truyện không có sẵn'
                                }
                              </div>
                            </div>
                          )}
                          
                          {item.fullStory && (
                            <div>
                              <div className="text-gray-400 mb-1">Truyện:</div>
                              <div className="bg-gray-700 p-2 rounded text-gray-300">
                                {typeof item.fullStory.content === 'string'
                                  ? item.fullStory.content.substring(0, 200) + (item.fullStory.content.length > 200 ? '...' : '')
                                  : 'Nội dung truyện không có sẵn'
                                }
                              </div>
                            </div>
                          )}
                          
                          {item.scenes && item.scenes.length > 0 && (
                            <div>
                              <div className="text-gray-400 mb-1">Phân cảnh:</div>
                              <div className="bg-gray-700 p-2 rounded text-gray-300">
                                {item.scenes.length} phân cảnh đã được tạo
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  
                  <div className="flex justify-end space-x-2 mt-2 pt-2 border-t border-gray-700">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-900 hover:bg-opacity-20"
                      onClick={() => onDeleteStory(item.id)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Xóa
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs h-7 px-3 text-blue-400 hover:text-blue-300 bg-gray-700 border-gray-600"
                      onClick={() => handleLoadStory(item)}
                    >
                      <Save className="w-3 h-3 mr-1" /> Tải lại
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        <DialogFooter className="mt-4 flex items-center justify-between">
          <div className="text-xs text-gray-400">
            Tổng cộng: {histories.length} truyện
          </div>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="text-gray-300 border-gray-600"
          >
            <X className="w-4 h-4 mr-1" /> Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}