/**
 * Cấu hình hiển thị các tính năng trong ứng dụng
 */

export const featureConfig = {
  /**
   * Hiển thị tính năng tạo hình ảnh
   * Khi tắt, các component liên quan đến tạo hình ảnh sẽ bị ẩn đi
   */
  showImageGeneration: true,

  /**
   * Hiển thị tính năng tạo audio
   * Khi tắt, các component liên quan đến tạo và phát audio sẽ bị ẩn đi
   */
  showAudioGeneration: true,

  /**
   * Hiển thị tính năng tạo video
   * Khi tắt, các liên kết và trang tạo video sẽ bị ẩn đi
   */
  showVideoGeneration: true,

  /**
   * Hiển thị tính năng phân tích hình ảnh
   * Khi tắt, các component liên quan đến phân tích hình ảnh sẽ bị ẩn đi
   */
  showImageAnalysis: true,
  
  /**
   * Hiển thị tính năng tạo podcast
   * Khi tắt, tab và chức năng tạo podcast sẽ bị ẩn đi
   */
  showPodcastGeneration: true,
  
  /**
   * Hiển thị tính năng GPT Voice
   * Khi tắt, tab và chức năng GPT Voice sẽ bị ẩn đi
   */
  showGPTVoice: true
};