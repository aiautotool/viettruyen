import { v4 as uuidv4 } from 'uuid';

export interface Task {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  type: 'video' | 'audio' | 'image';
  metadata?: Record<string, any>;
}

class TaskManager {
  private tasks: Map<string, Task>;

  constructor() {
    this.tasks = new Map();
  }

  /**
   * Tạo một task mới
   */
  createTask(type: 'video' | 'audio' | 'image', metadata?: Record<string, any>): Task {
    const taskId = uuidv4();
    const task: Task = {
      id: taskId,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
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
  updateTaskProgress(taskId: string, progress: number): void {
    const task = this.getTask(taskId);
    if (!task) {
      console.error(`Task ${taskId} not found`);
      return;
    }

    task.progress = Math.min(Math.max(0, progress), 100); // Đảm bảo progress trong khoảng 0-100
    task.updatedAt = new Date();
    this.tasks.set(taskId, task);
  }

  /**
   * Cập nhật trạng thái của task
   */
  updateTaskStatus(taskId: string, status: 'pending' | 'processing' | 'completed' | 'failed', result?: any, error?: string): void {
    const task = this.getTask(taskId);
    if (!task) {
      console.error(`Task ${taskId} not found`);
      return;
    }

    task.status = status;
    task.updatedAt = new Date();
    
    if (status === 'completed' && result !== undefined) {
      task.result = result;
      task.progress = 100;
    }
    
    if (status === 'failed' && error) {
      task.error = error;
    }
    
    this.tasks.set(taskId, task);
    console.log(`Task ${taskId} updated to status: ${status}, progress: ${task.progress}%`);
  }

  /**
   * Lấy thông tin của task
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Xóa task sau khi hoàn thành quá lâu để tránh memory leak
   */
  cleanupTasks(maxAgeHours: number = 24): void {
    const now = new Date();
    const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
    
    this.tasks.forEach((task, taskId) => {
      if ((now.getTime() - task.updatedAt.getTime() > maxAge) && 
          (task.status === 'completed' || task.status === 'failed')) {
        this.tasks.delete(taskId);
        console.log(`Task ${taskId} cleaned up`);
      }
    });
  }

  /**
   * Liệt kê tất cả các task
   */
  listTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Liệt kê tất cả các task theo loại
   */
  listTasksByType(type: 'video' | 'audio' | 'image'): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.type === type);
  }
}

// Singleton instance
export const taskManager = new TaskManager();

// Thiết lập cơ chế dọn dẹp task định kỳ
setInterval(() => {
  taskManager.cleanupTasks();
}, 60 * 60 * 1000); // Chạy mỗi giờ