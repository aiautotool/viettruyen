import React from "react";

interface LoadingOverlayProps {
  show: boolean;
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  show, 
  message = "Đang xử lý...", 
  size = 'md'
}) => {
  if (!show) return null;
  
  return (
    <div className="loading-overlay">
      <div className="flex flex-col items-center justify-center">
        <div className={`spinner spinner-moc spinner-${size} mb-4`}></div>
        {message && (
          <p className="text-white text-center font-medium mt-3 text-shadow-light">
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default LoadingOverlay;