import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import axios from "axios";
import path from "path";
import fs from "fs";
import multer from "multer";
import { 
  ApiKeyType, 
  getPreferredKey, 
  setUserProvidedKey, 
  getKeyStatus,
  hasAvailableKey
} from "./apiKeys";
import {
  generateStoryOutline,
  generateFullStory,
  generateScenes,
  generateScenesFromTopic,
  generateImage,
  generateContent
} from "./storyGenerator";
import { 
  generateAudio, 
  defaultVoice, 
  vietnameseVoices,
  getAllVoices,
  getVietnameseVoices,
  saveAudioFile
} from "./audio";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { analyzeImage } from "./gemini";

export async function registerRoutes(app: Express): Promise<Server> {
  // Cấu hình multer để xử lý upload file
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Tạo thư mục uploads nếu không tồn tại
      const uploadDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Tạo tên file ngẫu nhiên với thời gian hiện tại
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });

  // Không giới hạn kích thước tập tin
  const upload = multer({ 
    storage: storage,
    limits: {
      fileSize: Infinity // Không giới hạn kích thước file
    }
  });
  
  // Phục vụ static files từ thư mục uploads
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // API endpoint để phân tích ảnh
  app.post("/api/analyze-image", upload.single('image'), async (req, res) => {
    try {
      // Kiểm tra xem có file được upload không
      if (!req.file) {
        return res.status(400).json({ message: "Vui lòng tải lên một hình ảnh" });
      }

      // Kiểm tra Gemini API key
      const geminiKey = getPreferredKey(ApiKeyType.GEMINI);
      if (!geminiKey) {
        return res.status(400).json({ 
          message: "Không có Gemini API key. Vui lòng cung cấp Gemini API key để sử dụng tính năng này." 
        });
      }

      const imagePath = req.file.path;
      
      try {
        // Phân tích ảnh với Gemini AI
        const result = await analyzeImage(imagePath);
        
        // Xóa file tạm sau khi xử lý
        fs.unlink(imagePath, (err) => {
          if (err) console.error("Could not delete temporary image:", err);
        });
        
        res.json(result);
      } catch (imageError) {
        console.error("Detailed image analysis error:", imageError);
        
        // Xóa file tạm nếu có lỗi
        fs.unlink(imagePath, (err) => {
          if (err) console.error("Could not delete temporary image:", err);
        });
        
        // Thông báo lỗi chi tiết cho người dùng
        res.status(500).json({ 
          message: "Không thể phân tích hình ảnh. Vui lòng thử lại sau.",
          error: true
        });
      }
    } catch (error) {
      console.error("Error in image analysis route:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi phân tích hình ảnh" 
      });
    }
  });

  // API để kiểm tra trạng thái API keys
  app.get("/api/key-status", (req, res) => {
    res.json(getKeyStatus());
  });

  // API để thiết lập API key do người dùng cung cấp
  app.post("/api/set-key", (req, res) => {
    const { type, key } = req.body;
    
    if (!type || !key) {
      return res.status(400).json({ message: "Vui lòng cung cấp loại API và key" });
    }
    
    try {
      setUserProvidedKey(type as ApiKeyType, key);
      res.json({ success: true, message: `Đã thiết lập API key ${type}` });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi thiết lập API key" 
      });
    }
  });

  // API endpoint để tạo cốt truyện
  app.post("/api/generate-outline", async (req, res) => {
    try {
      const { genre, topic, readingTime, channelInfo, introduction } = req.body;

      if (!genre || !topic) {
        return res.status(400).json({ message: "Vui lòng cung cấp thể loại và chủ đề truyện" });
      }

      const outline = await generateStoryOutline(genre, topic, readingTime, channelInfo, introduction);
      res.json(outline);
    } catch (error) {
      console.error("Error generating outline:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi tạo cốt truyện" 
      });
    }
  });

  // API endpoint để tạo truyện đầy đủ từ cốt truyện
  app.post("/api/generate-full-story", async (req, res) => {
    try {
      const { outline, genre, characterEdits, channelInfo, introduction } = req.body;

      if (!outline || !genre) {
        return res.status(400).json({ message: "Vui lòng cung cấp cốt truyện và thể loại" });
      }

      const story = await generateFullStory(outline, genre, characterEdits, channelInfo, introduction);
      res.json(story);
    } catch (error) {
      console.error("Error generating full story:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi tạo truyện đầy đủ" 
      });
    }
  });
  
  // API endpoint để viết tiếp nội dung truyện
  app.post("/api/continue-story", async (req, res) => {
    try {
      const { content, outline, genre, endingContext } = req.body;

      if (!content || !genre || !outline) {
        return res.status(400).json({ message: "Vui lòng cung cấp nội dung truyện, thể loại và cốt truyện" });
      }

      // Sử dụng hàm generateContent từ storyGenerator để viết tiếp nội dung
      const prompt = `Bạn là một nhà văn chuyên viết truyện ${genre}. Hãy viết tiếp câu chuyện này dựa trên đoạn kết và cốt truyện cho sẵn:

Cốt truyện:
${JSON.stringify(outline, null, 2)}

Đoạn kết của nội dung đã có (khoảng 3-5 câu cuối):
${endingContext}

QUAN TRỌNG:
1. Viết tiếp nội dung một cách mạch lạc, liền mạch với đoạn kết phía trên
2. Phong cách viết và ngôn ngữ PHẢI nhất quán với nội dung trước đó và thể hiện rõ nét ĐẶC TRƯNG của thể loại ${genre}
3. KHÔNG bắt đầu với "Tiếp theo", "Sau đó", hay các cụm từ chuyển đoạn tương tự
4. Viết tiếp khoảng 200-300 từ
5. Không được kết thúc truyện, chỉ viết tiếp nội dung
6. Trả về kết quả dưới định dạng JSON như sau:
{
  "content": "Nội dung tiếp theo ở đây"
}

Nội dung viết tiếp:`;

      const continuedText = await generateContent(prompt);
      
      try {
        // Xử lý các trường hợp định dạng phản hồi Markdown và lồng nhau của Gemini
        // Loại bỏ các tag Markdown ```json và ``` nếu có
        const cleanedText = continuedText
          .replace(/```json\n/g, '')
          .replace(/```\n/g, '')
          .replace(/```/g, '');
        
        let finalContent = '';
        
        // Thử phân tích nội dung như JSON
        try {
          if (cleanedText.trim().startsWith('{') && cleanedText.trim().endsWith('}')) {
            // Nếu nội dung trả về đã là JSON, phân tích nó
            const parsedJson = JSON.parse(cleanedText);
            
            // Nếu có thuộc tính content, sử dụng nó
            if (parsedJson.content) {
              finalContent = parsedJson.content;
            } else {
              // Không có thuộc tính content, tạo string có định dạng từ đối tượng
              const jsonString = JSON.stringify(parsedJson);
              finalContent = jsonString
                .replace(/[{}"]/g, '')
                .replace(/,/g, '\n')
                .replace(/:/g, ': ')
                .trim();
            }
          } else {
            // Không phải định dạng JSON, sử dụng văn bản gốc đã được làm sạch
            finalContent = cleanedText;
          }
        } catch (e) {
          // Lỗi khi phân tích JSON, sử dụng văn bản gốc đã được làm sạch
          console.log('Không thể parse JSON trong response:', e);
          finalContent = cleanedText;
        }
        
        // Trả về nội dung đã xử lý
        res.json({ continuedContent: { content: finalContent } });
      } catch (e) {
        // Nếu có lỗi khi xử lý, trả về văn bản gốc
        res.json({ continuedContent: { content: continuedText } });
      }
    } catch (error) {
      console.error("Error continuing story:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi viết tiếp truyện" 
      });
    }
  });

  // API endpoint to generate scenes
  app.post("/api/generate-scenes", async (req, res) => {
    try {
      const { genre, topic, story, sceneCount, readingTime } = req.body;

      // Xử lý trường hợp có story đầy đủ và trường hợp chỉ có topic
      if (story) {
        // Sử dụng số cảnh từ request hoặc để hàm generateScenes tự tính dựa trên thời gian đọc
        const scenes = await generateScenes(story, genre, sceneCount);
        res.json(scenes);
      } else if (genre && topic) {
        // Truyền thời gian đọc thay vì số cảnh cố định
        const readingTimeValue = readingTime ? Number(readingTime) : 15;
        const scenes = await generateScenesFromTopic(genre, topic, readingTimeValue);
        res.json(scenes);
      } else {
        return res.status(400).json({ 
          message: "Vui lòng cung cấp (genre và topic) hoặc (story và genre)" 
        });
      }
    } catch (error) {
      console.error("Error generating scenes:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi tạo phân cảnh" 
      });
    }
  });

  // API endpoint to generate images
  app.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt } = req.body;

      if (!prompt) {
        return res.status(400).json({ message: "Vui lòng cung cấp prompt để tạo ảnh" });
      }

      try {
        const imageBase64 = await generateImage(prompt);
        res.json({ image: imageBase64 });
      } catch (imageError) {
        console.error("Detailed image generation error:", imageError);
        
        // Thông báo lỗi chi tiết cho người dùng
        res.status(500).json({ 
          message: "Không thể tạo ảnh. API n8n.aiautotool.com/webhook/dalle3 không khả dụng hoặc gặp lỗi. Vui lòng thử lại sau.",
          error: true
        });
      }
    } catch (error) {
      console.error("Error in image generation route:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi tạo ảnh" 
      });
    }
  });

  // API endpoint để lấy danh sách giọng đọc tiếng Việt
  app.get("/api/vietnamese-voices", async (req, res) => {
    try {
      const voices = await getVietnameseVoices();
      res.json(voices);
    } catch (error) {
      console.error("Error getting Vietnamese voices:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi lấy danh sách giọng đọc" 
      });
    }
  });
  
  // API endpoint để kiểm tra khả năng tạo audio
  app.get("/api/check-tts", async (req, res) => {
    try {
      console.log("Kiểm tra khả năng tạo audio...");
      
      // Tạo mẫu text tiếng Việt ngắn để thử nghiệm
      const testText = "Xin chào, đây là bài kiểm tra tổng hợp giọng nói.";
      const testVoice = defaultVoice;
      
      try {
        // Thử tạo audio với đoạn text ngắn
        console.log("Bắt đầu tạo audio thử nghiệm...");
        const audioBase64 = await generateAudio(testText, testVoice);
        
        // Kiểm tra dữ liệu trả về
        if (audioBase64 && audioBase64.length > 0) {
          console.log("Tạo audio thành công, độ dài base64:", audioBase64.length);
          
          // Lưu file audio test
          const fileName = `test_audio_${Date.now()}.mp3`;
          const filePath = saveAudioFile(audioBase64, fileName);
          
          res.json({
            success: true,
            message: "Hệ thống tạo audio đang hoạt động tốt",
            audio: audioBase64,
            voiceUsed: testVoice,
            downloadUrl: `/uploads/${fileName}`
          });
        } else {
          throw new Error("Audio trả về trống");
        }
      } catch (audioError) {
        console.error("Lỗi khi tạo audio thử nghiệm:", audioError);
        
        res.status(500).json({
          success: false,
          message: "Không thể tạo audio thử nghiệm. Vui lòng kiểm tra cấu hình.",
          error: audioError instanceof Error ? audioError.message : String(audioError)
        });
      }
    } catch (error) {
      console.error("Lỗi khi kiểm tra TTS:", error);
      res.status(500).json({
        success: false,
        message: "Đã xảy ra lỗi khi kiểm tra khả năng tạo audio",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // API endpoint để tạo audio từ text
  app.post("/api/generate-audio", async (req, res) => {
    try {
      const { text, voice, speed } = req.body;

      if (!text) {
        return res.status(400).json({ message: "Vui lòng cung cấp text để tạo audio" });
      }

      // Kiểm tra độ dài văn bản
      if (text.length > 5000) {
        return res.status(400).json({ 
          message: "Văn bản quá dài, tối đa 5000 ký tự",
          error: true
        });
      }

      // Sử dụng giọng đọc mặc định nếu không được chỉ định
      const voiceName = voice || defaultVoice;
      // Sử dụng tốc độ đọc mặc định nếu không được chỉ định
      const speedRate = speed || 1.0;
      
      console.log(`Đang tạo audio cho: ${text.substring(0, 50)}... với giọng ${voiceName}`);

      try {
        // Gọi API tạo audio thực tế
        const audioBase64 = await generateAudio(text, voiceName, speedRate);
        console.log(`Audio đã được tạo, độ dài: ${audioBase64.length} ký tự`);
        
        if (audioBase64 && audioBase64.length > 0) {
          return res.json({ 
            success: true,
            audio: audioBase64 
          });
        } else {
          throw new Error("Audio trả về trống");
        }
      } catch (audioError) {
        console.error("Lỗi chi tiết khi tạo audio:", audioError);
        
        // Thông báo lỗi chi tiết cho người dùng
        return res.status(500).json({ 
          success: false,
          message: "Không thể tạo audio. Google Text-to-Speech API không khả dụng. Vui lòng kiểm tra API key và thử lại sau.",
          error: true
        });
      }
    } catch (error) {
      console.error("Lỗi trong route tạo audio:", error);
      return res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi tạo audio" 
      });
    }
  });
  
  // API endpoint để tải audio về
  app.post("/api/download-audio", async (req, res) => {
    try {
      const { audioBase64, fileName } = req.body;
      
      if (!audioBase64) {
        return res.status(400).json({ 
          success: false,
          message: "Vui lòng cung cấp dữ liệu audio để tải về"
        });
      }
      
      // Tạo đường dẫn thư mục nếu không tồn tại
      const uploadDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // Tạo tên file nếu không có
      const outputFileName = fileName || `audio_${Date.now()}.mp3`;
      const filePath = path.join(uploadDir, outputFileName);
      
      // Xử lý chuỗi base64
      try {
        // Loại bỏ prefix nếu có
        const base64Data = audioBase64.replace(/^data:audio\/mp3;base64,/, '');
        
        // Ghi file
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        console.log(`Đã lưu file audio thành công: ${filePath}`);
        
        // Trả về đường dẫn tương đối để tải về
        res.json({ 
          success: true,
          downloadUrl: `/uploads/${outputFileName}`
        });
      } catch (fileError) {
        console.error("Lỗi khi lưu file audio:", fileError);
        return res.status(500).json({ 
          success: false,
          message: `Lỗi khi lưu file audio: ${fileError instanceof Error ? fileError.message : 'Lỗi không xác định'}`
        });
      }
    } catch (error) {
      console.error("Lỗi trong route tải audio:", error);
      return res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi tạo file audio để tải về" 
      });
    }
  });
  
  // API endpoint để tạo hình ảnh đại diện cho câu chuyện
  app.post("/api/generate-cover-image", async (req, res) => {
    try {
      const { title, genre, content } = req.body;

      if (!title || !genre) {
        return res.status(400).json({ message: "Vui lòng cung cấp tiêu đề và thể loại để tạo hình ảnh đại diện" });
      }

      // Tạo prompt cho hình ảnh đại diện
      const prompt = `High quality book cover for Vietnamese story titled "${title}". Genre: ${genre}. Photorealistic, professional, vivid colors, trending on artstation, attractive and detailed illustration.`;

      try {
        // Sử dụng generateImage có sẵn từ storyGenerator.ts
        const imageBase64 = await generateImage(prompt);
        res.json({ image: imageBase64 });
      } catch (imageError) {
        console.error("Detailed cover image generation error:", imageError);
        
        // Thông báo lỗi chi tiết cho người dùng
        res.status(500).json({ 
          message: "Không thể tạo hình ảnh đại diện. API tạo ảnh không khả dụng. Vui lòng thử lại sau.",
          error: true
        });
      }
    } catch (error) {
      console.error("Error in cover image generation route:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi tạo hình ảnh đại diện" 
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

// Tạo nội dung sử dụng Google Generative AI (Gemini)
async function generateWithGemini(prompt: string, apiKey: string): Promise<string> {
  try {
    console.log("Generating with Gemini...");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return text;
  } catch (error) {
    console.error("Error with Gemini API:", error);
    throw new Error(`Lỗi khi sử dụng Gemini API: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`);
  }
}

// Tạo nội dung sử dụng OpenAI API
async function generateWithOpenAI(prompt: string, apiKey: string): Promise<string> {
  try {
    console.log("Generating with OpenAI...");
    const openai = new OpenAI({ apiKey });
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
    });
    
    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("Error with OpenAI API:", error);
    throw new Error(`Lỗi khi sử dụng OpenAI API: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`);
  }
}

// Tạo nội dung sử dụng API bên ngoài
async function generateWithExternalAPI(prompt: string): Promise<string> {
  console.log("Generating with external API...");
  const encodedPrompt = encodeURIComponent(prompt);
  const url = `https://n8n.aiautotool.com/webhook/chatgpt4o?prompt=${encodedPrompt}`;

  const response = await axios.get(url);
  return response.data;
}
