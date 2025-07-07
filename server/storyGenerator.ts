import axios from "axios";
import { ApiKeyType, getPreferredKey, hasAvailableKey } from "./apiKeys";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";
// Import interface từ shared/schema
import {
  ApiKeyType as SchemaApiKeyType,
  StoryOutline,
  FullStory,
  Scene,
} from "@shared/schema";
// OpenAI đã được loại bỏ theo yêu cầu

const AIAUTOTOOL_API = "https://n8n.aiautotool.com/webhook/chatgpt4o";
const AIAUTOTOOL_IMAGE_API = "https://n8n.aiautotool.com/webhook/image?prompt=";

/**
 * Gọi API với n8n.aiautotool.com
 */
async function callExternalAPI(
  prompt: string,
  language: string = "vi",
): Promise<string> {
  try {
    console.log("Calling AI Auto Tool API...");

    // Thêm chỉ định ngôn ngữ vào prompt
    prompt =
      prompt +
      `,output trả về bằng ${language === "vi" ? "tiếng Việt" : "English"}.`;

    // Cấu hình retry và timeout
    const MAX_RETRIES = 2;
    const TIMEOUT = 60000; // 60 giây

    let retries = 0;
    let lastError = null;

    while (retries <= MAX_RETRIES) {
      try {
        // Thử cách 1: Sử dụng POST thay vì GET
        console.log(`Thử lần ${retries + 1} với phương thức POST...`);
        const response = await axios.post(
          "https://n8n.aiautotool.com/webhook/chatgptpost",
          { prompt },
          {
            timeout: TIMEOUT,
            headers: { "Content-Type": "application/json" },
          },
        );
        return response.data;
      } catch (error) {
        const retryError = error as Error;
        console.log(`Thử lần ${retries + 1} thất bại:`, retryError.message);

        // Thử cách 2: Sử dụng GET với tham số trong URL
        try {
          console.log(`Thử lần ${retries + 1} với phương thức GET...`);
          const encodedPrompt = encodeURIComponent(prompt);
          const url = `${AIAUTOTOOL_API}?prompt=${encodedPrompt}`;

          const response = await axios.get(url, { timeout: TIMEOUT });
          return response.data;
        } catch (getError) {
          lastError = getError;
          retries++;
          // Chờ trước khi thử lại
          if (retries <= MAX_RETRIES) {
            const delay = retries * 1000; // Tăng thời gian chờ mỗi lần thử
            console.log(`Chờ ${delay}ms trước khi thử lại...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }
    }

    throw lastError;
  } catch (error) {
    console.error("Error with External API:", error);
    throw new Error(
      `Lỗi khi sử dụng External API: ${error instanceof Error ? error.message : "Lỗi không xác định"}`,
    );
  }
}

/**
 * Tạo nội dung sử dụng Google Generative AI (Gemini)
 */
async function callGeminiAPI(prompt: string, apiKey: string): Promise<string> {
  try {
    console.log("Generating with Gemini...");
    const genAI = new GoogleGenerativeAI(apiKey);

    // Cập nhật: Thử với các version và model khác nhau
    let models = [
      { model: "gemini-pro", version: "v1" }, // Version mới nhất
      { model: "gemini-1.5-pro", version: "v1" }, // Model mới nhất
      { model: "gemini-1.5-flash", version: "v1" }, // Model nhanh
      { model: "gemini-pro", version: "v1beta" }, // Version cũ
    ];

    let lastError = null;

    // Thử từng model cho đến khi thành công
    for (const { model, version } of models) {
      try {
        console.log(`Thử với model: ${model}, version: ${version}`);
        // Cập nhật URL API nếu cần
        const modelObj = genAI.getGenerativeModel({
          model,
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
        });

        const result = await modelObj.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log(`Thành công với model: ${model}, version: ${version}`);
        return text;
      } catch (error) {
        const modelError = error as Error;
        console.log(
          `Lỗi với model ${model}, version ${version}:`,
          modelError.message,
        );
        lastError = modelError;
        // Tiếp tục thử model tiếp theo
      }
    }

    // Nếu tất cả đều không thành công, throw lỗi cuối cùng
    throw lastError;
  } catch (error) {
    console.error("Error with all Gemini API models:", error);
    throw new Error(
      `Lỗi khi sử dụng Gemini API: ${error instanceof Error ? error.message : "Lỗi không xác định"}`,
    );
  }
}

/**
 * Không sử dụng OpenAI API theo yêu cầu
 * Đã bị loại bỏ theo yêu cầu: "Ưu tiên API n8n, sau đó là Gemini, không dùng OpenAI"
 */

/**
 * Trích xuất JSON từ response text
 */
function extractJson(text: any): any {
  console.log("Raw response:", text);

  // Xử lý nếu response là một object
  if (typeof text === "object" && text !== null) {
    // Nếu có thuộc tính content, sử dụng nó
    if (text.content) {
      text = text.content;
    } else {
      // Nếu là object nhưng không có content, chuyển đổi thành string
      try {
        text = JSON.stringify(text);
      } catch (e) {
        console.error("Lỗi khi chuyển đổi object thành JSON string:", e);
        throw new Error("Dữ liệu không hợp lệ");
      }
    }
  }

  // Đảm bảo text là string
  if (typeof text !== "string") {
    text = String(text);
  }

  // Xử lý chuỗi để loại bỏ các ký tự không mong muốn
  let cleanText = text.replace(/```json|```/g, "").trim();

  // Trường hợp đặc biệt: Phản hồi array có dấu phẩy cuối cùng
  cleanText = cleanText.replace(/,(\s*[\]}])/g, "$1");

  // Trường hợp đặc biệt: Phản hồi có ký tự không mong muốn sau JSON
  const jsonObjectEndPos = cleanText.lastIndexOf("}");
  const jsonArrayEndPos = cleanText.lastIndexOf("]");

  if (jsonObjectEndPos > 0 && jsonObjectEndPos < cleanText.length - 1) {
    cleanText = cleanText.substring(0, jsonObjectEndPos + 1);
  } else if (jsonArrayEndPos > 0 && jsonArrayEndPos < cleanText.length - 1) {
    cleanText = cleanText.substring(0, jsonArrayEndPos + 1);
  }

  // Thử tìm và trích xuất JSON
  try {
    // Thử parse trực tiếp
    try {
      return JSON.parse(cleanText);
    } catch (directParseError) {
      console.log("Không thể parse trực tiếp, thử phương pháp khác");
    }

    // Xử lý đặc biệt cho StoryOutline
    if (
      cleanText.includes('"title"') &&
      cleanText.includes('"characters"') &&
      cleanText.includes('"outline"') &&
      cleanText.includes('"mainScenes"')
    ) {
      try {
        // Tìm các thành phần của cốt truyện
        const titleMatch = cleanText.match(/"title"\s*:\s*"([^"]+)"/);
        const outlineMatch = cleanText.match(/"outline"\s*:\s*"([^"]+)"/);
        const readingTimeMatch = cleanText.match(
          /"estimatedReadingTime"\s*:\s*"?(\d+)"?/,
        );

        // Khởi tạo đối tượng cốt truyện
        const storyOutline: StoryOutline = {
          title: titleMatch ? titleMatch[1] : "Truyện không tên",
          characters: [],
          outline: outlineMatch
            ? outlineMatch[1]
            : "Nội dung truyện đang được xử lý...",
          estimatedReadingTime: readingTimeMatch ? readingTimeMatch[1] : "15",
          mainScenes: [],
        };

        // Tìm và xử lý nhân vật
        const characterPattern =
          /"name"\s*:\s*"([^"]+)"\s*,\s*"description"\s*:\s*"([^"]+)"/g;
        let characterMatch;
        while ((characterMatch = characterPattern.exec(cleanText)) !== null) {
          storyOutline.characters.push({
            name: characterMatch[1],
            description: characterMatch[2],
          });
        }

        // Nếu không tìm thấy nhân vật, thử phương pháp khác
        if (storyOutline.characters.length === 0) {
          // Tìm đoạn characters array
          const charactersStart = cleanText.indexOf('"characters"');
          const charactersEnd = cleanText.indexOf('"outline"');

          if (charactersStart !== -1 && charactersEnd !== -1) {
            const charactersText = cleanText.substring(
              charactersStart,
              charactersEnd,
            );

            // Tìm tên
            const nameMatches = charactersText.match(/"name"\s*:\s*"([^"]+)"/g);
            const descMatches = charactersText.match(
              /"description"\s*:\s*"([^"]+)"/g,
            );

            if (
              nameMatches &&
              descMatches &&
              nameMatches.length === descMatches.length
            ) {
              for (let i = 0; i < nameMatches.length; i++) {
                const name = nameMatches[i].match(/"name"\s*:\s*"([^"]+)"/)[1];
                const desc = descMatches[i].match(
                  /"description"\s*:\s*"([^"]+)"/,
                )[1];

                storyOutline.characters.push({ name, description: desc });
              }
            }
          }
        }

        // Tìm và xử lý cảnh chính
        const mainScenesStart = cleanText.indexOf('"mainScenes"');
        if (mainScenesStart !== -1) {
          const mainScenesText = cleanText.substring(mainScenesStart);
          const scenesPattern = /"([^"]{10,})"/g; // Mô tả cảnh thường dài hơn 10 ký tự
          let sceneMatch;
          let foundFirstTag = false;

          while ((sceneMatch = scenesPattern.exec(mainScenesText)) !== null) {
            // Bỏ qua tag "mainScenes"
            if (!foundFirstTag) {
              if (sceneMatch[1] === "mainScenes") {
                foundFirstTag = true;
                continue;
              }
              // Nếu không phải tag mainScenes và chưa tìm thấy tag đó, bỏ qua
              if (!sceneMatch[1].includes("mainScenes")) {
                continue;
              }
              foundFirstTag = true;
            }

            // Thêm cảnh nếu là một mô tả hợp lệ (đủ dài)
            if (sceneMatch[1].length > 15) {
              storyOutline.mainScenes.push(sceneMatch[1]);
            }
          }
        }

        // Kiểm tra tính hợp lệ của cốt truyện
        if (
          storyOutline.title &&
          storyOutline.outline &&
          storyOutline.characters.length > 0 &&
          storyOutline.mainScenes.length > 0
        ) {
          console.log("Đã trích xuất thành công cốt truyện:", storyOutline);
          return storyOutline;
        }
      } catch (outlineError) {
        console.error("Lỗi khi tạo cốt truyện:", outlineError);
      }
    }

    // Phương pháp 1: Tìm JSON array
    if (cleanText.includes("[") && cleanText.includes("]")) {
      const jsonRegex = /\[([\s\S]*)\]/;
      const match = cleanText.match(jsonRegex);
      if (match && match[0]) {
        let jsonArray = match[0];
        // Kiểm tra và sửa lỗi phổ biến
        jsonArray = jsonArray.replace(/,(\s*[\]}])/g, "$1");
        return JSON.parse(jsonArray);
      }
    }

    // Phương pháp 2: Tìm JSON object
    if (cleanText.includes("{") && cleanText.includes("}")) {
      const jsonRegex = /\{([\s\S]*)\}/;
      const match = cleanText.match(jsonRegex);
      if (match && match[0]) {
        let jsonObj = match[0];
        // Kiểm tra và sửa lỗi phổ biến
        jsonObj = jsonObj.replace(/,(\s*[\]}])/g, "$1");
        try {
          return JSON.parse(jsonObj);
        } catch (objParseError) {
          // Thêm xử lý đặc biệt cho chuỗi JSON bị hỏng
          jsonObj = jsonObj
            .replace(/,\s*}/g, "}") // Xóa dấu phẩy thừa trước dấu đóng
            .replace(/,\s*]/g, "]") // Xóa dấu phẩy thừa trước dấu đóng mảng
            .replace(/:\s*"([^"]*)"\s*([,}])/g, ':"$1"$2') // Chuẩn hóa chuỗi
            .replace(/:\s*'([^']*)'\s*([,}])/g, ':"$1"$2'); // Thay dấu nháy đơn bằng nháy kép

          return JSON.parse(jsonObj);
        }
      }
    }

    throw new Error("Không tìm thấy cấu trúc JSON hợp lệ");
  } catch (parseError) {
    console.error("JSON Parse Error:", parseError);

    // Phương pháp dự phòng: Xử lý kỹ lưỡng hơn
    try {
      // Xóa khoảng trắng, xuống dòng
      const content = cleanText.replace(/[\n\r\t]+/g, " ").trim();

      // Phát hiện trực tiếp các thành phần của StoryOutline
      if (
        content.includes('"title":') &&
        content.includes('"outline":') &&
        content.includes('"characters":')
      ) {
        // Tìm và trích xuất tiêu đề
        let title = extractValue(content, '"title":', /[,}]/);
        const outline = extractValue(content, '"outline":', /[,}]/);
        const estimatedReadingTime =
          extractValue(content, '"estimatedReadingTime":', /[,}]/) || "15";

        if (!title) {
          // Thử phương pháp khác để lấy tiêu đề
          const titleMatch = content.match(/"title"\s*:\s*"([^"]+)"/);
          if (titleMatch) title = titleMatch[1];
        }

        // Khởi tạo đối tượng cốt truyện
        const storyOutline: StoryOutline = {
          title: title || "Truyện không tên",
          characters: [],
          outline: outline || "Nội dung truyện đang được xử lý...",
          estimatedReadingTime: estimatedReadingTime,
          mainScenes: [],
        };

        // Tìm và xử lý nhân vật
        const charSection = content.substring(
          content.indexOf('"characters":'),
          content.indexOf('"outline":'),
        );

        const nameMatches = charSection.match(/"name"\s*:\s*"([^"]+)"/g);
        const descMatches = charSection.match(/"description"\s*:\s*"([^"]+)"/g);

        if (nameMatches && descMatches) {
          for (
            let i = 0;
            i < Math.min(nameMatches.length, descMatches.length);
            i++
          ) {
            const nameMatch = nameMatches[i].match(/"name"\s*:\s*"([^"]+)"/);
            const descMatch = descMatches[i].match(
              /"description"\s*:\s*"([^"]+)"/,
            );

            if (nameMatch && descMatch) {
              storyOutline.characters.push({
                name: nameMatch[1],
                description: descMatch[1],
              });
            }
          }
        }

        // Tìm và xử lý cảnh chính
        if (content.includes('"mainScenes":')) {
          const scenesSection = content.substring(
            content.indexOf('"mainScenes":'),
          );
          const sceneMatches = scenesSection.match(/"([^"]{15,})"/g); // Mô tả cảnh thường dài

          if (sceneMatches && sceneMatches.length > 1) {
            // Bỏ qua tag "mainScenes"
            for (let i = 1; i < sceneMatches.length; i++) {
              const scene = sceneMatches[i].replace(/^"|"$/g, "");
              storyOutline.mainScenes.push(scene);
            }
          }
        }

        // Kiểm tra tính hợp lệ của cốt truyện
        if (
          storyOutline.title &&
          storyOutline.outline &&
          storyOutline.characters.length > 0 &&
          storyOutline.mainScenes.length > 0
        ) {
          console.log(
            "Đã trích xuất thành công cốt truyện (phương pháp dự phòng):",
            storyOutline,
          );
          return storyOutline;
        }
      }

      // Tìm mảng JSON
      if (content.includes("[") && content.includes("]")) {
        const startIdx = content.indexOf("[");
        const endIdx = content.lastIndexOf("]") + 1;

        if (startIdx < endIdx) {
          const jsonArrayText = content.substring(startIdx, endIdx);

          // Làm sạch và chuẩn hóa chuỗi JSON
          const normalizedJson = jsonArrayText
            .replace(/\\n/g, " ") // Thay newlines bằng khoảng trắng
            .replace(/\\"/g, '"') // Xử lý escaped quotes
            .replace(/",\s*}/g, '"}') // Xóa dấu phẩy trước dấu đóng object
            .replace(/",\s*]/g, '"]') // Xóa dấu phẩy trước dấu đóng array
            .replace(/([^\\])"/g, '$1"') // Chuẩn hóa quotes
            .replace(/^"/, '"') // Chuẩn hóa quote đầu dòng
            .replace(/([a-zA-Z0-9])"/g, '$1"') // Chuẩn hóa quotes sau text
            .replace(/",\s*,/g, '",') // Sửa dấu phẩy trùng lặp
            .replace(/\]\s*,\s*\]/g, "]]"); // Sửa dấu phẩy cuối mảng trong mảng

          console.log("Normalized JSON array:", normalizedJson);
          return JSON.parse(normalizedJson);
        }
      }

      // Tìm đối tượng JSON
      if (content.includes("{") && content.includes("}")) {
        const startIdx = content.indexOf("{");
        const endIdx = content.lastIndexOf("}") + 1;

        if (startIdx < endIdx) {
          const jsonObjectText = content.substring(startIdx, endIdx);

          // Làm sạch và chuẩn hóa chuỗi JSON
          const normalizedJson = jsonObjectText
            .replace(/\\n/g, " ") // Thay newlines bằng khoảng trắng
            .replace(/\\"/g, '"') // Xử lý escaped quotes
            .replace(/",\s*}/g, '"}') // Xóa dấu phẩy trước dấu đóng object
            .replace(/",\s*]/g, '"]') // Xóa dấu phẩy trước dấu đóng array
            .replace(/([^\\])"/g, '$1"') // Chuẩn hóa quotes
            .replace(/^"/, '"') // Chuẩn hóa quote đầu dòng
            .replace(/([a-zA-Z0-9])"/g, '$1"') // Chuẩn hóa quotes sau text
            .replace(/",\s*,/g, '",') // Sửa dấu phẩy trùng lặp
            .replace(/}\s*,\s*}/g, "}}"); // Sửa dấu phẩy cuối object trong object

          console.log("Normalized JSON object:", normalizedJson);
          return JSON.parse(normalizedJson);
        }
      }
    } catch (altError) {
      console.error("Alternative JSON Parse Error:", altError);
    }

    // Thử đoán cấu trúc và tự tạo JSON
    if (cleanText.includes('"text":') && cleanText.includes('"promptanh":')) {
      try {
        // Trường hợp đặc biệt cho mảng scenes với phương pháp đơn giản
        const scenes = [];

        // Tìm tất cả các khối text
        const textBlocks = [];
        const textRegex = /"text":\s*"([^"]+)"/g;
        let textMatch;
        while ((textMatch = textRegex.exec(cleanText)) !== null) {
          textBlocks.push(textMatch[1]);
        }

        // Tìm tất cả các khối promptanh
        const promptBlocks = [];
        const promptRegex = /"promptanh":\s*"([^"]+)"/g;
        let promptMatch;
        while ((promptMatch = promptRegex.exec(cleanText)) !== null) {
          promptBlocks.push(promptMatch[1]);
        }

        // Nếu có cùng số lượng text và prompt, tạo scene
        if (
          textBlocks.length === promptBlocks.length &&
          textBlocks.length > 0
        ) {
          for (let i = 0; i < textBlocks.length; i++) {
            scenes.push({
              text: textBlocks[i],
              promptanh: promptBlocks[i],
            });
          }

          if (scenes.length > 0) {
            console.log(
              "Đã trích xuất thành công phân cảnh:",
              scenes.length,
              "cảnh",
            );
            return scenes;
          }
        }
      } catch (ex) {
        console.error("Scene extraction error:", ex);
      }
    }

    throw new Error("Không thể phân tích JSON từ phản hồi sau nhiều lần thử");
  }
}

// Hàm tiện ích để trích xuất giá trị từ chuỗi JSON
function extractValue(
  text: string,
  marker: string,
  endRegex: RegExp,
): string | null {
  if (!text.includes(marker)) return null;

  const startPos = text.indexOf(marker) + marker.length;
  const endMatch = text.substring(startPos).match(endRegex);

  // TypeScript's RegExpMatchArray.index is non-null when match is found
  const endPos =
    endMatch && typeof endMatch.index === "number"
      ? startPos + endMatch.index
      : text.length;

  let value = text.substring(startPos, endPos).trim();

  // Loại bỏ dấu ngoặc kép nếu có
  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.substring(1, value.length - 1);
  }

  return value;
}

/**
 * Tạo nội dung sử dụng thứ tự ưu tiên các API
 */
export async function generateContent(prompt: string): Promise<string> {
  try {
    // Kiểm tra API Gemini nếu query yêu cầu kiểm tra
    if (
      prompt.toLowerCase().includes("test_gemini") ||
      prompt.toLowerCase().includes("kiểm_tra_gemini")
    ) {
      console.log("Bắt buộc kiểm tra Gemini API theo yêu cầu");

      if (hasAvailableKey(ApiKeyType.GEMINI)) {
        const geminiKey = getPreferredKey(ApiKeyType.GEMINI);
        return await callGeminiAPI(prompt, geminiKey as string);
      } else {
        throw new Error("Không có API key Gemini");
      }
    }

    // Ưu tiên sử dụng API bên ngoài (mặc định)
    return await callExternalAPI(prompt);
  } catch (externalError) {
    console.log(
      "Lỗi khi sử dụng API bên ngoài, thử dùng Gemini:",
      externalError,
    );

    // Sử dụng Gemini nếu API bên ngoài có lỗi
    if (hasAvailableKey(ApiKeyType.GEMINI)) {
      const geminiKey = getPreferredKey(ApiKeyType.GEMINI);
      return await callGeminiAPI(prompt, geminiKey as string);
    }

    // Không sử dụng OpenAI theo yêu cầu
    throw new Error(
      "Không có API khả dụng. Vui lòng kiểm tra kết nối đến n8n.aiautotool.com hoặc cung cấp Gemini API key",
    );
  }
}

/**
 * Tạo cốt truyện
 */
export async function generateStoryOutline(
  genre: string,
  topic: string,
  readingTime?: string,
  channelInfo?: string,
  introduction?: string,
): Promise<StoryOutline> {
  const timeInstruction = readingTime
    ? `Tạo một cốt truyện với độ dài phù hợp để đọc trong khoảng ${readingTime} phút.`
    : "Tạo một cốt truyện ngắn gọn, súc tích.";

  // Xử lý thông tin kênh và lời dẫn nếu có
  let channelInfoText = "";
  if (channelInfo && channelInfo.trim()) {
    channelInfoText = `\n\nThông tin kênh: "${channelInfo}"`;
  }

  let introductionText = "";
  if (introduction && introduction.trim()) {
    introductionText = `\n\nLời dẫn truyện: "${introduction}"`;
  }

  const prompt = `Bạn là một nhà biên kịch chuyên Viết kịch bản podcast kể chuyện theo phong cách tâm linh – trầm lắng, huyền bí, giàu cảm xúc.  ${genre}. ${timeInstruction}
Hãy tạo một cốt truyện tự nhiên, cuốn hút, phong cách kể chuyện giống con người, lời thoại giữa các nhân vật nên sử dụng ngôn ngữ miền tây. dựa trên chủ đề: "${topic}".${channelInfoText}${introductionText}

QUAN TRỌNG: 
1. Hãy đảm bảo phong cách và nội dung của cốt truyện phải thể hiện rõ chất và đặc trưng của thể loại ${genre}. 
Cụ thể:
- Nếu là thể loại kinh dị: tạo bầu không khí rùng rợn, căng thẳng, yếu tố siêu nhiên hoặc tâm lý ám ảnh
- Nếu là thể loại tình cảm: tập trung vào mối quan hệ, cảm xúc và xung đột tình cảm giữa các nhân vật
- Nếu là thể loại hành động: tạo nhiều cảnh đối đầu, rượt đuổi, đánh đấm, tình huống nguy hiểm
- Nếu là thể loại viễn tưởng: xây dựng thế giới với công nghệ tiên tiến hoặc khả năng siêu nhiên, sáng tạo
- Nếu là thể loại phiêu lưu: tạo hành trình khám phá, trải nghiệm mới lạ, thử thách phải vượt qua
- Nếu là thể loại hài hước: sử dụng tình huống hài, gây cười, nhân vật duyên dáng
- Nếu là thể loại giả tưởng: bao gồm sinh vật huyền bí, phép thuật, thế giới khác thường

2. KHÔNG tạo nhân vật chính là nhà văn, nhà biên kịch, hay người làm trong lĩnh vực viết lách. Thay vào đó, hãy tạo nhân vật với nghề nghiệp đa dạng và phù hợp với thể loại truyện, ví dụ:
- Kinh dị: sinh viên, học sinh, bán vé số, người già, bán online, lập trình viên..., bác sĩ, giáo viên, nhà khảo cổ, nhân viên bảo tàng...
- Tình cảm: đầu bếp, luật sư, kỹ sư, họa sĩ, nhạc sĩ, y tá...
- Hành động: cảnh sát, quân nhân, vận động viên, thợ săn tiền thưởng, bảo vệ...
- Viễn tưởng: nhà khoa học, kỹ sư, phi hành gia, bác sĩ, sinh viên...
- Phiêu lưu: nhà thám hiểm, nhà khảo cổ, phi công, thủy thủ, hướng dẫn viên du lịch...
- Hài hước: nhân viên văn phòng, giáo viên, đầu bếp, nhân viên bán hàng...
- Giả tưởng: thợ rèn, hiệp sĩ, thầy phù thủy, thương nhân, thợ săn...

Kết quả trả về dưới dạng JSON với cấu trúc:
{
  "title": "Tiêu đề truyện",
  "characters": [
    {"name": "Tên nhân vật 1", "description": "Mô tả ngắn về nhân vật"},
    {"name": "Tên nhân vật 2", "description": "Mô tả ngắn về nhân vật"}
  ],
  "outline": "Tóm tắt cốt truyện chi tiết, bao gồm bối cảnh, xung đột và kết thúc",
  "estimatedReadingTime": "Ước tính thời gian đọc (phút)",
  "mainScenes": [
    "Mô tả ngắn về cảnh 1",
    "Mô tả ngắn về cảnh 2"
  ]
}`;

  const result = await generateContent(prompt);
  return extractJson(result) as StoryOutline;
}

/**
 * Tạo truyện đầy đủ từ cốt truyện (phiên bản tách riêng việc tạo truyện và podcast)
 */
export async function generateFullStory(
  outline: StoryOutline,
  genre: string,
  characterEdits?: string,
  channelInfo?: string,
  introduction?: string,
): Promise<FullStory> {
  try {
    // Bước 1: Tạo nội dung truyện thuần túy
    const storyContent = await generateStoryContent(
      outline,
      genre,
      characterEdits,
    );

    // Bước 2: Luôn tạo nội dung podcast - nếu không có thông tin kênh hoặc lời dẫn, sẽ dùng thông tin mặc định
    // Dùng AI để tự tạo dựa vào input đầu vào của truyện
    const podcastContent = await generatePodcastContent(
      storyContent.title,
      storyContent.content,
      genre,
      channelInfo ||
        `Kênh Truyện Ma Online - Những câu chuyện ${genre} hấp dẫn`,
      introduction ||
        `Hôm nay chúng ta sẽ khám phá một câu chuyện ${genre} đặc sắc với tựa đề "${storyContent.title}"`,
    );

    // Kết hợp kết quả
    return {
      title: storyContent.title,
      content: storyContent.content,
      podcastContent: podcastContent,
      wordCount: storyContent.wordCount,
      readingTime: storyContent.readingTime,
    };
  } catch (error) {
    console.error("Lỗi khi tạo truyện đầy đủ:", error);
    throw new Error(
      "Không thể tạo truyện đầy đủ: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * Tạo nội dung truyện thuần túy
 */
async function generateStoryContent(
  outline: StoryOutline,
  genre: string,
  characterEdits?: string,
): Promise<FullStory> {
  // Tính số từ cần thiết dựa trên thời gian đọc
  // Trung bình người đọc 200-250 từ/phút
  const targetReadingTime = Number(outline.estimatedReadingTime) || 15;
  const targetWordCount = targetReadingTime * 250; // Tăng lên 250 từ/phút để có nội dung dài hơn

  const prompt = `Bạn là một nhà văn chuyên viết truyện ${genre}. Viết kịch bản podcast kể chuyện theo phong cách tâm linh – trầm lắng, huyền bí, giàu cảm xúc. Dựa trên đoạn nội dung sau, hãy sáng tạo thành một câu chuyện hoàn chỉnh có mở bài dẫn dắt, cao trào và kết bài rút ra thông điệp sâu sắc. Giọng kể chậm, nhẹ.  Kết hợp yếu tố logic tâm linh nếu có.  Văn phong tự nhiên, sống động, hấp dẫn. Hãy viết một câu chuyện đầy đủ dựa trên outline sau:
${JSON.stringify(outline, null, 2)}

${characterEdits ? "Lưu ý có những thay đổi về nhân vật: " + characterEdits : ""}

HƯỚNG DẪN QUAN TRỌNG:

1. Chiều dài: Câu chuyện phải có độ dài ${targetWordCount} từ để đảm bảo thời gian đọc khoảng ${targetReadingTime} phút.

2. Phong cách viết:
   - Văn phong tự nhiên, sống động, giống con người
   - Tránh lặp từ, thêm chi tiết cảm xúc tự nhiên
   - Cuốn hút, tình tiết logic, kịch tính hợp lý

3. Đối thoại nhân vật:
   - LỜI THOẠI GIỮA CÁC NHÂN VẬT PHẢI SỬ DỤNG NGÔN NGỮ MIỀN TÂY NAM BỘ
   - Thay vì "tôi, bạn, anh, chị" hãy dùng "tui, bạn, anh, chị", thay "thế này, thế kia" bằng "dzậy nè, dzậy đó"
   - Thêm các từ địa phương như "nẫu" (giận), "nhỏ, tía, má, bự, dà, trỏng, ngoài đó, trong này"
   - Dùng từ "hen" cuối câu để thể hiện sự đồng ý, như "Đi chơi hen", "Thôi nghen"
   - Nói nhanh, nói trống không, bỏ bớt dấu: "Ui trời, trời ơi", "Dzô dzô"
   - Sử dụng "Dạ" thay vì "Vâng", "Ổng, bả" thay vì "Anh ấy, chị ấy"

4. Phong cách đặc trưng thể loại ${genre}:
- Nếu là thể loại kinh dị: tạo cảm giác đêm khuya, tâm linh nhưng nhân văn.
- Nếu là thể loại tình cảm: ngôn ngữ đậm chất xúc cảm, nhiều phép ẩn dụ, chi tiết về nội tâm và cảm xúc
- Nếu là thể loại hành động: văn phong nhanh, gọn, nhiều động từ mạnh, mô tả cụ thể các pha hành động
- Nếu là thể loại viễn tưởng: dùng từ ngữ đặc biệt mô tả công nghệ, khái niệm khoa học, thế giới tương lai
- Nếu là thể loại phiêu lưu: trọng tâm mô tả không gian, địa điểm mới lạ, cảm giác khám phá, hành trình
- Nếu là thể loại hài hước: sử dụng phép châm biếm, cường điệu, đối thoại dí dỏm, tình huống gây cười
- Nếu là thể loại giả tưởng: ngôn ngữ trang trọng hoặc cổ điển, mô tả về sinh vật huyền bí, phép thuật

5. KHÔNG được tự ý thay đổi nghề nghiệp của nhân vật từ outline. Nếu nhân vật không phải là nhà văn/biên kịch, đảm bảo giữ nguyên nghề nghiệp trong truyện.

Trả về câu chuyện dưới dạng JSON với cấu trúc:
{
  "title": "Tiêu đề truyện",
  "content": "Nội dung truyện thuần túy, đã được chia thành các đoạn văn có format",
  "wordCount": số từ trong truyện (ít nhất ${targetWordCount} từ),
  "readingTime": ${targetReadingTime}
}`;

  const result = await generateContent(prompt);
  return extractJson(result) as FullStory;
}

/**
 * Tạo nội dung podcast dựa trên truyện đã có - chỉ tạo phần mở đầu và kết thúc
 */
async function generatePodcastContent(
  title: string,
  storyContent: string,
  genre: string,
  channelInfo?: string,
  introduction?: string,
): Promise<string> {
  // Xử lý thông tin kênh và lời dẫn nếu có
  let channelInfoText =
    channelInfo && channelInfo.trim()
      ? channelInfo
      : "Kênh Truyện Audio - Nơi chia sẻ những câu chuyện hay nhất";
  let introductionText =
    introduction && introduction.trim()
      ? introduction
      : `Hôm nay chúng ta sẽ thưởng thức một câu chuyện ${genre} hấp dẫn`;

  // Tạo phần mở đầu và kết thúc, không tạo lại phần nội dung
  const prompt = `Bạn là một người dẫn chương trình podcast chuyên kể truyện ${genre}. Hãy tạo phần mở đầu và kết thúc cho podcast với các thông tin sau:

TIÊU ĐỀ: ${title}

THÔNG TIN:
- Thể loại: ${genre}
- Nội dung tóm tắt: "${storyContent.substring(0, 500)}..."
- Tên kênh/podcast: "${channelInfoText}"
- Lời dẫn/giới thiệu: "${introductionText}"

YÊU CẦU:
1. CHỈ tạo 2 phần riêng biệt, mỗi phần KHÔNG quá 100 từ:
   
   a) PHẦN MỞ ĐẦU:
      - Lời chào khán giả thân thiện "Xin chào các bạn, quý vị thính giả"
      - Giới thiệu về kênh podcast
      - Lời dẫn mở đầu
      - Giới thiệu tiêu đề và thể loại của câu chuyện
   
   b) PHẦN KẾT THÚC:
      - Đúc kết ý nghĩa, bài học từ câu chuyện dựa trên nội dung tóm tắt đã cung cấp
      - Liên hệ bài học với cuộc sống thực tế
      - Lời chào tạm biệt "Cảm ơn quý vị đã lắng nghe", "Hẹn gặp lại trong các tập sau"
      - Nhắc nhở khán giả "Đừng quên theo dõi kênh và chia sẻ nếu thích nội dung"

2. Phong cách:
   - Giọng điệu thân thiện, gần gũi
   - Ngôn ngữ đơn giản, dễ hiểu
   - Phần mở đầu: gây hứng thú, tạo kỳ vọng
   - Phần kết thúc: gói gọn ý nghĩa, tạo ấn tượng

3. KHÔNG trả về format markdown hoặc bất kỳ cú pháp đặc biệt nào khác
4. Phải đảm bảo phần kết thúc phản ánh đúng nội dung và bài học từ câu chuyện
5. Nếu chiều dài truyện quá dài, hãy tập trung vào phần tóm tắt để rút ra ý nghĩa

Trả về JSON thuần túy theo định dạng sau:
{
  "content": "Phần mở đầu ở đây [SEPARATOR] Phần kết thúc ở đây"
}

CHỈ trả về JSON, không thêm chú thích, biểu tượng markdown, hoặc bất kỳ text nào khác.`;

  // Lấy phần mở đầu và kết thúc
  console.log(prompt);
  const result = await generateContent(prompt);

  // Kiểm tra kết quả có phải là chuỗi không
  if (typeof result !== "string") {
    console.error("Kết quả không phải là chuỗi:", result);

    // Tạo phần mở đầu và kết thúc mặc định
    const defaultIntro = `Xin chào quý vị và các bạn thính giả thân mến! Rất vui được gặp lại mọi người trong khuông giờ quen thuộc này. ${channelInfoText}. ${introductionText} với tựa đề "${title}" thuộc thể loại ${genre}.`;
    const defaultOutro = `Câu chuyện ${genre} "${title}" đến đây là kết thúc. Cảm ơn quý vị và các bạn đã lắng nghe. Hẹn gặp lại trong các tập sau. Đừng quên theo dõi kênh và chia sẻ nếu thích nội dung này nhé!`;

    try {
      // Thử phân tích kết quả JSON nếu có thể
      const jsonObj: Record<string, any> =
        typeof result === "object"
          ? result
          : JSON.parse(
              typeof result === "string" ? result : JSON.stringify(result),
            );

      if (
        jsonObj &&
        typeof jsonObj === "object" &&
        "content" in jsonObj &&
        typeof jsonObj.content === "string"
      ) {
        let content = jsonObj.content;

        // Kiểm tra nếu content chứa chuỗi JSON, trích xuất thêm một lần nữa
        if (content.includes("```json") || content.includes('"content":')) {
          try {
            // Loại bỏ các ký tự markdown ```json và ``` nếu có
            content = content
              .replace(/```json\n/g, "")
              .replace(/```/g, "")
              .trim();
            const innerJson = JSON.parse(content);
            if (
              innerJson &&
              typeof innerJson === "object" &&
              "content" in innerJson
            ) {
              return innerJson.content;
            }
          } catch (innerError) {
            console.error("Lỗi khi trích xuất JSON nội tại:", innerError);
          }
        }
        return content;
      }
    } catch (e) {
      console.error("Lỗi khi phân tích kết quả JSON:", e);
    }

    // Trả về nội dung mặc định nếu không phân tích được
    return `${defaultIntro}\n\n${storyContent}\n\n${defaultOutro}`;
  }

  // Lưu lại kết quả gốc từ API
  const rawContent = result;

  // Phân tách phần mở đầu và kết thúc
  const parts = result.split("[SEPARATOR]");
  let intro = parts[0]?.trim() || "";
  let outro = parts.length > 1 ? parts[1]?.trim() : "";

  // Nếu không có phân tách rõ ràng, thử tìm kiếm dựa trên đặc điểm của phần kết thúc
  if (parts.length === 1) {
    // Tìm kiếm các cụm từ đặc trưng của phần kết thúc
    const outroMarkers = [
      "Cảm ơn quý vị",
      "Hẹn gặp lại",
      "Đừng quên theo dõi",
      "Bài học",
      "Ý nghĩa",
      "Tạm biệt",
      "Kết thúc câu chuyện",
    ];

    for (const marker of outroMarkers) {
      const index = result.indexOf(marker);
      if (index > result.length / 2) {
        // Chỉ tìm ở nửa sau của văn bản
        intro = result.substring(0, index).trim();
        outro = result.substring(index).trim();
        break;
      }
    }

    // Nếu vẫn không tìm được outro, sử dụng giá trị mặc định
    if (!outro && intro === result) {
      outro = `Cảm ơn quý vị và các bạn đã lắng nghe câu chuyện ${genre} "${title}". Hẹn gặp lại trong các tập tiếp theo. Đừng quên theo dõi kênh và chia sẻ nếu thích nội dung này nhé!`;
    }
  }

  // Kiểm tra và thay thế SEPARATOR
  console.log("Kiểm tra [SEPARATOR] trong:", intro.substring(0, 30) + "...");
  
  // Trường hợp 1: Nội dung gốc chứa SEPARATOR
  if (rawContent.includes("[SEPARATOR]")) {
    console.log("Nội dung gốc có chứa [SEPARATOR], thực hiện thay thế trực tiếp");
    return rawContent.replace("[SEPARATOR]", `\n\n${storyContent}\n\n`);
  }
  
  // Trường hợp 2: Phần intro chứa SEPARATOR
  if (intro.includes("[SEPARATOR]")) {
    console.log("Phần intro có chứa [SEPARATOR], thực hiện thay thế");
    return intro.replace("[SEPARATOR]", `\n\n${storyContent}\n\n`);
  }
  
  // Trường hợp mặc định: Không có SEPARATOR
  console.log("Không tìm thấy [SEPARATOR], ghép nối theo cách thông thường");
  return `${intro}\n\n${storyContent}\n\n${outro}`;
}

