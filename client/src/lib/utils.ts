import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface ThemeOptions {
  primary: string
  appearance: "light" | "dark" | "system"
  radius: number
  variant: "professional" | "tint" | "vibrant"
}

export function createTheme(options: ThemeOptions) {
  // Thực hiện tạo và áp dụng theme
  // Trong thực tế, có thể thay đổi các biến CSS hoặc các thuộc tính khác
  document.documentElement.setAttribute("data-theme", options.appearance);
  
  // Có thể thêm xử lý khác cho theme nếu cần
  return options;
}
