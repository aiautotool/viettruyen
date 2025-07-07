import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { log } from './vite';
import { taskManager } from './taskManager';

// Cấu hình ffmpeg với đường dẫn từ ffmpeg-installer hoặc sử dụng ffmpeg hệ thống
try {
  // Thử sử dụng ffmpeg từ hệ thống (đã cài đặt qua nix)
  ffmpeg.setFfmpegPath('ffmpeg');
  console.log('Sử dụng FFmpeg từ hệ thống');
} catch (error) {
  // Nếu không thành công, sử dụng ffmpeg từ npm
  ffmpeg.setFfmpegPath(ffmpegInstaller.path);
  console.log('Sử dụng FFmpeg từ node_modules');
}

// Đường dẫn cho thư mục uploads
const uploadsDir = './uploads';
// Đảm bảo thư mục uploads tồn tại
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Thư mục videos trong public
const videosDir = path.join(process.cwd(), 'public', 'videos');
if (!fs.existsSync(videosDir)) {
  fs.mkdirSync(videosDir, { recursive: true });
}

// Thư mục hiệu ứng
const effectsDir = path.join(process.cwd(), 'public', 'images', 'effects');
if (!fs.existsSync(effectsDir)) {
  fs.mkdirSync(effectsDir, { recursive: true });
}

// Tạo thư mục uploads/videos nếu cần
const uploadsVideosDir = path.join(uploadsDir, 'videos');
if (!fs.existsSync(uploadsVideosDir)) {
  fs.mkdirSync(uploadsVideosDir, { recursive: true });
}

/**
 * Tạo slideshow video từ audio và background image
 */
export async function createVideoFromAudioAndImage(
  audioPath: string,
  imagePath: string,
  options: {
    outputFileName?: string;
    duration?: number;
    resolution?: string;
  } = {}
): Promise<string> {
  try {
    // Nếu không có tệp đầu vào, ném lỗi
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Không tìm thấy file audio: ${audioPath}`);
    }
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Không tìm thấy file ảnh: ${imagePath}`);
    }

    // Tên tệp đầu ra - đảm bảo không có ký tự đặc biệt
    // Loại bỏ ký tự không phải chữ cái, số, gạch ngang, gạch dưới
    const safeOutputFileName = options.outputFileName 
      ? options.outputFileName.replace(/[^\w\-_.]/g, '_') + '.mp4'
      : `video_${uuidv4()}.mp4`;
    
    log(`[video] Tên file video đã chuẩn hóa: ${safeOutputFileName}`);
    const outputPath = path.join(videosDir, safeOutputFileName);

    // Độ phân giải
    const resolution = options.resolution || '1280x720';

    log(`Bắt đầu tạo video với audio: ${audioPath} và ảnh: ${imagePath}`, 'video');

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(imagePath)
        .inputOptions(['-loop 1']) // Lặp lại ảnh
        .input(audioPath)
        .outputOptions([
          '-c:v libx264',          // Codec video
          '-tune stillimage',       // Tối ưu cho ảnh tĩnh
          '-c:a aac',              // Codec audio
          '-b:a 192k',             // Bitrate audio
          '-pix_fmt yuv420p',      // Pixel format
          '-shortest',             // Thời lượng video bằng với audio
          `-vf scale=${resolution}` // Đặt độ phân giải
        ])
        .output(outputPath)
        .on('start', (command) => {
          log(`Lệnh ffmpeg: ${command}`, 'video');
        })
        .on('progress', (progress) => {
          log(`Tiến độ xử lý: ${progress.percent?.toFixed(2)}%`, 'video');
        })
        .on('error', (err) => {
          log(`Lỗi tạo video: ${err.message}`, 'video');
          reject(err);
        })
        .on('end', () => {
          log(`Video đã được tạo thành công: ${outputPath}`, 'video');
          resolve(outputPath);
        })
        .run();
    });
  } catch (error) {
    log(`Lỗi trong quá trình tạo video: ${error instanceof Error ? error.message : String(error)}`, 'video');
    throw error;
  }
}

