// Kiểm tra Gemini API với các model khác nhau
import axios from 'axios';

async function testGemini() {
  try {
    console.log("Kiểm tra Gemini API...");
    
    const prompt = "Viết 1 câu chuyện ngắn về mèo"; // Có thể thay đổi prompt
    
    const response = await axios.post('http://localhost:5000/api/test-gemini', {
      prompt: prompt
    });
    
    console.log("Kết quả:", response.data);
    
    if (response.data.success) {
      console.log("API Gemini hoạt động thành công!");
      console.log("Nội dung phản hồi:", response.data.result);
    } else {
      console.error("API Gemini không hoạt động:", response.data.message);
    }
  } catch (error) {
    console.error("Lỗi khi kiểm tra:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
  }
}

testGemini();