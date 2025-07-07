import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { genres, detailedGenres } from "@/lib/genreUtils";

interface GenreSelectorProps {
  onGenreSelect: (genre: string | null) => void;
}

export default function GenreSelector({ onGenreSelect }: GenreSelectorProps) {
  // States
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [customGenre, setCustomGenre] = useState("");
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // Effect to handle custom genre changes
  useEffect(() => {
    if (customGenre.trim()) {
      setSelectedGenre(customGenre);
      onGenreSelect(customGenre);
    } else if (!selectedGenre) {
      onGenreSelect(null);
    }
  }, [customGenre, onGenreSelect, selectedGenre]);

  // Handlers
  const handleGenreSelect = (genreName: string) => {
    setCustomGenre("");
    setSelectedGenre(genreName);
    onGenreSelect(genreName);
    setShowMobileMenu(false);
  };
  
  const handleCustomGenreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomGenre(value);
    
    if (!value.trim()) {
      if (selectedGenre && genres.some(g => g.name === selectedGenre)) {
        onGenreSelect(selectedGenre);
      } else {
        setSelectedGenre(null);
        onGenreSelect(null);
      }
    }
  };
  
  const toggleMobileMenu = () => {
    console.log('Toggling mobile menu', !showMobileMenu);
    setShowMobileMenu(!showMobileMenu);
  };

  // Mobile Genre Menu Component
  const MobileGenreMenu = () => {
    if (!showMobileMenu) return null;
    
    return (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-[9999] flex flex-col overflow-hidden">
        <div className="sticky top-0 bg-gray-800 p-4 border-b border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-white">Chọn thể loại</h3>
            <button 
              className="p-2 bg-gray-700 rounded-full text-white"
              onClick={toggleMobileMenu}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-3">
            {detailedGenres.map((genre) => (
              <div 
                key={genre.name}
                className={`p-4 rounded-lg cursor-pointer transition-colors ${
                  selectedGenre === genre.name 
                    ? 'bg-gray-700 ring-2 ring-moc-accent' 
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
                onClick={() => handleGenreSelect(genre.name)}
              >
                <div className="flex items-center gap-3">
                  <i className={`fas ${genre.icon} text-xl ${genre.border.replace('border-', 'text-')}`}></i>
                  <div>
                    <h4 className="font-medium text-gray-100">{genre.name}</h4>
                    <p className="text-sm text-gray-400">{genre.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-800/70 rounded-xl p-4 border border-gray-700">
      <div className="flex flex-col xs:flex-row justify-between items-start xs:items-center mb-3 gap-2">
        <Label className="block text-blue-400 font-medium text-sm">
          <i className="fas fa-tag mr-2"></i>
          Chọn thể loại truyện
        </Label>
        {selectedGenre && (
          <div className="bg-blue-900/50 px-2 sm:px-3 py-1 rounded-full border border-blue-700/50 flex items-center self-start xs:self-auto">
            <span className="text-xs text-gray-200 mr-1 sm:mr-2">Đã chọn:</span>
            <span className="text-xs font-medium text-blue-300">{selectedGenre}</span>
          </div>
        )}
      </div>
      
      <div className="flex mb-2 items-center justify-between">
        <Label className="text-xs text-gray-400">Các thể loại phổ biến:</Label>
        <Button
          onClick={toggleMobileMenu}
          type="button"
          variant="outline"
          size="sm"
          className="bg-gray-700 text-blue-400 border-gray-600 flex items-center gap-1 text-xs h-7 px-2 hover:bg-gray-600"
        >
          <i className="fas fa-list-ul text-xs mr-1"></i> <span className="hidden xs:inline">Tất cả thể loại</span>
          <i className={`fas fa-chevron-${showMobileMenu ? 'up' : 'down'} text-xs`}></i>
        </Button>
      </div>
      
      {/* Genre Grid - Thu nhỏ lại so với trước */}
      <div className="grid grid-cols-4 xs:grid-cols-4 md:grid-cols-8 gap-2 mb-3">
        {genres.map((genre) => (
          <div
            key={genre.name}
            className={`genre-card ${genre.color} ${genre.border} border-2 rounded-lg p-2 cursor-pointer flex flex-col items-center hover:shadow-lg transition-all ${
              selectedGenre === genre.name && !customGenre.trim() ? "selected shadow-lg" : ""
            }`}
            onClick={() => handleGenreSelect(genre.name)}
            style={{
              boxShadow: selectedGenre === genre.name && !customGenre.trim() 
                ? "0 0 0 2px white, 0 0 0 4px currentColor" 
                : undefined,
              transform: selectedGenre === genre.name && !customGenre.trim() 
                ? "translateY(-2px)" 
                : undefined
            }}
          >
            <i className={`fas ${genre.icon} text-lg mb-1 text-white drop-shadow-md`}></i>
            <span className="text-white font-medium text-center text-xs drop-shadow-lg">{genre.name}</span>
            
            {/* Overlay nền mờ nếu là tối màu để dễ đọc text */}
            {selectedGenre === genre.name && (
              <div className="absolute inset-0 bg-white bg-opacity-20 rounded-lg"></div>
            )}
          </div>
        ))}
      </div>
      
      {/* Custom Genre Input */}
      <div className="mt-3">
        <Label className="block text-gray-400 text-xs sm:text-sm mb-1">Hoặc nhập thể loại khác:</Label>
        <Input 
          type="text" 
          value={customGenre}
          onChange={handleCustomGenreChange}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 focus:outline-none focus:ring-2 focus:ring-moc-accent text-white text-sm"
          placeholder="Ví dụ: Đô thị, Học đường, ..."
        />
      </div>

      {/* Mobile Menu - Render at the end of DOM to ensure proper z-index */}
      <MobileGenreMenu />
    </div>
  );
}