/**
 * Tính số cảnh dựa trên thời gian đọc
 * Truyện càng dài, số cảnh càng nhiều
 */
function calculateSceneCount(readingTimeInput: number | string): number {
  // Xử lý trường hợp readingTime là string (ví dụ: "3 phút")
  let readingTime: number;

  if (typeof readingTimeInput === "string") {
    // Trích xuất số từ chuỗi (ví dụ: "3 phút" -> 3)
    const match = readingTimeInput.match(/(\d+)/);
    if (match && match[1]) {
      readingTime = parseInt(match[1], 10);
    } else {
      console.error(
        `Không thể xác định thời gian đọc từ: "${readingTimeInput}". Sử dụng giá trị mặc định.`,
      );
      readingTime = 15; // Mặc định 15 phút nếu không xác định được
    }
  } else if (typeof readingTimeInput === "number") {
    readingTime = readingTimeInput;
  } else {
    console.error(
      `Định dạng thời gian đọc không hợp lệ: ${readingTimeInput}. Sử dụng giá trị mặc định.`,
    );
    readingTime = 15; // Mặc định 15 phút nếu không hợp lệ
  }

  // Đảm bảo readingTime là số dương
  readingTime = Math.max(1, readingTime);

  console.log(
    `Đã xử lý thời gian đọc: ${readingTimeInput} -> ${readingTime} phút`,
  );

  // Quy đổi giá trị: thời gian đọc (phút) -> số cảnh
  if (readingTime <= 5) return 4;
  if (readingTime <= 10) return 6;
  if (readingTime <= 15) return 8;
  if (readingTime <= 20) return 9;
  if (readingTime <= 30) return 10;
  if (readingTime <= 45) return 12;
  if (readingTime <= 60) return 16;
  return Math.min(20, Math.ceil(readingTime / 4)); // Tối đa 20 cảnh
}

