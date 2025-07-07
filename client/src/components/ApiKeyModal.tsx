import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ApiKeyType, KeyStatus } from "@/lib/types";

interface ApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ApiKeyModal({ open, onOpenChange }: ApiKeyModalProps) {
  const [activeTab, setActiveTab] = useState<ApiKeyType>(ApiKeyType.GEMINI);
  const [geminiKey, setGeminiKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [keyStatus, setKeyStatus] = useState<KeyStatus>({
    [ApiKeyType.GEMINI]: false,
    [ApiKeyType.OPENAI]: false
  });
  const { toast } = useToast();
  
  // Lấy trạng thái key khi mở modal
  useEffect(() => {
    if (open) {
      fetchKeyStatus();
    }
  }, [open]);
  
  const fetchKeyStatus = async () => {
    try {
      const response = await apiRequest("GET", "/api/key-status");
      const data = await response.json();
      setKeyStatus(data);
    } catch (error) {
      console.error("Error checking key status:", error);
    }
  };

  const handleSubmit = async () => {
    let key = activeTab === ApiKeyType.GEMINI ? geminiKey : openaiKey;
    
    if (!key.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập API key",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await apiRequest(
        "POST",
        "/api/set-key",
        { type: activeTab, key }
      );
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Thành công",
          description: data.message || "Đã thiết lập API key thành công",
        });
        
        // Cập nhật trạng thái key
        await fetchKeyStatus();
        
        if (dontShowAgain) {
          localStorage.setItem("dontShowApiKeyModal", "true");
        }
        
        onOpenChange(false);
      } else {
        toast({
          title: "Lỗi",
          description: data.message || "Đã xảy ra lỗi khi thiết lập API key",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể kết nối tới server",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-moc-dark border-moc-primary border-2 text-text-light shadow-lg">
        <DialogHeader className="bg-gradient-to-r from-moc-primary to-moc-secondary p-4 -m-6 mb-4 rounded-t-lg">
          <DialogTitle className="flex items-center text-xl font-semibold text-white">
            <i className="fas fa-key text-yellow-400 mr-2"></i>
            Cài đặt API Key
          </DialogTitle>
          <DialogDescription className="text-gray-100">
            Để có trải nghiệm tốt nhất, bạn có thể sử dụng API key của riêng mình. 
            Không có API key, ứng dụng sẽ sử dụng API hạn chế của chúng tôi.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ApiKeyType)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4 bg-moc-dark">
            <TabsTrigger 
              value={ApiKeyType.GEMINI} 
              className="data-[state=active]:bg-green-700 data-[state=active]:text-white text-gray-200"
            >
              <i className="fab fa-google text-yellow-400 mr-2"></i> Google Gemini
            </TabsTrigger>
            <TabsTrigger 
              value={ApiKeyType.OPENAI} 
              className="data-[state=active]:bg-green-700 data-[state=active]:text-white text-gray-200"
            >
              <i className="fas fa-robot text-blue-400 mr-2"></i> OpenAI
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value={ApiKeyType.GEMINI} className="space-y-4">
            <div className="bg-slate-800/50 border-moc-accent border rounded-md p-4 space-y-3 shadow-inner">
              <div className="flex justify-between items-center">
                <Label className="text-base text-moc-light flex items-center">
                  <i className="fas fa-key text-yellow-400 mr-2"></i> Gemini API Key
                </Label>
                <div className="flex items-center">
                  <Label htmlFor="show-gemini-key" className="mr-2 text-sm text-gray-300">Hiện key</Label>
                  <Switch 
                    id="show-gemini-key" 
                    checked={showGeminiKey}
                    onCheckedChange={setShowGeminiKey}
                    className="data-[state=checked]:bg-green-500"
                  />
                </div>
              </div>
              
              <Input
                type={showGeminiKey ? "text" : "password"}
                placeholder="Nhập Gemini API key..."
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-gray-400"
              />
              
              <div className="text-sm text-gray-300 flex items-center">
                <i className="fas fa-info-circle text-blue-400 mr-2"></i>
                Lấy key tại: <a href="https://makersuite.google.com" target="_blank" rel="noopener" className="text-blue-400 hover:text-blue-300 hover:underline ml-1">makersuite.google.com</a>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value={ApiKeyType.OPENAI} className="space-y-4">
            <div className="bg-slate-800/50 border-moc-accent border rounded-md p-4 space-y-3 shadow-inner">
              <div className="flex justify-between items-center">
                <Label className="text-base text-moc-light flex items-center">
                  <i className="fas fa-key text-blue-400 mr-2"></i> OpenAI API Key
                </Label>
                <div className="flex items-center">
                  <Label htmlFor="show-openai-key" className="mr-2 text-sm text-gray-300">Hiện key</Label>
                  <Switch 
                    id="show-openai-key" 
                    checked={showOpenaiKey}
                    onCheckedChange={setShowOpenaiKey}
                    className="data-[state=checked]:bg-green-500"
                  />
                </div>
              </div>
              
              <Input
                type={showOpenaiKey ? "text" : "password"}
                placeholder="Nhập OpenAI API key..."
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-gray-400"
              />
              
              <div className="text-sm text-gray-300 flex items-center">
                <i className="fas fa-info-circle text-blue-400 mr-2"></i>
                Lấy key tại: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="text-blue-400 hover:text-blue-300 hover:underline ml-1">platform.openai.com/api-keys</a>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="flex items-center space-x-2 mb-4 text-gray-300">
          <Checkbox 
            id="dont-show-again" 
            checked={dontShowAgain}
            onCheckedChange={(checked) => setDontShowAgain(checked as boolean)}
            className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
          />
          <Label htmlFor="dont-show-again" className="text-sm font-normal">
            Đừng hiện lại hộp thoại này
          </Label>
        </div>
        
        <div className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="border-gray-600 text-gray-300 hover:bg-slate-700 hover:text-white"
          >
            <i className="fas fa-times mr-2"></i> Bỏ qua
          </Button>
          <Button 
            className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white border-none btn-glow"
            onClick={handleSubmit} 
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="mr-2">Đang lưu...</span>
                <div className="spinner spinner-sm"></div>
              </>
            ) : (
              <>
                <i className="fas fa-save mr-2"></i> Lưu API Key
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}