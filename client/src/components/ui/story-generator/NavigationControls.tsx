import { FC } from "react";
import { Button } from "@/components/ui/button";

interface NavigationControlsProps {
  onNavigate: (direction: "prev" | "next") => void;
  currentStep: string;
}

const NavigationControls: FC<NavigationControlsProps> = ({ onNavigate, currentStep }) => {
  const isFirstStep = currentStep === "info";
  const isLastStep = currentStep === "scene";

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-secondary border-t border-gray-700 p-4 flex justify-between">
      <Button
        variant="ghost"
        className="text-gray-400 hover:bg-gray-700"
        onClick={() => onNavigate("prev")}
        disabled={isFirstStep}
      >
        <svg 
          className="w-5 h-5 mr-1" 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        Quay lại
      </Button>
      <Button
        variant="ghost"
        className="text-gray-400 hover:bg-gray-700"
        onClick={() => onNavigate("next")}
        disabled={isLastStep}
      >
        Tiếp tục
        <svg 
          className="w-5 h-5 ml-1" 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      </Button>
    </div>
  );
};

export default NavigationControls;