/**
 * Tạo phân cảnh từ truyện đầy đủ
 */
export async function generateScenes(
  story: FullStory,
  genre: string,
  sceneCount?: number,
): Promise<Scene[]> {
  // Tính số cảnh dựa trên thời gian đọc nếu không có số cảnh cụ thể
  const estimatedSceneCount =
    sceneCount || calculateSceneCount(story.readingTime);

  console.log(
    `Generating ${estimatedSceneCount} scenes based on reading time ${story.readingTime} minutes`,
  );

  const prompt = `Bạn là một nhà biên kịch chuyên viết truyện ${genre}. Hãy tạo một JSON gồm CHÍNH XÁC ${estimatedSceneCount} phân cảnh dựa trên câu chuyện sau:
${story.content}

VUI LÒNG TẠO CHÍNH XÁC ${estimatedSceneCount} PHÂN CẢNH, KHÔNG HƠN KHÔNG KÉM.

Mỗi phân cảnh gồm:
- "text": mô tả ngắn cảnh xảy ra trong truyện (bằng tiếng Việt). Văn phong phải phù hợp với thể loại ${genre}.
- "promptanh": mô tả chi tiết bằng tiếng Anh để tạo ảnh bằng AI. Đảm bảo mô tả này thể hiện rõ bầu không khí và phong cách của thể loại ${genre}.

QUAN TRỌNG:
1. Cho thể loại ${genre}, hãy đảm bảo:
- Nếu là kinh dị: các phân cảnh phải tạo cảm giác sợ hãi, bí ẩn, u ám. Prompts ảnh phải tối, đáng sợ, rùng rợn.
- Nếu là tình cảm: các phân cảnh tập trung vào tình cảm, cảm xúc, khoảnh khắc lãng mạn. Prompts ảnh phải ấm áp, nhẹ nhàng.
- Nếu là hành động: các phân cảnh mô tả những pha hành động gay cấn, đấu đá, rượt đuổi. Prompts ảnh phải năng động, mạnh mẽ.
- Nếu là viễn tưởng: các phân cảnh nên chứa yếu tố công nghệ cao, tương lai. Prompts ảnh phải futuristic, hiện đại, đột phá.
- Nếu là phiêu lưu: các phân cảnh mô tả hành trình, khám phá, thử thách. Prompts ảnh phải hoang dã, rộng lớn, kỳ thú.
- Nếu là hài hước: các phân cảnh gây cười, tình huống hài hước. Prompts ảnh phải vui vẻ, hài hước, sống động.
- Nếu là giả tưởng: các phân cảnh có yếu tố phép thuật, sinh vật huyền bí. Prompts ảnh phải thần thoại, kỳ ảo, huyền bí.

2. Trong câu chuyện này, hãy tôn trọng nghề nghiệp của các nhân vật và KHÔNG thay đổi chúng trong phân cảnh của bạn. Đảm bảo prompts ảnh phản ánh chính xác đặc điểm của các nhân vật như mô tả trong câu chuyện.

Trả kết quả dưới dạng một mảng JSON có CHÍNH XÁC ${estimatedSceneCount} phần tử như ví dụ:
[
  {
    "text": "...",
    "promptanh": "..." 
  },
  ...thêm cho đủ ${estimatedSceneCount} phần tử
]`;

  const result = await generateContent(prompt);
  return extractJson(result) as Scene[];
}

