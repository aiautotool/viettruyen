export const genres = [
  { name: "Kinh Dị", icon: "fa-ghost", color: "bg-red-900", border: "border-red-700" },
  { name: "Trinh Thám", icon: "fa-magnifying-glass", color: "bg-gray-800", border: "border-gray-600" },
  { name: "Lãng Mạn", icon: "fa-heart", color: "bg-pink-900", border: "border-pink-700" },
  { name: "Khoa Học Viễn Tưởng", icon: "fa-rocket", color: "bg-indigo-900", border: "border-indigo-700" },
  { name: "Fantasy", icon: "fa-dragon", color: "bg-purple-900", border: "border-purple-700" },
  { name: "Hành Động", icon: "fa-gun", color: "bg-yellow-900", border: "border-yellow-700" },
  { name: "Hài Hước", icon: "fa-face-laugh-squint", color: "bg-yellow-600", border: "border-yellow-500" },
  { name: "Lịch Sử", icon: "fa-landmark", color: "bg-amber-900", border: "border-amber-700" },
  { name: "Tiên Hiệp", icon: "fa-wand-magic-sparkles", color: "bg-green-900", border: "border-green-700" }
];

export const detailedGenres = [
  { name: "Tiên hiệp", description: "Tu luyện, phi thăng, tiên nhân, pháp bảo, linh thạch", icon: "fa-wand-magic-sparkles", color: "bg-green-900", border: "border-green-700" },
  { name: "Huyền huyễn", description: "Thế giới giả tưởng, phép thuật, quái vật, thần thoại phương Tây", icon: "fa-hat-wizard", color: "bg-purple-900", border: "border-purple-700" },
  { name: "Đô thị", description: "Lấy bối cảnh hiện đại, cuộc sống, xã hội, công việc, tình cảm", icon: "fa-city", color: "bg-blue-900", border: "border-blue-700" },
  { name: "Ngôn tình", description: "Tập trung vào chuyện tình yêu, thường dành cho nữ", icon: "fa-heart", color: "bg-pink-900", border: "border-pink-700" },
  { name: "Trinh thám", description: "Vụ án, phá án, điều tra, bí ẩn", icon: "fa-magnifying-glass", color: "bg-gray-800", border: "border-gray-600" },
  { name: "Kinh dị", description: "Ma quái, rùng rợn, tâm linh", icon: "fa-ghost", color: "bg-red-900", border: "border-red-700" },
  { name: "Lịch sử", description: "Dựa trên hoặc cải biên từ lịch sử có thật", icon: "fa-landmark", color: "bg-amber-900", border: "border-amber-700" },
  { name: "Xuyên không", description: "Nhân vật chính xuyên từ thế giới này sang thế giới khác", icon: "fa-door-open", color: "bg-teal-900", border: "border-teal-700" },
  { name: "Hệ thống", description: "Nhân vật chính được một hệ thống hỗ trợ để mạnh lên", icon: "fa-microchip", color: "bg-blue-800", border: "border-blue-600" },
  { name: "Trọng sinh", description: "Nhân vật chết đi sống lại, quay về quá khứ sống lại cuộc đời mới", icon: "fa-sync", color: "bg-indigo-800", border: "border-indigo-600" },
  { name: "Thanh xuân vườn trường", description: "Tình cảm học đường, tuổi trẻ", icon: "fa-school", color: "bg-green-800", border: "border-green-600" },
  { name: "Hài hước", description: "Truyện mang tính giải trí, gây cười", icon: "fa-face-laugh-squint", color: "bg-yellow-600", border: "border-yellow-500" },
  { name: "Gia đấu", description: "Mưu mô trong nội bộ gia tộc, đấu đá quyền lực", icon: "fa-users", color: "bg-amber-800", border: "border-amber-600" },
  { name: "Cung đấu", description: "Hậu cung tranh sủng, đấu trí, âm mưu", icon: "fa-chess-queen", color: "bg-red-800", border: "border-red-600" },
  { name: "Khoa học viễn tưởng", description: "Tương lai, công nghệ, robot, du hành thời gian", icon: "fa-rocket", color: "bg-indigo-900", border: "border-indigo-700" },
  { name: "Game/Thể thao", description: "Liên quan đến thế giới game hoặc các môn thể thao", icon: "fa-gamepad", color: "bg-blue-700", border: "border-blue-500" },
  { name: "Mạt thế", description: "Thế giới hậu tận thế, sinh tồn, zombie", icon: "fa-biohazard", color: "bg-gray-900", border: "border-gray-700" },
  { name: "Điền văn", description: "Cuộc sống nông thôn, bình dị, nhẹ nhàng, ấm áp", icon: "fa-leaf", color: "bg-green-700", border: "border-green-500" },
  { name: "Đam mỹ", description: "Truyện tình cảm nam x nam", icon: "fa-mars-double", color: "bg-indigo-700", border: "border-indigo-500" },
  { name: "Bách hợp", description: "Truyện tình cảm nữ x nữ", icon: "fa-venus-double", color: "bg-pink-700", border: "border-pink-500" }
];

export function getGenreBorderColor(genreName: string): string {
  const genre = genres.find(g => g.name === genreName) || 
               detailedGenres.find(g => g.name.toLowerCase() === genreName.toLowerCase());
  return genre ? `border-l-4 ${genre.border}` : "border-l-4 border-blue-700";
}

export function getGenreTextColor(genreName: string): string {
  const colorMap: Record<string, string> = {
    "Kinh Dị": "text-red-400",
    "Trinh Thám": "text-gray-300",
    "Lãng Mạn": "text-pink-400",
    "Khoa Học Viễn Tưởng": "text-indigo-400",
    "Fantasy": "text-purple-400",
    "Hành Động": "text-yellow-400",
    "Hài Hước": "text-yellow-300",
    "Lịch Sử": "text-amber-400",
    "Tiên Hiệp": "text-green-400"
  };
  
  return colorMap[genreName] || "text-blue-400";
}

export function getGenreIcon(genreName: string): string {
  const genre = genres.find(g => g.name === genreName) || 
               detailedGenres.find(g => g.name.toLowerCase() === genreName.toLowerCase());
  return genre ? `fas ${genre.icon}` : "fas fa-book";
}

export function getGenreButtonColor(genreName: string): string {
  const buttonMap: Record<string, string> = {
    "Kinh Dị": "bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700",
    "Trinh Thám": "bg-gradient-to-r from-gray-600 to-gray-800 hover:from-gray-500 hover:to-gray-700",
    "Lãng Mạn": "bg-gradient-to-r from-pink-600 to-pink-800 hover:from-pink-500 hover:to-pink-700",
    "Khoa Học Viễn Tưởng": "bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700",
    "Fantasy": "bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700",
    "Hành Động": "bg-gradient-to-r from-yellow-600 to-yellow-800 hover:from-yellow-500 hover:to-yellow-700",
    "Hài Hước": "bg-gradient-to-r from-yellow-500 to-yellow-700 hover:from-yellow-400 hover:to-yellow-600",
    "Lịch Sử": "bg-gradient-to-r from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700",
    "Tiên Hiệp": "bg-gradient-to-r from-green-600 to-green-800 hover:from-green-500 hover:to-green-700"
  };
  
  return buttonMap[genreName] || "bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700";
}
