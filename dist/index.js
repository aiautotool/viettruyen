// server/index.ts
import express3 from "express";

// server/routes.ts
import express2 from "express";
import path7 from "path";
import fs7 from "fs";
import multer from "multer";

// server/storyGenerator.ts
import axios from "axios";

// server/apiKeys.ts
import fs from "fs";
import path from "path";
var API_KEY_FILE = path.join(process.cwd(), "apikey.txt");
var DEFAULT_OPENAI_KEY = process.env.OPENAI_API_KEY;
function readGeminiKeysFromFile() {
  try {
    if (fs.existsSync(API_KEY_FILE)) {
      const content = fs.readFileSync(API_KEY_FILE, "utf-8");
      const keys = content.split("\n").map((key) => key.trim()).filter((key) => key.length > 0);
      return keys;
    }
  } catch (error) {
    console.error("L\u1ED7i khi \u0111\u1ECDc file API keys:", error);
  }
  return [];
}
function getRandomGeminiKey() {
  const keys = readGeminiKeysFromFile();
  if (keys.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * keys.length);
  return keys[randomIndex];
}
function getOpenAIKey() {
  return DEFAULT_OPENAI_KEY || null;
}
var userProvidedKeys = {
  ["gemini" /* GEMINI */]: null,
  ["openai" /* OPENAI */]: null
};
function setUserProvidedKey(type, key) {
  userProvidedKeys[type] = key;
}
function getPreferredKey(type) {
  if (userProvidedKeys[type]) {
    return userProvidedKeys[type];
  }
  if (type === "gemini" /* GEMINI */) {
    return getRandomGeminiKey();
  }
  if (type === "openai" /* OPENAI */) {
    return getOpenAIKey();
  }
  return null;
}
function hasAvailableKey(type) {
  return getPreferredKey(type) !== null;
}
function getKeyStatus() {
  return {
    ["gemini" /* GEMINI */]: hasAvailableKey("gemini" /* GEMINI */),
    ["openai" /* OPENAI */]: hasAvailableKey("openai" /* OPENAI */)
  };
}