/**
 * Tạo slideshow video từ nhiều ảnh và audio
 */
export async function createSlideshowVideo(
  audioPath: string,
  imagePaths: string[],
  options: {
    outputFileName?: string;
    slideDuration?: number;
    resolution?: string;
    transition?: boolean;
    transitionDuration?: number;
  } = {}
): Promise<string> {
  try {
    // Nếu không có tệp đầu vào, ném lỗi
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Không tìm thấy file audio: ${audioPath}`);
    }

    if (imagePaths.length === 0) {
      throw new Error('Không có hình ảnh nào được cung cấp');
    }

    // Kiểm tra tất cả đường dẫn hình ảnh
    for (const imgPath of imagePaths) {
      if (!fs.existsSync(imgPath)) {
        throw new Error(`Không tìm thấy file ảnh: ${imgPath}`);
      }
    }

    // Tạo file tạm chứa danh sách hình ảnh
    const imageListFile = path.join(uploadsDir, `image_list_${uuidv4()}.txt`);
    const slideDuration = options.slideDuration || 5; // Thời gian hiển thị mỗi ảnh (giây)
    
    // Tạo nội dung cho file danh sách
    let imageListContent = '';
    imagePaths.forEach(imgPath => {
      imageListContent += `file '${imgPath}'\nduration ${slideDuration}\n`;
    });
    // Lặp lại ảnh cuối cùng (cần thiết cho ffmpeg)
    imageListContent += `file '${imagePaths[imagePaths.length - 1]}'`;
    
    fs.writeFileSync(imageListFile, imageListContent);

    // Tên tệp đầu ra - đảm bảo không có ký tự đặc biệt
    const safeOutputFileName = options.outputFileName 
      ? options.outputFileName.replace(/[^\w\-_.]/g, '_') + '.mp4'
      : `slideshow_${uuidv4()}.mp4`;
    
    log(`[video] Tên file slideshow đã chuẩn hóa: ${safeOutputFileName}`);
    const outputPath = path.join(videosDir, safeOutputFileName);

    // Độ phân giải
    const resolution = options.resolution || '1280x720';

    log(`Bắt đầu tạo slideshow với ${imagePaths.length} ảnh và audio: ${audioPath}`, 'video');

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(imageListFile)
        .inputOptions(['-f concat', '-safe 0'])
        .input(audioPath)
        .outputOptions([
          '-c:v libx264',          // Codec video
          '-c:a aac',              // Codec audio
          '-b:a 192k',             // Bitrate audio
          '-pix_fmt yuv420p',      // Pixel format
          '-shortest',             // Thời lượng video bằng với audio
          `-vf scale=${resolution}` // Đặt độ phân giải
        ])
        .output(outputPath)
        .on('start', (command) => {
          log(`Lệnh ffmpeg: ${command}`, 'video');
        })
        .on('progress', (progress) => {
          log(`Tiến độ xử lý: ${progress.percent?.toFixed(2)}%`, 'video');
        })
        .on('error', (err) => {
          log(`Lỗi tạo slideshow: ${err.message}`, 'video');
          // Xóa file tạm sau khi xử lý
          try {
            fs.unlinkSync(imageListFile);
          } catch (e) {
            log(`Không thể xóa file tạm: ${e instanceof Error ? e.message : String(e)}`, 'video');
          }
          reject(err);
        })
        .on('end', () => {
          log(`Slideshow đã được tạo thành công: ${outputPath}`, 'video');
          // Xóa file tạm sau khi xử lý
          try {
            fs.unlinkSync(imageListFile);
          } catch (e) {
            log(`Không thể xóa file tạm: ${e instanceof Error ? e.message : String(e)}`, 'video');
          }
          resolve(outputPath);
        })
        .run();
    });
  } catch (error) {
    log(`Lỗi trong quá trình tạo slideshow: ${error instanceof Error ? error.message : String(error)}`, 'video');
    throw error;
  }
}

/**
 * Tạo video từ truyện với audio và một ảnh đại diện
 */
export async function createStoryVideo(
  audioPath: string, 
  coverImagePath: string,
  options: {
    title?: string;
    outputFileName?: string;
    resolution?: string;
    addSmokeFx?: boolean;
  } = {}
): Promise<string> {
  try {
    // Kiểm tra file đầu vào
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Không tìm thấy file audio: ${audioPath}`);
    }
    if (!fs.existsSync(coverImagePath)) {
      throw new Error(`Không tìm thấy file ảnh bìa: ${coverImagePath}`);
    }

    // Tên tệp đầu ra - đảm bảo không có ký tự đặc biệt
    const safeTitle = options.title ? options.title.replace(/[^\w\-_.]/g, '_').toLowerCase() : 'story';
    const safeOutputFileName = options.outputFileName 
      ? options.outputFileName.replace(/[^\w\-_.]/g, '_') + '.mp4'
      : `${safeTitle}_${uuidv4()}.mp4`;
    
    log(`[video] Tên file video truyện đã chuẩn hóa: ${safeOutputFileName}`);
    const outputPath = path.join(videosDir, safeOutputFileName);

    // Độ phân giải
    const resolution = options.resolution || '1280x720';

    log(`Bắt đầu tạo video truyện với audio: ${audioPath} và ảnh bìa: ${coverImagePath} (Độ phân giải: ${resolution})`, 'video');
    
    // Kiểm tra nếu cần thêm hiệu ứng sương khói
    const smokeFxPath = path.join(effectsDir, 'smoke.svg');
    const fogFxPath = path.join(effectsDir, 'fog.svg');
    const cloudsFxPath = path.join(effectsDir, 'clouds.svg');
    const useSmokeFx = options.addSmokeFx !== false; // Mặc định là true nếu không được chỉ định
    
    if (useSmokeFx) {
      log(`Thêm hiệu ứng sương khói vào video`, 'video');
    }

    return new Promise((resolve, reject) => {
      let command = ffmpeg();
      
      // Input cho hình ảnh chính
      command = command.input(coverImagePath)
        .inputOptions(['-loop 1']); // Lặp lại ảnh
      
      // Input cho audio
      command = command.input(audioPath);
      
      // Phương pháp đơn giản hơn cho hiệu ứng sương khói
      // Thay vì sử dụng filter_complex, chúng ta sẽ chỉ làm mờ hình ảnh và thêm overlay màu để tạo hiệu ứng
      let vfOption = '';
      
      if (useSmokeFx) {
        // Sử dụng một hiệu ứng đơn giản hơn với boxblur và coloroverlay để giả lập sương khói
        log(`Thêm hiệu ứng sương khói đơn giản (dùng coloroverlay và boxblur)`, 'video');
        
        // Tạo hiệu ứng khói bằng boxblur và overlay màu
        // Format: scale => boxblur + hue/colorize để tạo hiệu ứng sương mù
        vfOption = `scale=${resolution},boxblur=luma_radius=2:luma_power=1:enable='between(t,0,999999)',hue=s=0.1:enable='between(t,0,999999)'`;
      } else {
        // Nếu không sử dụng hiệu ứng, chỉ scale hình ảnh
        vfOption = `scale=${resolution}`;
      }
      
      // Cấu hình output
      const outputOptions = [
        '-c:v libx264',          // Codec video
        '-tune stillimage',       // Tối ưu cho ảnh tĩnh
        '-c:a aac',              // Codec audio
        '-b:a 192k',             // Bitrate audio
        '-pix_fmt yuv420p',      // Pixel format
        '-shortest',             // Thời lượng video bằng với audio
        `-vf ${vfOption}`        // Video filters (scale, hiệu ứng)
      ];
      
      command.outputOptions(outputOptions)
        .output(outputPath)
        .on('start', (command) => {
          log(`Lệnh ffmpeg: ${command}`, 'video');
        })
        .on('progress', (progress) => {
          log(`Tiến độ xử lý: ${progress.percent?.toFixed(2)}%`, 'video');
        })
        .on('error', (err) => {
          log(`Lỗi tạo video truyện: ${err.message}`, 'video');
          reject(err);
        })
        .on('end', () => {
          log(`Video truyện đã được tạo thành công: ${outputPath}`, 'video');
          resolve(outputPath);
        })
        .run();
    });
  } catch (error) {
    log(`Lỗi trong quá trình tạo video truyện: ${error instanceof Error ? error.message : String(error)}`, 'video');
    throw error;
  }
}

