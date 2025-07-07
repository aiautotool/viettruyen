import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs/promises";
import { OpenAI } from "openai";
import { getPreferredKey, ApiKeyType } from "./apiKeys";

/**
 * Analyzes an image and extracts the content
 */
export async function analyzeImage(imagePath: string): Promise<{
  description: string;
  subject: string;
  model: string;
}> {
  try {
    // Get Gemini API key
    const GEMINI_API_KEY = getPreferredKey(ApiKeyType.GEMINI);
    if (!GEMINI_API_KEY) {
      throw new Error(
        "Không có Gemini API key. Vui lòng cung cấp API key để sử dụng tính năng này.",
      );
    }

    // Try Google Generative AI first
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const imageData = await fs.readFile(imagePath);

      const prompt =
        "Trích suất toàn bộ nội dung text trong hình ảnh sau, đặc biệt tập trung vào chủ đề chính và tạo thành chủ đề để viết truyện " +
        "Trả về phân tích của bạn dưới dạng đối tượng JSON với các trường sau: " +
        '{ "description": "nội dung đầy đủ", "subject": "chủ đề" }';

      const parts = [
        { text: prompt },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: imageData.toString("base64"),
          },
        },
      ];

      const result = await model.generateContent(parts);

      const response = await result.response;
      const text = response.text();

      // Extract JSON from the response
      let jsonMatch =
        text.match(/```json\s*([\s\S]*?)\s*```/) ||
        text.match(/```\s*([\s\S]*?)\s*```/) ||
        text.match(/(\{[\s\S]*\})/);

      let parsedResponse;
      if (jsonMatch && jsonMatch[1]) {
        parsedResponse = JSON.parse(jsonMatch[1]);
      } else {
        try {
          // Try to parse the entire response as JSON
          parsedResponse = JSON.parse(text);
        } catch {
          // If not valid JSON, return the text as description with default subject
          return {
            description: text,
            subject: "Other",
            model: "Google Generative AI",
          };
        }
      }

      return {
        description: parsedResponse.description || text,
        subject: parsedResponse.subject || "Other",
        model: "Google Generative AI",
      };
    } catch (googleError) {
      console.log("Google AI failed, falling back to OpenAI:", googleError);

      // Get OpenAI API key
      const OPENAI_API_KEY = getPreferredKey(ApiKeyType.OPENAI);
      if (!OPENAI_API_KEY) {
        throw new Error(
          "Không có OpenAI API key và Gemini API không khả dụng.",
        );
      }

      // Fallback to OpenAI
      const imageData = await fs.readFile(imagePath);
      const base64Image = imageData.toString("base64");

      const openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Trích suất toàn bộ nội dung text trong hình ảnh sau, đặc biệt tập trung vào chủ đề chính: " +
                  "Trả về phân tích của bạn dưới dạng đối tượng JSON với các trường sau: " +
                  '{ "description": "nội dung đầy đủ", "subject": "chủ đề" }',
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content || "{}";
      let parsedContent;

      try {
        parsedContent = JSON.parse(content);
      } catch (e) {
        parsedContent = {
          description: "Không thể phân tích hình ảnh",
          subject: "Other",
        };
      }

      return {
        description:
          parsedContent.description || "Không thể phân tích hình ảnh",
        subject: parsedContent.subject || "Other",
        model: "OpenAI",
      };
    }
  } catch (error) {
    console.error("Error analyzing image:", error);
    throw error;
  }
}
