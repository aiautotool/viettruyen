import React from "react";
import { genres, detailedGenres } from "@/lib/genreUtils";

interface GenreMobileModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedGenre: string | null;
  onGenreSelect: (genre: string) => void;
}

const GenreMobileModal: React.FC<GenreMobileModalProps> = ({
  isOpen,
  onClose,
  selectedGenre,
  onGenreSelect
}) => {
  if (!isOpen) return null;
  
  // Prevent background scrolling when modal is open
  React.useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.9)",
      zIndex: 9999,
      display: "flex",
      flexDirection: "column"
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: "#1F2937",
        padding: "16px",
        borderBottom: "1px solid #374151"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <h3 style={{
            fontSize: "18px",
            fontWeight: 500,
            color: "white"
          }}>Tất cả thể loại</h3>
          <button
            onClick={onClose}
            style={{
              backgroundColor: "#374151",
              color: "white",
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer"
            }}
          >
            <span style={{ fontSize: "18px" }}>×</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "16px"
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {detailedGenres.map((genre) => (
            <div
              key={genre.name}
              onClick={() => {
                onGenreSelect(genre.name);
                onClose();
              }}
              style={{
                padding: "16px",
                backgroundColor: selectedGenre === genre.name ? "#374151" : "#1F2937",
                borderRadius: "8px",
                cursor: "pointer",
                border: selectedGenre === genre.name ? "2px solid #6366F1" : "none"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <i
                  className={`fas ${genre.icon} text-xl ${genre.border.replace('border-', 'text-')}`}
                  style={{ fontSize: "20px" }}
                ></i>
                <div>
                  <div style={{
                    fontWeight: 500,
                    color: "white",
                    fontSize: "16px"
                  }}>{genre.name}</div>
                  <div style={{
                    color: "#9CA3AF",
                    fontSize: "14px"
                  }}>{genre.description}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GenreMobileModal;