// server/storyGenerator.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs2 from "fs";
import * as path2 from "path";
var AIAUTOTOOL_API = "https://n8n.aiautotool.com/webhook/chatgpt4o";
var AIAUTOTOOL_IMAGE_API = "https://n8n.aiautotool.com/webhook/image?prompt=";
async function callExternalAPI(prompt, language = "vi") {
  try {
    console.log("Calling AI Auto Tool API...");
    prompt = prompt + `,output tr\u1EA3 v\u1EC1 b\u1EB1ng ${language === "vi" ? "ti\u1EBFng Vi\u1EC7t" : "English"}.`;
    const MAX_RETRIES = 2;
    const TIMEOUT = 6e4;
    let retries = 0;
    let lastError = null;
    while (retries <= MAX_RETRIES) {
      try {
        console.log(`Th\u1EED l\u1EA7n ${retries + 1} v\u1EDBi ph\u01B0\u01A1ng th\u1EE9c POST...`);
        const response = await axios.post(
          "https://n8n.aiautotool.com/webhook/chatgptpost",
          { prompt },
          {
            timeout: TIMEOUT,
            headers: { "Content-Type": "application/json" }
          }
        );
        return response.data;
      } catch (error) {
        const retryError = error;
        console.log(`Th\u1EED l\u1EA7n ${retries + 1} th\u1EA5t b\u1EA1i:`, retryError.message);
        try {
          console.log(`Th\u1EED l\u1EA7n ${retries + 1} v\u1EDBi ph\u01B0\u01A1ng th\u1EE9c GET...`);
          const encodedPrompt = encodeURIComponent(prompt);
          const url = `${AIAUTOTOOL_API}?prompt=${encodedPrompt}`;
          const response = await axios.get(url, { timeout: TIMEOUT });
          return response.data;
        } catch (getError) {
          lastError = getError;
          retries++;
          if (retries <= MAX_RETRIES) {
            const delay = retries * 1e3;
            console.log(`Ch\u1EDD ${delay}ms tr\u01B0\u1EDBc khi th\u1EED l\u1EA1i...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }
    }
    throw lastError;
  } catch (error) {
    console.error("Error with External API:", error);
    throw new Error(
      `L\u1ED7i khi s\u1EED d\u1EE5ng External API: ${error instanceof Error ? error.message : "L\u1ED7i kh\xF4ng x\xE1c \u0111\u1ECBnh"}`
    );
  }
}
async function callGeminiAPI(prompt, apiKey) {
  try {
    console.log("Generating with Gemini...");
    const genAI = new GoogleGenerativeAI(apiKey);
    let models = [
      { model: "gemini-pro", version: "v1" },
      // Version mới nhất
      { model: "gemini-1.5-pro", version: "v1" },
      // Model mới nhất
      { model: "gemini-1.5-flash", version: "v1" },
      // Model nhanh
      { model: "gemini-pro", version: "v1beta" }
      // Version cũ
    ];
    let lastError = null;
    for (const { model, version } of models) {
      try {
        console.log(`Th\u1EED v\u1EDBi model: ${model}, version: ${version}`);
        const modelObj = genAI.getGenerativeModel({
          model,
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192
          }
        });
        const result = await modelObj.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        console.log(`Th\xE0nh c\xF4ng v\u1EDBi model: ${model}, version: ${version}`);
        return text;
      } catch (error) {
        const modelError = error;
        console.log(
          `L\u1ED7i v\u1EDBi model ${model}, version ${version}:`,
          modelError.message
        );
        lastError = modelError;
      }
    }
    throw lastError;
  } catch (error) {
    console.error("Error with all Gemini API models:", error);
    throw new Error(
      `L\u1ED7i khi s\u1EED d\u1EE5ng Gemini API: ${error instanceof Error ? error.message : "L\u1ED7i kh\xF4ng x\xE1c \u0111\u1ECBnh"}`
    );
  }
}
function extractJson(text) {
  console.log("Raw response:", text);
  if (typeof text === "object" && text !== null) {
    if (text.content) {
      text = text.content;
    } else {
      try {
        text = JSON.stringify(text);
      } catch (e) {
        console.error("L\u1ED7i khi chuy\u1EC3n \u0111\u1ED5i object th\xE0nh JSON string:", e);
        throw new Error("D\u1EEF li\u1EC7u kh\xF4ng h\u1EE3p l\u1EC7");
      }
    }
  }
  if (typeof text !== "string") {
    text = String(text);
  }
  let cleanText = text.replace(/```json|```/g, "").trim();
  cleanText = cleanText.replace(/,(\s*[\]}])/g, "$1");
  const jsonObjectEndPos = cleanText.lastIndexOf("}");
  const jsonArrayEndPos = cleanText.lastIndexOf("]");
  if (jsonObjectEndPos > 0 && jsonObjectEndPos < cleanText.length - 1) {
    cleanText = cleanText.substring(0, jsonObjectEndPos + 1);
  } else if (jsonArrayEndPos > 0 && jsonArrayEndPos < cleanText.length - 1) {
    cleanText = cleanText.substring(0, jsonArrayEndPos + 1);
  }
  try {
    try {
      return JSON.parse(cleanText);
    } catch (directParseError) {
      console.log("Kh\xF4ng th\u1EC3 parse tr\u1EF1c ti\u1EBFp, th\u1EED ph\u01B0\u01A1ng ph\xE1p kh\xE1c");
    }
    if (cleanText.includes('"title"') && cleanText.includes('"characters"') && cleanText.includes('"outline"') && cleanText.includes('"mainScenes"')) {
      try {
        const titleMatch = cleanText.match(/"title"\s*:\s*"([^"]+)"/);
        const outlineMatch = cleanText.match(/"outline"\s*:\s*"([^"]+)"/);
        const readingTimeMatch = cleanText.match(
          /"estimatedReadingTime"\s*:\s*"?(\d+)"?/
        );
        const storyOutline = {
          title: titleMatch ? titleMatch[1] : "Truy\u1EC7n kh\xF4ng t\xEAn",
          characters: [],
          outline: outlineMatch ? outlineMatch[1] : "N\u1ED9i dung truy\u1EC7n \u0111ang \u0111\u01B0\u1EE3c x\u1EED l\xFD...",
          estimatedReadingTime: readingTimeMatch ? readingTimeMatch[1] : "15",
          mainScenes: []
        };
        const characterPattern = /"name"\s*:\s*"([^"]+)"\s*,\s*"description"\s*:\s*"([^"]+)"/g;
        let characterMatch;
        while ((characterMatch = characterPattern.exec(cleanText)) !== null) {
          storyOutline.characters.push({
            name: characterMatch[1],
            description: characterMatch[2]
          });
        }
        if (storyOutline.characters.length === 0) {
          const charactersStart = cleanText.indexOf('"characters"');
          const charactersEnd = cleanText.indexOf('"outline"');
          if (charactersStart !== -1 && charactersEnd !== -1) {
            const charactersText = cleanText.substring(
              charactersStart,
              charactersEnd
            );
            const nameMatches = charactersText.match(/"name"\s*:\s*"([^"]+)"/g);
            const descMatches = charactersText.match(
              /"description"\s*:\s*"([^"]+)"/g
            );
            if (nameMatches && descMatches && nameMatches.length === descMatches.length) {
              for (let i = 0; i < nameMatches.length; i++) {
                const name = nameMatches[i].match(/"name"\s*:\s*"([^"]+)"/)[1];
                const desc = descMatches[i].match(
                  /"description"\s*:\s*"([^"]+)"/
                )[1];
                storyOutline.characters.push({ name, description: desc });
              }
            }
          }
        }
        const mainScenesStart = cleanText.indexOf('"mainScenes"');
        if (mainScenesStart !== -1) {
          const mainScenesText = cleanText.substring(mainScenesStart);
          const scenesPattern = /"([^"]{10,})"/g;
          let sceneMatch;
          let foundFirstTag = false;
          while ((sceneMatch = scenesPattern.exec(mainScenesText)) !== null) {
            if (!foundFirstTag) {
              if (sceneMatch[1] === "mainScenes") {
                foundFirstTag = true;
                continue;
              }
              if (!sceneMatch[1].includes("mainScenes")) {
                continue;
              }
              foundFirstTag = true;
            }
            if (sceneMatch[1].length > 15) {
              storyOutline.mainScenes.push(sceneMatch[1]);
            }
          }
        }
        if (storyOutline.title && storyOutline.outline && storyOutline.characters.length > 0 && storyOutline.mainScenes.length > 0) {
          console.log("\u0110\xE3 tr\xEDch xu\u1EA5t th\xE0nh c\xF4ng c\u1ED1t truy\u1EC7n:", storyOutline);
          return storyOutline;
        }
      } catch (outlineError) {
        console.error("L\u1ED7i khi t\u1EA1o c\u1ED1t truy\u1EC7n:", outlineError);
      }
    }
    if (cleanText.includes("[") && cleanText.includes("]")) {
      const jsonRegex = /\[([\s\S]*)\]/;
      const match = cleanText.match(jsonRegex);
      if (match && match[0]) {
        let jsonArray = match[0];
        jsonArray = jsonArray.replace(/,(\s*[\]}])/g, "$1");
        return JSON.parse(jsonArray);
      }
    }
    if (cleanText.includes("{") && cleanText.includes("}")) {
      const jsonRegex = /\{([\s\S]*)\}/;
      const match = cleanText.match(jsonRegex);
      if (match && match[0]) {
        let jsonObj = match[0];
        jsonObj = jsonObj.replace(/,(\s*[\]}])/g, "$1");
        try {
          return JSON.parse(jsonObj);
        } catch (objParseError) {
          jsonObj = jsonObj.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/:\s*"([^"]*)"\s*([,}])/g, ':"$1"$2').replace(/:\s*'([^']*)'\s*([,}])/g, ':"$1"$2');
          return JSON.parse(jsonObj);
        }
      }
    }
    throw new Error("Kh\xF4ng t\xECm th\u1EA5y c\u1EA5u tr\xFAc JSON h\u1EE3p l\u1EC7");
  } catch (parseError) {
    console.error("JSON Parse Error:", parseError);
    try {
      const content = cleanText.replace(/[\n\r\t]+/g, " ").trim();
      if (content.includes('"title":') && content.includes('"outline":') && content.includes('"characters":')) {
        let title = extractValue(content, '"title":', /[,}]/);
        const outline = extractValue(content, '"outline":', /[,}]/);
        const estimatedReadingTime = extractValue(content, '"estimatedReadingTime":', /[,}]/) || "15";
        if (!title) {
          const titleMatch = content.match(/"title"\s*:\s*"([^"]+)"/);
          if (titleMatch) title = titleMatch[1];
        }
        const storyOutline = {
          title: title || "Truy\u1EC7n kh\xF4ng t\xEAn",
          characters: [],
          outline: outline || "N\u1ED9i dung truy\u1EC7n \u0111ang \u0111\u01B0\u1EE3c x\u1EED l\xFD...",
          estimatedReadingTime,
          mainScenes: []
        };
        const charSection = content.substring(
          content.indexOf('"characters":'),
          content.indexOf('"outline":')
        );
        const nameMatches = charSection.match(/"name"\s*:\s*"([^"]+)"/g);
        const descMatches = charSection.match(/"description"\s*:\s*"([^"]+)"/g);
        if (nameMatches && descMatches) {
          for (let i = 0; i < Math.min(nameMatches.length, descMatches.length); i++) {
            const nameMatch = nameMatches[i].match(/"name"\s*:\s*"([^"]+)"/);
            const descMatch = descMatches[i].match(
              /"description"\s*:\s*"([^"]+)"/
            );
            if (nameMatch && descMatch) {
              storyOutline.characters.push({
                name: nameMatch[1],
                description: descMatch[1]
              });
            }
          }
        }
        if (content.includes('"mainScenes":')) {
          const scenesSection = content.substring(
            content.indexOf('"mainScenes":')
          );
          const sceneMatches = scenesSection.match(/"([^"]{15,})"/g);
          if (sceneMatches && sceneMatches.length > 1) {
            for (let i = 1; i < sceneMatches.length; i++) {
              const scene = sceneMatches[i].replace(/^"|"$/g, "");
              storyOutline.mainScenes.push(scene);
            }
          }
        }
        if (storyOutline.title && storyOutline.outline && storyOutline.characters.length > 0 && storyOutline.mainScenes.length > 0) {
          console.log(
            "\u0110\xE3 tr\xEDch xu\u1EA5t th\xE0nh c\xF4ng c\u1ED1t truy\u1EC7n (ph\u01B0\u01A1ng ph\xE1p d\u1EF1 ph\xF2ng):",
            storyOutline
          );
          return storyOutline;
        }
      }
      if (content.includes("[") && content.includes("]")) {
        const startIdx = content.indexOf("[");
        const endIdx = content.lastIndexOf("]") + 1;
        if (startIdx < endIdx) {
          const jsonArrayText = content.substring(startIdx, endIdx);
          const normalizedJson = jsonArrayText.replace(/\\n/g, " ").replace(/\\"/g, '"').replace(/",\s*}/g, '"}').replace(/",\s*]/g, '"]').replace(/([^\\])"/g, '$1"').replace(/^"/, '"').replace(/([a-zA-Z0-9])"/g, '$1"').replace(/",\s*,/g, '",').replace(/\]\s*,\s*\]/g, "]]");
          console.log("Normalized JSON array:", normalizedJson);
          return JSON.parse(normalizedJson);
        }
      }
      if (content.includes("{") && content.includes("}")) {
        const startIdx = content.indexOf("{");
        const endIdx = content.lastIndexOf("}") + 1;
        if (startIdx < endIdx) {
          const jsonObjectText = content.substring(startIdx, endIdx);
          const normalizedJson = jsonObjectText.replace(/\\n/g, " ").replace(/\\"/g, '"').replace(/",\s*}/g, '"}').replace(/",\s*]/g, '"]').replace(/([^\\])"/g, '$1"').replace(/^"/, '"').replace(/([a-zA-Z0-9])"/g, '$1"').replace(/",\s*,/g, '",').replace(/}\s*,\s*}/g, "}}");
          console.log("Normalized JSON object:", normalizedJson);
          return JSON.parse(normalizedJson);
        }
      }
    } catch (altError) {
      console.error("Alternative JSON Parse Error:", altError);
    }
    if (cleanText.includes('"text":') && cleanText.includes('"promptanh":')) {
      try {
        const scenes = [];
        const textBlocks = [];
        const textRegex = /"text":\s*"([^"]+)"/g;
        let textMatch;
        while ((textMatch = textRegex.exec(cleanText)) !== null) {
          textBlocks.push(textMatch[1]);
        }
        const promptBlocks = [];
        const promptRegex = /"promptanh":\s*"([^"]+)"/g;
        let promptMatch;
        while ((promptMatch = promptRegex.exec(cleanText)) !== null) {
          promptBlocks.push(promptMatch[1]);
        }
        if (textBlocks.length === promptBlocks.length && textBlocks.length > 0) {
          for (let i = 0; i < textBlocks.length; i++) {
            scenes.push({
              text: textBlocks[i],
              promptanh: promptBlocks[i]
            });
          }
          if (scenes.length > 0) {
            console.log(
              "\u0110\xE3 tr\xEDch xu\u1EA5t th\xE0nh c\xF4ng ph\xE2n c\u1EA3nh:",
              scenes.length,
              "c\u1EA3nh"
            );
            return scenes;
          }
        }
      } catch (ex) {
        console.error("Scene extraction error:", ex);
      }
    }
    throw new Error("Kh\xF4ng th\u1EC3 ph\xE2n t\xEDch JSON t\u1EEB ph\u1EA3n h\u1ED3i sau nhi\u1EC1u l\u1EA7n th\u1EED");
  }
}
function extractValue(text, marker, endRegex) {
  if (!text.includes(marker)) return null;
  const startPos = text.indexOf(marker) + marker.length;
  const endMatch = text.substring(startPos).match(endRegex);
  const endPos = endMatch && typeof endMatch.index === "number" ? startPos + endMatch.index : text.length;
  let value = text.substring(startPos, endPos).trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.substring(1, value.length - 1);
  }
  return value;
}
async function generateContent(prompt) {
  try {
    if (prompt.toLowerCase().includes("test_gemini") || prompt.toLowerCase().includes("ki\u1EC3m_tra_gemini")) {
      console.log("B\u1EAFt bu\u1ED9c ki\u1EC3m tra Gemini API theo y\xEAu c\u1EA7u");
      if (hasAvailableKey("gemini" /* GEMINI */)) {
        const geminiKey = getPreferredKey("gemini" /* GEMINI */);
        return await callGeminiAPI(prompt, geminiKey);
      } else {
        throw new Error("Kh\xF4ng c\xF3 API key Gemini");
      }
    }
    return await callExternalAPI(prompt);
  } catch (externalError) {
    console.log(
      "L\u1ED7i khi s\u1EED d\u1EE5ng API b\xEAn ngo\xE0i, th\u1EED d\xF9ng Gemini:",
      externalError
    );
    if (hasAvailableKey("gemini" /* GEMINI */)) {
      const geminiKey = getPreferredKey("gemini" /* GEMINI */);
      return await callGeminiAPI(prompt, geminiKey);
    }
    throw new Error(
      "Kh\xF4ng c\xF3 API kh\u1EA3 d\u1EE5ng. Vui l\xF2ng ki\u1EC3m tra k\u1EBFt n\u1ED1i \u0111\u1EBFn n8n.aiautotool.com ho\u1EB7c cung c\u1EA5p Gemini API key"
    );
  }
}
async function generateStoryOutline(genre, topic, readingTime, channelInfo, introduction) {
  const timeInstruction = readingTime ? `T\u1EA1o m\u1ED9t c\u1ED1t truy\u1EC7n v\u1EDBi \u0111\u1ED9 d\xE0i ph\xF9 h\u1EE3p \u0111\u1EC3 \u0111\u1ECDc trong kho\u1EA3ng ${readingTime} ph\xFAt.` : "T\u1EA1o m\u1ED9t c\u1ED1t truy\u1EC7n ng\u1EAFn g\u1ECDn, s\xFAc t\xEDch.";
  let channelInfoText = "";
  if (channelInfo && channelInfo.trim()) {
    channelInfoText = `

Th\xF4ng tin k\xEAnh: "${channelInfo}"`;
  }
  let introductionText = "";
  if (introduction && introduction.trim()) {
    introductionText = `

L\u1EDDi d\u1EABn truy\u1EC7n: "${introduction}"`;
  }
  const prompt = `B\u1EA1n l\xE0 m\u1ED9t nh\xE0 bi\xEAn k\u1ECBch chuy\xEAn vi\u1EBFt truy\u1EC7n ${genre}. ${timeInstruction}
H\xE3y t\u1EA1o m\u1ED9t c\u1ED1t truy\u1EC7n t\u1EF1 nhi\xEAn, cu\u1ED1n h\xFAt, phong c\xE1ch k\u1EC3 chuy\u1EC7n gi\u1ED1ng con ng\u01B0\u1EDDi, l\u1EDDi tho\u1EA1i gi\u1EEFa c\xE1c nh\xE2n v\u1EADt n\xEAn s\u1EED d\u1EE5ng ng\xF4n ng\u1EEF mi\u1EC1n t\xE2y. d\u1EF1a tr\xEAn ch\u1EE7 \u0111\u1EC1: "${topic}".${channelInfoText}${introductionText}

QUAN TR\u1ECCNG: 
1. H\xE3y \u0111\u1EA3m b\u1EA3o phong c\xE1ch v\xE0 n\u1ED9i dung c\u1EE7a c\u1ED1t truy\u1EC7n ph\u1EA3i th\u1EC3 hi\u1EC7n r\xF5 ch\u1EA5t v\xE0 \u0111\u1EB7c tr\u01B0ng c\u1EE7a th\u1EC3 lo\u1EA1i ${genre}. 
C\u1EE5 th\u1EC3:
- N\u1EBFu l\xE0 th\u1EC3 lo\u1EA1i kinh d\u1ECB: t\u1EA1o b\u1EA7u kh\xF4ng kh\xED r\xF9ng r\u1EE3n, c\u0103ng th\u1EB3ng, y\u1EBFu t\u1ED1 si\xEAu nhi\xEAn ho\u1EB7c t\xE2m l\xFD \xE1m \u1EA3nh
- N\u1EBFu l\xE0 th\u1EC3 lo\u1EA1i t\xECnh c\u1EA3m: t\u1EADp trung v\xE0o m\u1ED1i quan h\u1EC7, c\u1EA3m x\xFAc v\xE0 xung \u0111\u1ED9t t\xECnh c\u1EA3m gi\u1EEFa c\xE1c nh\xE2n v\u1EADt
- N\u1EBFu l\xE0 th\u1EC3 lo\u1EA1i h\xE0nh \u0111\u1ED9ng: t\u1EA1o nhi\u1EC1u c\u1EA3nh \u0111\u1ED1i \u0111\u1EA7u, r\u01B0\u1EE3t \u0111u\u1ED5i, \u0111\xE1nh \u0111\u1EA5m, t\xECnh hu\u1ED1ng nguy hi\u1EC3m
- N\u1EBFu l\xE0 th\u1EC3 lo\u1EA1i vi\u1EC5n t\u01B0\u1EDFng: x\xE2y d\u1EF1ng th\u1EBF gi\u1EDBi v\u1EDBi c\xF4ng ngh\u1EC7 ti\xEAn ti\u1EBFn ho\u1EB7c kh\u1EA3 n\u0103ng si\xEAu nhi\xEAn, s\xE1ng t\u1EA1o
- N\u1EBFu l\xE0 th\u1EC3 lo\u1EA1i phi\xEAu l\u01B0u: t\u1EA1o h\xE0nh tr\xECnh kh\xE1m ph\xE1, tr\u1EA3i nghi\u1EC7m m\u1EDBi l\u1EA1, th\u1EED th\xE1ch ph\u1EA3i v\u01B0\u1EE3t qua
- N\u1EBFu l\xE0 th\u1EC3 lo\u1EA1i h\xE0i h\u01B0\u1EDBc: s\u1EED d\u1EE5ng t\xECnh hu\u1ED1ng h\xE0i, g\xE2y c\u01B0\u1EDDi, nh\xE2n v\u1EADt duy\xEAn d\xE1ng
- N\u1EBFu l\xE0 th\u1EC3 lo\u1EA1i gi\u1EA3 t\u01B0\u1EDFng: bao g\u1ED3m sinh v\u1EADt huy\u1EC1n b\xED, ph\xE9p thu\u1EADt, th\u1EBF gi\u1EDBi kh\xE1c th\u01B0\u1EDDng

2. KH\xD4NG t\u1EA1o nh\xE2n v\u1EADt ch\xEDnh l\xE0 nh\xE0 v\u0103n, nh\xE0 bi\xEAn k\u1ECBch, hay ng\u01B0\u1EDDi l\xE0m trong l\u0129nh v\u1EF1c vi\u1EBFt l\xE1ch. Thay v\xE0o \u0111\xF3, h\xE3y t\u1EA1o nh\xE2n v\u1EADt v\u1EDBi ngh\u1EC1 nghi\u1EC7p \u0111a d\u1EA1ng v\xE0 ph\xF9 h\u1EE3p v\u1EDBi th\u1EC3 lo\u1EA1i truy\u1EC7n, v\xED d\u1EE5:
- Kinh d\u1ECB: sinh vi\xEAn, h\u1ECDc sinh, b\xE1n v\xE9 s\u1ED1, ng\u01B0\u1EDDi gi\xE0, b\xE1n online, l\u1EADp tr\xECnh vi\xEAn..., b\xE1c s\u0129, gi\xE1o vi\xEAn, nh\xE0 kh\u1EA3o c\u1ED5, nh\xE2n vi\xEAn b\u1EA3o t\xE0ng...
- T\xECnh c\u1EA3m: \u0111\u1EA7u b\u1EBFp, lu\u1EADt s\u01B0, k\u1EF9 s\u01B0, h\u1ECDa s\u0129, nh\u1EA1c s\u0129, y t\xE1...
- H\xE0nh \u0111\u1ED9ng: c\u1EA3nh s\xE1t, qu\xE2n nh\xE2n, v\u1EADn \u0111\u1ED9ng vi\xEAn, th\u1EE3 s\u0103n ti\u1EC1n th\u01B0\u1EDFng, b\u1EA3o v\u1EC7...
- Vi\u1EC5n t\u01B0\u1EDFng: nh\xE0 khoa h\u1ECDc, k\u1EF9 s\u01B0, phi h\xE0nh gia, b\xE1c s\u0129, sinh vi\xEAn...
- Phi\xEAu l\u01B0u: nh\xE0 th\xE1m hi\u1EC3m, nh\xE0 kh\u1EA3o c\u1ED5, phi c\xF4ng, th\u1EE7y th\u1EE7, h\u01B0\u1EDBng d\u1EABn vi\xEAn du l\u1ECBch...
- H\xE0i h\u01B0\u1EDBc: nh\xE2n vi\xEAn v\u0103n ph\xF2ng, gi\xE1o vi\xEAn, \u0111\u1EA7u b\u1EBFp, nh\xE2n vi\xEAn b\xE1n h\xE0ng...
- Gi\u1EA3 t\u01B0\u1EDFng: th\u1EE3 r\xE8n, hi\u1EC7p s\u0129, th\u1EA7y ph\xF9 th\u1EE7y, th\u01B0\u01A1ng nh\xE2n, th\u1EE3 s\u0103n...

K\u1EBFt qu\u1EA3 tr\u1EA3 v\u1EC1 d\u01B0\u1EDBi d\u1EA1ng JSON v\u1EDBi c\u1EA5u tr\xFAc:
{
  "title": "Ti\xEAu \u0111\u1EC1 truy\u1EC7n",
  "characters": [
    {"name": "T\xEAn nh\xE2n v\u1EADt 1", "description": "M\xF4 t\u1EA3 ng\u1EAFn v\u1EC1 nh\xE2n v\u1EADt"},
    {"name": "T\xEAn nh\xE2n v\u1EADt 2", "description": "M\xF4 t\u1EA3 ng\u1EAFn v\u1EC1 nh\xE2n v\u1EADt"}
  ],
  "outline": "T\xF3m t\u1EAFt c\u1ED1t truy\u1EC7n chi ti\u1EBFt, bao g\u1ED3m b\u1ED1i c\u1EA3nh, xung \u0111\u1ED9t v\xE0 k\u1EBFt th\xFAc",
  "estimatedReadingTime": "\u01AF\u1EDBc t\xEDnh th\u1EDDi gian \u0111\u1ECDc (ph\xFAt)",
  "mainScenes": [
    "M\xF4 t\u1EA3 ng\u1EAFn v\u1EC1 c\u1EA3nh 1",
    "M\xF4 t\u1EA3 ng\u1EAFn v\u1EC1 c\u1EA3nh 2"
  ]
}`;
  const result = await generateContent(prompt);
  return extractJson(result);
}
async function generateFullStory(outline, genre, characterEdits, channelInfo, introduction) {
  try {
    const storyContent = await generateStoryContent(
      outline,
      genre,
      characterEdits
    );
    const podcastContent = await generatePodcastContent(
      storyContent.title,
      storyContent.content,
      genre,
      channelInfo || `K\xEAnh Truy\u1EC7n Ma Online - Nh\u1EEFng c\xE2u chuy\u1EC7n ${genre} h\u1EA5p d\u1EABn`,
      introduction || `H\xF4m nay ch\xFAng ta s\u1EBD kh\xE1m ph\xE1 m\u1ED9t c\xE2u chuy\u1EC7n ${genre} \u0111\u1EB7c s\u1EAFc v\u1EDBi t\u1EF1a \u0111\u1EC1 "${storyContent.title}"`
    );
    return {
      title: storyContent.title,
      content: storyContent.content,
      podcastContent,
      wordCount: storyContent.wordCount,
      readingTime: storyContent.readingTime
    };
  } catch (error) {
    console.error("L\u1ED7i khi t\u1EA1o truy\u1EC7n \u0111\u1EA7y \u0111\u1EE7:", error);
    throw new Error(
      "Kh\xF4ng th\u1EC3 t\u1EA1o truy\u1EC7n \u0111\u1EA7y \u0111\u1EE7: " + (error instanceof Error ? error.message : String(error))
    );
  }
}
async function generateStoryContent(outline, genre, characterEdits) {
  const targetReadingTime = Number(outline.estimatedReadingTime) || 15;
  const targetWordCount = targetReadingTime * 250;
  const prompt = `B\u1EA1n l\xE0 m\u1ED9t nh\xE0 v\u0103n chuy\xEAn vi\u1EBFt truy\u1EC7n ${genre}. Vi\u1EBFt k\u1ECBch b\u1EA3n podcast k\u1EC3 chuy\u1EC7n theo phong c\xE1ch t\xE2m linh \u2013 tr\u1EA7m l\u1EAFng, huy\u1EC1n b\xED, gi\xE0u c\u1EA3m x\xFAc. D\u1EF1a tr\xEAn \u0111o\u1EA1n n\u1ED9i dung sau, h\xE3y s\xE1ng t\u1EA1o th\xE0nh m\u1ED9t c\xE2u chuy\u1EC7n ho\xE0n ch\u1EC9nh c\xF3 m\u1EDF b\xE0i d\u1EABn d\u1EAFt, cao tr\xE0o v\xE0 k\u1EBFt b\xE0i r\xFAt ra th\xF4ng \u0111i\u1EC7p s\xE2u s\u1EAFc. Gi\u1ECDng k\u1EC3 ch\u1EADm, nh\u1EB9.  K\u1EBFt h\u1EE3p y\u1EBFu t\u1ED1 logic t\xE2m linh n\u1EBFu c\xF3.  V\u0103n phong t\u1EF1 nhi\xEAn, s\u1ED1ng \u0111\u1ED9ng, h\u1EA5p d\u1EABn. H\xE3y vi\u1EBFt m\u1ED9t c\xE2u chuy\u1EC7n \u0111\u1EA7y \u0111\u1EE7 d\u1EF1a tr\xEAn outline sau:
${JSON.stringify(outline, null, 2)}

${characterEdits ? "L\u01B0u \xFD c\xF3 nh\u1EEFng thay \u0111\u1ED5i v\u1EC1 nh\xE2n v\u1EADt: " + characterEdits : ""}

H\u01AF\u1EDANG D\u1EAAN QUAN TR\u1ECCNG:

1. Chi\u1EC1u d\xE0i: C\xE2u chuy\u1EC7n ph\u1EA3i c\xF3 \u0111\u1ED9 d\xE0i ${targetWordCount} t\u1EEB \u0111\u1EC3 \u0111\u1EA3m b\u1EA3o th\u1EDDi gian \u0111\u1ECDc kho\u1EA3ng ${targetReadingTime} ph\xFAt.

2. Phong c\xE1ch vi\u1EBFt:
   - V\u0103n phong t\u1EF1 nhi\xEAn, s\u1ED1ng \u0111\u1ED9ng, gi\u1ED1ng con ng\u01B0\u1EDDi
   - Tr\xE1nh l\u1EB7p t\u1EEB, th\xEAm chi ti\u1EBFt c\u1EA3m x\xFAc t\u1EF1 nhi\xEAn
   - Cu\u1ED1n h\xFAt, t\xECnh ti\u1EBFt logic, k\u1ECBch t\xEDnh h\u1EE3p l\xFD

3. \u0110\u1ED1i tho\u1EA1i nh\xE2n v\u1EADt:
   - L\u1EDCI THO\u1EA0I GI\u1EEEA C\xC1C NH\xC2N V\u1EACT PH\u1EA2I S\u1EEC D\u1EE4NG NG\xD4N NG\u1EEE MI\u1EC0N T\xC2Y NAM B\u1ED8
   - Thay v\xEC "t\xF4i, b\u1EA1n, anh, ch\u1ECB" h\xE3y d\xF9ng "tui, b\u1EA1n, anh, ch\u1ECB", thay "th\u1EBF n\xE0y, th\u1EBF kia" b\u1EB1ng "dz\u1EADy n\xE8, dz\u1EADy \u0111\xF3"
   - Th\xEAm c\xE1c t\u1EEB \u0111\u1ECBa ph\u01B0\u01A1ng nh\u01B0 "n\u1EABu" (gi\u1EADn), "nh\u1ECF, t\xEDa, m\xE1, b\u1EF1, d\xE0, tr\u1ECFng, ngo\xE0i \u0111\xF3, trong n\xE0y"
   - D\xF9ng t\u1EEB "hen" cu\u1ED1i c\xE2u \u0111\u1EC3 th\u1EC3 hi\u1EC7n s\u1EF1 \u0111\u1ED3ng \xFD, nh\u01B0 "\u0110i ch\u01A1i hen", "Th\xF4i nghen"
   - N\xF3i nhanh, n\xF3i tr\u1ED1ng kh\xF4ng, b\u1ECF b\u1EDBt d\u1EA5u: "Ui tr\u1EDDi, tr\u1EDDi \u01A1i", "Dz\xF4 dz\xF4"
   - S\u1EED d\u1EE5ng "D\u1EA1" thay v\xEC "V\xE2ng", "\u1ED4ng, b\u1EA3" thay v\xEC "Anh \u1EA5y, ch\u1ECB \u1EA5y"

4. Phong c\xE1ch \u0111\u1EB7c tr\u01B0ng th\u1EC3 lo\u1EA1i ${genre}:
- N\u1EBFu l\xE0 th\u1EC3 lo\u1EA1i kinh d\u1ECB: t\u1EA1o c\u1EA3m gi\xE1c \u0111\xEAm khuya, t\xE2m linh nh\u01B0ng nh\xE2n v\u0103n.
- N\u1EBFu l\xE0 th\u1EC3 lo\u1EA1i t\xECnh c\u1EA3m: ng\xF4n ng\u1EEF \u0111\u1EADm ch\u1EA5t x\xFAc c\u1EA3m, nhi\u1EC1u ph\xE9p \u1EA9n d\u1EE5, chi ti\u1EBFt v\u1EC1 n\u1ED9i t\xE2m v\xE0 c\u1EA3m x\xFAc
- N\u1EBFu l\xE0 th\u1EC3 lo\u1EA1i h\xE0nh \u0111\u1ED9ng: v\u0103n phong nhanh, g\u1ECDn, nhi\u1EC1u \u0111\u1ED9ng t\u1EEB m\u1EA1nh, m\xF4 t\u1EA3 c\u1EE5 th\u1EC3 c\xE1c pha h\xE0nh \u0111\u1ED9ng
- N\u1EBFu l\xE0 th\u1EC3 lo\u1EA1i vi\u1EC5n t\u01B0\u1EDFng: d\xF9ng t\u1EEB ng\u1EEF \u0111\u1EB7c bi\u1EC7t m\xF4 t\u1EA3 c\xF4ng ngh\u1EC7, kh\xE1i ni\u1EC7m khoa h\u1ECDc, th\u1EBF gi\u1EDBi t\u01B0\u01A1ng lai
- N\u1EBFu l\xE0 th\u1EC3 lo\u1EA1i phi\xEAu l\u01B0u: tr\u1ECDng t\xE2m m\xF4 t\u1EA3 kh\xF4ng gian, \u0111\u1ECBa \u0111i\u1EC3m m\u1EDBi l\u1EA1, c\u1EA3m gi\xE1c kh\xE1m ph\xE1, h\xE0nh tr\xECnh
- N\u1EBFu l\xE0 th\u1EC3 lo\u1EA1i h\xE0i h\u01B0\u1EDBc: s\u1EED d\u1EE5ng ph\xE9p ch\xE2m bi\u1EBFm, c\u01B0\u1EDDng \u0111i\u1EC7u, \u0111\u1ED1i tho\u1EA1i d\xED d\u1ECFm, t\xECnh hu\u1ED1ng g\xE2y c\u01B0\u1EDDi
- N\u1EBFu l\xE0 th\u1EC3 lo\u1EA1i gi\u1EA3 t\u01B0\u1EDFng: ng\xF4n ng\u1EEF trang tr\u1ECDng ho\u1EB7c c\u1ED5 \u0111i\u1EC3n, m\xF4 t\u1EA3 v\u1EC1 sinh v\u1EADt huy\u1EC1n b\xED, ph\xE9p thu\u1EADt

5. KH\xD4NG \u0111\u01B0\u1EE3c t\u1EF1 \xFD thay \u0111\u1ED5i ngh\u1EC1 nghi\u1EC7p c\u1EE7a nh\xE2n v\u1EADt t\u1EEB outline. N\u1EBFu nh\xE2n v\u1EADt kh\xF4ng ph\u1EA3i l\xE0 nh\xE0 v\u0103n/bi\xEAn k\u1ECBch, \u0111\u1EA3m b\u1EA3o gi\u1EEF nguy\xEAn ngh\u1EC1 nghi\u1EC7p trong truy\u1EC7n.

Tr\u1EA3 v\u1EC1 c\xE2u chuy\u1EC7n d\u01B0\u1EDBi d\u1EA1ng JSON v\u1EDBi c\u1EA5u tr\xFAc:
{
  "title": "Ti\xEAu \u0111\u1EC1 truy\u1EC7n",
  "content": "N\u1ED9i dung truy\u1EC7n thu\u1EA7n t\xFAy, \u0111\xE3 \u0111\u01B0\u1EE3c chia th\xE0nh c\xE1c \u0111o\u1EA1n v\u0103n c\xF3 format",
  "wordCount": s\u1ED1 t\u1EEB trong truy\u1EC7n (\xEDt nh\u1EA5t ${targetWordCount} t\u1EEB),
  "readingTime": ${targetReadingTime}
}`;
  const result = await generateContent(prompt);
  return extractJson(result);
}
async function generatePodcastContent(title, storyContent, genre, channelInfo, introduction) {
  let channelInfoText = channelInfo && channelInfo.trim() ? channelInfo : "K\xEAnh Truy\u1EC7n Audio - N\u01A1i chia s\u1EBB nh\u1EEFng c\xE2u chuy\u1EC7n hay nh\u1EA5t";
  let introductionText = introduction && introduction.trim() ? introduction : `H\xF4m nay ch\xFAng ta s\u1EBD th\u01B0\u1EDFng th\u1EE9c m\u1ED9t c\xE2u chuy\u1EC7n ${genre} h\u1EA5p d\u1EABn`;
  const prompt = `B\u1EA1n l\xE0 m\u1ED9t ng\u01B0\u1EDDi d\u1EABn ch\u01B0\u01A1ng tr\xECnh podcast chuy\xEAn k\u1EC3 truy\u1EC7n ${genre}. H\xE3y t\u1EA1o ph\u1EA7n m\u1EDF \u0111\u1EA7u v\xE0 k\u1EBFt th\xFAc cho podcast v\u1EDBi c\xE1c th\xF4ng tin sau:

TI\xCAU \u0110\u1EC0: ${title}

TH\xD4NG TIN:
- Th\u1EC3 lo\u1EA1i: ${genre}
- N\u1ED9i dung t\xF3m t\u1EAFt: "${storyContent.substring(0, 500)}..."
- T\xEAn k\xEAnh/podcast: "${channelInfoText}"
- L\u1EDDi d\u1EABn/gi\u1EDBi thi\u1EC7u: "${introductionText}"

Y\xCAU C\u1EA6U:
1. CH\u1EC8 t\u1EA1o 2 ph\u1EA7n ri\xEAng bi\u1EC7t, m\u1ED7i ph\u1EA7n KH\xD4NG qu\xE1 100 t\u1EEB:
   
   a) PH\u1EA6N M\u1EDE \u0110\u1EA6U:
      - L\u1EDDi ch\xE0o kh\xE1n gi\u1EA3 th\xE2n thi\u1EC7n "Xin ch\xE0o c\xE1c b\u1EA1n, qu\xFD v\u1ECB th\xEDnh gi\u1EA3"
      - Gi\u1EDBi thi\u1EC7u v\u1EC1 k\xEAnh podcast
      - L\u1EDDi d\u1EABn m\u1EDF \u0111\u1EA7u
      - Gi\u1EDBi thi\u1EC7u ti\xEAu \u0111\u1EC1 v\xE0 th\u1EC3 lo\u1EA1i c\u1EE7a c\xE2u chuy\u1EC7n
   
   b) PH\u1EA6N K\u1EBET TH\xDAC:
      - \u0110\xFAc k\u1EBFt \xFD ngh\u0129a, b\xE0i h\u1ECDc t\u1EEB c\xE2u chuy\u1EC7n d\u1EF1a tr\xEAn n\u1ED9i dung t\xF3m t\u1EAFt \u0111\xE3 cung c\u1EA5p
      - Li\xEAn h\u1EC7 b\xE0i h\u1ECDc v\u1EDBi cu\u1ED9c s\u1ED1ng th\u1EF1c t\u1EBF
      - L\u1EDDi ch\xE0o t\u1EA1m bi\u1EC7t "C\u1EA3m \u01A1n qu\xFD v\u1ECB \u0111\xE3 l\u1EAFng nghe", "H\u1EB9n g\u1EB7p l\u1EA1i trong c\xE1c t\u1EADp sau"
      - Nh\u1EAFc nh\u1EDF kh\xE1n gi\u1EA3 "\u0110\u1EEBng qu\xEAn theo d\xF5i k\xEAnh v\xE0 chia s\u1EBB n\u1EBFu th\xEDch n\u1ED9i dung"

2. Phong c\xE1ch:
   - Gi\u1ECDng \u0111i\u1EC7u th\xE2n thi\u1EC7n, g\u1EA7n g\u0169i
   - Ng\xF4n ng\u1EEF \u0111\u01A1n gi\u1EA3n, d\u1EC5 hi\u1EC3u
   - Ph\u1EA7n m\u1EDF \u0111\u1EA7u: g\xE2y h\u1EE9ng th\xFA, t\u1EA1o k\u1EF3 v\u1ECDng
   - Ph\u1EA7n k\u1EBFt th\xFAc: g\xF3i g\u1ECDn \xFD ngh\u0129a, t\u1EA1o \u1EA5n t\u01B0\u1EE3ng

3. KH\xD4NG tr\u1EA3 v\u1EC1 format markdown ho\u1EB7c b\u1EA5t k\u1EF3 c\xFA ph\xE1p \u0111\u1EB7c bi\u1EC7t n\xE0o kh\xE1c
4. Ph\u1EA3i \u0111\u1EA3m b\u1EA3o ph\u1EA7n k\u1EBFt th\xFAc ph\u1EA3n \xE1nh \u0111\xFAng n\u1ED9i dung v\xE0 b\xE0i h\u1ECDc t\u1EEB c\xE2u chuy\u1EC7n
5. N\u1EBFu chi\u1EC1u d\xE0i truy\u1EC7n qu\xE1 d\xE0i, h\xE3y t\u1EADp trung v\xE0o ph\u1EA7n t\xF3m t\u1EAFt \u0111\u1EC3 r\xFAt ra \xFD ngh\u0129a

Tr\u1EA3 v\u1EC1 JSON thu\u1EA7n t\xFAy theo \u0111\u1ECBnh d\u1EA1ng sau:
{
  "content": "Ph\u1EA7n m\u1EDF \u0111\u1EA7u \u1EDF \u0111\xE2y [SEPARATOR] Ph\u1EA7n k\u1EBFt th\xFAc \u1EDF \u0111\xE2y"
}

CH\u1EC8 tr\u1EA3 v\u1EC1 JSON, kh\xF4ng th\xEAm ch\xFA th\xEDch, bi\u1EC3u t\u01B0\u1EE3ng markdown, ho\u1EB7c b\u1EA5t k\u1EF3 text n\xE0o kh\xE1c.`;
  console.log(prompt);
  const result = await generateContent(prompt);
  if (typeof result !== "string") {
    console.error("K\u1EBFt qu\u1EA3 kh\xF4ng ph\u1EA3i l\xE0 chu\u1ED7i:", result);
    const defaultIntro = `Xin ch\xE0o qu\xFD v\u1ECB v\xE0 c\xE1c b\u1EA1n th\xEDnh gi\u1EA3 th\xE2n m\u1EBFn! R\u1EA5t vui \u0111\u01B0\u1EE3c g\u1EB7p l\u1EA1i m\u1ECDi ng\u01B0\u1EDDi trong khu\xF4ng gi\u1EDD quen thu\u1ED9c n\xE0y. ${channelInfoText}. ${introductionText} v\u1EDBi t\u1EF1a \u0111\u1EC1 "${title}" thu\u1ED9c th\u1EC3 lo\u1EA1i ${genre}.`;
    const defaultOutro = `C\xE2u chuy\u1EC7n ${genre} "${title}" \u0111\u1EBFn \u0111\xE2y l\xE0 k\u1EBFt th\xFAc. C\u1EA3m \u01A1n qu\xFD v\u1ECB v\xE0 c\xE1c b\u1EA1n \u0111\xE3 l\u1EAFng nghe. H\u1EB9n g\u1EB7p l\u1EA1i trong c\xE1c t\u1EADp sau. \u0110\u1EEBng qu\xEAn theo d\xF5i k\xEAnh v\xE0 chia s\u1EBB n\u1EBFu th\xEDch n\u1ED9i dung n\xE0y nh\xE9!`;
    try {
      const jsonObj = typeof result === "object" ? result : JSON.parse(
        typeof result === "string" ? result : JSON.stringify(result)
      );
      if (jsonObj && typeof jsonObj === "object" && "content" in jsonObj && typeof jsonObj.content === "string") {
        let content = jsonObj.content;
        if (content.includes("```json") || content.includes('"content":')) {
          try {
            content = content.replace(/```json\n/g, "").replace(/```/g, "").trim();
            const innerJson = JSON.parse(content);
            if (innerJson && typeof innerJson === "object" && "content" in innerJson) {
              return innerJson.content;
            }
          } catch (innerError) {
            console.error("L\u1ED7i khi tr\xEDch xu\u1EA5t JSON n\u1ED9i t\u1EA1i:", innerError);
          }
        }
        return content;
      }
    } catch (e) {
      console.error("L\u1ED7i khi ph\xE2n t\xEDch k\u1EBFt qu\u1EA3 JSON:", e);
    }
    return `${defaultIntro}

${storyContent}

${defaultOutro}`;
  }
  const rawContent = result;
  const parts = result.split("[SEPARATOR]");
  let intro = parts[0]?.trim() || "";
  let outro = parts.length > 1 ? parts[1]?.trim() : "";
  if (parts.length === 1) {
    const outroMarkers = [
      "C\u1EA3m \u01A1n qu\xFD v\u1ECB",
      "H\u1EB9n g\u1EB7p l\u1EA1i",
      "\u0110\u1EEBng qu\xEAn theo d\xF5i",
      "B\xE0i h\u1ECDc",
      "\xDD ngh\u0129a",
      "T\u1EA1m bi\u1EC7t",
      "K\u1EBFt th\xFAc c\xE2u chuy\u1EC7n"
    ];
    for (const marker of outroMarkers) {
      const index = result.indexOf(marker);
      if (index > result.length / 2) {
        intro = result.substring(0, index).trim();
        outro = result.substring(index).trim();
        break;
      }
    }
    if (!outro && intro === result) {
      outro = `C\u1EA3m \u01A1n qu\xFD v\u1ECB v\xE0 c\xE1c b\u1EA1n \u0111\xE3 l\u1EAFng nghe c\xE2u chuy\u1EC7n ${genre} "${title}". H\u1EB9n g\u1EB7p l\u1EA1i trong c\xE1c t\u1EADp ti\u1EBFp theo. \u0110\u1EEBng qu\xEAn theo d\xF5i k\xEAnh v\xE0 chia s\u1EBB n\u1EBFu th\xEDch n\u1ED9i dung n\xE0y nh\xE9!`;
    }
  }
  console.log("Ki\u1EC3m tra [SEPARATOR] trong:", intro.substring(0, 30) + "...");
  if (rawContent.includes("[SEPARATOR]")) {
    console.log("N\u1ED9i dung g\u1ED1c c\xF3 ch\u1EE9a [SEPARATOR], th\u1EF1c hi\u1EC7n thay th\u1EBF tr\u1EF1c ti\u1EBFp");
    return rawContent.replace("[SEPARATOR]", `

${storyContent}

`);
  }
  if (intro.includes("[SEPARATOR]")) {
    console.log("Ph\u1EA7n intro c\xF3 ch\u1EE9a [SEPARATOR], th\u1EF1c hi\u1EC7n thay th\u1EBF");
    return intro.replace("[SEPARATOR]", `

${storyContent}

`);
  }
  console.log("Kh\xF4ng t\xECm th\u1EA5y [SEPARATOR], gh\xE9p n\u1ED1i theo c\xE1ch th\xF4ng th\u01B0\u1EDDng");
  return `${intro}

${storyContent}

${outro}`;
}
function calculateSceneCount(readingTimeInput) {
  let readingTime;
  if (typeof readingTimeInput === "string") {
    const match = readingTimeInput.match(/(\d+)/);
    if (match && match[1]) {
      readingTime = parseInt(match[1], 10);
    } else {
      console.error(
        `Kh\xF4ng th\u1EC3 x\xE1c \u0111\u1ECBnh th\u1EDDi gian \u0111\u1ECDc t\u1EEB: "${readingTimeInput}". S\u1EED d\u1EE5ng gi\xE1 tr\u1ECB m\u1EB7c \u0111\u1ECBnh.`
      );
      readingTime = 15;
    }
  } else if (typeof readingTimeInput === "number") {
    readingTime = readingTimeInput;
  } else {
    console.error(
      `\u0110\u1ECBnh d\u1EA1ng th\u1EDDi gian \u0111\u1ECDc kh\xF4ng h\u1EE3p l\u1EC7: ${readingTimeInput}. S\u1EED d\u1EE5ng gi\xE1 tr\u1ECB m\u1EB7c \u0111\u1ECBnh.`
    );
    readingTime = 15;
  }
  readingTime = Math.max(1, readingTime);
  console.log(
    `\u0110\xE3 x\u1EED l\xFD th\u1EDDi gian \u0111\u1ECDc: ${readingTimeInput} -> ${readingTime} ph\xFAt`
  );
  if (readingTime <= 5) return 4;
  if (readingTime <= 10) return 6;
  if (readingTime <= 15) return 8;
  if (readingTime <= 20) return 9;
  if (readingTime <= 30) return 10;
  if (readingTime <= 45) return 12;
  if (readingTime <= 60) return 16;
  return Math.min(20, Math.ceil(readingTime / 4));
}
async function generateScenesFromTopic(genre, topic, readingTime = 15) {
  const estimatedSceneCount = calculateSceneCount(readingTime);
  console.log(
    `Generating ${estimatedSceneCount} scenes directly from topic, based on reading time ${readingTime} minutes`
  );
  const prompt = `B\u1EA1n l\xE0 m\u1ED9t nh\xE0 bi\xEAn k\u1ECBch chuy\xEAn vi\u1EBFt truy\u1EC7n ${genre}. H\xE3y t\u1EA1o m\u1ED9t JSON g\u1ED3m CH\xCDNH X\xC1C ${estimatedSceneCount} ph\xE2n c\u1EA3nh d\u1EF1a tr\xEAn ch\u1EE7 \u0111\u1EC1 truy\u1EC7n sau: "${topic}".

VUI L\xD2NG T\u1EA0O CH\xCDNH X\xC1C ${estimatedSceneCount} PH\xC2N C\u1EA2NH, KH\xD4NG H\u01A0N KH\xD4NG K\xC9M.

M\u1ED7i ph\xE2n c\u1EA3nh g\u1ED3m:
- "text": m\xF4 t\u1EA3 ng\u1EAFn c\u1EA3nh x\u1EA3y ra trong truy\u1EC7n (b\u1EB1ng ti\u1EBFng Vi\u1EC7t). V\u0103n phong ph\u1EA3i ph\xF9 h\u1EE3p v\u1EDBi th\u1EC3 lo\u1EA1i ${genre}.
- "promptanh": m\xF4 t\u1EA3 chi ti\u1EBFt b\u1EB1ng ti\u1EBFng Anh \u0111\u1EC3 t\u1EA1o \u1EA3nh b\u1EB1ng AI. \u0110\u1EA3m b\u1EA3o m\xF4 t\u1EA3 n\xE0y th\u1EC3 hi\u1EC7n r\xF5 b\u1EA7u kh\xF4ng kh\xED v\xE0 phong c\xE1ch c\u1EE7a th\u1EC3 lo\u1EA1i ${genre}.

QUAN TR\u1ECCNG:
1. Cho th\u1EC3 lo\u1EA1i ${genre}, h\xE3y \u0111\u1EA3m b\u1EA3o:
- N\u1EBFu l\xE0 kinh d\u1ECB: c\xE1c ph\xE2n c\u1EA3nh ph\u1EA3i t\u1EA1o c\u1EA3m gi\xE1c s\u1EE3 h\xE3i, b\xED \u1EA9n, u \xE1m. Prompts \u1EA3nh ph\u1EA3i t\u1ED1i, \u0111\xE1ng s\u1EE3, r\xF9ng r\u1EE3n.
- N\u1EBFu l\xE0 t\xECnh c\u1EA3m: c\xE1c ph\xE2n c\u1EA3nh t\u1EADp trung v\xE0o t\xECnh c\u1EA3m, c\u1EA3m x\xFAc, kho\u1EA3nh kh\u1EAFc l\xE3ng m\u1EA1n. Prompts \u1EA3nh ph\u1EA3i \u1EA5m \xE1p, nh\u1EB9 nh\xE0ng.
- N\u1EBFu l\xE0 h\xE0nh \u0111\u1ED9ng: c\xE1c ph\xE2n c\u1EA3nh m\xF4 t\u1EA3 nh\u1EEFng pha h\xE0nh \u0111\u1ED9ng gay c\u1EA5n, \u0111\u1EA5u \u0111\xE1, r\u01B0\u1EE3t \u0111u\u1ED5i. Prompts \u1EA3nh ph\u1EA3i n\u0103ng \u0111\u1ED9ng, m\u1EA1nh m\u1EBD.
- N\u1EBFu l\xE0 vi\u1EC5n t\u01B0\u1EDFng: c\xE1c ph\xE2n c\u1EA3nh n\xEAn ch\u1EE9a y\u1EBFu t\u1ED1 c\xF4ng ngh\u1EC7 cao, t\u01B0\u01A1ng lai. Prompts \u1EA3nh ph\u1EA3i futuristic, hi\u1EC7n \u0111\u1EA1i, \u0111\u1ED9t ph\xE1.
- N\u1EBFu l\xE0 phi\xEAu l\u01B0u: c\xE1c ph\xE2n c\u1EA3nh m\xF4 t\u1EA3 h\xE0nh tr\xECnh, kh\xE1m ph\xE1, th\u1EED th\xE1ch. Prompts \u1EA3nh ph\u1EA3i hoang d\xE3, r\u1ED9ng l\u1EDBn, k\u1EF3 th\xFA.
- N\u1EBFu l\xE0 h\xE0i h\u01B0\u1EDBc: c\xE1c ph\xE2n c\u1EA3nh g\xE2y c\u01B0\u1EDDi, t\xECnh hu\u1ED1ng h\xE0i h\u01B0\u1EDBc. Prompts \u1EA3nh ph\u1EA3i vui v\u1EBB, h\xE0i h\u01B0\u1EDBc, s\u1ED1ng \u0111\u1ED9ng.
- N\u1EBFu l\xE0 gi\u1EA3 t\u01B0\u1EDFng: c\xE1c ph\xE2n c\u1EA3nh c\xF3 y\u1EBFu t\u1ED1 ph\xE9p thu\u1EADt, sinh v\u1EADt huy\u1EC1n b\xED. Prompts \u1EA3nh ph\u1EA3i th\u1EA7n tho\u1EA1i, k\u1EF3 \u1EA3o, huy\u1EC1n b\xED.

2. KH\xD4NG t\u1EA1o nh\xE2n v\u1EADt ch\xEDnh l\xE0 nh\xE0 v\u0103n, nh\xE0 bi\xEAn k\u1ECBch, hay ng\u01B0\u1EDDi l\xE0m trong l\u0129nh v\u1EF1c vi\u1EBFt l\xE1ch. Thay v\xE0o \u0111\xF3, h\xE3y t\u1EA1o nh\xE2n v\u1EADt v\u1EDBi ngh\u1EC1 nghi\u1EC7p \u0111a d\u1EA1ng v\xE0 ph\xF9 h\u1EE3p v\u1EDBi th\u1EC3 lo\u1EA1i truy\u1EC7n, v\xED d\u1EE5:
- Kinh d\u1ECB: th\xE1m t\u1EED, b\xE1c s\u0129, gi\xE1o vi\xEAn, nh\xE0 kh\u1EA3o c\u1ED5, nh\xE2n vi\xEAn b\u1EA3o t\xE0ng...
- T\xECnh c\u1EA3m: \u0111\u1EA7u b\u1EBFp, lu\u1EADt s\u01B0, k\u1EF9 s\u01B0, h\u1ECDa s\u0129, nh\u1EA1c s\u0129, y t\xE1...
- H\xE0nh \u0111\u1ED9ng: c\u1EA3nh s\xE1t, qu\xE2n nh\xE2n, v\u1EADn \u0111\u1ED9ng vi\xEAn, th\u1EE3 s\u0103n ti\u1EC1n th\u01B0\u1EDFng, b\u1EA3o v\u1EC7...
- Vi\u1EC5n t\u01B0\u1EDFng: nh\xE0 khoa h\u1ECDc, k\u1EF9 s\u01B0, phi h\xE0nh gia, b\xE1c s\u0129, sinh vi\xEAn...
- Phi\xEAu l\u01B0u: nh\xE0 th\xE1m hi\u1EC3m, nh\xE0 kh\u1EA3o c\u1ED5, phi c\xF4ng, th\u1EE7y th\u1EE7, h\u01B0\u1EDBng d\u1EABn vi\xEAn du l\u1ECBch...
- H\xE0i h\u01B0\u1EDBc: nh\xE2n vi\xEAn v\u0103n ph\xF2ng, gi\xE1o vi\xEAn, \u0111\u1EA7u b\u1EBFp, nh\xE2n vi\xEAn b\xE1n h\xE0ng...
- Gi\u1EA3 t\u01B0\u1EDFng: th\u1EE3 r\xE8n, hi\u1EC7p s\u0129, th\u1EA7y ph\xF9 th\u1EE7y, th\u01B0\u01A1ng nh\xE2n, th\u1EE3 s\u0103n...

Tr\u1EA3 k\u1EBFt qu\u1EA3 d\u01B0\u1EDBi d\u1EA1ng m\u1ED9t m\u1EA3ng JSON c\xF3 CH\xCDNH X\xC1C ${estimatedSceneCount} ph\u1EA7n t\u1EED nh\u01B0 v\xED d\u1EE5:
[
  {
    "text": "...",
    "promptanh": "..." 
  },
  ...th\xEAm cho \u0111\u1EE7 ${estimatedSceneCount} ph\u1EA7n t\u1EED
]`;
  const result = await generateContent(prompt);
  return extractJson(result);
}
async function generateImage(prompt) {
  try {
    console.log("Generating image with prompt:", prompt);
    const encodedPrompt = encodeURIComponent(prompt);
    const url = `${AIAUTOTOOL_IMAGE_API}?prompt=${encodedPrompt}`;
    console.log("URL \u0111\u1EC3 t\u1EA1o \u1EA3nh:", url);
    const response = await axios.get(url, {
      timeout: 1e5,
      // Giảm xuống 8 giây
      maxBodyLength: 20 * 1024 * 1024,
      // 20MB max response size
      responseType: "arraybuffer"
      // Quan trọng: Chỉ định nhận dữ liệu dạng binary
    });
    if (!response.data || response.data.byteLength === 0) {
      console.log("Kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u h\xECnh \u1EA3nh");
      throw new Error("Kh\xF4ng c\xF3 \u1EA3nh tr\u1EA3 v\u1EC1 t\u1EEB API");
    }
    const base64Image = Buffer.from(response.data).toString("base64");
    if (!base64Image || base64Image.length < 100) {
      console.log("D\u1EEF li\u1EC7u image kh\xF4ng h\u1EE3p l\u1EC7, \u0111\u1ED9 d\xE0i:", base64Image?.length);
      throw new Error("D\u1EEF li\u1EC7u \u1EA3nh kh\xF4ng h\u1EE3p l\u1EC7");
    }
    try {
      const timestamp = Date.now();
      const filename = `image_${timestamp}.jpg`;
      const filepath = `public/images/${filename}`;
      const dirPath = path2.dirname(filepath);
      if (!fs2.existsSync(dirPath)) {
        fs2.mkdirSync(dirPath, { recursive: true });
      }
      fs2.writeFileSync(filepath, response.data);
      console.log(`\u0110\xE3 l\u01B0u \u1EA3nh t\u1EA1i: ${filepath} (t\u1EEB arraybuffer)`);
      const accessUrl = `/images/${filename}`;
      return {
        base64: base64Image,
        filepath,
        url: accessUrl,
        timestamp
      };
    } catch (fsError) {
      console.error("L\u1ED7i khi l\u01B0u file \u1EA3nh:", fsError);
      return base64Image;
    }
  } catch (error) {
    console.error(
      "L\u1ED7i khi t\u1EA1o \u1EA3nh v\u1EDBi API https://n8n.aiautotool.com/webhook/image?prompt=",
      error
    );
    try {
      console.log("Th\u1EED t\u1EA1o \u1EA3nh v\u1EDBi \u0111\u01B0\u1EDDng d\u1EABn thay th\u1EBF...");
      const encodedPrompt = encodeURIComponent(prompt);
      const alternativeUrl = `https://n8n.aiautotool.com/webhook/image?prompt=${encodedPrompt}`;
      const response = await axios.get(alternativeUrl, {
        timeout: 8e5,
        maxBodyLength: 20 * 1024 * 1024,
        responseType: "arraybuffer"
      });
      if (!response.data || response.data.byteLength === 0) {
        throw new Error("Kh\xF4ng c\xF3 \u1EA3nh tr\u1EA3 v\u1EC1 t\u1EEB API thay th\u1EBF");
      }
      const base64Image = Buffer.from(response.data).toString("base64");
      if (!base64Image || base64Image.length < 100) {
        throw new Error("D\u1EEF li\u1EC7u \u1EA3nh kh\xF4ng h\u1EE3p l\u1EC7 t\u1EEB API thay th\u1EBF");
      }
      console.log("\u0110\xE3 t\u1EA1o \u1EA3nh th\xE0nh c\xF4ng v\u1EDBi API thay th\u1EBF");
      try {
        const timestamp = Date.now();
        const filename = `image_alt_${timestamp}.jpg`;
        const filepath = `public/images/${filename}`;
        const dirPath = path2.dirname(filepath);
        if (!fs2.existsSync(dirPath)) {
          fs2.mkdirSync(dirPath, { recursive: true });
        }
        fs2.writeFileSync(filepath, response.data);
        console.log(`\u0110\xE3 l\u01B0u \u1EA3nh thay th\u1EBF t\u1EA1i: ${filepath}`);
        const accessUrl = `/images/${filename}`;
        return {
          base64: base64Image,
          filepath,
          url: accessUrl,
          timestamp
        };
      } catch (fsError) {
        console.error("L\u1ED7i khi l\u01B0u file \u1EA3nh t\u1EEB API thay th\u1EBF:", fsError);
        return base64Image;
      }
    } catch (altError) {
      console.error("L\u1ED7i khi th\u1EED v\u1EDBi API thay th\u1EBF:", altError);
      throw new Error(
        "Kh\xF4ng th\u1EC3 t\u1EA1o \u1EA3nh: API n8n.aiautotool.com kh\xF4ng kh\u1EA3 d\u1EE5ng. Vui l\xF2ng th\u1EED l\u1EA1i sau."
      );
    }
    throw new Error(
      "Kh\xF4ng th\u1EC3 t\u1EA1o \u1EA3nh: API kh\xF4ng kh\u1EA3 d\u1EE5ng ho\u1EB7c \u0111\u01B0\u1EDDng d\u1EABn kh\xF4ng ch\xEDnh x\xE1c"
    );
  }
}

