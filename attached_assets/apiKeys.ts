import fs from 'fs';
import path from 'path';

// Các loại API keys hỗ trợ
export enum ApiKeyType {
  GEMINI = 'gemini',
  OPENAI = 'openai'
}

// Cấu hình mặc định
const API_KEY_FILE = path.join(process.cwd(), 'apikey.txt');
const DEFAULT_OPENAI_KEY = process.env.OPENAI_API_KEY;

// Hàm đọc file chứa danh sách API keys Gemini
export function readGeminiKeysFromFile(): string[] {
  try {
    if (fs.existsSync(API_KEY_FILE)) {
      const content = fs.readFileSync(API_KEY_FILE, 'utf-8');
      const keys = content.split('\n')
        .map(key => key.trim())
        .filter(key => key.length > 0);
      
      return keys;
    }
  } catch (error) {
    console.error('Lỗi khi đọc file API keys:', error);
  }
  return [];
}

// Hàm lấy một API key Gemini ngẫu nhiên từ danh sách
export function getRandomGeminiKey(): string | null {
  const keys = readGeminiKeysFromFile();
  
  if (keys.length === 0) {
    return null;
  }
  
  const randomIndex = Math.floor(Math.random() * keys.length);
  return keys[randomIndex];
}

// Hàm lấy API key OpenAI
export function getOpenAIKey(): string | null {
  return DEFAULT_OPENAI_KEY || null;
}

// Lưu trữ key do người dùng nhập (session storage)
const userProvidedKeys: Record<ApiKeyType, string | null> = {
  [ApiKeyType.GEMINI]: null,
  [ApiKeyType.OPENAI]: null
};

// Thiết lập key do người dùng cung cấp
export function setUserProvidedKey(type: ApiKeyType, key: string): void {
  userProvidedKeys[type] = key;
}

// Lấy key được ưu tiên (user provided > gemini > openai)
export function getPreferredKey(type: ApiKeyType): string | null {
  // Ưu tiên key do người dùng cung cấp
  if (userProvidedKeys[type]) {
    return userProvidedKeys[type];
  }
  
  // Đối với Gemini, thử lấy key từ file
  if (type === ApiKeyType.GEMINI) {
    return getRandomGeminiKey();
  }
  
  // Đối với OpenAI, sử dụng key từ biến môi trường
  if (type === ApiKeyType.OPENAI) {
    return getOpenAIKey();
  }
  
  return null;
}

// Kiểm tra xem có sẵn key nào hay không
export function hasAvailableKey(type: ApiKeyType): boolean {
  return getPreferredKey(type) !== null;
}

// Trả về trạng thái các loại key
export function getKeyStatus(): Record<ApiKeyType, boolean> {
  return {
    [ApiKeyType.GEMINI]: hasAvailableKey(ApiKeyType.GEMINI),
    [ApiKeyType.OPENAI]: hasAvailableKey(ApiKeyType.OPENAI)
  };
}