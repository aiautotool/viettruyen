import express, { Express, Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { Server } from "http";
import { generateStoryOutline, generateFullStory, generateImage, generateScenesFromTopic, generateContent } from "./storyGenerator";
import { generateAudio, checkAudioGenerationAvailability, getVietnameseVoices, defaultVoice } from "./audio";
import { createStoryVideo, createVideoFromAudioAndImage, checkFfmpegAvailability, createSlideshowVideo, createStoryVideoAsync, createSlideshowVideoAsync } from "./video";
import { ApiKeyType, getKeyStatus, setUserProvidedKey, getPreferredKey } from "./apiKeys";
import { analyzeImage } from "./gemini";
import { KeyStatus, SetKeyRequest, FullStory, GenerateFullStoryRequest, GenerateRequest, GenerateScenesRequest, ImageRequest, Scene, StoryOutline } from "@shared/schema";
import { taskManager, Task } from "./taskManager";

// Interface để giúp type-checking cho kết quả từ generateImage
interface ImageResult {
  base64?: string;
  filepath?: string;
  url?: string;
  timestamp?: number;
}
import { log } from "./vite";

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve các thư mục tĩnh
  app.use('/images', express.static(path.join(process.cwd(), 'public/images')));
  app.use('/videos', express.static(path.join(process.cwd(), 'public/videos')));
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  app.use('/public', express.static(path.join(process.cwd(), 'public')));
  
  // Cấu hình multer cho upload ảnh
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname);
    }
  });

  const upload = multer({
    storage: storage,
    limits: {
      fileSize: 10 * 1024 * 1024 // Giới hạn kích thước file 10MB
    }
  });
  
  // API endpoint để kiểm tra trạng thái API key
  app.get("/api/key-status", (req, res) => {
    const keyStatus = getKeyStatus();
    res.json(keyStatus);
  });
  
  // API endpoint để phân tích nội dung hình ảnh
  app.post("/api/analyze-image", upload.single('image'), async (req, res) => {
    try {
      // Kiểm tra xem có file được upload không
      if (!req.file && !req.body.imageUrl) {
        return res.status(400).json({ 
          success: false,
          message: "Vui lòng tải lên một hình ảnh hoặc cung cấp URL hình ảnh" 
        });
      }

      // Kiểm tra Gemini API key
      const geminiKey = getPreferredKey(ApiKeyType.GEMINI);
      if (!geminiKey) {
        return res.status(400).json({ 
          success: false,
          message: "Không có Gemini API key. Vui lòng cung cấp key để sử dụng tính năng này." 
        });
      }

      let imagePath = '';
      if (req.file) {
        // Nếu có file upload
        imagePath = req.file.path;
      }
      
      try {
        // Phân tích hình ảnh với Gemini AI
        const result = await analyzeImage(imagePath);
        
        // Xóa file tạm sau khi xử lý nếu là file upload
        if (req.file && fs.existsSync(imagePath)) {
          fs.unlink(imagePath, (err) => {
            if (err) console.error("Không thể xóa tệp tạm:", err);
          });
        }
        
        res.json({
          success: true,
          ...result
        });
      } catch (imageError) {
        console.error("Lỗi chi tiết khi phân tích hình ảnh:", imageError);
        
        // Xóa file tạm nếu có lỗi
        if (req.file && fs.existsSync(imagePath)) {
          fs.unlink(imagePath, (err) => {
            if (err) console.error("Không thể xóa tệp tạm:", err);
          });
        }
        
        // Thông báo lỗi chi tiết cho người dùng
        res.status(500).json({ 
          success: false,
          message: "Không thể phân tích hình ảnh. Vui lòng thử lại sau.",
          error: imageError instanceof Error ? imageError.message : String(imageError)
        });
      }
    } catch (error) {
      console.error("Lỗi trong route phân tích hình ảnh:", error);
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi phân tích hình ảnh"
      });
    }
  });
  
  // API endpoint để đặt API key của người dùng
  app.post("/api/set-key", (req, res) => {
    try {
      const { type, key } = req.body as SetKeyRequest;
      
      if (!type || !key) {
        return res.status(400).json({ 
          success: false,
          message: "Vui lòng cung cấp loại API key và giá trị key" 
        });
      }
      
      setUserProvidedKey(type, key);
      
      res.json({ 
        success: true,
        message: `Đã đặt API key ${type} thành công` 
      });
    } catch (error) {
      console.error("Lỗi khi đặt API key:", error);
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi đặt API key" 
      });
    }
  });

  // API endpoint để kiểm tra khả năng tạo audio
  app.get("/api/check-audio", async (req, res) => {
    try {
      const available = await checkAudioGenerationAvailability();
      res.json({ 
        available,
        message: available ? "Audio generation is available" : "Audio generation is not available"
      });
    } catch (error) {
      console.error("Error checking audio availability:", error);
      res.status(500).json({ 
        available: false,
        message: "Error checking audio generation availability"
      });
    }
  });

  // API endpoint để lấy danh sách giọng tiếng Việt
  app.get("/api/vietnamese-voices", async (req, res) => {
    try {
      const voices = await getVietnameseVoices();
      res.json({ 
        success: true,
        voices,
        defaultVoice
      });
    } catch (error) {
      console.error("Error fetching Vietnamese voices:", error);
      res.status(500).json({ 
        success: false,
        message: "Error fetching Vietnamese voices"
      });
    }
  });

  // API endpoint để kiểm tra khả năng tạo video
  app.get("/api/check-video", async (req, res) => {
    try {
      const available = await checkFfmpegAvailability();
      res.json({ 
        available,
        message: available ? "Video generation is available" : "Video generation is not available"
      });
    } catch (error) {
      console.error("Error checking video availability:", error);
      res.status(500).json({ 
        available: false,
        message: "Error checking video generation availability"
      });
    }
  });
  
  // API endpoint để tạo cốt truyện
  app.post("/api/generate-outline", async (req, res) => {
    try {
      const { genre, topic, readingTime } = req.body;
      
      if (!genre || !topic) {
        return res.status(400).json({ 
          success: false,
          message: "Vui lòng cung cấp thể loại và chủ đề" 
        });
      }
      
      const outline = await generateStoryOutline(genre, topic, readingTime);
      
      res.json({ 
        success: true,
        outline 
      });
    } catch (error) {
      console.error("Lỗi khi tạo cốt truyện:", error);
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi tạo cốt truyện" 
      });
    }
  });
  
  // API endpoint để tạo truyện đầy đủ
  app.post("/api/generate-full-story", async (req, res) => {
    try {
      const { outline, genre, characterEdits, channelInfo, introduction } = req.body;
      
      if (!outline || !genre) {
        return res.status(400).json({ 
          success: false,
          message: "Vui lòng cung cấp cốt truyện và thể loại" 
        });
      }
      
      const story = await generateFullStory(outline, genre, characterEdits, channelInfo, introduction);
      
      res.json({ 
        success: true,
        story
      });
    } catch (error) {
      console.error("Lỗi khi tạo truyện đầy đủ:", error);
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi tạo truyện đầy đủ" 
      });
    }
  });
  
  // API endpoint để tiếp tục viết truyện
  app.post("/api/continue-story", async (req, res) => {
    try {
      const { content, genre, endingContext, outline } = req.body;
      
      if (!content || !genre) {
        return res.status(400).json({ 
          success: false,
          message: "Vui lòng cung cấp nội dung và thể loại" 
        });
      }
      
      // Tạo prompt cho việc tiếp tục viết
      const prompt = `Hãy tiếp tục viết câu chuyện sau đây theo phong cách ${genre}. Hãy viết thêm một đoạn nữa dựa trên phần trước. Phần trước: "${endingContext}"`;
      
      // Gọi API để tiếp tục viết
      const continuedContent = await generateContent(prompt);
      
      res.json({ 
        success: true,
        continuedContent 
      });
    } catch (error) {
      console.error("Lỗi khi tiếp tục viết truyện:", error);
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi tiếp tục viết truyện" 
      });
    }
  });
  
  // API endpoint để tạo phân cảnh
  app.post("/api/generate-scenes", async (req, res) => {
    try {
      const { genre, topic, story, sceneCount } = req.body;
      
      if (!genre || (!topic && !story)) {
        return res.status(400).json({ 
          success: false,
          message: "Vui lòng cung cấp thể loại và chủ đề hoặc nội dung truyện" 
        });
      }
      
      let scenes;
      
      if (story) {
        scenes = await generateScenesFromTopic(genre, topic, sceneCount);
      } else {
        scenes = await generateScenesFromTopic(genre, topic, sceneCount);
      }
      
      res.json({ 
        success: true,
        scenes 
      });
    } catch (error) {
      console.error("Lỗi khi tạo phân cảnh:", error);
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi tạo phân cảnh" 
      });
    }
  });

  // API endpoint để tạo audio từ văn bản (alias cho route voice)
  app.post("/api/generate-audio", async (req, res) => {
    try {
      const { text, voice, speed, name } = req.body;
      
      if (!text) {
        return res.status(400).json({ 
          success: false,
          message: "Vui lòng cung cấp nội dung văn bản để chuyển thành giọng nói"
        });
      }
      
      try {
        console.log("Bắt đầu tạo audio cho văn bản (endpoint: generate-audio):", text.substring(0, 50) + "...");
        
        // generateAudio trả về chuỗi base64
        const audioBase64 = await generateAudio(
          text, 
          voice || defaultVoice, 
          speed || 1.0
        );
        
        if (!audioBase64) {
          throw new Error("Audio trả về trống");
        }
        
        // Lưu file audio từ base64 string
        const fileName = `${name || 'audio'}_${Date.now()}.mp3`;
        console.log("Lưu file audio với tên:", fileName);
        
        // Lưu vào thư mục uploads
        const uploadsDir = path.join(process.cwd(), "uploads");
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const filePath = path.join(uploadsDir, fileName);
        fs.writeFileSync(filePath, Buffer.from(audioBase64, 'base64'));
        
        console.log("Đã lưu file audio tại:", filePath);
        
        // Trả về đường dẫn tương đối để dễ dàng tải xuống
        const relativePath = '/' + path.relative(process.cwd(), filePath).replace(/\\/g, '/');
        return res.json({ 
          success: true,
          message: "Đã tạo audio thành công",
          audioPath: relativePath
        });
      } catch (audioError) {
        console.error("Lỗi chi tiết khi tạo audio:", audioError);
        
        // Thông báo lỗi chi tiết cho người dùng
        return res.status(500).json({ 
          success: false,
          message: "Không thể tạo audio. API Text-to-Speech không khả dụng. Vui lòng thử lại sau.",
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
  
  // API endpoint để tạo audio từ văn bản
  app.post("/api/voice", async (req, res) => {
    try {
      const { text, voice, speed, name } = req.body;
      
      if (!text) {
        return res.status(400).json({ 
          success: false,
          message: "Vui lòng cung cấp nội dung văn bản để chuyển thành giọng nói"
        });
      }
      
      try {
        console.log("Bắt đầu tạo audio cho văn bản:", text.substring(0, 50) + "...");
        
        // generateAudio trả về chuỗi base64
        const audioBase64 = await generateAudio(
          text, 
          voice || defaultVoice, 
          speed || 1.0
        );
        
        if (!audioBase64) {
          throw new Error("Audio trả về trống");
        }
        
        // Lưu file audio từ base64 string
        const fileName = `${name || 'audio'}_${Date.now()}.mp3`;
        console.log("Lưu file audio với tên:", fileName);
        
        // Lưu vào thư mục uploads
        const uploadsDir = path.join(process.cwd(), "uploads");
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const filePath = path.join(uploadsDir, fileName);
        fs.writeFileSync(filePath, Buffer.from(audioBase64, 'base64'));
        
        console.log("Đã lưu file audio tại:", filePath);
        
        // Trả về đường dẫn tương đối để dễ dàng tải xuống
        const relativePath = '/' + path.relative(process.cwd(), filePath).replace(/\\/g, '/');
        return res.json({ 
          success: true,
          message: "Đã tạo audio thành công",
          audioPath: relativePath
        });
      } catch (audioError) {
        console.error("Lỗi chi tiết khi tạo audio:", audioError);
        
        // Thông báo lỗi chi tiết cho người dùng
        return res.status(500).json({ 
          success: false,
          message: "Không thể tạo audio. API Text-to-Speech không khả dụng. Vui lòng thử lại sau.",
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
      
      // Lưu file
      const audioData = audioBase64.replace(/^data:audio\/\w+;base64,/, "");
      fs.writeFileSync(filePath, Buffer.from(audioData, 'base64'));
      
      // Trả về đường dẫn tương đối để dễ dàng tải xuống
      const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
      return res.json({ 
        success: true,
        message: "Đã lưu audio thành công",
        audioPath: `/${relativePath}`
      });
    } catch (error) {
      console.error("Lỗi khi tải audio:", error);
      return res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi tải audio" 
      });
    }
  });

  // API endpoint để tạo hình ảnh đại diện
  app.post("/api/generate-cover", async (req, res) => {
    try {
      const { title, genre } = req.body;
      
      if (!title) {
        return res.status(400).json({ 
          success: false,
          message: "Vui lòng cung cấp tiêu đề để tạo hình ảnh đại diện" 
        });
      }
      
      // Tạo prompt cho hình ảnh
      const prompt = `Create a book or story cover illustration for "${title}". Genre: ${genre}. Photorealistic, professional, vivid colors, trending on artstation, attractive and detailed illustration.`;

      try {
        // Sử dụng generateImage có sẵn từ storyGenerator.ts
        const result = await generateImage(prompt);
        
        // Kiểm tra kết quả trả về là object chứa thông tin file hay chỉ là base64
        if (typeof result === 'object' && 'base64' in result && 'url' in result) {
          // Trả về cả chuỗi base64 và URL của hình ảnh đã lưu
          res.json({ 
            image: result.base64, 
            imageUrl: result.url,
            imageFilepath: result.filepath
          });
        } else {
          // Trả về chỉ chuỗi base64 nếu không lưu được file
          res.json({ image: result });
        }
      } catch (imageError) {
        console.error("Detailed cover image generation error:", imageError);
        
        // Thông báo lỗi chi tiết cho người dùng
        res.status(500).json({ 
          message: "Không thể tạo hình ảnh đại diện. API tạo ảnh không khả dụng. Vui lòng thử lại sau." 
        });
      }
    } catch (error) {
      console.error("Error generating cover image:", error);
      res.status(500).json({ 
        message: "Đã xảy ra lỗi khi tạo hình ảnh đại diện" 
      });
    }
  });

  // API endpoint để tạo hình ảnh đại diện cho truyện
  app.post("/api/generate-cover-image", async (req, res) => {
    try {
      const { title, genre, content } = req.body;
      
      if (!title) {
        return res.status(400).json({ 
          success: false,
          message: "Vui lòng cung cấp tiêu đề để tạo hình ảnh đại diện" 
        });
      }
      
      // Tạo prompt cho hình ảnh bìa
      const prompt = `Tạo hình ảnh bìa minh họa cho truyện có tựa đề "${title}". Thể loại: ${genre}. Hình ảnh thực tế, chuyên nghiệp, màu sắc sống động, phong cách nghệ thuật hiện đại, minh họa hấp dẫn và chi tiết.`;

      try {
        // Sử dụng generateImage từ storyGenerator.ts
        const result = await generateImage(prompt);
        
        // Kiểm tra kết quả trả về là object chứa thông tin file hay chỉ là base64
        if (typeof result === 'object' && 'base64' in result && 'url' in result) {
          // Trả về cả base64 và URL của hình ảnh đã lưu
          res.json({ 
            success: true,
            image: result.base64,
            imageUrl: result.url,
            timestamp: result.timestamp
          });
        } else {
          // Trả về chuỗi base64 nếu không lưu được file
          res.json({ 
            success: true,
            image: result
          });
        }
      } catch (imageError) {
        console.error("Lỗi chi tiết khi tạo hình ảnh đại diện:", imageError);
        
        // Thông báo lỗi chi tiết cho người dùng
        res.status(500).json({ 
          success: false,
          message: "Không thể tạo hình ảnh đại diện. API tạo ảnh không khả dụng. Vui lòng thử lại sau.",
          error: true
        });
      }
    } catch (error) {
      console.error("Lỗi khi tạo hình ảnh đại diện:", error);
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi tạo hình ảnh đại diện" 
      });
    }
  });

  // API endpoint để tạo hình ảnh từ prompt
  app.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ 
          success: false,
          message: "Vui lòng cung cấp prompt để tạo hình ảnh" 
        });
      }
      
      try {
        const result = await generateImage(prompt);
        
        // Kiểm tra kết quả trả về là object chứa thông tin file hay chỉ là base64
        if (typeof result === 'object' && 'base64' in result && 'url' in result) {
          // Trả về URL của hình ảnh làm trường chính để client sử dụng
          const imageUrl = result.url;
          // Chuyển đổi URL tương đối thành URL tuyệt đối nếu cần
          const absoluteUrl = imageUrl.startsWith('http') 
            ? imageUrl 
            : `${req.protocol}://${req.get('host')}${imageUrl}`;
            
          res.json({ 
            success: true,
            image: result.base64, // Vẫn giữ base64 để tương thích ngược
            imageUrl: absoluteUrl   // URL tuyệt đối của hình ảnh
          });
        } else {
          // Trường hợp không có URL, vẫn giữ lại base64
          res.json({ 
            success: true,
            image: result,
            // Không có URL
            imageUrl: null
          });
        }
      } catch (imageError) {
        console.error("Detailed image generation error:", imageError);
        res.status(500).json({ 
          success: false,
          message: "Không thể tạo hình ảnh. API tạo ảnh không khả dụng. Vui lòng thử lại sau." 
        });
      }
    } catch (error) {
      console.error("Error generating image:", error);
      res.status(500).json({ 
        success: false,
        message: "Đã xảy ra lỗi khi tạo hình ảnh" 
      });
    }
  });
  
  // API endpoint để tạo video từ audio và image
  app.post("/api/create-video", async (req, res) => {
    try {
      const { audioPath, imagePath, title, resolution } = req.body;
      
      if (!audioPath || !imagePath) {
        return res.status(400).json({ 
          success: false,
          message: "Vui lòng cung cấp đường dẫn audio và hình ảnh" 
        });
      }
      
      console.log("Request tạo video:", { audioPath, imagePath, title, resolution });
      
      // Chuẩn hóa đường dẫn (loại bỏ dấu / ở đầu nếu có)
      let normalizedAudioPath = audioPath.startsWith('/') ? audioPath.substring(1) : audioPath;
      let normalizedImagePath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
      
      // Kiểm tra xem các file có tồn tại không
      const fullAudioPath = path.join(process.cwd(), normalizedAudioPath);
      const fullImagePath = path.join(process.cwd(), normalizedImagePath);
      
      console.log("Đường dẫn đầy đủ:", { fullAudioPath, fullImagePath });
      
      // Kiểm tra file audio
      if (!fs.existsSync(fullAudioPath)) {
        console.log("File audio không tồn tại:", fullAudioPath);
        
        // Thử tìm kiếm trong các đường dẫn khác nhau
        const alternativePaths = [
          path.join(process.cwd(), 'uploads', path.basename(normalizedAudioPath)),
          path.join(process.cwd(), path.basename(normalizedAudioPath))
        ];
        
        let found = false;
        for (const altPath of alternativePaths) {
          console.log("Thử tìm file audio tại:", altPath);
          if (fs.existsSync(altPath)) {
            console.log("Đã tìm thấy file audio tại:", altPath);
            normalizedAudioPath = path.relative(process.cwd(), altPath);
            found = true;
            break;
          }
        }
        
        if (!found) {
          return res.status(400).json({ 
            success: false,
            message: "File audio không tồn tại hoặc không thể truy cập" 
          });
        }
      }
      
      // Kiểm tra file hình ảnh
      if (!fs.existsSync(fullImagePath)) {
        console.log("File hình ảnh không tồn tại:", fullImagePath);
        
        // Thử tìm kiếm trong các đường dẫn khác nhau
        const alternativePaths = [
          path.join(process.cwd(), 'uploads', path.basename(normalizedImagePath)),
          path.join(process.cwd(), path.basename(normalizedImagePath)),
          path.join(process.cwd(), 'public', 'images', path.basename(normalizedImagePath))
        ];
        
        let found = false;
        for (const altPath of alternativePaths) {
          console.log("Thử tìm file hình ảnh tại:", altPath);
          if (fs.existsSync(altPath)) {
            console.log("Đã tìm thấy file hình ảnh tại:", altPath);
            normalizedImagePath = path.relative(process.cwd(), altPath);
            found = true;
            break;
          }
        }
        
        if (!found) {
          return res.status(400).json({ 
            success: false,
            message: "File hình ảnh không tồn tại hoặc không thể truy cập" 
          });
        }
      }
      
      const fullAudioPathUpdated = path.join(process.cwd(), normalizedAudioPath);
      const fullImagePathUpdated = path.join(process.cwd(), normalizedImagePath);
      
      // Tạo video
      const outputFilePath = await createVideoFromAudioAndImage(
        fullAudioPathUpdated, 
        fullImagePathUpdated, 
        {
          outputFileName: title || "video",
          resolution: resolution || "576x1024" // Mặc định là 9:16 (dọc) cho TikTok/Instagram
        }
      );
      
      // Trả về đường dẫn tương đối để dễ dàng tải xuống
      const relativePath = path.relative(process.cwd(), outputFilePath).replace(/\\/g, '/');
      res.json({
        success: true,
        message: "Video đã được tạo thành công",
        videoUrl: `/${relativePath}`
      });
    } catch (error) {
      console.error("Lỗi khi tạo video:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi tạo video"
      });
    }
  });
  
  // API endpoint để tạo video truyện từ audio và hình ảnh bìa
  app.post("/api/create-story-video", async (req, res) => {
    try {
      const { audioPath, coverImagePath, title, resolution } = req.body;

      if (!audioPath || !coverImagePath) {
        return res.status(400).json({ 
          success: false,
          message: "Vui lòng cung cấp đường dẫn audio và hình ảnh bìa" 
        });
      }

      console.log("Request tạo video truyện:", { audioPath, coverImagePath, title, resolution });

      // Chuẩn hóa đường dẫn (loại bỏ dấu / ở đầu nếu có)
      let normalizedAudioPath = audioPath.startsWith('/') ? audioPath.substring(1) : audioPath;
      let normalizedImagePath = coverImagePath.startsWith('/') ? coverImagePath.substring(1) : coverImagePath;
      
      // Kiểm tra xem các file có tồn tại không
      const fullAudioPath = path.join(process.cwd(), normalizedAudioPath);
      const fullImagePath = path.join(process.cwd(), normalizedImagePath);
      
      console.log("Đường dẫn đầy đủ:", { fullAudioPath, fullImagePath });
      
      // Kiểm tra file audio
      if (!fs.existsSync(fullAudioPath)) {
        console.log("File audio không tồn tại:", fullAudioPath);
        
        // Thử tìm kiếm trong các đường dẫn khác nhau
        const alternativePaths = [
          path.join(process.cwd(), 'uploads', path.basename(normalizedAudioPath)),
          path.join(process.cwd(), path.basename(normalizedAudioPath))
        ];
        
        let found = false;
        for (const altPath of alternativePaths) {
          console.log("Thử tìm file audio tại:", altPath);
          if (fs.existsSync(altPath)) {
            console.log("Đã tìm thấy file audio tại:", altPath);
            normalizedAudioPath = path.relative(process.cwd(), altPath);
            found = true;
            break;
          }
        }
        
        if (!found) {
          return res.status(400).json({ 
            success: false,
            message: "File audio không tồn tại hoặc không thể truy cập" 
          });
        }
      }
      
      // Kiểm tra file hình ảnh
      if (!fs.existsSync(fullImagePath)) {
        console.log("File hình ảnh không tồn tại:", fullImagePath);
        
        // Thử tìm kiếm trong các đường dẫn khác nhau
        const alternativePaths = [
          path.join(process.cwd(), 'uploads', path.basename(normalizedImagePath)),
          path.join(process.cwd(), path.basename(normalizedImagePath)),
          path.join(process.cwd(), 'public', 'images', path.basename(normalizedImagePath))
        ];
        
        let found = false;
        for (const altPath of alternativePaths) {
          console.log("Thử tìm file hình ảnh tại:", altPath);
          if (fs.existsSync(altPath)) {
            console.log("Đã tìm thấy file hình ảnh tại:", altPath);
            normalizedImagePath = path.relative(process.cwd(), altPath);
            found = true;
            break;
          }
        }
        
        if (!found) {
          return res.status(400).json({ 
            success: false,
            message: "File hình ảnh không tồn tại hoặc không thể truy cập" 
          });
        }
      }

      // Tạo video
      const outputFilePath = await createStoryVideo(
        fullAudioPath, 
        fullImagePath, 
        {
          title: title || "story",
          resolution: resolution || '1280x720'
        }
      );
      
      // Trả về đường dẫn tương đối để tải xuống
      const relativePath = path.relative(process.cwd(), outputFilePath).replace(/\\/g, '/');
      res.json({
        success: true,
        message: "Video truyện đã được tạo thành công",
        videoUrl: `/${relativePath}`
      });
    } catch (error) {
      console.error("Lỗi khi tạo video truyện:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi tạo video truyện"
      });
    }
  });
  
  // API endpoint để tạo video từ nhiều ảnh
  app.post("/api/create-slideshow", async (req, res) => {
    try {
      const { imagePaths, audioPath, title, duration } = req.body;
      
      if (!imagePaths || !imagePaths.length) {
        return res.status(400).json({ 
          success: false,
          message: "Vui lòng cung cấp ít nhất một đường dẫn hình ảnh" 
        });
      }
      
      // Xử lý đường dẫn ảnh
      const processedImagePaths = imagePaths.map((imgPath: string) => {
        const normalizedPath = imgPath.startsWith('/') ? imgPath.substring(1) : imgPath;
        const fullPath = path.join(process.cwd(), normalizedPath);
        
        // Nếu không tìm thấy, thử các đường dẫn thay thế
        if (!fs.existsSync(fullPath)) {
          const alternativePaths = [
            path.join(process.cwd(), 'uploads', path.basename(normalizedPath)),
            path.join(process.cwd(), path.basename(normalizedPath)),
            path.join(process.cwd(), 'public', 'images', path.basename(normalizedPath))
          ];
          
          for (const altPath of alternativePaths) {
            if (fs.existsSync(altPath)) {
              return altPath;
            }
          }
          
          throw new Error(`Không tìm thấy hình ảnh tại: ${imgPath}`);
        }
        
        return fullPath;
      });
      
      // Xử lý đường dẫn audio nếu có
      if (!audioPath) {
        return res.status(400).json({ 
          success: false,
          message: "Cần cung cấp đường dẫn tới file audio" 
        });
      }
      
      // Xử lý đường dẫn audio
      const normalizedAudioPath = audioPath.startsWith('/') ? audioPath.substring(1) : audioPath;
      const fullAudioPath = path.join(process.cwd(), normalizedAudioPath);
      let processedAudioPath = fullAudioPath;
      
      if (!fs.existsSync(fullAudioPath)) {
        const alternativePaths = [
          path.join(process.cwd(), 'uploads', path.basename(normalizedAudioPath)),
          path.join(process.cwd(), path.basename(normalizedAudioPath))
        ];
        
        let found = false;
        for (const altPath of alternativePaths) {
          if (fs.existsSync(altPath)) {
            processedAudioPath = altPath;
            found = true;
            break;
          }
        }
        
        if (!found) {
          return res.status(400).json({ 
            success: false,
            message: "File audio không tồn tại hoặc không thể truy cập" 
          });
        }
      }
      
      // Tạo slideshow
      const outputFilePath = await createSlideshowVideo(
        processedAudioPath,
        processedImagePaths,
        {
          outputFileName: title ?? "slideshow",
          slideDuration: duration || 2
        }
      );
      
      // Trả về đường dẫn tương đối để tải xuống
      const relativePath = path.relative(process.cwd(), outputFilePath).replace(/\\/g, '/');
      res.json({
        success: true,
        message: "Slideshow đã được tạo thành công",
        videoUrl: `/${relativePath}`
      });
    } catch (error) {
      console.error("Lỗi khi tạo slideshow:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi tạo slideshow"
      });
    }
  });

  // API endpoint để tạo video tự động (tự tạo audio và hình ảnh)
  // API endpoint để lấy thông tin về một task
  app.get("/api/task/:taskId", async (req, res) => {
    try {
      const { taskId } = req.params;
      
      if (!taskId) {
        return res.status(400).json({ 
          success: false,
          message: "Vui lòng cung cấp task ID" 
        });
      }
      
      const task = taskManager.getTask(taskId);
      
      if (!task) {
        return res.status(404).json({ 
          success: false,
          message: "Không tìm thấy task với ID đã cung cấp" 
        });
      }
      
      res.json({ 
        success: true,
        task
      });
    } catch (error) {
      console.error("Lỗi khi lấy thông tin task:", error);
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi lấy thông tin task" 
      });
    }
  });
  
  // API endpoint để tạo video từ audio và ảnh sử dụng task manager
  app.post("/api/create-video-async", async (req, res) => {
    try {
      const { audioPath, imagePath, title, options } = req.body;
      
      if (!audioPath || !imagePath) {
        return res.status(400).json({ 
          success: false,
          message: "Vui lòng cung cấp đường dẫn file audio và ảnh" 
        });
      }
      
      // Sử dụng hàm bất đồng bộ thay vì hàm đồng bộ trước đây
      const taskId = await createStoryVideoAsync(audioPath, imagePath, {
        title,
        ...options
      });
      
      res.json({ 
        success: true,
        message: "Đã bắt đầu tạo video",
        taskId
      });
    } catch (error) {
      console.error("Lỗi khi tạo video bất đồng bộ:", error);
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi tạo video" 
      });
    }
  });
  
  // API endpoint để tạo slideshow từ nhiều ảnh và audio sử dụng task manager
  app.post("/api/create-slideshow-async", async (req, res) => {
    try {
      const { audioPath, imagePaths, options } = req.body;
      
      if (!audioPath || !imagePaths || !Array.isArray(imagePaths) || imagePaths.length === 0) {
        return res.status(400).json({ 
          success: false,
          message: "Vui lòng cung cấp đường dẫn file audio và danh sách ảnh" 
        });
      }
      
      // Sử dụng hàm bất đồng bộ
      const taskId = await createSlideshowVideoAsync(audioPath, imagePaths, options);
      
      res.json({ 
        success: true,
        message: "Đã bắt đầu tạo slideshow",
        taskId
      });
    } catch (error) {
      console.error("Lỗi khi tạo slideshow bất đồng bộ:", error);
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi tạo slideshow" 
      });
    }
  });
  
  // API endpoint để tạo video tự động từ truyện bằng phương thức bất đồng bộ
  app.post("/api/auto-create-video-async", async (req, res) => {
    try {
      const { title, storyText, genre } = req.body;
      
      if (!title || !storyText) {
        return res.status(400).json({ 
          success: false,
          message: "Vui lòng cung cấp tiêu đề và nội dung truyện" 
        });
      }
      
      console.log(`Bắt đầu tạo video tự động cho: ${title}`);
      
      // Bước 1: Tạo hình ảnh đại diện
      console.log("Bước 1: Tạo hình ảnh đại diện");
      const imagePrompt = `Tạo hình ảnh bìa minh họa cho truyện có tựa đề "${title}". Thể loại: ${genre || "Tổng hợp"}. Hình ảnh thực tế, chuyên nghiệp, màu sắc sống động, phong cách nghệ thuật hiện đại, minh họa hấp dẫn và chi tiết.`;
      
      // Tạo task mới cho toàn bộ quá trình
      const task = taskManager.createTask('video', {
        title,
        genre,
        startTime: new Date()
      });
      
      // Xử lý bất đồng bộ
      setTimeout(async () => {
        try {
          // Cập nhật trạng thái đang xử lý
          taskManager.updateTaskStatus(task.id, 'processing');
          taskManager.updateTaskProgress(task.id, 5); // 5% - Bắt đầu
          
          try {
            // Bước 1: Tạo hình ảnh bìa
            const imageResult = await generateImage(imagePrompt) as ImageResult;
            taskManager.updateTaskProgress(task.id, 20); // 20% - Đã có hình ảnh
            
            let imagePath = '';
            if (typeof imageResult === 'string') {
              // Nếu kết quả là base64 string
              const fileName = `cover_${Date.now()}.jpg`;
              const uploadDir = path.join(process.cwd(), 'uploads');
              if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
              }
              imagePath = path.join(uploadDir, fileName);
              fs.writeFileSync(imagePath, Buffer.from(imageResult, 'base64'));
            } else if (imageResult.filepath) {
              // Nếu kết quả là object có chứa filepath
              imagePath = imageResult.filepath;
            } else {
              throw new Error("Không thể tạo hình ảnh bìa");
            }
            
            // Bước 2: Tạo audio từ nội dung truyện
            console.log("Bước 2: Tạo audio từ nội dung truyện");
            taskManager.updateTaskProgress(task.id, 25); // 25% - Bắt đầu tạo audio
            
            const audioBase64 = await generateAudio(storyText);
            taskManager.updateTaskProgress(task.id, 55); // 55% - Đã có audio
            
            // Lưu file audio
            const audioFileName = `story_${Date.now()}.mp3`;
            const audioDir = path.join(process.cwd(), 'uploads');
            if (!fs.existsSync(audioDir)) {
              fs.mkdirSync(audioDir, { recursive: true });
            }
            const audioPath = path.join(audioDir, audioFileName);
            fs.writeFileSync(audioPath, Buffer.from(audioBase64, 'base64'));
            
            // Bước 3: Tạo video từ audio và hình ảnh
            console.log("Bước 3: Tạo video từ audio và hình ảnh");
            taskManager.updateTaskProgress(task.id, 60); // 60% - Bắt đầu tạo video
            
            const videoPath = await createStoryVideo(audioPath, imagePath, {
              title,
              addSmokeFx: genre?.toLowerCase().includes("kinh dị") || genre?.toLowerCase().includes("bí ẩn")
            });
            
            // Cập nhật task hoàn thành
            taskManager.updateTaskProgress(task.id, 100); // 100% - Hoàn thành
            
            // Tạo URL có thể truy cập từ web
            const videoUrl = '/videos/' + path.basename(videoPath);
            
            taskManager.updateTaskStatus(task.id, 'completed', {
              videoPath,
              videoUrl,
              title
            });
          } catch (error) {
            console.error("Lỗi trong quá trình xử lý tạo video tự động:", error);
            taskManager.updateTaskStatus(task.id, 'failed', null, error instanceof Error ? error.message : String(error));
          }
        } catch (outerError) {
          console.error("Lỗi ngoài trong quá trình xử lý tạo video tự động:", outerError);
          taskManager.updateTaskStatus(task.id, 'failed', null, outerError instanceof Error ? outerError.message : String(outerError));
        }
      }, 0);
      
      res.json({ 
        success: true,
        message: "Đã bắt đầu tạo video tự động",
        taskId: task.id
      });
    } catch (error) {
      console.error("Lỗi khi bắt đầu tạo video tự động:", error);
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi bắt đầu tạo video" 
      });
    }
  });
  
  app.post("/api/auto-create-video", async (req, res) => {
    try {
      const { title, content, genre } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({ 
          success: false,
          message: "Vui lòng cung cấp tiêu đề và nội dung để tạo video"
        });
      }
      
      console.log(`Bắt đầu tạo video tự động cho: ${title}`);
      
      // Tạo task mới cho toàn bộ quá trình
      const task = taskManager.createTask('video', {
        title,
        genre,
        startTime: new Date()
      });
      
      // Xử lý bất đồng bộ - trả về task_id ngay lập tức
      res.json({
        success: true,
        message: "Đã bắt đầu tạo video tự động. Quá trình này sẽ mất vài phút, bạn có thể theo dõi tiến độ với task_id.",
        taskId: task.id
      });
      
      // Xử lý trong background
      setTimeout(async () => {
        try {
          // Cập nhật trạng thái đang xử lý
          taskManager.updateTaskStatus(task.id, 'processing');
          taskManager.updateTaskProgress(task.id, 5); // 5% - Bắt đầu
          
          // 1. Tạo hình ảnh đại diện
          console.log("Bước 1: Tạo hình ảnh đại diện");
          const imagePrompt = `Tạo hình ảnh bìa minh họa cho truyện có tựa đề "${title}". Thể loại: ${genre || 'Tình cảm'}. Hình ảnh thực tế, chuyên nghiệp, màu sắc sống động, phong cách nghệ thuật hiện đại, minh họa hấp dẫn và chi tiết.`;
          
          try {
            // Cập nhật tiến độ
            taskManager.updateTaskProgress(task.id, 10); // 10% - Bắt đầu tạo hình ảnh
            
            // Tạo hình ảnh
            const imageResult = await generateImage(imagePrompt) as ImageResult;
            console.log("Đã tạo xong hình ảnh đại diện");
            
            // Cập nhật tiến độ
            taskManager.updateTaskProgress(task.id, 30); // 30% - Đã tạo xong hình ảnh
            
            // Lấy đường dẫn hình ảnh
            let imagePath = "";
            if (typeof imageResult === 'object' && imageResult !== null && 'filepath' in imageResult) {
              imagePath = imageResult.filepath;
            } else {
              // Nếu không có đường dẫn file, lưu base64 thành file
              let base64Data = "";
              if (typeof imageResult === 'object' && imageResult !== null && 'base64' in imageResult) {
                const imgResult = imageResult as ImageResult;
                base64Data = String(imgResult.base64 || ""); 
              } else if (typeof imageResult === 'string') {
                base64Data = imageResult;
              }
              
              if (!base64Data) {
                throw new Error("Không nhận được dữ liệu hình ảnh hợp lệ");
              }
              
              const imageBuffer = Buffer.from(base64Data, 'base64');
              
              const imageFileName = `image_${Date.now()}.jpg`;
              const imageDir = path.join(process.cwd(), 'public', 'images');
              
              if (!fs.existsSync(imageDir)) {
                fs.mkdirSync(imageDir, { recursive: true });
              }
              
              imagePath = path.join(imageDir, imageFileName);
              fs.writeFileSync(imagePath, imageBuffer);
              console.log("Đã lưu hình ảnh tại:", imagePath);
            }
            
            // 2. Tạo audio từ nội dung
            console.log("Bước 2: Tạo audio từ nội dung");
            taskManager.updateTaskProgress(task.id, 35); // 35% - Bắt đầu tạo audio
            
            let audioBase64;
            try {
              audioBase64 = await generateAudio(content);
              console.log("Đã tạo xong audio, độ dài:", audioBase64.length);
              
              // Cập nhật tiến độ
              taskManager.updateTaskProgress(task.id, 60); // 60% - Đã tạo xong audio
              
              // Lưu audio vào file
              const audioFileName = `audio_${Date.now()}.mp3`;
              const uploadsDir = path.join(process.cwd(), "uploads");
              
              if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
              }
              
              const audioPath = path.join(uploadsDir, audioFileName);
              fs.writeFileSync(audioPath, Buffer.from(audioBase64, 'base64'));
              console.log("Đã lưu file audio tại:", audioPath);
              
              // 3. Tạo video từ audio và hình ảnh
              console.log("Bước 3: Tạo video từ audio và hình ảnh");
              taskManager.updateTaskProgress(task.id, 65); // 65% - Bắt đầu tạo video
              
              try {
                const outputPath = await createStoryVideo(
                  audioPath,
                  imagePath,
                  {
                    title: title,
                    resolution: '720x1280', // Tỉ lệ 9:16 cho di động
                    addSmokeFx: genre?.toLowerCase().includes("kinh dị") || genre?.toLowerCase().includes("bí ẩn") // Thêm hiệu ứng sương khói cho truyện kinh dị
                  }
                );
                
                // Trả về đường dẫn tương đối để dễ dàng tải xuống
                const relativePath = '/' + path.relative(process.cwd(), outputPath).replace(/\\/g, '/');
                
                // Cập nhật task đã hoàn thành
                taskManager.updateTaskProgress(task.id, 100); // 100% - Hoàn thành
                taskManager.updateTaskStatus(task.id, 'completed', {
                  videoUrl: relativePath,
                  imageUrl: `/public/images/${path.basename(imagePath)}`,
                  audioPath: `/uploads/${audioFileName}`
                });
                
              } catch (videoError) {
                console.error("Lỗi khi tạo video:", videoError);
                
                // Cập nhật task khi có lỗi video
                taskManager.updateTaskStatus(task.id, 'failed', {
                  imageUrl: `/public/images/${path.basename(imagePath)}`,
                  audioPath: `/uploads/${audioFileName}`,
                  error: videoError instanceof Error ? videoError.message : String(videoError)
                }, "Đã xảy ra lỗi khi tạo video, nhưng audio và hình ảnh đã được tạo thành công");
              }
              
            } catch (audioError) {
              console.error("Lỗi khi tạo audio:", audioError);
              
              // Cập nhật task khi có lỗi audio
              taskManager.updateTaskStatus(task.id, 'failed', {
                imageUrl: `/public/images/${path.basename(imagePath)}`
              }, "Đã xảy ra lỗi khi tạo audio, nhưng hình ảnh đã được tạo thành công");
            }
            
          } catch (imageError) {
            console.error("Lỗi khi tạo hình ảnh:", imageError);
            
            // Cập nhật task khi có lỗi hình ảnh
            taskManager.updateTaskStatus(task.id, 'failed', null, 
              `Đã xảy ra lỗi khi tạo hình ảnh đại diện: ${imageError instanceof Error ? imageError.message : String(imageError)}`);
          }
          
        } catch (error) {
          console.error("Lỗi khi tạo video tự động:", error);
          taskManager.updateTaskStatus(task.id, 'failed', null, 
            `Lỗi không xác định: ${error instanceof Error ? error.message : String(error)}`);
        }
      }, 0);
      
    } catch (error) {
      console.error("Lỗi khi bắt đầu tạo video tự động:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi tạo video tự động"
      });
    }
  });

  // API endpoint để kiểm tra Gemini API
  app.post("/api/test-gemini", async (req, res) => {
    try {
      const { prompt } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ 
          success: false,
          message: "Vui lòng cung cấp prompt để kiểm tra" 
        });
      }
      
      // Thêm từ khóa để buộc sử dụng Gemini
      const testPrompt = `test_gemini ${prompt}`;
      
      const result = await generateContent(testPrompt);
      
      res.json({ 
        success: true,
        result 
      });
    } catch (error) {
      console.error("Lỗi khi kiểm tra Gemini API:", error);
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi kiểm tra Gemini API" 
      });
    }
  });
  
  // Xử lý lỗi
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Express error handler:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  });

  return app.listen(5010, "0.0.0.0", () => {
    log(`serving on port 5000`);
  });
}