// server/audio.ts
import axios2 from "axios";
import fs3 from "fs";
import path3 from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import { exec } from "child_process";
import { promisify } from "util";
import { URLSearchParams } from "url";
var execPromise = promisify(exec);
ffmpeg.setFfmpegPath(ffmpegPath.path);
var uploadsDir = path3.join(process.cwd(), "uploads");
if (!fs3.existsSync(uploadsDir)) {
  fs3.mkdirSync(uploadsDir, { recursive: true });
}
var tempDir = path3.join(uploadsDir, "temp");
if (!fs3.existsSync(tempDir)) {
  fs3.mkdirSync(tempDir, { recursive: true });
}
var vietnameseVoices = [
  { value: "vi-VN-NamMinhNeural", label: "Nam Minh (Nam)" },
  { value: "vi-VN-HoaiMyNeural", label: "Ho\xE0i My (N\u1EEF)" },
  { value: "vi-VN-ThanhTuNeural", label: "Thanh T\xFA (Nam tr\u1EBB)" },
  { value: "vi-VN-NgocHoangNeural", label: "Ng\u1ECDc Ho\xE0ng (Nam trung ni\xEAn)" }
];
var defaultVoice = "vi-VN-NamMinhNeural";
async function generateAudio(text, voice = defaultVoice, speed = 1) {
  try {
    console.log(`B\u1EAFt \u0111\u1EA7u t\u1EA1o audio... (gi\u1ECDng: ${voice}, t\u1ED1c \u0111\u1ED9: ${speed})`);
    try {
      console.log("S\u1EED d\u1EE5ng API vkct.synology.me...");
      const apiUrl = `http://vkct.synology.me:5014/tts`;
      const params = new URLSearchParams();
      params.append("text", text);
      params.append("voice_name", voice);
      console.log("G\u1EEDi request \u0111\u1EBFn API TTS:", apiUrl);
      const response = await axios2.post(apiUrl, params, {
        responseType: "arraybuffer",
        // Quan trọng để nhận dữ liệu binary
        timeout: 6e4
        // Timeout 60s vì text có thể dài
      });
      if (!response.data) {
        console.log("Kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u audio t\u1EEB API vkct.synology.me, chuy\u1EC3n sang ph\u01B0\u01A1ng ph\xE1p kh\xE1c");
        throw new Error("Kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u audio t\u1EEB API vkct.synology.me");
      }
      let base64Audio;
      if (Buffer.isBuffer(response.data)) {
        base64Audio = response.data.toString("base64");
      } else {
        const buffer = Buffer.from(response.data);
        base64Audio = buffer.toString("base64");
      }
      console.log(`\u0110\xE3 nh\u1EADn \u0111\u01B0\u1EE3c audio t\u1EEB API vkct.synology.me: ${base64Audio.substring(0, 50)}...`);
      return base64Audio;
    } catch (vkctError) {
      console.error("L\u1ED7i khi s\u1EED d\u1EE5ng API vkct.synology.me:", vkctError);
      try {
        console.log("S\u1EED d\u1EE5ng API c\u1EE7a aitoolseo.com...");
        const apiUrl = `https://aitoolseo.com/api/voice`;
        const requestData = {
          text,
          voice_name: voice,
          speed,
          userId: 2
          // Hardcoded ID như trong curl command
        };
        const headers = {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:137.0) Gecko/20100101 Firefox/137.0",
          "Accept": "*/*",
          "Accept-Language": "vi,en-US;q=0.7,en;q=0.3",
          "Accept-Encoding": "gzip, deflate, br, zstd",
          "Referer": "https://aitoolseo.com/voice-ads",
          "Content-Type": "application/json",
          "Authorization": "Bearer trinhnd19@gmail.com",
          "Origin": "https://aitoolseo.com",
          "Connection": "keep-alive",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin",
          "Priority": "u=0"
        };
        console.log("G\u1EEDi request \u0111\u1EBFn API TTS:", apiUrl);
        const response = await axios2.post(apiUrl, requestData, {
          headers,
          responseType: "arraybuffer",
          // Quan trọng để nhận dữ liệu binary
          timeout: 3e4
          // Giảm timeout xuống 30s
        });
        if (!response.data) {
          console.log("Kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u audio t\u1EEB API aitoolseo.com, chuy\u1EC3n sang ph\u01B0\u01A1ng ph\xE1p kh\xE1c");
          throw new Error("Kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u audio t\u1EEB API aitoolseo.com");
        }
        let base64Audio;
        if (Buffer.isBuffer(response.data)) {
          base64Audio = response.data.toString("base64");
        } else {
          const buffer = Buffer.from(response.data);
          base64Audio = buffer.toString("base64");
        }
        console.log(`\u0110\xE3 nh\u1EADn \u0111\u01B0\u1EE3c audio t\u1EEB API aitoolseo.com: ${base64Audio.substring(0, 50)}...`);
        return base64Audio;
      } catch (aitoolseoError) {
        console.error("L\u1ED7i khi s\u1EED d\u1EE5ng API aitoolseo.com:", aitoolseoError);
        try {
          console.log("Th\u1EED s\u1EED d\u1EE5ng edge-tts tr\u1EF1c ti\u1EBFp...");
          const rateString = speed > 1 ? `+${Math.round((speed - 1) * 100)}%` : speed < 1 ? `-${Math.round((1 - speed) * 100)}%` : "+0%";
          const filePath = path3.join(tempDir, `temp_audio_${Date.now()}.mp3`);
          console.log(`T\u1EA1o audio v\u1EDBi edge-tts, l\u01B0u t\u1EA1m v\xE0o: ${filePath}`);
          await execPromise(`python -m edge_tts --voice ${voice} --rate=${rateString} --text "${text.replace(/"/g, '\\"')}" --write-media ${filePath}`);
          console.log("Ki\u1EC3m tra file audio \u0111\xE3 \u0111\u01B0\u1EE3c t\u1EA1o...");
          if (fs3.existsSync(filePath)) {
            console.log(`File audio \u0111\xE3 \u0111\u01B0\u1EE3c t\u1EA1o: ${filePath}`);
            const audioBuffer = fs3.readFileSync(filePath);
            const base64Audio = audioBuffer.toString("base64");
            try {
              fs3.unlinkSync(filePath);
            } catch (e) {
              console.error("Kh\xF4ng th\u1EC3 x\xF3a file t\u1EA1m:", e);
            }
            console.log(`\u0110\xE3 t\u1EA1o audio v\u1EDBi edge-tts, \u0111\u1ED9 d\xE0i base64: ${base64Audio.length} k\xFD t\u1EF1`);
            return base64Audio;
          } else {
            throw new Error("Kh\xF4ng t\xECm th\u1EA5y file audio sau khi t\u1EA1o v\u1EDBi edge-tts");
          }
        } catch (edgeTtsError) {
          console.error("L\u1ED7i khi s\u1EED d\u1EE5ng edge-tts:", edgeTtsError);
          if (process.env.GOOGLE_API_KEY) {
            try {
              console.log("Th\u1EED s\u1EED d\u1EE5ng API Google Cloud Text-to-Speech...");
              const googleUrl = `https://texttospeech.googleapis.com/v1/text:synthesize`;
              const googleApiKey = process.env.GOOGLE_API_KEY;
              let googleVoice = "vi-VN-Standard-A";
              if (voice.includes("Nam")) {
                googleVoice = "vi-VN-Standard-C";
              } else if (voice.includes("Hoai") || voice.includes("My")) {
                googleVoice = "vi-VN-Standard-A";
              }
              const requestData = {
                input: { text },
                voice: {
                  languageCode: "vi-VN",
                  name: googleVoice
                },
                audioConfig: {
                  audioEncoding: "MP3",
                  speakingRate: speed
                }
              };
              console.log("G\u1EEDi request \u0111\u1EBFn Google TTS API");
              const response = await axios2.post(`${googleUrl}?key=${googleApiKey}`, requestData, {
                timeout: 3e4
                // Giảm timeout xuống 30s
              });
              if (!response.data || !response.data.audioContent) {
                throw new Error("Kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u audio t\u1EEB Google Text-to-Speech API");
              }
              console.log("\u0110\xE3 nh\u1EADn \u0111\u01B0\u1EE3c audio t\u1EEB Google TTS");
              return response.data.audioContent;
            } catch (googleTtsError) {
              console.error("L\u1ED7i khi s\u1EED d\u1EE5ng Google TTS:", googleTtsError);
              throw new Error(`L\u1ED7i Google TTS: ${googleTtsError.message || "L\u1ED7i kh\xF4ng x\xE1c \u0111\u1ECBnh"}`);
            }
          } else {
            console.log("T\u1EA5t c\u1EA3 c\xE1c ph\u01B0\u01A1ng ph\xE1p t\u1EA1o audio \u0111\u1EC1u th\u1EA5t b\u1EA1i, tr\u1EA3 v\u1EC1 th\xF4ng b\xE1o l\u1ED7i");
            throw new Error("Kh\xF4ng th\u1EC3 k\u1EBFt n\u1ED1i \u0111\u1EBFn b\u1EA5t k\u1EF3 d\u1ECBch v\u1EE5 TTS n\xE0o. Vui l\xF2ng th\u1EED l\u1EA1i sau.");
          }
        }
      }
    }
  } catch (error) {
    console.error("L\u1ED7i khi t\u1EA1o audio:", error);
    throw new Error(`Kh\xF4ng th\u1EC3 t\u1EA1o audio: ${error.message || "L\u1ED7i kh\xF4ng x\xE1c \u0111\u1ECBnh"}`);
  }
}
async function checkAudioGenerationAvailability() {
  try {
    try {
      const testText = "Test";
      const apiUrl = `http://vkct.synology.me:5014/tts`;
      const params = new URLSearchParams();
      params.append("text", testText);
      params.append("voice_name", defaultVoice);
      await axios2.post(apiUrl, params, {
        responseType: "arraybuffer",
        timeout: 5e3
        // Timeout ngắn để kiểm tra nhanh
      });
      return true;
    } catch (vkctError) {
      console.warn("API vkct.synology.me kh\xF4ng kh\u1EA3 d\u1EE5ng:", vkctError.message);
    }
    try {
      const testText = "Test";
      const apiUrl = `https://aitoolseo.com/api/voice`;
      const requestData = {
        text: testText,
        voice_name: defaultVoice,
        speed: 1,
        userId: 2
      };
      const headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer trinhnd19@gmail.com",
        "Origin": "https://aitoolseo.com",
        "Referer": "https://aitoolseo.com/voice-ads"
      };
      await axios2.post(apiUrl, requestData, {
        headers,
        timeout: 5e3,
        // Timeout ngắn để kiểm tra nhanh
        validateStatus: (status) => status < 500
        // Chấp nhận các mã phản hồi khác 500
      });
      return true;
    } catch (apiError) {
      console.warn("API aitoolseo.com kh\xF4ng kh\u1EA3 d\u1EE5ng:", apiError.message);
    }
    try {
      await execPromise("python -m edge_tts --version");
      return true;
    } catch (edgeTtsError) {
      console.warn("Edge TTS Python package kh\xF4ng kh\u1EA3 d\u1EE5ng:", edgeTtsError.message);
    }
    return false;
  } catch (error) {
    console.warn("Kh\xF4ng th\u1EC3 ki\u1EC3m tra kh\u1EA3 n\u0103ng t\u1EA1o audio:", error);
    return false;
  }
}
async function getAllVoices() {
  try {
    const { stdout } = await execPromise("python -m edge_tts --list-voices");
    if (stdout) {
      const lines = stdout.split("\n").filter((line) => line.trim());
      const voices = lines.map((line) => {
        const match = line.match(/^(\S+)\s+(\S+)/);
        if (match) {
          const shortName = match[1];
          const gender = match[2];
          const localeParts = shortName.split("-");
          const locale = localeParts.length >= 2 ? `${localeParts[0]}-${localeParts[1]}` : "";
          return {
            ShortName: shortName,
            Locale: locale,
            Gender: gender,
            FriendlyName: shortName
          };
        }
        return null;
      }).filter(Boolean);
      if (voices.length > 0) {
        return voices;
      }
    }
    return vietnameseVoices;
  } catch (error) {
    console.error("L\u1ED7i khi l\u1EA5y danh s\xE1ch gi\u1ECDng \u0111\u1ECDc:", error);
    return vietnameseVoices;
  }
}
async function getVietnameseVoices() {
  try {
    const allVoices = await getAllVoices();
    const viVoices = allVoices.filter(
      (voice) => voice.Locale && voice.Locale.toLowerCase().includes("vi-vn")
    ).map((voice) => ({
      value: voice.ShortName,
      label: `${voice.FriendlyName} (${voice.Gender === "Female" ? "N\u1EEF" : "Nam"})`
    }));
    return viVoices.length > 0 ? viVoices : vietnameseVoices;
  } catch (error) {
    console.error("L\u1ED7i khi l\u1EA5y danh s\xE1ch gi\u1ECDng \u0111\u1ECDc ti\u1EBFng Vi\u1EC7t:", error);
    return vietnameseVoices;
  }
}

