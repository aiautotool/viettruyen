import axios from "axios";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import { ApiKeyType, getPreferredKey, hasAvailableKey } from "./apiKeys";
import { exec } from "child_process";
import { promisify } from "util";
// Import edge-tts-node
import EdgeTTSNode from "edge-tts-node";
const { MsEdgeTTS } = EdgeTTSNode;

// Chuyển đổi exec sang promise
const execPromise = promisify(exec);

// Đặt đường dẫn cho ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath.path);

// Đảm bảo thư mục uploads tồn tại
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Đảm bảo thư mục tạm tồn tại
const tempDir = path.join(uploadsDir, "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Danh sách các giọng đọc tiếng Việt có sẵn
export const vietnameseVoices = [
  { value: "vi-VN-NamMinhNeural", label: "Nam Minh (Nam)" },
  { value: "vi-VN-HoaiMyNeural", label: "Hoài My (Nữ)" },
  { value: "vi-VN-ThanhTuNeural", label: "Thanh Tú (Nam trẻ)" },
  { value: "vi-VN-NgocHoangNeural", label: "Ngọc Hoàng (Nam trung niên)" }
];

// Giọng đọc mặc định
export const defaultVoice = "vi-VN-NamMinhNeural";

/**
 * Tạo audio từ text sử dụng edge-tts-node hoặc các phương pháp thay thế
 */
export async function generateAudio(text: string, voice: string = defaultVoice, speed: number = 1.0): Promise<string> {
  try {
    console.log(`Bắt đầu tạo audio... (giọng: ${voice}, tốc độ: ${speed})`);
    
    // Sử dụng API của aitoolseo.com như đã được cung cấp
    try {
      console.log("Sử dụng API của aitoolseo.com...");
      
      // URL API
      const apiUrl = `https://aitoolseo.com/api/voice`;
      
      // Chuẩn bị body request
      const requestData = {
        text: text,
        voice_name: voice,
        speed: speed,
        userId: 2 // Hardcoded ID như trong curl command
      };
      
      // Thiết lập headers như đã được cung cấp trong curl command
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:137.0) Gecko/20100101 Firefox/137.0',
        'Accept': '*/*',
        'Accept-Language': 'vi,en-US;q=0.7,en;q=0.3',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Referer': 'https://aitoolseo.com/voice-ads',
        'Content-Type': 'application/json',
        'Authorization': 'Bearer trinhnd19@gmail.com',
        'Origin': 'https://aitoolseo.com',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Priority': 'u=0'
      };
      
      // Thực hiện request với những headers cụ thể và responseType binary
      console.log("Gửi request đến API TTS:", apiUrl);
      const response = await axios.post(apiUrl, requestData, {
        headers: headers,
        responseType: 'arraybuffer', // Quan trọng để nhận dữ liệu binary
        timeout: 30000 // Giảm timeout xuống 30s
      });
      
      // Kiểm tra response
      // API trả về dữ liệu mp3 trực tiếp, không phải json
      if (!response.data) {
        console.log("Không nhận được dữ liệu audio từ API aitoolseo.com, chuyển sang phương pháp khác");
        throw new Error("Không nhận được dữ liệu audio từ API aitoolseo.com");
      }
      
      // Lấy dữ liệu audio từ response và chuyển sang base64
      // Response.data là Buffer hoặc ArrayBuffer khi nhận được binary data
      let base64Audio;
      if (Buffer.isBuffer(response.data)) {
        base64Audio = response.data.toString('base64');
      } else {
        // Nếu không phải Buffer, chuyển đổi thành Buffer và sau đó thành base64
        const buffer = Buffer.from(response.data);
        base64Audio = buffer.toString('base64');
      }
      
      console.log(`Đã nhận được audio từ API aitoolseo.com: ${base64Audio.substring(0, 50)}...`);
      
      return base64Audio;
    }
    catch (aitoolseoError) {
      console.error("Lỗi khi sử dụng API aitoolseo.com:", aitoolseoError);
      
      // Thử với API HTTP Edge TTS
      try {
        console.log("Thử sử dụng HTTP API của Edge TTS...");
        
        // URL API
        const apiUrl = `https://edgetts.aihub.wtf/api/tts`;
        
        // Thiết lập tốc độ đọc
        const rateString = speed > 1.0 ? `+${Math.round((speed - 1) * 100)}%` : speed < 1.0 ? `-${Math.round((1 - speed) * 100)}%` : "0%";
        
        // Chuẩn bị body request
        const requestData = {
          text: text,
          voice: voice,
          rate: rateString
        };
        
        // Thực hiện request
        console.log("Gửi request đến API Edge TTS:", apiUrl);
        const response = await axios.post(apiUrl, requestData, {
          timeout: 30000 // Giảm timeout xuống 30s
        });
        
        // Kiểm tra response
        if (!response.data || !response.data.audioContent) {
          console.log("Không nhận được dữ liệu audio từ API Edge TTS, chuyển sang phương pháp khác");
          throw new Error("Không nhận được dữ liệu audio từ API Edge TTS");
        }
        
        // Lấy dữ liệu audio base64 từ response
        const base64Audio = response.data.audioContent;
        console.log(`Đã nhận được audio base64 từ API Edge TTS: ${base64Audio.length} ký tự`);
        
        return base64Audio;
      } 
      catch (edgeTtsApiError) {
        console.error("Lỗi khi sử dụng Edge TTS API:", edgeTtsApiError);
        
        // Thử với Google TTS nếu có API key
        if (process.env.GOOGLE_API_KEY) {
          try {
            console.log("Thử sử dụng API Google Cloud Text-to-Speech...");
            
            // URL của Google Cloud TTS
            const googleUrl = `https://texttospeech.googleapis.com/v1/text:synthesize`;
            
            // Lấy API key
            const googleApiKey = process.env.GOOGLE_API_KEY;
            
            // Map giọng Edge TTS sang giọng Google
            let googleVoice = "vi-VN-Standard-A"; // Giọng mặc định
            if (voice.includes("Nam")) {
              googleVoice = "vi-VN-Standard-C"; // Giọng nam
            } else if (voice.includes("Hoai") || voice.includes("My")) {
              googleVoice = "vi-VN-Standard-A"; // Giọng nữ
            }
            
            // Chuẩn bị body request cho Google TTS
            const requestData = {
              input: { text: text },
              voice: { 
                languageCode: "vi-VN",
                name: googleVoice
              },
              audioConfig: { 
                audioEncoding: "MP3",
                speakingRate: speed
              }
            };
            
            // Thực hiện request
            console.log("Gửi request đến Google TTS API");
            const response = await axios.post(`${googleUrl}?key=${googleApiKey}`, requestData, {
              timeout: 30000 // Giảm timeout xuống 30s
            });
            
            // Kiểm tra response
            if (!response.data || !response.data.audioContent) {
              throw new Error("Không nhận được dữ liệu audio từ Google Text-to-Speech API");
            }
            
            console.log("Đã nhận được audio từ Google TTS");
            return response.data.audioContent;
          } 
          catch (googleTtsError: any) {
            console.error("Lỗi khi sử dụng Google TTS:", googleTtsError);
            throw new Error(`Lỗi Google TTS: ${googleTtsError.message || 'Lỗi không xác định'}`);
          }
        } else {
          // Tạo thông báo lỗi chi tiết nếu tất cả các API đều thất bại
          console.log("Tất cả các phương pháp tạo audio đều thất bại, trả về thông báo lỗi");
          
          throw new Error("Không thể kết nối đến bất kỳ dịch vụ TTS nào. Vui lòng thử lại sau.");
        }
      }
    }
  } 
  catch (error: any) {
    console.error("Lỗi khi tạo audio:", error);
    throw new Error(`Không thể tạo audio: ${error.message || 'Lỗi không xác định'}`);
  }
}