/**
 * Tạo phân cảnh trực tiếp từ chủ đề
 */
export async function generateScenesFromTopic(
  genre: string,
  topic: string,
  readingTime: number = 15,
): Promise<Scene[]> {
  // Tính số cảnh dựa trên thời gian đọc
  const estimatedSceneCount = calculateSceneCount(readingTime);

  console.log(
    `Generating ${estimatedSceneCount} scenes directly from topic, based on reading time ${readingTime} minutes`,
  );

  const prompt = `Bạn là một nhà biên kịch chuyên viết truyện ${genre}. Hãy tạo một JSON gồm CHÍNH XÁC ${estimatedSceneCount} phân cảnh dựa trên chủ đề truyện sau: "${topic}".

VUI LÒNG TẠO CHÍNH XÁC ${estimatedSceneCount} PHÂN CẢNH, KHÔNG HƠN KHÔNG KÉM.

Mỗi phân cảnh gồm:
- "text": mô tả ngắn cảnh xảy ra trong truyện (bằng tiếng Việt). Văn phong phải phù hợp với thể loại ${genre}.
- "promptanh": mô tả chi tiết bằng tiếng Anh để tạo ảnh bằng AI. Đảm bảo mô tả này thể hiện rõ bầu không khí và phong cách của thể loại ${genre}.

QUAN TRỌNG:
1. Cho thể loại ${genre}, hãy đảm bảo:
- Nếu là kinh dị: các phân cảnh phải tạo cảm giác sợ hãi, bí ẩn, u ám. Prompts ảnh phải tối, đáng sợ, rùng rợn.
- Nếu là tình cảm: các phân cảnh tập trung vào tình cảm, cảm xúc, khoảnh khắc lãng mạn. Prompts ảnh phải ấm áp, nhẹ nhàng.
- Nếu là hành động: các phân cảnh mô tả những pha hành động gay cấn, đấu đá, rượt đuổi. Prompts ảnh phải năng động, mạnh mẽ.
- Nếu là viễn tưởng: các phân cảnh nên chứa yếu tố công nghệ cao, tương lai. Prompts ảnh phải futuristic, hiện đại, đột phá.
- Nếu là phiêu lưu: các phân cảnh mô tả hành trình, khám phá, thử thách. Prompts ảnh phải hoang dã, rộng lớn, kỳ thú.
- Nếu là hài hước: các phân cảnh gây cười, tình huống hài hước. Prompts ảnh phải vui vẻ, hài hước, sống động.
- Nếu là giả tưởng: các phân cảnh có yếu tố phép thuật, sinh vật huyền bí. Prompts ảnh phải thần thoại, kỳ ảo, huyền bí.

2. KHÔNG tạo nhân vật chính là nhà văn, nhà biên kịch, hay người làm trong lĩnh vực viết lách. Thay vào đó, hãy tạo nhân vật với nghề nghiệp đa dạng và phù hợp với thể loại truyện, ví dụ:
- Kinh dị: thám tử, bác sĩ, giáo viên, nhà khảo cổ, nhân viên bảo tàng...
- Tình cảm: đầu bếp, luật sư, kỹ sư, họa sĩ, nhạc sĩ, y tá...
- Hành động: cảnh sát, quân nhân, vận động viên, thợ săn tiền thưởng, bảo vệ...
- Viễn tưởng: nhà khoa học, kỹ sư, phi hành gia, bác sĩ, sinh viên...
- Phiêu lưu: nhà thám hiểm, nhà khảo cổ, phi công, thủy thủ, hướng dẫn viên du lịch...
- Hài hước: nhân viên văn phòng, giáo viên, đầu bếp, nhân viên bán hàng...
- Giả tưởng: thợ rèn, hiệp sĩ, thầy phù thủy, thương nhân, thợ săn...

Trả kết quả dưới dạng một mảng JSON có CHÍNH XÁC ${estimatedSceneCount} phần tử như ví dụ:
[
  {
    "text": "...",
    "promptanh": "..." 
  },
  ...thêm cho đủ ${estimatedSceneCount} phần tử
]`;

  const result = await generateContent(prompt);
  return extractJson(result) as Scene[];
}