// server/video.ts
import ffmpeg2 from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import fs5 from "fs";
import path6 from "path";
import { v4 as uuidv42 } from "uuid";

// server/vite.ts
import express from "express";
import fs4 from "fs";
import path5, { dirname as dirname3 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path4, { dirname as dirname2 } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname2(__filename);
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path4.resolve(__dirname, "client", "src"),
      "@shared": path4.resolve(__dirname, "shared"),
      "@assets": path4.resolve(__dirname, "attached_assets")
    }
  },
  root: path4.resolve(__dirname, "client"),
  build: {
    outDir: path4.resolve(__dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = dirname3(__filename2);
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path5.resolve(
        __dirname2,
        "..",
        "client",
        "index.html"
      );
      let template = await fs4.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path5.resolve(__dirname2, "public");
  if (!fs4.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path5.resolve(distPath, "index.html"));
  });
}

// server/taskManager.ts
import { v4 as uuidv4 } from "uuid";
var TaskManager = class {
  tasks;
  constructor() {
    this.tasks = /* @__PURE__ */ new Map();
  }
  /**
   * Tạo một task mới
   */
  createTask(type, metadata) {
    const taskId = uuidv4();
    const task = {
      id: taskId,
      status: "pending",
      progress: 0,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date(),
      type,
      metadata
    };
    this.tasks.set(taskId, task);
    console.log(`Task ${taskId} created with type ${type}`);
    return task;
  }
  /**
   * Cập nhật tiến độ của task
   */
  updateTaskProgress(taskId, progress) {
    const task = this.getTask(taskId);
    if (!task) {
      console.error(`Task ${taskId} not found`);
      return;
    }
    task.progress = Math.min(Math.max(0, progress), 100);
    task.updatedAt = /* @__PURE__ */ new Date();
    this.tasks.set(taskId, task);
  }
  /**
   * Cập nhật trạng thái của task
   */
  updateTaskStatus(taskId, status, result, error) {
    const task = this.getTask(taskId);
    if (!task) {
      console.error(`Task ${taskId} not found`);
      return;
    }
    task.status = status;
    task.updatedAt = /* @__PURE__ */ new Date();
    if (status === "completed" && result !== void 0) {
      task.result = result;
      task.progress = 100;
    }
    if (status === "failed" && error) {
      task.error = error;
    }
    this.tasks.set(taskId, task);
    console.log(`Task ${taskId} updated to status: ${status}, progress: ${task.progress}%`);
  }
  /**
   * Lấy thông tin của task
   */
  getTask(taskId) {
    return this.tasks.get(taskId);
  }
  /**
   * Xóa task sau khi hoàn thành quá lâu để tránh memory leak
   */
  cleanupTasks(maxAgeHours = 24) {
    const now = /* @__PURE__ */ new Date();
    const maxAge = maxAgeHours * 60 * 60 * 1e3;
    this.tasks.forEach((task, taskId) => {
      if (now.getTime() - task.updatedAt.getTime() > maxAge && (task.status === "completed" || task.status === "failed")) {
        this.tasks.delete(taskId);
        console.log(`Task ${taskId} cleaned up`);
      }
    });
  }
  /**
   * Liệt kê tất cả các task
   */
  listTasks() {
    return Array.from(this.tasks.values());
  }
  /**
   * Liệt kê tất cả các task theo loại
   */
  listTasksByType(type) {
    return Array.from(this.tasks.values()).filter((task) => task.type === type);
  }
};
var taskManager = new TaskManager();
setInterval(() => {
  taskManager.cleanupTasks();
}, 60 * 60 * 1e3);