/**
 * Chuyển đổi Base64 audio thành file MP3 và trả về đường dẫn file
 */
export function saveAudioFile(base64Audio: string, fileName: string = ""): string {
  // Tạo buffer từ base64
  const buffer = Buffer.from(base64Audio, 'base64');
  
  // Tạo tên file nếu không được cung cấp
  const finalFileName = fileName || `audio_${Date.now()}.mp3`;
  const outputPath = path.join(uploadsDir, finalFileName);
  
  // Ghi file
  fs.writeFileSync(outputPath, buffer);
  
  return outputPath;
}

/**
 * Kiểm tra xem có thể tạo audio không
 */
export async function checkAudioGenerationAvailability(): Promise<boolean> {
  try {
    // Thực hiện một lệnh edge-tts đơn giản để kiểm tra
    await execPromise('npx edge-tts --version');
    return true;
  } catch (error: any) {
    console.warn("Edge TTS CLI không khả dụng:", error.message || "Lỗi không xác định");
    
    // Thử kiểm tra API proxy
    try {
      const testUrl = `https://edgetts.aihub.wtf/api/voices`;
      const response = await axios.get(testUrl, { timeout: 5000 });
      return true;
    } catch (fallbackError: any) {
      console.warn("API proxy cho TTS không khả dụng:", fallbackError.message || "Lỗi không xác định");
      return false;
    }
  }
}

/**
 * Lấy danh sách tất cả các giọng đọc từ Edge TTS
 */
export async function getAllVoices(): Promise<any[]> {
  try {
    // Thử lấy danh sách từ API proxy
    const response = await axios.get('https://edgetts.aihub.wtf/api/voices', { timeout: 5000 });
    if (response.data && Array.isArray(response.data)) {
      return response.data;
    }
    return vietnameseVoices;
  } catch (error) {
    console.error("Lỗi khi lấy danh sách giọng đọc:", error);
    return vietnameseVoices; // Trả về danh sách cố định nếu không thể lấy được từ API
  }
}

/**
 * Lấy danh sách các giọng đọc tiếng Việt
 */
export async function getVietnameseVoices(): Promise<any[]> {
  try {
    // Lấy tất cả giọng đọc
    const allVoices = await getAllVoices();
    
    // Lọc ra các giọng tiếng Việt
    const viVoices = allVoices.filter((voice: any) => 
      voice.Locale && voice.Locale.toLowerCase().includes('vi-vn')
    ).map((voice: any) => ({
      value: voice.ShortName,
      label: `${voice.FriendlyName} (${voice.Gender === 'Female' ? 'Nữ' : 'Nam'})`
    }));
    
    return viVoices.length > 0 ? viVoices : vietnameseVoices;
  } catch (error) {
    console.error("Lỗi khi lấy danh sách giọng đọc tiếng Việt:", error);
    return vietnameseVoices; // Trả về danh sách cố định nếu có lỗi
  }
}