// Định nghĩa interface cho lỗi axios
interface AxiosError {
  code?: string;
  response?: {
    status: number;
    data: any;
  };
  request?: any;
  message?: string;
}

/**
 * Tạo hình ảnh từ prompt
 * @return Có thể trả về chuỗi base64 hoặc đối tượng chứa thông tin file
 */
export async function generateImage(
  prompt: string,
): Promise<
  string | { base64: string; filepath: string; url: string; timestamp: number }
> {
  try {
    console.log("Generating image with prompt:", prompt);
    const encodedPrompt = encodeURIComponent(prompt);
    const url = `${AIAUTOTOOL_IMAGE_API}?prompt=${encodedPrompt}`;
    console.log("URL để tạo ảnh:", url);

    // Thêm timeout ngắn (8 giây) để nhanh chóng phát hiện lỗi nếu API bên ngoài không phản hồi
    const response = await axios.get(url, {
      timeout: 100000, // Giảm xuống 8 giây
      maxBodyLength: 20 * 1024 * 1024, // 20MB max response size
      responseType: "arraybuffer", // Quan trọng: Chỉ định nhận dữ liệu dạng binary
    });

    // Kiểm tra dữ liệu binary hợp lệ
    if (!response.data || response.data.byteLength === 0) {
      console.log("Không nhận được dữ liệu hình ảnh");
      throw new Error("Không có ảnh trả về từ API");
    }

    // Chuyển đổi binary thành chuỗi base64
    const base64Image = Buffer.from(response.data).toString("base64");

    if (!base64Image || base64Image.length < 100) {
      console.log("Dữ liệu image không hợp lệ, độ dài:", base64Image?.length);
      throw new Error("Dữ liệu ảnh không hợp lệ");
    }

    // Lưu ảnh vào thư mục public/images để có thể truy cập dễ dàng
    try {
      // Tạo tên file duy nhất
      const timestamp = Date.now();
      const filename = `image_${timestamp}.jpg`;
      const filepath = `public/images/${filename}`;

      // Đảm bảo thư mục tồn tại
      const dirPath = path.dirname(filepath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // Ghi file ảnh trực tiếp từ arraybuffer thay vì base64
      fs.writeFileSync(filepath, response.data);
      console.log(`Đã lưu ảnh tại: ${filepath} (từ arraybuffer)`);

      // Tạo đường dẫn tương đối có thể truy cập được
      const accessUrl = `/images/${filename}`;

      // Trả về chuỗi base64 và thông tin về file đã lưu
      return {
        base64: base64Image,
        filepath: filepath,
        url: accessUrl,
        timestamp: timestamp,
      };
    } catch (fsError) {
      console.error("Lỗi khi lưu file ảnh:", fsError);
      // Vẫn trả về chuỗi base64 nếu không lưu được file
      return base64Image;
    }
  } catch (error) {
    // Kiểm tra tình trạng lỗi hiện tại
    console.error(
      "Lỗi khi tạo ảnh với API https://n8n.aiautotool.com/webhook/image?prompt=",
      error,
    );

    // Thử đường dẫn API thay thế
    try {
      console.log("Thử tạo ảnh với đường dẫn thay thế...");
      const encodedPrompt = encodeURIComponent(prompt);
      const alternativeUrl = `https://n8n.aiautotool.com/webhook/image?prompt=${encodedPrompt}`;

      // Thêm timeout ngắn để nhanh chóng phát hiện lỗi
      const response = await axios.get(alternativeUrl, {
        timeout: 800000,
        maxBodyLength: 20 * 1024 * 1024,
        responseType: "arraybuffer",
      });

      // Kiểm tra dữ liệu binary hợp lệ
      if (!response.data || response.data.byteLength === 0) {
        throw new Error("Không có ảnh trả về từ API thay thế");
      }

      // Chuyển đổi binary thành chuỗi base64
      const base64Image = Buffer.from(response.data).toString("base64");

      if (!base64Image || base64Image.length < 100) {
        throw new Error("Dữ liệu ảnh không hợp lệ từ API thay thế");
      }

      console.log("Đã tạo ảnh thành công với API thay thế");

      // Lưu ảnh từ API thay thế
      try {
        // Tạo tên file duy nhất
        const timestamp = Date.now();
        const filename = `image_alt_${timestamp}.jpg`;
        const filepath = `public/images/${filename}`;

        // Đảm bảo thư mục tồn tại
        const dirPath = path.dirname(filepath);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }

        // Ghi file ảnh từ arraybuffer
        fs.writeFileSync(filepath, response.data);
        console.log(`Đã lưu ảnh thay thế tại: ${filepath}`);

        // Tạo đường dẫn tương đối
        const accessUrl = `/images/${filename}`;

        // Trả về chuỗi base64 và thông tin về file đã lưu
        return {
          base64: base64Image,
          filepath: filepath,
          url: accessUrl,
          timestamp: timestamp,
        };
      } catch (fsError) {
        console.error("Lỗi khi lưu file ảnh từ API thay thế:", fsError);
        // Vẫn trả về chuỗi base64 nếu không lưu được file
        return base64Image;
      }
    } catch (altError) {
      console.error("Lỗi khi thử với API thay thế:", altError);

      // Thông báo lỗi chi tiết
      throw new Error(
        "Không thể tạo ảnh: API n8n.aiautotool.com không khả dụng. Vui lòng thử lại sau.",
      );
    }

    // Thông báo lỗi chung - code này không chạy vì các lỗi đã được xử lý ở try/catch bên trên
    throw new Error(
      "Không thể tạo ảnh: API không khả dụng hoặc đường dẫn không chính xác",
    );
  }
}