// server/video.ts
try {
  ffmpeg2.setFfmpegPath("ffmpeg");
  console.log("S\u1EED d\u1EE5ng FFmpeg t\u1EEB h\u1EC7 th\u1ED1ng");
} catch (error) {
  ffmpeg2.setFfmpegPath(ffmpegInstaller.path);
  console.log("S\u1EED d\u1EE5ng FFmpeg t\u1EEB node_modules");
}
var uploadsDir2 = "./uploads";
if (!fs5.existsSync(uploadsDir2)) {
  fs5.mkdirSync(uploadsDir2, { recursive: true });
}
var videosDir = path6.join(process.cwd(), "public", "videos");
if (!fs5.existsSync(videosDir)) {
  fs5.mkdirSync(videosDir, { recursive: true });
}
var effectsDir = path6.join(process.cwd(), "public", "images", "effects");
if (!fs5.existsSync(effectsDir)) {
  fs5.mkdirSync(effectsDir, { recursive: true });
}
var uploadsVideosDir = path6.join(uploadsDir2, "videos");
if (!fs5.existsSync(uploadsVideosDir)) {
  fs5.mkdirSync(uploadsVideosDir, { recursive: true });
}
async function createVideoFromAudioAndImage(audioPath, imagePath, options = {}) {
  try {
    if (!fs5.existsSync(audioPath)) {
      throw new Error(`Kh\xF4ng t\xECm th\u1EA5y file audio: ${audioPath}`);
    }
    if (!fs5.existsSync(imagePath)) {
      throw new Error(`Kh\xF4ng t\xECm th\u1EA5y file \u1EA3nh: ${imagePath}`);
    }
    const safeOutputFileName = options.outputFileName ? options.outputFileName.replace(/[^\w\-_.]/g, "_") + ".mp4" : `video_${uuidv42()}.mp4`;
    log(`[video] T\xEAn file video \u0111\xE3 chu\u1EA9n h\xF3a: ${safeOutputFileName}`);
    const outputPath = path6.join(videosDir, safeOutputFileName);
    const resolution = options.resolution || "1280x720";
    log(`B\u1EAFt \u0111\u1EA7u t\u1EA1o video v\u1EDBi audio: ${audioPath} v\xE0 \u1EA3nh: ${imagePath}`, "video");
    return new Promise((resolve, reject) => {
      ffmpeg2().input(imagePath).inputOptions(["-loop 1"]).input(audioPath).outputOptions([
        "-c:v libx264",
        // Codec video
        "-tune stillimage",
        // Tối ưu cho ảnh tĩnh
        "-c:a aac",
        // Codec audio
        "-b:a 192k",
        // Bitrate audio
        "-pix_fmt yuv420p",
        // Pixel format
        "-shortest",
        // Thời lượng video bằng với audio
        `-vf scale=${resolution}`
        // Đặt độ phân giải
      ]).output(outputPath).on("start", (command) => {
        log(`L\u1EC7nh ffmpeg: ${command}`, "video");
      }).on("progress", (progress) => {
        log(`Ti\u1EBFn \u0111\u1ED9 x\u1EED l\xFD: ${progress.percent?.toFixed(2)}%`, "video");
      }).on("error", (err) => {
        log(`L\u1ED7i t\u1EA1o video: ${err.message}`, "video");
        reject(err);
      }).on("end", () => {
        log(`Video \u0111\xE3 \u0111\u01B0\u1EE3c t\u1EA1o th\xE0nh c\xF4ng: ${outputPath}`, "video");
        resolve(outputPath);
      }).run();
    });
  } catch (error) {
    log(`L\u1ED7i trong qu\xE1 tr\xECnh t\u1EA1o video: ${error instanceof Error ? error.message : String(error)}`, "video");
    throw error;
  }
}
async function createSlideshowVideo(audioPath, imagePaths, options = {}) {
  try {
    if (!fs5.existsSync(audioPath)) {
      throw new Error(`Kh\xF4ng t\xECm th\u1EA5y file audio: ${audioPath}`);
    }
    if (imagePaths.length === 0) {
      throw new Error("Kh\xF4ng c\xF3 h\xECnh \u1EA3nh n\xE0o \u0111\u01B0\u1EE3c cung c\u1EA5p");
    }
    for (const imgPath of imagePaths) {
      if (!fs5.existsSync(imgPath)) {
        throw new Error(`Kh\xF4ng t\xECm th\u1EA5y file \u1EA3nh: ${imgPath}`);
      }
    }
    const imageListFile = path6.join(uploadsDir2, `image_list_${uuidv42()}.txt`);
    const slideDuration = options.slideDuration || 5;
    let imageListContent = "";
    imagePaths.forEach((imgPath) => {
      imageListContent += `file '${imgPath}'
duration ${slideDuration}
`;
    });
    imageListContent += `file '${imagePaths[imagePaths.length - 1]}'`;
    fs5.writeFileSync(imageListFile, imageListContent);
    const safeOutputFileName = options.outputFileName ? options.outputFileName.replace(/[^\w\-_.]/g, "_") + ".mp4" : `slideshow_${uuidv42()}.mp4`;
    log(`[video] T\xEAn file slideshow \u0111\xE3 chu\u1EA9n h\xF3a: ${safeOutputFileName}`);
    const outputPath = path6.join(videosDir, safeOutputFileName);
    const resolution = options.resolution || "1280x720";
    log(`B\u1EAFt \u0111\u1EA7u t\u1EA1o slideshow v\u1EDBi ${imagePaths.length} \u1EA3nh v\xE0 audio: ${audioPath}`, "video");
    return new Promise((resolve, reject) => {
      ffmpeg2().input(imageListFile).inputOptions(["-f concat", "-safe 0"]).input(audioPath).outputOptions([
        "-c:v libx264",
        // Codec video
        "-c:a aac",
        // Codec audio
        "-b:a 192k",
        // Bitrate audio
        "-pix_fmt yuv420p",
        // Pixel format
        "-shortest",
        // Thời lượng video bằng với audio
        `-vf scale=${resolution}`
        // Đặt độ phân giải
      ]).output(outputPath).on("start", (command) => {
        log(`L\u1EC7nh ffmpeg: ${command}`, "video");
      }).on("progress", (progress) => {
        log(`Ti\u1EBFn \u0111\u1ED9 x\u1EED l\xFD: ${progress.percent?.toFixed(2)}%`, "video");
      }).on("error", (err) => {
        log(`L\u1ED7i t\u1EA1o slideshow: ${err.message}`, "video");
        try {
          fs5.unlinkSync(imageListFile);
        } catch (e) {
          log(`Kh\xF4ng th\u1EC3 x\xF3a file t\u1EA1m: ${e instanceof Error ? e.message : String(e)}`, "video");
        }
        reject(err);
      }).on("end", () => {
        log(`Slideshow \u0111\xE3 \u0111\u01B0\u1EE3c t\u1EA1o th\xE0nh c\xF4ng: ${outputPath}`, "video");
        try {
          fs5.unlinkSync(imageListFile);
        } catch (e) {
          log(`Kh\xF4ng th\u1EC3 x\xF3a file t\u1EA1m: ${e instanceof Error ? e.message : String(e)}`, "video");
        }
        resolve(outputPath);
      }).run();
    });
  } catch (error) {
    log(`L\u1ED7i trong qu\xE1 tr\xECnh t\u1EA1o slideshow: ${error instanceof Error ? error.message : String(error)}`, "video");
    throw error;
  }
}
async function createStoryVideo(audioPath, coverImagePath, options = {}) {
  try {
    if (!fs5.existsSync(audioPath)) {
      throw new Error(`Kh\xF4ng t\xECm th\u1EA5y file audio: ${audioPath}`);
    }
    if (!fs5.existsSync(coverImagePath)) {
      throw new Error(`Kh\xF4ng t\xECm th\u1EA5y file \u1EA3nh b\xECa: ${coverImagePath}`);
    }
    const safeTitle = options.title ? options.title.replace(/[^\w\-_.]/g, "_").toLowerCase() : "story";
    const safeOutputFileName = options.outputFileName ? options.outputFileName.replace(/[^\w\-_.]/g, "_") + ".mp4" : `${safeTitle}_${uuidv42()}.mp4`;
    log(`[video] T\xEAn file video truy\u1EC7n \u0111\xE3 chu\u1EA9n h\xF3a: ${safeOutputFileName}`);
    const outputPath = path6.join(videosDir, safeOutputFileName);
    const resolution = options.resolution || "1280x720";
    log(`B\u1EAFt \u0111\u1EA7u t\u1EA1o video truy\u1EC7n v\u1EDBi audio: ${audioPath} v\xE0 \u1EA3nh b\xECa: ${coverImagePath} (\u0110\u1ED9 ph\xE2n gi\u1EA3i: ${resolution})`, "video");
    const smokeFxPath = path6.join(effectsDir, "smoke.svg");
    const fogFxPath = path6.join(effectsDir, "fog.svg");
    const cloudsFxPath = path6.join(effectsDir, "clouds.svg");
    const useSmokeFx = options.addSmokeFx !== false;
    if (useSmokeFx) {
      log(`Th\xEAm hi\u1EC7u \u1EE9ng s\u01B0\u01A1ng kh\xF3i v\xE0o video`, "video");
    }
    return new Promise((resolve, reject) => {
      let command = ffmpeg2();
      command = command.input(coverImagePath).inputOptions(["-loop 1"]);
      command = command.input(audioPath);
      let vfOption = "";
      if (useSmokeFx) {
        log(`Th\xEAm hi\u1EC7u \u1EE9ng s\u01B0\u01A1ng kh\xF3i \u0111\u01A1n gi\u1EA3n (d\xF9ng coloroverlay v\xE0 boxblur)`, "video");
        vfOption = `scale=${resolution},boxblur=luma_radius=2:luma_power=1:enable='between(t,0,999999)',hue=s=0.1:enable='between(t,0,999999)'`;
      } else {
        vfOption = `scale=${resolution}`;
      }
      const outputOptions = [
        "-c:v libx264",
        // Codec video
        "-tune stillimage",
        // Tối ưu cho ảnh tĩnh
        "-c:a aac",
        // Codec audio
        "-b:a 192k",
        // Bitrate audio
        "-pix_fmt yuv420p",
        // Pixel format
        "-shortest",
        // Thời lượng video bằng với audio
        `-vf ${vfOption}`
        // Video filters (scale, hiệu ứng)
      ];
      command.outputOptions(outputOptions).output(outputPath).on("start", (command2) => {
        log(`L\u1EC7nh ffmpeg: ${command2}`, "video");
      }).on("progress", (progress) => {
        log(`Ti\u1EBFn \u0111\u1ED9 x\u1EED l\xFD: ${progress.percent?.toFixed(2)}%`, "video");
      }).on("error", (err) => {
        log(`L\u1ED7i t\u1EA1o video truy\u1EC7n: ${err.message}`, "video");
        reject(err);
      }).on("end", () => {
        log(`Video truy\u1EC7n \u0111\xE3 \u0111\u01B0\u1EE3c t\u1EA1o th\xE0nh c\xF4ng: ${outputPath}`, "video");
        resolve(outputPath);
      }).run();
    });
  } catch (error) {
    log(`L\u1ED7i trong qu\xE1 tr\xECnh t\u1EA1o video truy\u1EC7n: ${error instanceof Error ? error.message : String(error)}`, "video");
    throw error;
  }
}
async function createStoryVideoAsync(audioPath, coverImagePath, options = {}) {
  try {
    if (!fs5.existsSync(audioPath)) {
      throw new Error(`Kh\xF4ng t\xECm th\u1EA5y file audio: ${audioPath}`);
    }
    if (!fs5.existsSync(coverImagePath)) {
      throw new Error(`Kh\xF4ng t\xECm th\u1EA5y file \u1EA3nh b\xECa: ${coverImagePath}`);
    }
    const task = taskManager.createTask("video", {
      audioPath,
      coverImagePath,
      options,
      startTime: /* @__PURE__ */ new Date()
    });
    setTimeout(async () => {
      try {
        taskManager.updateTaskStatus(task.id, "processing");
        taskManager.updateTaskProgress(task.id, 5);
        const safeTitle = options.title ? options.title.replace(/[^\w\-_.]/g, "_").toLowerCase() : "story";
        const safeOutputFileName = options.outputFileName ? options.outputFileName.replace(/[^\w\-_.]/g, "_") + ".mp4" : `${safeTitle}_${uuidv42()}.mp4`;
        log(`[video] T\xEAn file video truy\u1EC7n \u0111\xE3 chu\u1EA9n h\xF3a: ${safeOutputFileName}`, "video");
        const outputPath = path6.join(videosDir, safeOutputFileName);
        const resolution = options.resolution || "1280x720";
        log(`B\u1EAFt \u0111\u1EA7u t\u1EA1o video truy\u1EC7n v\u1EDBi audio: ${audioPath} v\xE0 \u1EA3nh b\xECa: ${coverImagePath} (\u0110\u1ED9 ph\xE2n gi\u1EA3i: ${resolution})`, "video");
        const useSmokeFx = options.addSmokeFx !== false;
        taskManager.updateTaskProgress(task.id, 10);
        if (useSmokeFx) {
          log(`Th\xEAm hi\u1EC7u \u1EE9ng s\u01B0\u01A1ng kh\xF3i v\xE0o video`, "video");
        }
        const command = ffmpeg2();
        command.input(coverImagePath).inputOptions(["-loop 1"]);
        command.input(audioPath);
        let vfOption = "";
        if (useSmokeFx) {
          log(`Th\xEAm hi\u1EC7u \u1EE9ng s\u01B0\u01A1ng kh\xF3i \u0111\u01A1n gi\u1EA3n (d\xF9ng coloroverlay v\xE0 boxblur)`, "video");
          vfOption = `scale=${resolution},boxblur=luma_radius=2:luma_power=1:enable='between(t,0,999999)',hue=s=0.1:enable='between(t,0,999999)'`;
        } else {
          vfOption = `scale=${resolution}`;
        }
        const outputOptions = [
          "-c:v libx264",
          // Codec video
          "-tune stillimage",
          // Tối ưu cho ảnh tĩnh
          "-c:a aac",
          // Codec audio
          "-b:a 192k",
          // Bitrate audio
          "-pix_fmt yuv420p",
          // Pixel format
          "-shortest",
          // Thời lượng video bằng với audio
          `-vf ${vfOption}`
          // Video filters (scale, hiệu ứng)
        ];
        command.outputOptions(outputOptions).output(outputPath).on("start", (commandLine) => {
          log(`L\u1EC7nh ffmpeg: ${commandLine}`, "video");
          taskManager.updateTaskProgress(task.id, 15);
        }).on("progress", (progress) => {
          const percent = progress.percent || 0;
          const scaledPercent = 15 + percent * 0.8;
          log(`Ti\u1EBFn \u0111\u1ED9 x\u1EED l\xFD: ${percent.toFixed(2)}%, scaled: ${scaledPercent.toFixed(2)}%`, "video");
          taskManager.updateTaskProgress(task.id, Math.round(scaledPercent));
        }).on("error", (err) => {
          log(`L\u1ED7i t\u1EA1o video truy\u1EC7n: ${err.message}`, "video");
          taskManager.updateTaskStatus(task.id, "failed", null, err.message);
        }).on("end", () => {
          log(`Video truy\u1EC7n \u0111\xE3 \u0111\u01B0\u1EE3c t\u1EA1o th\xE0nh c\xF4ng: ${outputPath}`, "video");
          const relativeUrl = `/videos/${path6.basename(outputPath)}`;
          taskManager.updateTaskProgress(task.id, 100);
          taskManager.updateTaskStatus(task.id, "completed", {
            outputPath,
            url: relativeUrl,
            fileName: path6.basename(outputPath)
          });
        }).run();
      } catch (error) {
        log(`L\u1ED7i khi x\u1EED l\xFD video: ${error instanceof Error ? error.message : String(error)}`, "video");
        taskManager.updateTaskStatus(task.id, "failed", null, String(error));
      }
    }, 0);
    return task.id;
  } catch (error) {
    log(`L\u1ED7i khi kh\u1EDFi t\u1EA1o task video: ${error instanceof Error ? error.message : String(error)}`, "video");
    throw error;
  }
}
async function createSlideshowVideoAsync(audioPath, imagePaths, options = {}) {
  try {
    if (!fs5.existsSync(audioPath)) {
      throw new Error(`Kh\xF4ng t\xECm th\u1EA5y file audio: ${audioPath}`);
    }
    if (imagePaths.length === 0) {
      throw new Error("Kh\xF4ng c\xF3 h\xECnh \u1EA3nh n\xE0o \u0111\u01B0\u1EE3c cung c\u1EA5p");
    }
    for (const imgPath of imagePaths) {
      if (!fs5.existsSync(imgPath)) {
        throw new Error(`Kh\xF4ng t\xECm th\u1EA5y file \u1EA3nh: ${imgPath}`);
      }
    }
    const task = taskManager.createTask("video", {
      audioPath,
      imagePaths,
      options,
      startTime: /* @__PURE__ */ new Date()
    });
    setTimeout(async () => {
      try {
        taskManager.updateTaskStatus(task.id, "processing");
        taskManager.updateTaskProgress(task.id, 5);
        const imageListFile = path6.join(uploadsDir2, `image_list_${uuidv42()}.txt`);
        const slideDuration = options.slideDuration || 5;
        let imageListContent = "";
        imagePaths.forEach((imgPath) => {
          imageListContent += `file '${imgPath}'
duration ${slideDuration}
`;
        });
        imageListContent += `file '${imagePaths[imagePaths.length - 1]}'`;
        fs5.writeFileSync(imageListFile, imageListContent);
        taskManager.updateTaskProgress(task.id, 10);
        const safeOutputFileName = options.outputFileName ? options.outputFileName.replace(/[^\w\-_.]/g, "_") + ".mp4" : `slideshow_${uuidv42()}.mp4`;
        log(`[video] T\xEAn file slideshow \u0111\xE3 chu\u1EA9n h\xF3a: ${safeOutputFileName}`, "video");
        const outputPath = path6.join(videosDir, safeOutputFileName);
        const resolution = options.resolution || "1280x720";
        log(`B\u1EAFt \u0111\u1EA7u t\u1EA1o slideshow v\u1EDBi ${imagePaths.length} \u1EA3nh v\xE0 audio: ${audioPath}`, "video");
        ffmpeg2().input(imageListFile).inputOptions(["-f concat", "-safe 0"]).input(audioPath).outputOptions([
          "-c:v libx264",
          // Codec video
          "-c:a aac",
          // Codec audio
          "-b:a 192k",
          // Bitrate audio
          "-pix_fmt yuv420p",
          // Pixel format
          "-shortest",
          // Thời lượng video bằng với audio
          `-vf scale=${resolution}`
          // Đặt độ phân giải
        ]).output(outputPath).on("start", (commandLine) => {
          log(`L\u1EC7nh ffmpeg: ${commandLine}`, "video");
          taskManager.updateTaskProgress(task.id, 15);
        }).on("progress", (progress) => {
          const percent = progress.percent || 0;
          const scaledPercent = 15 + percent * 0.8;
          log(`Ti\u1EBFn \u0111\u1ED9 x\u1EED l\xFD: ${percent.toFixed(2)}%, scaled: ${scaledPercent.toFixed(2)}%`, "video");
          taskManager.updateTaskProgress(task.id, Math.round(scaledPercent));
        }).on("error", (err) => {
          log(`L\u1ED7i t\u1EA1o slideshow: ${err.message}`, "video");
          try {
            fs5.unlinkSync(imageListFile);
          } catch (e) {
            log(`Kh\xF4ng th\u1EC3 x\xF3a file t\u1EA1m: ${e instanceof Error ? e.message : String(e)}`, "video");
          }
          taskManager.updateTaskStatus(task.id, "failed", null, err.message);
        }).on("end", () => {
          log(`Slideshow \u0111\xE3 \u0111\u01B0\u1EE3c t\u1EA1o th\xE0nh c\xF4ng: ${outputPath}`, "video");
          try {
            fs5.unlinkSync(imageListFile);
          } catch (e) {
            log(`Kh\xF4ng th\u1EC3 x\xF3a file t\u1EA1m: ${e instanceof Error ? e.message : String(e)}`, "video");
          }
          const relativeUrl = `/videos/${path6.basename(outputPath)}`;
          taskManager.updateTaskProgress(task.id, 100);
          taskManager.updateTaskStatus(task.id, "completed", {
            outputPath,
            url: relativeUrl,
            fileName: path6.basename(outputPath)
          });
        }).run();
      } catch (error) {
        log(`L\u1ED7i khi x\u1EED l\xFD video: ${error instanceof Error ? error.message : String(error)}`, "video");
        taskManager.updateTaskStatus(task.id, "failed", null, String(error));
      }
    }, 0);
    return task.id;
  } catch (error) {
    log(`L\u1ED7i khi kh\u1EDFi t\u1EA1o task video: ${error instanceof Error ? error.message : String(error)}`, "video");
    throw error;
  }
}
async function checkFfmpegAvailability() {
  return new Promise((resolve) => {
    ffmpeg2.getAvailableFormats((err, formats) => {
      if (err) {
        log(`L\u1ED7i khi ki\u1EC3m tra FFmpeg: ${err.message}`, "video");
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
}

// server/gemini.ts
import { GoogleGenerativeAI as GoogleGenerativeAI2 } from "@google/generative-ai";
import fs6 from "fs/promises";
import { OpenAI } from "openai";
async function analyzeImage(imagePath) {
  try {
    const GEMINI_API_KEY = getPreferredKey("gemini" /* GEMINI */);
    if (!GEMINI_API_KEY) {
      throw new Error(
        "Kh\xF4ng c\xF3 Gemini API key. Vui l\xF2ng cung c\u1EA5p API key \u0111\u1EC3 s\u1EED d\u1EE5ng t\xEDnh n\u0103ng n\xE0y."
      );
    }
    try {
      const genAI = new GoogleGenerativeAI2(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const imageData = await fs6.readFile(imagePath);
      const prompt = 'Tr\xEDch su\u1EA5t to\xE0n b\u1ED9 n\u1ED9i dung text trong h\xECnh \u1EA3nh sau, \u0111\u1EB7c bi\u1EC7t t\u1EADp trung v\xE0o ch\u1EE7 \u0111\u1EC1 ch\xEDnh v\xE0 t\u1EA1o th\xE0nh ch\u1EE7 \u0111\u1EC1 \u0111\u1EC3 vi\u1EBFt truy\u1EC7n Tr\u1EA3 v\u1EC1 ph\xE2n t\xEDch c\u1EE7a b\u1EA1n d\u01B0\u1EDBi d\u1EA1ng \u0111\u1ED1i t\u01B0\u1EE3ng JSON v\u1EDBi c\xE1c tr\u01B0\u1EDDng sau: { "description": "n\u1ED9i dung \u0111\u1EA7y \u0111\u1EE7", "subject": "ch\u1EE7 \u0111\u1EC1" }';
      const parts = [
        { text: prompt },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: imageData.toString("base64")
          }
        }
      ];
      const result = await model.generateContent(parts);
      const response = await result.response;
      const text = response.text();
      let jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/) || text.match(/(\{[\s\S]*\})/);
      let parsedResponse;
      if (jsonMatch && jsonMatch[1]) {
        parsedResponse = JSON.parse(jsonMatch[1]);
      } else {
        try {
          parsedResponse = JSON.parse(text);
        } catch {
          return {
            description: text,
            subject: "Other",
            model: "Google Generative AI"
          };
        }
      }
      return {
        description: parsedResponse.description || text,
        subject: parsedResponse.subject || "Other",
        model: "Google Generative AI"
      };
    } catch (googleError) {
      console.log("Google AI failed, falling back to OpenAI:", googleError);
      const OPENAI_API_KEY = getPreferredKey("openai" /* OPENAI */);
      if (!OPENAI_API_KEY) {
        throw new Error(
          "Kh\xF4ng c\xF3 OpenAI API key v\xE0 Gemini API kh\xF4ng kh\u1EA3 d\u1EE5ng."
        );
      }
      const imageData = await fs6.readFile(imagePath);
      const base64Image = imageData.toString("base64");
      const openai = new OpenAI({
        apiKey: OPENAI_API_KEY
      });
      const response = await openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: 'Tr\xEDch su\u1EA5t to\xE0n b\u1ED9 n\u1ED9i dung text trong h\xECnh \u1EA3nh sau, \u0111\u1EB7c bi\u1EC7t t\u1EADp trung v\xE0o ch\u1EE7 \u0111\u1EC1 ch\xEDnh: Tr\u1EA3 v\u1EC1 ph\xE2n t\xEDch c\u1EE7a b\u1EA1n d\u01B0\u1EDBi d\u1EA1ng \u0111\u1ED1i t\u01B0\u1EE3ng JSON v\u1EDBi c\xE1c tr\u01B0\u1EDDng sau: { "description": "n\u1ED9i dung \u0111\u1EA7y \u0111\u1EE7", "subject": "ch\u1EE7 \u0111\u1EC1" }'
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1e3
      });
      const content = response.choices[0]?.message?.content || "{}";
      let parsedContent;
      try {
        parsedContent = JSON.parse(content);
      } catch (e) {
        parsedContent = {
          description: "Kh\xF4ng th\u1EC3 ph\xE2n t\xEDch h\xECnh \u1EA3nh",
          subject: "Other"
        };
      }
      return {
        description: parsedContent.description || "Kh\xF4ng th\u1EC3 ph\xE2n t\xEDch h\xECnh \u1EA3nh",
        subject: parsedContent.subject || "Other",
        model: "OpenAI"
      };
    }
  } catch (error) {
    console.error("Error analyzing image:", error);
    throw error;
  }
}

// server/routes.ts
async function registerRoutes(app2) {
  app2.use("/images", express2.static(path7.join(process.cwd(), "public/images")));
  app2.use("/videos", express2.static(path7.join(process.cwd(), "public/videos")));
  app2.use("/uploads", express2.static(path7.join(process.cwd(), "uploads")));
  app2.use("/public", express2.static(path7.join(process.cwd(), "public")));
  const storage = multer.diskStorage({
    destination: function(req, file, cb) {
      const uploadDir = path7.join(process.cwd(), "uploads");
      if (!fs7.existsSync(uploadDir)) {
        fs7.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function(req, file, cb) {
      cb(null, Date.now() + "-" + file.originalname);
    }
  });
  const upload = multer({
    storage,
    limits: {
      fileSize: 10 * 1024 * 1024
      // Giới hạn kích thước file 10MB
    }
  });
  app2.get("/api/key-status", (req, res) => {
    const keyStatus = getKeyStatus();
    res.json(keyStatus);
  });
  app2.post("/api/analyze-image", upload.single("image"), async (req, res) => {
    try {
      if (!req.file && !req.body.imageUrl) {
        return res.status(400).json({
          success: false,
          message: "Vui l\xF2ng t\u1EA3i l\xEAn m\u1ED9t h\xECnh \u1EA3nh ho\u1EB7c cung c\u1EA5p URL h\xECnh \u1EA3nh"
        });
      }
      const geminiKey = getPreferredKey("gemini" /* GEMINI */);
      if (!geminiKey) {
        return res.status(400).json({
          success: false,
          message: "Kh\xF4ng c\xF3 Gemini API key. Vui l\xF2ng cung c\u1EA5p key \u0111\u1EC3 s\u1EED d\u1EE5ng t\xEDnh n\u0103ng n\xE0y."
        });
      }
      let imagePath = "";
      if (req.file) {
        imagePath = req.file.path;
      }
      try {
        const result = await analyzeImage(imagePath);
        if (req.file && fs7.existsSync(imagePath)) {
          fs7.unlink(imagePath, (err) => {
            if (err) console.error("Kh\xF4ng th\u1EC3 x\xF3a t\u1EC7p t\u1EA1m:", err);
          });
        }
        res.json({
          success: true,
          ...result
        });
      } catch (imageError) {
        console.error("L\u1ED7i chi ti\u1EBFt khi ph\xE2n t\xEDch h\xECnh \u1EA3nh:", imageError);
        if (req.file && fs7.existsSync(imagePath)) {
          fs7.unlink(imagePath, (err) => {
            if (err) console.error("Kh\xF4ng th\u1EC3 x\xF3a t\u1EC7p t\u1EA1m:", err);
          });
        }
        res.status(500).json({
          success: false,
          message: "Kh\xF4ng th\u1EC3 ph\xE2n t\xEDch h\xECnh \u1EA3nh. Vui l\xF2ng th\u1EED l\u1EA1i sau.",
          error: imageError instanceof Error ? imageError.message : String(imageError)
        });
      }
    } catch (error) {
      console.error("L\u1ED7i trong route ph\xE2n t\xEDch h\xECnh \u1EA3nh:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "\u0110\xE3 x\u1EA3y ra l\u1ED7i khi ph\xE2n t\xEDch h\xECnh \u1EA3nh"
      });
    }
  });
  app2.post("/api/set-key", (req, res) => {
    try {
      const { type, key } = req.body;
      if (!type || !key) {
        return res.status(400).json({
          success: false,
          message: "Vui l\xF2ng cung c\u1EA5p lo\u1EA1i API key v\xE0 gi\xE1 tr\u1ECB key"
        });
      }
      setUserProvidedKey(type, key);
      res.json({
        success: true,
        message: `\u0110\xE3 \u0111\u1EB7t API key ${type} th\xE0nh c\xF4ng`
      });
    } catch (error) {
      console.error("L\u1ED7i khi \u0111\u1EB7t API key:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "\u0110\xE3 x\u1EA3y ra l\u1ED7i khi \u0111\u1EB7t API key"
      });
    }
  });
  app2.get("/api/check-audio", async (req, res) => {
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
  app2.get("/api/vietnamese-voices", async (req, res) => {
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
  app2.get("/api/check-video", async (req, res) => {
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
  app2.post("/api/generate-outline", async (req, res) => {
    try {
      const { genre, topic, readingTime } = req.body;
      if (!genre || !topic) {
        return res.status(400).json({
          success: false,
          message: "Vui l\xF2ng cung c\u1EA5p th\u1EC3 lo\u1EA1i v\xE0 ch\u1EE7 \u0111\u1EC1"
        });
      }
      const outline = await generateStoryOutline(genre, topic, readingTime);
      res.json({
        success: true,
        outline
      });
    } catch (error) {
      console.error("L\u1ED7i khi t\u1EA1o c\u1ED1t truy\u1EC7n:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "\u0110\xE3 x\u1EA3y ra l\u1ED7i khi t\u1EA1o c\u1ED1t truy\u1EC7n"
      });
    }
  });
  app2.post("/api/generate-full-story", async (req, res) => {
    try {
      const { outline, genre, characterEdits, channelInfo, introduction } = req.body;
      if (!outline || !genre) {
        return res.status(400).json({
          success: false,
          message: "Vui l\xF2ng cung c\u1EA5p c\u1ED1t truy\u1EC7n v\xE0 th\u1EC3 lo\u1EA1i"
        });
      }
      const story = await generateFullStory(outline, genre, characterEdits, channelInfo, introduction);
      res.json({
        success: true,
        story
      });
    } catch (error) {
      console.error("L\u1ED7i khi t\u1EA1o truy\u1EC7n \u0111\u1EA7y \u0111\u1EE7:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "\u0110\xE3 x\u1EA3y ra l\u1ED7i khi t\u1EA1o truy\u1EC7n \u0111\u1EA7y \u0111\u1EE7"
      });
    }
  });
  app2.post("/api/continue-story", async (req, res) => {
    try {
      const { content, genre, endingContext, outline } = req.body;
      if (!content || !genre) {
        return res.status(400).json({
          success: false,
          message: "Vui l\xF2ng cung c\u1EA5p n\u1ED9i dung v\xE0 th\u1EC3 lo\u1EA1i"
        });
      }
      const prompt = `H\xE3y ti\u1EBFp t\u1EE5c vi\u1EBFt c\xE2u chuy\u1EC7n sau \u0111\xE2y theo phong c\xE1ch ${genre}. H\xE3y vi\u1EBFt th\xEAm m\u1ED9t \u0111o\u1EA1n n\u1EEFa d\u1EF1a tr\xEAn ph\u1EA7n tr\u01B0\u1EDBc. Ph\u1EA7n tr\u01B0\u1EDBc: "${endingContext}"`;
      const continuedContent = await generateContent(prompt);
      res.json({
        success: true,
        continuedContent
      });
    } catch (error) {
      console.error("L\u1ED7i khi ti\u1EBFp t\u1EE5c vi\u1EBFt truy\u1EC7n:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "\u0110\xE3 x\u1EA3y ra l\u1ED7i khi ti\u1EBFp t\u1EE5c vi\u1EBFt truy\u1EC7n"
      });
    }
  });
  app2.post("/api/generate-scenes", async (req, res) => {
    try {
      const { genre, topic, story, sceneCount } = req.body;
      if (!genre || !topic && !story) {
        return res.status(400).json({
          success: false,
          message: "Vui l\xF2ng cung c\u1EA5p th\u1EC3 lo\u1EA1i v\xE0 ch\u1EE7 \u0111\u1EC1 ho\u1EB7c n\u1ED9i dung truy\u1EC7n"
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
      console.error("L\u1ED7i khi t\u1EA1o ph\xE2n c\u1EA3nh:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "\u0110\xE3 x\u1EA3y ra l\u1ED7i khi t\u1EA1o ph\xE2n c\u1EA3nh"
      });
    }
  });
  app2.post("/api/generate-audio", async (req, res) => {
    try {
      const { text, voice, speed, name } = req.body;
      if (!text) {
        return res.status(400).json({
          success: false,
          message: "Vui l\xF2ng cung c\u1EA5p n\u1ED9i dung v\u0103n b\u1EA3n \u0111\u1EC3 chuy\u1EC3n th\xE0nh gi\u1ECDng n\xF3i"
        });
      }
      try {
        console.log("B\u1EAFt \u0111\u1EA7u t\u1EA1o audio cho v\u0103n b\u1EA3n (endpoint: generate-audio):", text.substring(0, 50) + "...");
        const audioBase64 = await generateAudio(
          text,
          voice || defaultVoice,
          speed || 1
        );
        if (!audioBase64) {
          throw new Error("Audio tr\u1EA3 v\u1EC1 tr\u1ED1ng");
        }
        const fileName = `${name || "audio"}_${Date.now()}.mp3`;
        console.log("L\u01B0u file audio v\u1EDBi t\xEAn:", fileName);
        const uploadsDir3 = path7.join(process.cwd(), "uploads");
        if (!fs7.existsSync(uploadsDir3)) {
          fs7.mkdirSync(uploadsDir3, { recursive: true });
        }
        const filePath = path7.join(uploadsDir3, fileName);
        fs7.writeFileSync(filePath, Buffer.from(audioBase64, "base64"));
        console.log("\u0110\xE3 l\u01B0u file audio t\u1EA1i:", filePath);
        const relativePath = "/" + path7.relative(process.cwd(), filePath).replace(/\\/g, "/");
        return res.json({
          success: true,
          message: "\u0110\xE3 t\u1EA1o audio th\xE0nh c\xF4ng",
          audioPath: relativePath
        });
      } catch (audioError) {
        console.error("L\u1ED7i chi ti\u1EBFt khi t\u1EA1o audio:", audioError);
        return res.status(500).json({
          success: false,
          message: "Kh\xF4ng th\u1EC3 t\u1EA1o audio. API Text-to-Speech kh\xF4ng kh\u1EA3 d\u1EE5ng. Vui l\xF2ng th\u1EED l\u1EA1i sau.",
          error: true
        });
      }
    } catch (error) {
      console.error("L\u1ED7i trong route t\u1EA1o audio:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "\u0110\xE3 x\u1EA3y ra l\u1ED7i khi t\u1EA1o audio"
      });
    }
  });
  app2.post("/api/voice", async (req, res) => {
    try {
      const { text, voice, speed, name } = req.body;
      if (!text) {
        return res.status(400).json({
          success: false,
          message: "Vui l\xF2ng cung c\u1EA5p n\u1ED9i dung v\u0103n b\u1EA3n \u0111\u1EC3 chuy\u1EC3n th\xE0nh gi\u1ECDng n\xF3i"
        });
      }
      try {
        console.log("B\u1EAFt \u0111\u1EA7u t\u1EA1o audio cho v\u0103n b\u1EA3n:", text.substring(0, 50) + "...");
        const audioBase64 = await generateAudio(
          text,
          voice || defaultVoice,
          speed || 1
        );
        if (!audioBase64) {
          throw new Error("Audio tr\u1EA3 v\u1EC1 tr\u1ED1ng");
        }
        const fileName = `${name || "audio"}_${Date.now()}.mp3`;
        console.log("L\u01B0u file audio v\u1EDBi t\xEAn:", fileName);
        const uploadsDir3 = path7.join(process.cwd(), "uploads");
        if (!fs7.existsSync(uploadsDir3)) {
          fs7.mkdirSync(uploadsDir3, { recursive: true });
        }
        const filePath = path7.join(uploadsDir3, fileName);
        fs7.writeFileSync(filePath, Buffer.from(audioBase64, "base64"));
        console.log("\u0110\xE3 l\u01B0u file audio t\u1EA1i:", filePath);
        const relativePath = "/" + path7.relative(process.cwd(), filePath).replace(/\\/g, "/");
        return res.json({
          success: true,
          message: "\u0110\xE3 t\u1EA1o audio th\xE0nh c\xF4ng",
          audioPath: relativePath
        });
      } catch (audioError) {
        console.error("L\u1ED7i chi ti\u1EBFt khi t\u1EA1o audio:", audioError);
        return res.status(500).json({
          success: false,
          message: "Kh\xF4ng th\u1EC3 t\u1EA1o audio. API Text-to-Speech kh\xF4ng kh\u1EA3 d\u1EE5ng. Vui l\xF2ng th\u1EED l\u1EA1i sau.",
          error: true
        });
      }
    } catch (error) {
      console.error("L\u1ED7i trong route t\u1EA1o audio:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "\u0110\xE3 x\u1EA3y ra l\u1ED7i khi t\u1EA1o audio"
      });
    }
  });
  app2.post("/api/download-audio", async (req, res) => {
    try {
      const { audioBase64, fileName } = req.body;
      if (!audioBase64) {
        return res.status(400).json({
          success: false,
          message: "Vui l\xF2ng cung c\u1EA5p d\u1EEF li\u1EC7u audio \u0111\u1EC3 t\u1EA3i v\u1EC1"
        });
      }
      const uploadDir = path7.join(process.cwd(), "uploads");
      if (!fs7.existsSync(uploadDir)) {
        fs7.mkdirSync(uploadDir, { recursive: true });
      }
      const outputFileName = fileName || `audio_${Date.now()}.mp3`;
      const filePath = path7.join(uploadDir, outputFileName);
      const audioData = audioBase64.replace(/^data:audio\/\w+;base64,/, "");
      fs7.writeFileSync(filePath, Buffer.from(audioData, "base64"));
      const relativePath = path7.relative(process.cwd(), filePath).replace(/\\/g, "/");
      return res.json({
        success: true,
        message: "\u0110\xE3 l\u01B0u audio th\xE0nh c\xF4ng",
        audioPath: `/${relativePath}`
      });
    } catch (error) {
      console.error("L\u1ED7i khi t\u1EA3i audio:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "\u0110\xE3 x\u1EA3y ra l\u1ED7i khi t\u1EA3i audio"
      });
    }
  });
  app2.post("/api/generate-cover", async (req, res) => {
    try {
      const { title, genre } = req.body;
      if (!title) {
        return res.status(400).json({
          success: false,
          message: "Vui l\xF2ng cung c\u1EA5p ti\xEAu \u0111\u1EC1 \u0111\u1EC3 t\u1EA1o h\xECnh \u1EA3nh \u0111\u1EA1i di\u1EC7n"
        });
      }
      const prompt = `Create a book or story cover illustration for "${title}". Genre: ${genre}. Photorealistic, professional, vivid colors, trending on artstation, attractive and detailed illustration.`;
      try {
        const result = await generateImage(prompt);
        if (typeof result === "object" && "base64" in result && "url" in result) {
          res.json({
            image: result.base64,
            imageUrl: result.url,
            imageFilepath: result.filepath
          });
        } else {
          res.json({ image: result });
        }
      } catch (imageError) {
        console.error("Detailed cover image generation error:", imageError);
        res.status(500).json({
          message: "Kh\xF4ng th\u1EC3 t\u1EA1o h\xECnh \u1EA3nh \u0111\u1EA1i di\u1EC7n. API t\u1EA1o \u1EA3nh kh\xF4ng kh\u1EA3 d\u1EE5ng. Vui l\xF2ng th\u1EED l\u1EA1i sau."
        });
      }
    } catch (error) {
      console.error("Error generating cover image:", error);
      res.status(500).json({
        message: "\u0110\xE3 x\u1EA3y ra l\u1ED7i khi t\u1EA1o h\xECnh \u1EA3nh \u0111\u1EA1i di\u1EC7n"
      });
    }
  });
  app2.post("/api/generate-cover-image", async (req, res) => {
    try {
      const { title, genre, content } = req.body;
      if (!title) {
        return res.status(400).json({
          success: false,
          message: "Vui l\xF2ng cung c\u1EA5p ti\xEAu \u0111\u1EC1 \u0111\u1EC3 t\u1EA1o h\xECnh \u1EA3nh \u0111\u1EA1i di\u1EC7n"
        });
      }
      const prompt = `T\u1EA1o h\xECnh \u1EA3nh b\xECa minh h\u1ECDa cho truy\u1EC7n c\xF3 t\u1EF1a \u0111\u1EC1 "${title}". Th\u1EC3 lo\u1EA1i: ${genre}. H\xECnh \u1EA3nh th\u1EF1c t\u1EBF, chuy\xEAn nghi\u1EC7p, m\xE0u s\u1EAFc s\u1ED1ng \u0111\u1ED9ng, phong c\xE1ch ngh\u1EC7 thu\u1EADt hi\u1EC7n \u0111\u1EA1i, minh h\u1ECDa h\u1EA5p d\u1EABn v\xE0 chi ti\u1EBFt.`;
      try {
        const result = await generateImage(prompt);
        if (typeof result === "object" && "base64" in result && "url" in result) {
          res.json({
            success: true,
            image: result.base64,
            imageUrl: result.url,
            timestamp: result.timestamp
          });
        } else {
          res.json({
            success: true,
            image: result
          });
        }
      } catch (imageError) {
        console.error("L\u1ED7i chi ti\u1EBFt khi t\u1EA1o h\xECnh \u1EA3nh \u0111\u1EA1i di\u1EC7n:", imageError);
        res.status(500).json({
          success: false,
          message: "Kh\xF4ng th\u1EC3 t\u1EA1o h\xECnh \u1EA3nh \u0111\u1EA1i di\u1EC7n. API t\u1EA1o \u1EA3nh kh\xF4ng kh\u1EA3 d\u1EE5ng. Vui l\xF2ng th\u1EED l\u1EA1i sau.",
          error: true
        });
      }
    } catch (error) {
      console.error("L\u1ED7i khi t\u1EA1o h\xECnh \u1EA3nh \u0111\u1EA1i di\u1EC7n:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "\u0110\xE3 x\u1EA3y ra l\u1ED7i khi t\u1EA1o h\xECnh \u1EA3nh \u0111\u1EA1i di\u1EC7n"
      });
    }
  });
  app2.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({
          success: false,
          message: "Vui l\xF2ng cung c\u1EA5p prompt \u0111\u1EC3 t\u1EA1o h\xECnh \u1EA3nh"
        });
      }
      try {
        const result = await generateImage(prompt);
        if (typeof result === "object" && "base64" in result && "url" in result) {
          const imageUrl = result.url;
          const absoluteUrl = imageUrl.startsWith("http") ? imageUrl : `${req.protocol}://${req.get("host")}${imageUrl}`;
          res.json({
            success: true,
            image: result.base64,
            // Vẫn giữ base64 để tương thích ngược
            imageUrl: absoluteUrl
            // URL tuyệt đối của hình ảnh
          });
        } else {
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
          message: "Kh\xF4ng th\u1EC3 t\u1EA1o h\xECnh \u1EA3nh. API t\u1EA1o \u1EA3nh kh\xF4ng kh\u1EA3 d\u1EE5ng. Vui l\xF2ng th\u1EED l\u1EA1i sau."
        });
      }
    } catch (error) {
      console.error("Error generating image:", error);
      res.status(500).json({
        success: false,
        message: "\u0110\xE3 x\u1EA3y ra l\u1ED7i khi t\u1EA1o h\xECnh \u1EA3nh"
      });
    }
  });
  app2.post("/api/create-video", async (req, res) => {
    try {
      const { audioPath, imagePath, title, resolution } = req.body;
      if (!audioPath || !imagePath) {
        return res.status(400).json({
          success: false,
          message: "Vui l\xF2ng cung c\u1EA5p \u0111\u01B0\u1EDDng d\u1EABn audio v\xE0 h\xECnh \u1EA3nh"
        });
      }
      console.log("Request t\u1EA1o video:", { audioPath, imagePath, title, resolution });
      let normalizedAudioPath = audioPath.startsWith("/") ? audioPath.substring(1) : audioPath;
      let normalizedImagePath = imagePath.startsWith("/") ? imagePath.substring(1) : imagePath;
      const fullAudioPath = path7.join(process.cwd(), normalizedAudioPath);
      const fullImagePath = path7.join(process.cwd(), normalizedImagePath);
      console.log("\u0110\u01B0\u1EDDng d\u1EABn \u0111\u1EA7y \u0111\u1EE7:", { fullAudioPath, fullImagePath });
      if (!fs7.existsSync(fullAudioPath)) {
        console.log("File audio kh\xF4ng t\u1ED3n t\u1EA1i:", fullAudioPath);
        const alternativePaths = [
          path7.join(process.cwd(), "uploads", path7.basename(normalizedAudioPath)),
          path7.join(process.cwd(), path7.basename(normalizedAudioPath))
        ];
        let found = false;
        for (const altPath of alternativePaths) {
          console.log("Th\u1EED t\xECm file audio t\u1EA1i:", altPath);
          if (fs7.existsSync(altPath)) {
            console.log("\u0110\xE3 t\xECm th\u1EA5y file audio t\u1EA1i:", altPath);
            normalizedAudioPath = path7.relative(process.cwd(), altPath);
            found = true;
            break;
          }
        }
        if (!found) {
          return res.status(400).json({
            success: false,
            message: "File audio kh\xF4ng t\u1ED3n t\u1EA1i ho\u1EB7c kh\xF4ng th\u1EC3 truy c\u1EADp"
          });
        }
      }
      if (!fs7.existsSync(fullImagePath)) {
        console.log("File h\xECnh \u1EA3nh kh\xF4ng t\u1ED3n t\u1EA1i:", fullImagePath);
        const alternativePaths = [
          path7.join(process.cwd(), "uploads", path7.basename(normalizedImagePath)),
          path7.join(process.cwd(), path7.basename(normalizedImagePath)),
          path7.join(process.cwd(), "public", "images", path7.basename(normalizedImagePath))
        ];
        let found = false;
        for (const altPath of alternativePaths) {
          console.log("Th\u1EED t\xECm file h\xECnh \u1EA3nh t\u1EA1i:", altPath);
          if (fs7.existsSync(altPath)) {
            console.log("\u0110\xE3 t\xECm th\u1EA5y file h\xECnh \u1EA3nh t\u1EA1i:", altPath);
            normalizedImagePath = path7.relative(process.cwd(), altPath);
            found = true;
            break;
          }
        }
        if (!found) {
          return res.status(400).json({
            success: false,
            message: "File h\xECnh \u1EA3nh kh\xF4ng t\u1ED3n t\u1EA1i ho\u1EB7c kh\xF4ng th\u1EC3 truy c\u1EADp"
          });
        }
      }
      const fullAudioPathUpdated = path7.join(process.cwd(), normalizedAudioPath);
      const fullImagePathUpdated = path7.join(process.cwd(), normalizedImagePath);
      const outputFilePath = await createVideoFromAudioAndImage(
        fullAudioPathUpdated,
        fullImagePathUpdated,
        {
          outputFileName: title || "video",
          resolution: resolution || "576x1024"
          // Mặc định là 9:16 (dọc) cho TikTok/Instagram
        }
      );
      const relativePath = path7.relative(process.cwd(), outputFilePath).replace(/\\/g, "/");
      res.json({
        success: true,
        message: "Video \u0111\xE3 \u0111\u01B0\u1EE3c t\u1EA1o th\xE0nh c\xF4ng",
        videoUrl: `/${relativePath}`
      });
    } catch (error) {
      console.error("L\u1ED7i khi t\u1EA1o video:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "\u0110\xE3 x\u1EA3y ra l\u1ED7i khi t\u1EA1o video"
      });
    }
  });
  app2.post("/api/create-story-video", async (req, res) => {
    try {
      const { audioPath, coverImagePath, title, resolution } = req.body;
      if (!audioPath || !coverImagePath) {
        return res.status(400).json({
          success: false,
          message: "Vui l\xF2ng cung c\u1EA5p \u0111\u01B0\u1EDDng d\u1EABn audio v\xE0 h\xECnh \u1EA3nh b\xECa"
        });
      }
      console.log("Request t\u1EA1o video truy\u1EC7n:", { audioPath, coverImagePath, title, resolution });
      let normalizedAudioPath = audioPath.startsWith("/") ? audioPath.substring(1) : audioPath;
      let normalizedImagePath = coverImagePath.startsWith("/") ? coverImagePath.substring(1) : coverImagePath;
      const fullAudioPath = path7.join(process.cwd(), normalizedAudioPath);
      const fullImagePath = path7.join(process.cwd(), normalizedImagePath);
      console.log("\u0110\u01B0\u1EDDng d\u1EABn \u0111\u1EA7y \u0111\u1EE7:", { fullAudioPath, fullImagePath });
      if (!fs7.existsSync(fullAudioPath)) {
        console.log("File audio kh\xF4ng t\u1ED3n t\u1EA1i:", fullAudioPath);
        const alternativePaths = [
          path7.join(process.cwd(), "uploads", path7.basename(normalizedAudioPath)),
          path7.join(process.cwd(), path7.basename(normalizedAudioPath))
        ];
        let found = false;
        for (const altPath of alternativePaths) {
          console.log("Th\u1EED t\xECm file audio t\u1EA1i:", altPath);
          if (fs7.existsSync(altPath)) {
            console.log("\u0110\xE3 t\xECm th\u1EA5y file audio t\u1EA1i:", altPath);
            normalizedAudioPath = path7.relative(process.cwd(), altPath);
            found = true;
            break;
          }
        }
        if (!found) {
          return res.status(400).json({
            success: false,
            message: "File audio kh\xF4ng t\u1ED3n t\u1EA1i ho\u1EB7c kh\xF4ng th\u1EC3 truy c\u1EADp"
          });
        }
      }
      if (!fs7.existsSync(fullImagePath)) {
        console.log("File h\xECnh \u1EA3nh kh\xF4ng t\u1ED3n t\u1EA1i:", fullImagePath);
        const alternativePaths = [
          path7.join(process.cwd(), "uploads", path7.basename(normalizedImagePath)),
          path7.join(process.cwd(), path7.basename(normalizedImagePath)),
          path7.join(process.cwd(), "public", "images", path7.basename(normalizedImagePath))
        ];
        let found = false;
        for (const altPath of alternativePaths) {
          console.log("Th\u1EED t\xECm file h\xECnh \u1EA3nh t\u1EA1i:", altPath);
          if (fs7.existsSync(altPath)) {
            console.log("\u0110\xE3 t\xECm th\u1EA5y file h\xECnh \u1EA3nh t\u1EA1i:", altPath);
            normalizedImagePath = path7.relative(process.cwd(), altPath);
            found = true;
            break;
          }
        }
        if (!found) {
          return res.status(400).json({
            success: false,
            message: "File h\xECnh \u1EA3nh kh\xF4ng t\u1ED3n t\u1EA1i ho\u1EB7c kh\xF4ng th\u1EC3 truy c\u1EADp"
          });
        }
      }
      const outputFilePath = await createStoryVideo(
        fullAudioPath,
        fullImagePath,
        {
          title: title || "story",
          resolution: resolution || "1280x720"
        }
      );
      const relativePath = path7.relative(process.cwd(), outputFilePath).replace(/\\/g, "/");
      res.json({
        success: true,
        message: "Video truy\u1EC7n \u0111\xE3 \u0111\u01B0\u1EE3c t\u1EA1o th\xE0nh c\xF4ng",
        videoUrl: `/${relativePath}`
      });
    } catch (error) {
      console.error("L\u1ED7i khi t\u1EA1o video truy\u1EC7n:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "\u0110\xE3 x\u1EA3y ra l\u1ED7i khi t\u1EA1o video truy\u1EC7n"
      });
    }
  });
  app2.post("/api/create-slideshow", async (req, res) => {
    try {
      const { imagePaths, audioPath, title, duration } = req.body;
      if (!imagePaths || !imagePaths.length) {
        return res.status(400).json({
          success: false,
          message: "Vui l\xF2ng cung c\u1EA5p \xEDt nh\u1EA5t m\u1ED9t \u0111\u01B0\u1EDDng d\u1EABn h\xECnh \u1EA3nh"
        });
      }
      const processedImagePaths = imagePaths.map((imgPath) => {
        const normalizedPath = imgPath.startsWith("/") ? imgPath.substring(1) : imgPath;
        const fullPath = path7.join(process.cwd(), normalizedPath);
        if (!fs7.existsSync(fullPath)) {
          const alternativePaths = [
            path7.join(process.cwd(), "uploads", path7.basename(normalizedPath)),
            path7.join(process.cwd(), path7.basename(normalizedPath)),
            path7.join(process.cwd(), "public", "images", path7.basename(normalizedPath))
          ];
          for (const altPath of alternativePaths) {
            if (fs7.existsSync(altPath)) {
              return altPath;
            }
          }
          throw new Error(`Kh\xF4ng t\xECm th\u1EA5y h\xECnh \u1EA3nh t\u1EA1i: ${imgPath}`);
        }
        return fullPath;
      });
      if (!audioPath) {
        return res.status(400).json({
          success: false,
          message: "C\u1EA7n cung c\u1EA5p \u0111\u01B0\u1EDDng d\u1EABn t\u1EDBi file audio"
        });
      }
      const normalizedAudioPath = audioPath.startsWith("/") ? audioPath.substring(1) : audioPath;
      const fullAudioPath = path7.join(process.cwd(), normalizedAudioPath);
      let processedAudioPath = fullAudioPath;
      if (!fs7.existsSync(fullAudioPath)) {
        const alternativePaths = [
          path7.join(process.cwd(), "uploads", path7.basename(normalizedAudioPath)),
          path7.join(process.cwd(), path7.basename(normalizedAudioPath))
        ];
        let found = false;
        for (const altPath of alternativePaths) {
          if (fs7.existsSync(altPath)) {
            processedAudioPath = altPath;
            found = true;
            break;
          }
        }
        if (!found) {
          return res.status(400).json({
            success: false,
            message: "File audio kh\xF4ng t\u1ED3n t\u1EA1i ho\u1EB7c kh\xF4ng th\u1EC3 truy c\u1EADp"
          });
        }
      }
      const outputFilePath = await createSlideshowVideo(
        processedAudioPath,
        processedImagePaths,
        {
          outputFileName: title ?? "slideshow",
          slideDuration: duration || 2
        }
      );
      const relativePath = path7.relative(process.cwd(), outputFilePath).replace(/\\/g, "/");
      res.json({
        success: true,
        message: "Slideshow \u0111\xE3 \u0111\u01B0\u1EE3c t\u1EA1o th\xE0nh c\xF4ng",
        videoUrl: `/${relativePath}`
      });
    } catch (error) {
      console.error("L\u1ED7i khi t\u1EA1o slideshow:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "\u0110\xE3 x\u1EA3y ra l\u1ED7i khi t\u1EA1o slideshow"
      });
    }
  });
  app2.get("/api/task/:taskId", async (req, res) => {
    try {
      const { taskId } = req.params;
      if (!taskId) {
        return res.status(400).json({
          success: false,
          message: "Vui l\xF2ng cung c\u1EA5p task ID"
        });
      }
      const task = taskManager.getTask(taskId);
      if (!task) {
        return res.status(404).json({
          success: false,
          message: "Kh\xF4ng t\xECm th\u1EA5y task v\u1EDBi ID \u0111\xE3 cung c\u1EA5p"
        });
      }
      res.json({
        success: true,
        task
      });
    } catch (error) {
      console.error("L\u1ED7i khi l\u1EA5y th\xF4ng tin task:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "\u0110\xE3 x\u1EA3y ra l\u1ED7i khi l\u1EA5y th\xF4ng tin task"
      });
    }
  });
  app2.post("/api/create-video-async", async (req, res) => {
    try {
      const { audioPath, imagePath, title, options } = req.body;
      if (!audioPath || !imagePath) {
        return res.status(400).json({
          success: false,
          message: "Vui l\xF2ng cung c\u1EA5p \u0111\u01B0\u1EDDng d\u1EABn file audio v\xE0 \u1EA3nh"
        });
      }
      const taskId = await createStoryVideoAsync(audioPath, imagePath, {
        title,
        ...options
      });
      res.json({
        success: true,
        message: "\u0110\xE3 b\u1EAFt \u0111\u1EA7u t\u1EA1o video",
        taskId
      });
    } catch (error) {
      console.error("L\u1ED7i khi t\u1EA1o video b\u1EA5t \u0111\u1ED3ng b\u1ED9:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "\u0110\xE3 x\u1EA3y ra l\u1ED7i khi t\u1EA1o video"
      });
    }
  });
  app2.post("/api/create-slideshow-async", async (req, res) => {
    try {
      const { audioPath, imagePaths, options } = req.body;
      if (!audioPath || !imagePaths || !Array.isArray(imagePaths) || imagePaths.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Vui l\xF2ng cung c\u1EA5p \u0111\u01B0\u1EDDng d\u1EABn file audio v\xE0 danh s\xE1ch \u1EA3nh"
        });
      }
      const taskId = await createSlideshowVideoAsync(audioPath, imagePaths, options);
      res.json({
        success: true,
        message: "\u0110\xE3 b\u1EAFt \u0111\u1EA7u t\u1EA1o slideshow",
        taskId
      });
    } catch (error) {
      console.error("L\u1ED7i khi t\u1EA1o slideshow b\u1EA5t \u0111\u1ED3ng b\u1ED9:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "\u0110\xE3 x\u1EA3y ra l\u1ED7i khi t\u1EA1o slideshow"
      });
    }
  });
  app2.post("/api/auto-create-video-async", async (req, res) => {
    try {
      const { title, storyText, genre } = req.body;
      if (!title || !storyText) {
        return res.status(400).json({
          success: false,
          message: "Vui l\xF2ng cung c\u1EA5p ti\xEAu \u0111\u1EC1 v\xE0 n\u1ED9i dung truy\u1EC7n"
        });
      }
      console.log(`B\u1EAFt \u0111\u1EA7u t\u1EA1o video t\u1EF1 \u0111\u1ED9ng cho: ${title}`);
      console.log("B\u01B0\u1EDBc 1: T\u1EA1o h\xECnh \u1EA3nh \u0111\u1EA1i di\u1EC7n");
      const imagePrompt = `T\u1EA1o h\xECnh \u1EA3nh b\xECa minh h\u1ECDa cho truy\u1EC7n c\xF3 t\u1EF1a \u0111\u1EC1 "${title}". Th\u1EC3 lo\u1EA1i: ${genre || "T\u1ED5ng h\u1EE3p"}. H\xECnh \u1EA3nh th\u1EF1c t\u1EBF, chuy\xEAn nghi\u1EC7p, m\xE0u s\u1EAFc s\u1ED1ng \u0111\u1ED9ng, phong c\xE1ch ngh\u1EC7 thu\u1EADt hi\u1EC7n \u0111\u1EA1i, minh h\u1ECDa h\u1EA5p d\u1EABn v\xE0 chi ti\u1EBFt.`;
      const task = taskManager.createTask("video", {
        title,
        genre,
        startTime: /* @__PURE__ */ new Date()
      });
      setTimeout(async () => {
        try {
          taskManager.updateTaskStatus(task.id, "processing");
          taskManager.updateTaskProgress(task.id, 5);
          try {
            const imageResult = await generateImage(imagePrompt);
            taskManager.updateTaskProgress(task.id, 20);
            let imagePath = "";
            if (typeof imageResult === "string") {
              const fileName = `cover_${Date.now()}.jpg`;
              const uploadDir = path7.join(process.cwd(), "uploads");
              if (!fs7.existsSync(uploadDir)) {
                fs7.mkdirSync(uploadDir, { recursive: true });
              }
              imagePath = path7.join(uploadDir, fileName);
              fs7.writeFileSync(imagePath, Buffer.from(imageResult, "base64"));
            } else if (imageResult.filepath) {
              imagePath = imageResult.filepath;
            } else {
              throw new Error("Kh\xF4ng th\u1EC3 t\u1EA1o h\xECnh \u1EA3nh b\xECa");
            }
            console.log("B\u01B0\u1EDBc 2: T\u1EA1o audio t\u1EEB n\u1ED9i dung truy\u1EC7n");
            taskManager.updateTaskProgress(task.id, 25);
            const audioBase64 = await generateAudio(storyText);
            taskManager.updateTaskProgress(task.id, 55);
            const audioFileName = `story_${Date.now()}.mp3`;
            const audioDir = path7.join(process.cwd(), "uploads");
            if (!fs7.existsSync(audioDir)) {
              fs7.mkdirSync(audioDir, { recursive: true });
            }
            const audioPath = path7.join(audioDir, audioFileName);
            fs7.writeFileSync(audioPath, Buffer.from(audioBase64, "base64"));
            console.log("B\u01B0\u1EDBc 3: T\u1EA1o video t\u1EEB audio v\xE0 h\xECnh \u1EA3nh");
            taskManager.updateTaskProgress(task.id, 60);
            const videoPath = await createStoryVideo(audioPath, imagePath, {
              title,
              addSmokeFx: genre?.toLowerCase().includes("kinh d\u1ECB") || genre?.toLowerCase().includes("b\xED \u1EA9n")
            });
            taskManager.updateTaskProgress(task.id, 100);
            const videoUrl = "/videos/" + path7.basename(videoPath);
            taskManager.updateTaskStatus(task.id, "completed", {
              videoPath,
              videoUrl,
              title
            });
          } catch (error) {
            console.error("L\u1ED7i trong qu\xE1 tr\xECnh x\u1EED l\xFD t\u1EA1o video t\u1EF1 \u0111\u1ED9ng:", error);
            taskManager.updateTaskStatus(task.id, "failed", null, error instanceof Error ? error.message : String(error));
          }
        } catch (outerError) {
          console.error("L\u1ED7i ngo\xE0i trong qu\xE1 tr\xECnh x\u1EED l\xFD t\u1EA1o video t\u1EF1 \u0111\u1ED9ng:", outerError);
          taskManager.updateTaskStatus(task.id, "failed", null, outerError instanceof Error ? outerError.message : String(outerError));
        }
      }, 0);
      res.json({
        success: true,
        message: "\u0110\xE3 b\u1EAFt \u0111\u1EA7u t\u1EA1o video t\u1EF1 \u0111\u1ED9ng",
        taskId: task.id
      });
    } catch (error) {
      console.error("L\u1ED7i khi b\u1EAFt \u0111\u1EA7u t\u1EA1o video t\u1EF1 \u0111\u1ED9ng:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "\u0110\xE3 x\u1EA3y ra l\u1ED7i khi b\u1EAFt \u0111\u1EA7u t\u1EA1o video"
      });
    }
  });
  app2.post("/api/auto-create-video", async (req, res) => {
    try {
      const { title, content, genre } = req.body;
      if (!title || !content) {
        return res.status(400).json({
          success: false,
          message: "Vui l\xF2ng cung c\u1EA5p ti\xEAu \u0111\u1EC1 v\xE0 n\u1ED9i dung \u0111\u1EC3 t\u1EA1o video"
        });
      }
      console.log(`B\u1EAFt \u0111\u1EA7u t\u1EA1o video t\u1EF1 \u0111\u1ED9ng cho: ${title}`);
      const task = taskManager.createTask("video", {
        title,
        genre,
        startTime: /* @__PURE__ */ new Date()
      });
      res.json({
        success: true,
        message: "\u0110\xE3 b\u1EAFt \u0111\u1EA7u t\u1EA1o video t\u1EF1 \u0111\u1ED9ng. Qu\xE1 tr\xECnh n\xE0y s\u1EBD m\u1EA5t v\xE0i ph\xFAt, b\u1EA1n c\xF3 th\u1EC3 theo d\xF5i ti\u1EBFn \u0111\u1ED9 v\u1EDBi task_id.",
        taskId: task.id
      });
      setTimeout(async () => {
        try {
          taskManager.updateTaskStatus(task.id, "processing");
          taskManager.updateTaskProgress(task.id, 5);
          console.log("B\u01B0\u1EDBc 1: T\u1EA1o h\xECnh \u1EA3nh \u0111\u1EA1i di\u1EC7n");
          const imagePrompt = `T\u1EA1o h\xECnh \u1EA3nh b\xECa minh h\u1ECDa cho truy\u1EC7n c\xF3 t\u1EF1a \u0111\u1EC1 "${title}". Th\u1EC3 lo\u1EA1i: ${genre || "T\xECnh c\u1EA3m"}. H\xECnh \u1EA3nh th\u1EF1c t\u1EBF, chuy\xEAn nghi\u1EC7p, m\xE0u s\u1EAFc s\u1ED1ng \u0111\u1ED9ng, phong c\xE1ch ngh\u1EC7 thu\u1EADt hi\u1EC7n \u0111\u1EA1i, minh h\u1ECDa h\u1EA5p d\u1EABn v\xE0 chi ti\u1EBFt.`;
          try {
            taskManager.updateTaskProgress(task.id, 10);
            const imageResult = await generateImage(imagePrompt);
            console.log("\u0110\xE3 t\u1EA1o xong h\xECnh \u1EA3nh \u0111\u1EA1i di\u1EC7n");
            taskManager.updateTaskProgress(task.id, 30);
            let imagePath = "";
            if (typeof imageResult === "object" && imageResult !== null && "filepath" in imageResult) {
              imagePath = imageResult.filepath;
            } else {
              let base64Data = "";
              if (typeof imageResult === "object" && imageResult !== null && "base64" in imageResult) {
                const imgResult = imageResult;
                base64Data = String(imgResult.base64 || "");
              } else if (typeof imageResult === "string") {
                base64Data = imageResult;
              }
              if (!base64Data) {
                throw new Error("Kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u h\xECnh \u1EA3nh h\u1EE3p l\u1EC7");
              }
              const imageBuffer = Buffer.from(base64Data, "base64");
              const imageFileName = `image_${Date.now()}.jpg`;
              const imageDir = path7.join(process.cwd(), "public", "images");
              if (!fs7.existsSync(imageDir)) {
                fs7.mkdirSync(imageDir, { recursive: true });
              }
              imagePath = path7.join(imageDir, imageFileName);
              fs7.writeFileSync(imagePath, imageBuffer);
              console.log("\u0110\xE3 l\u01B0u h\xECnh \u1EA3nh t\u1EA1i:", imagePath);
            }
            console.log("B\u01B0\u1EDBc 2: T\u1EA1o audio t\u1EEB n\u1ED9i dung");
            taskManager.updateTaskProgress(task.id, 35);
            let audioBase64;
            try {
              audioBase64 = await generateAudio(content);
              console.log("\u0110\xE3 t\u1EA1o xong audio, \u0111\u1ED9 d\xE0i:", audioBase64.length);
              taskManager.updateTaskProgress(task.id, 60);
              const audioFileName = `audio_${Date.now()}.mp3`;
              const uploadsDir3 = path7.join(process.cwd(), "uploads");
              if (!fs7.existsSync(uploadsDir3)) {
                fs7.mkdirSync(uploadsDir3, { recursive: true });
              }
              const audioPath = path7.join(uploadsDir3, audioFileName);
              fs7.writeFileSync(audioPath, Buffer.from(audioBase64, "base64"));
              console.log("\u0110\xE3 l\u01B0u file audio t\u1EA1i:", audioPath);
              console.log("B\u01B0\u1EDBc 3: T\u1EA1o video t\u1EEB audio v\xE0 h\xECnh \u1EA3nh");
              taskManager.updateTaskProgress(task.id, 65);
              try {
                const outputPath = await createStoryVideo(
                  audioPath,
                  imagePath,
                  {
                    title,
                    resolution: "720x1280",
                    // Tỉ lệ 9:16 cho di động
                    addSmokeFx: genre?.toLowerCase().includes("kinh d\u1ECB") || genre?.toLowerCase().includes("b\xED \u1EA9n")
                    // Thêm hiệu ứng sương khói cho truyện kinh dị
                  }
                );
                const relativePath = "/" + path7.relative(process.cwd(), outputPath).replace(/\\/g, "/");
                taskManager.updateTaskProgress(task.id, 100);
                taskManager.updateTaskStatus(task.id, "completed", {
                  videoUrl: relativePath,
                  imageUrl: `/public/images/${path7.basename(imagePath)}`,
                  audioPath: `/uploads/${audioFileName}`
                });
              } catch (videoError) {
                console.error("L\u1ED7i khi t\u1EA1o video:", videoError);
                taskManager.updateTaskStatus(task.id, "failed", {
                  imageUrl: `/public/images/${path7.basename(imagePath)}`,
                  audioPath: `/uploads/${audioFileName}`,
                  error: videoError instanceof Error ? videoError.message : String(videoError)
                }, "\u0110\xE3 x\u1EA3y ra l\u1ED7i khi t\u1EA1o video, nh\u01B0ng audio v\xE0 h\xECnh \u1EA3nh \u0111\xE3 \u0111\u01B0\u1EE3c t\u1EA1o th\xE0nh c\xF4ng");
              }
            } catch (audioError) {
              console.error("L\u1ED7i khi t\u1EA1o audio:", audioError);
              taskManager.updateTaskStatus(task.id, "failed", {
                imageUrl: `/public/images/${path7.basename(imagePath)}`
              }, "\u0110\xE3 x\u1EA3y ra l\u1ED7i khi t\u1EA1o audio, nh\u01B0ng h\xECnh \u1EA3nh \u0111\xE3 \u0111\u01B0\u1EE3c t\u1EA1o th\xE0nh c\xF4ng");
            }
          } catch (imageError) {
            console.error("L\u1ED7i khi t\u1EA1o h\xECnh \u1EA3nh:", imageError);
            taskManager.updateTaskStatus(
              task.id,
              "failed",
              null,
              `\u0110\xE3 x\u1EA3y ra l\u1ED7i khi t\u1EA1o h\xECnh \u1EA3nh \u0111\u1EA1i di\u1EC7n: ${imageError instanceof Error ? imageError.message : String(imageError)}`
            );
          }
        } catch (error) {
          console.error("L\u1ED7i khi t\u1EA1o video t\u1EF1 \u0111\u1ED9ng:", error);
          taskManager.updateTaskStatus(
            task.id,
            "failed",
            null,
            `L\u1ED7i kh\xF4ng x\xE1c \u0111\u1ECBnh: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }, 0);
    } catch (error) {
      console.error("L\u1ED7i khi b\u1EAFt \u0111\u1EA7u t\u1EA1o video t\u1EF1 \u0111\u1ED9ng:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "\u0110\xE3 x\u1EA3y ra l\u1ED7i khi t\u1EA1o video t\u1EF1 \u0111\u1ED9ng"
      });
    }
  });
  app2.post("/api/test-gemini", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({
          success: false,
          message: "Vui l\xF2ng cung c\u1EA5p prompt \u0111\u1EC3 ki\u1EC3m tra"
        });
      }
      const testPrompt = `test_gemini ${prompt}`;
      const result = await generateContent(testPrompt);
      res.json({
        success: true,
        result
      });
    } catch (error) {
      console.error("L\u1ED7i khi ki\u1EC3m tra Gemini API:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "\u0110\xE3 x\u1EA3y ra l\u1ED7i khi ki\u1EC3m tra Gemini API"
      });
    }
  });
  app2.use((err, _req, res, _next) => {
    console.error("Express error handler:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  });
  return app2.listen(5010, "0.0.0.0", () => {
    log(`serving on port 5000`);
  });
}

// server/index.ts
import path8 from "path";
var app = express3();
app.use(express3.json({ limit: "50mb" }));
app.use(express3.urlencoded({ extended: false, limit: "50mb" }));
app.use((req, res, next) => {
  const start = Date.now();
  const path9 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path9.startsWith("/api")) {
      let logLine = `${req.method} ${path9} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use("/uploads", express3.static(path8.join(process.cwd(), "uploads")));
  app.use("/public", express3.static(path8.join(process.cwd(), "public")));
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = 5010;
  if (!server.listening) {
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true
    }, () => {
      log(`serving on port ${port}`);
    });
  } else {
    log(`server already listening on port ${port}`);
  }
})();