/**
 * Tạo video từ truyện với audio và một ảnh đại diện theo cơ chế bất đồng bộ sử dụng task
 * @returns task_id để theo dõi tiến trình
 */
export async function createStoryVideoAsync(
  audioPath: string, 
  coverImagePath: string,
  options: {
    title?: string;
    outputFileName?: string;
    resolution?: string;
    addSmokeFx?: boolean;
  } = {}
): Promise<string> {
  try {
    // Kiểm tra file đầu vào tồn tại
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Không tìm thấy file audio: ${audioPath}`);
    }
    if (!fs.existsSync(coverImagePath)) {
      throw new Error(`Không tìm thấy file ảnh bìa: ${coverImagePath}`);
    }

    // Tạo task mới
    const task = taskManager.createTask('video', {
      audioPath,
      coverImagePath,
      options,
      startTime: new Date()
    });

    // Bắt đầu xử lý bất đồng bộ
    setTimeout(async () => {
      try {
        // Cập nhật trạng thái task
        taskManager.updateTaskStatus(task.id, 'processing');
        taskManager.updateTaskProgress(task.id, 5); // 5% - Đã bắt đầu xử lý
        
        // Tên tệp đầu ra - đảm bảo không có ký tự đặc biệt
        const safeTitle = options.title ? options.title.replace(/[^\w\-_.]/g, '_').toLowerCase() : 'story';
        const safeOutputFileName = options.outputFileName 
          ? options.outputFileName.replace(/[^\w\-_.]/g, '_') + '.mp4'
          : `${safeTitle}_${uuidv4()}.mp4`;
        
        log(`[video] Tên file video truyện đã chuẩn hóa: ${safeOutputFileName}`, 'video');
        const outputPath = path.join(videosDir, safeOutputFileName);

        // Độ phân giải
        const resolution = options.resolution || '1280x720';

        log(`Bắt đầu tạo video truyện với audio: ${audioPath} và ảnh bìa: ${coverImagePath} (Độ phân giải: ${resolution})`, 'video');
        
        // Kiểm tra nếu cần thêm hiệu ứng sương khói
        const useSmokeFx = options.addSmokeFx !== false; // Mặc định là true nếu không được chỉ định
        taskManager.updateTaskProgress(task.id, 10); // 10% - Đã chuẩn bị xong các thông số

        if (useSmokeFx) {
          log(`Thêm hiệu ứng sương khói vào video`, 'video');
        }

        const command = ffmpeg();
        
        // Input cho hình ảnh chính
        command.input(coverImagePath)
          .inputOptions(['-loop 1']); // Lặp lại ảnh
        
        // Input cho audio
        command.input(audioPath);
        
        // Phương pháp đơn giản hơn cho hiệu ứng sương khói
        let vfOption = '';
        
        if (useSmokeFx) {
          // Sử dụng một hiệu ứng đơn giản hơn với boxblur và coloroverlay để giả lập sương khói
          log(`Thêm hiệu ứng sương khói đơn giản (dùng coloroverlay và boxblur)`, 'video');
          
          // Tạo hiệu ứng khói bằng boxblur và overlay màu
          vfOption = `scale=${resolution},boxblur=luma_radius=2:luma_power=1:enable='between(t,0,999999)',hue=s=0.1:enable='between(t,0,999999)'`;
        } else {
          // Nếu không sử dụng hiệu ứng, chỉ scale hình ảnh
          vfOption = `scale=${resolution}`;
        }
        
        // Cấu hình output
        const outputOptions = [
          '-c:v libx264',          // Codec video
          '-tune stillimage',       // Tối ưu cho ảnh tĩnh
          '-c:a aac',              // Codec audio
          '-b:a 192k',             // Bitrate audio
          '-pix_fmt yuv420p',      // Pixel format
          '-shortest',             // Thời lượng video bằng với audio
          `-vf ${vfOption}`        // Video filters (scale, hiệu ứng)
        ];
        
        command.outputOptions(outputOptions)
          .output(outputPath)
          .on('start', (commandLine) => {
            log(`Lệnh ffmpeg: ${commandLine}`, 'video');
            taskManager.updateTaskProgress(task.id, 15); // 15% - Đã bắt đầu xử lý ffmpeg
          })
          .on('progress', (progress) => {
            const percent = progress.percent || 0;
            const scaledPercent = 15 + (percent * 0.8); // Chuyển đổi 0-100% thành 15-95%
            log(`Tiến độ xử lý: ${percent.toFixed(2)}%, scaled: ${scaledPercent.toFixed(2)}%`, 'video');
            taskManager.updateTaskProgress(task.id, Math.round(scaledPercent));
          })
          .on('error', (err) => {
            log(`Lỗi tạo video truyện: ${err.message}`, 'video');
            taskManager.updateTaskStatus(task.id, 'failed', null, err.message);
          })
          .on('end', () => {
            log(`Video truyện đã được tạo thành công: ${outputPath}`, 'video');
            
            // Tạo URL có thể truy cập từ web
            const relativeUrl = `/videos/${path.basename(outputPath)}`;
            
            // Cập nhật task đã hoàn thành
            taskManager.updateTaskProgress(task.id, 100);
            taskManager.updateTaskStatus(task.id, 'completed', {
              outputPath,
              url: relativeUrl,
              fileName: path.basename(outputPath)
            });
          })
          .run();
      } catch (error) {
        log(`Lỗi khi xử lý video: ${error instanceof Error ? error.message : String(error)}`, 'video');
        taskManager.updateTaskStatus(task.id, 'failed', null, String(error));
      }
    }, 0);

    // Trả về task_id để theo dõi tiến trình
    return task.id;
  } catch (error) {
    log(`Lỗi khi khởi tạo task video: ${error instanceof Error ? error.message : String(error)}`, 'video');
    throw error;
  }
}

/**
 * Tạo slideshow video từ nhiều ảnh và audio theo cơ chế bất đồng bộ sử dụng task
 * @returns task_id để theo dõi tiến trình
 */
export async function createSlideshowVideoAsync(
  audioPath: string,
  imagePaths: string[],
  options: {
    outputFileName?: string;
    slideDuration?: number;
    resolution?: string;
    transition?: boolean;
    transitionDuration?: number;
  } = {}
): Promise<string> {
  try {
    // Kiểm tra file đầu vào tồn tại
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Không tìm thấy file audio: ${audioPath}`);
    }

    if (imagePaths.length === 0) {
      throw new Error('Không có hình ảnh nào được cung cấp');
    }

    // Kiểm tra tất cả đường dẫn hình ảnh
    for (const imgPath of imagePaths) {
      if (!fs.existsSync(imgPath)) {
        throw new Error(`Không tìm thấy file ảnh: ${imgPath}`);
      }
    }

    // Tạo task mới
    const task = taskManager.createTask('video', {
      audioPath,
      imagePaths,
      options,
      startTime: new Date()
    });

    // Bắt đầu xử lý bất đồng bộ
    setTimeout(async () => {
      try {
        // Cập nhật trạng thái task
        taskManager.updateTaskStatus(task.id, 'processing');
        taskManager.updateTaskProgress(task.id, 5); // 5% - Đã bắt đầu xử lý

        // Tạo file tạm chứa danh sách hình ảnh
        const imageListFile = path.join(uploadsDir, `image_list_${uuidv4()}.txt`);
        const slideDuration = options.slideDuration || 5; // Thời gian hiển thị mỗi ảnh (giây)
        
        // Tạo nội dung cho file danh sách
        let imageListContent = '';
        imagePaths.forEach(imgPath => {
          imageListContent += `file '${imgPath}'\nduration ${slideDuration}\n`;
        });
        // Lặp lại ảnh cuối cùng (cần thiết cho ffmpeg)
        imageListContent += `file '${imagePaths[imagePaths.length - 1]}'`;
        
        fs.writeFileSync(imageListFile, imageListContent);
        taskManager.updateTaskProgress(task.id, 10); // 10% - Đã chuẩn bị xong các thông số

        // Tên tệp đầu ra - đảm bảo không có ký tự đặc biệt
        const safeOutputFileName = options.outputFileName 
          ? options.outputFileName.replace(/[^\w\-_.]/g, '_') + '.mp4'
          : `slideshow_${uuidv4()}.mp4`;
        
        log(`[video] Tên file slideshow đã chuẩn hóa: ${safeOutputFileName}`, 'video');
        const outputPath = path.join(videosDir, safeOutputFileName);

        // Độ phân giải
        const resolution = options.resolution || '1280x720';

        log(`Bắt đầu tạo slideshow với ${imagePaths.length} ảnh và audio: ${audioPath}`, 'video');

        ffmpeg()
          .input(imageListFile)
          .inputOptions(['-f concat', '-safe 0'])
          .input(audioPath)
          .outputOptions([
            '-c:v libx264',          // Codec video
            '-c:a aac',              // Codec audio
            '-b:a 192k',             // Bitrate audio
            '-pix_fmt yuv420p',      // Pixel format
            '-shortest',             // Thời lượng video bằng với audio
            `-vf scale=${resolution}` // Đặt độ phân giải
          ])
          .output(outputPath)
          .on('start', (commandLine) => {
            log(`Lệnh ffmpeg: ${commandLine}`, 'video');
            taskManager.updateTaskProgress(task.id, 15); // 15% - Đã bắt đầu xử lý ffmpeg
          })
          .on('progress', (progress) => {
            const percent = progress.percent || 0;
            const scaledPercent = 15 + (percent * 0.8); // Chuyển đổi 0-100% thành 15-95%
            log(`Tiến độ xử lý: ${percent.toFixed(2)}%, scaled: ${scaledPercent.toFixed(2)}%`, 'video');
            taskManager.updateTaskProgress(task.id, Math.round(scaledPercent));
          })
          .on('error', (err) => {
            log(`Lỗi tạo slideshow: ${err.message}`, 'video');
            // Xóa file tạm sau khi xử lý
            try {
              fs.unlinkSync(imageListFile);
            } catch (e) {
              log(`Không thể xóa file tạm: ${e instanceof Error ? e.message : String(e)}`, 'video');
            }
            taskManager.updateTaskStatus(task.id, 'failed', null, err.message);
          })
          .on('end', () => {
            log(`Slideshow đã được tạo thành công: ${outputPath}`, 'video');
            // Xóa file tạm sau khi xử lý
            try {
              fs.unlinkSync(imageListFile);
            } catch (e) {
              log(`Không thể xóa file tạm: ${e instanceof Error ? e.message : String(e)}`, 'video');
            }
            
            // Tạo URL có thể truy cập từ web
            const relativeUrl = `/videos/${path.basename(outputPath)}`;
            
            // Cập nhật task đã hoàn thành
            taskManager.updateTaskProgress(task.id, 100);
            taskManager.updateTaskStatus(task.id, 'completed', {
              outputPath,
              url: relativeUrl,
              fileName: path.basename(outputPath)
            });
          })
          .run();
      } catch (error) {
        log(`Lỗi khi xử lý video: ${error instanceof Error ? error.message : String(error)}`, 'video');
        taskManager.updateTaskStatus(task.id, 'failed', null, String(error));
      }
    }, 0);

    // Trả về task_id để theo dõi tiến trình
    return task.id;
  } catch (error) {
    log(`Lỗi khi khởi tạo task video: ${error instanceof Error ? error.message : String(error)}`, 'video');
    throw error;
  }
}

/**
 * Kiểm tra ffmpeg đã được cài đặt đúng cách
 */
export async function checkFfmpegAvailability(): Promise<boolean> {
  return new Promise((resolve) => {
    ffmpeg.getAvailableFormats((err, formats) => {
      if (err) {
        log(`Lỗi khi kiểm tra FFmpeg: ${err.message}`, 'video');
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
}