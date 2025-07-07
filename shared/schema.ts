import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Interface định nghĩa một nhân vật trong truyện
export interface Character {
  name: string;
  description: string;
}

// Interface định nghĩa cấu trúc cốt truyện
export interface StoryOutline {
  title: string;
  characters: Character[];
  outline: string;
  estimatedReadingTime: string;
  mainScenes: string[];
}

// Interface định nghĩa cấu trúc truyện đầy đủ
export interface FullStory {
  title: string;
  content: string;
  podcastContent?: string; // Nội dung podcast bao gồm lời dẫn, thông tin kênh và truyện
  wordCount: number;
  readingTime: number;
}

// Interface định nghĩa cấu trúc phân cảnh
export interface Scene {
  text: string;
  promptanh: string;
}

// Interface định nghĩa yêu cầu tạo truyện
export interface GenerateRequest {
  genre: string;
  topic: string;
  readingTime?: string;
}

// Interface định nghĩa yêu cầu tạo truyện đầy đủ
export interface GenerateFullStoryRequest {
  outline: StoryOutline;
  genre: string;
  characterEdits?: string;
  channelInfo?: string;
  introduction?: string;
}

// Interface định nghĩa yêu cầu tạo phân cảnh
export interface GenerateScenesRequest {
  genre: string;
  topic?: string;
  story?: FullStory;
  sceneCount?: number;
}

// Interface định nghĩa yêu cầu tạo ảnh
export interface ImageRequest {
  prompt: string;
}

// Interface định nghĩa phản hồi tạo ảnh
export interface ImageResponse {
  image: string;
}

export enum ApiKeyType {
  GEMINI = 'gemini',
  OPENAI = 'openai'
}

export interface KeyStatus {
  [ApiKeyType.GEMINI]: boolean;
  [ApiKeyType.OPENAI]: boolean;
}

export interface SetKeyRequest {
  type: ApiKeyType;
  key: string;
}

export interface ApiResponse {
  success: boolean;
  message: string;
}
