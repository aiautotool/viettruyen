import React from 'react';

export enum StepEnum {
  INITIAL = 0,
  OUTLINE = 1,
  FULL_STORY = 2,
  SCENES = 3
}

interface StepItemProps {
  step: {
    id: StepEnum;
    name: string;
    icon: string;
  };
  currentStep: StepEnum;
  onClick: (step: StepEnum) => void;
}

interface StepIndicatorProps {
  currentStep: StepEnum;
  onStepClick: (step: StepEnum) => void;
  className?: string;
}

const StepItem: React.FC<StepItemProps> = ({ step, currentStep, onClick }) => {
  const isActive = step.id === currentStep;
  const isCompleted = step.id < currentStep;
  
  return (
    <div 
      className={`flex flex-col items-center z-10 cursor-pointer transition-all ${isActive ? 'scale-110' : ''}`}
      onClick={() => onClick(step.id)}
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center mb-1.5 relative
          ${isActive 
            ? 'bg-blue-600 ring-4 ring-blue-300 ring-opacity-20' 
            : isCompleted
              ? 'bg-emerald-500'
              : 'bg-gray-700'
          }
          ${isActive ? 'shadow-lg shadow-blue-500/30' : ''}
          transition-all duration-300
        `}
      >
        {isActive && (
          <div className="absolute w-full h-full rounded-full animate-pulse-glow"></div>
        )}
        <i className={`fas ${step.icon} text-sm text-white`}></i>
      </div>
      <span 
        className={`text-xs font-medium transition-all duration-300
          ${isActive 
            ? 'text-blue-400' 
            : isCompleted
              ? 'text-emerald-400'
              : 'text-gray-400'
          }
        `}
      >
        {step.name}
      </span>
    </div>
  );
};

export const StepIndicator: React.FC<StepIndicatorProps> = ({ 
  currentStep, 
  onStepClick,
  className = ''
}) => {
  const steps = [
    { id: StepEnum.INITIAL, name: "Thông tin", icon: "fa-info-circle" },
    { id: StepEnum.OUTLINE, name: "Cốt truyện", icon: "fa-scroll" },
    { id: StepEnum.FULL_STORY, name: "Truyện đầy đủ", icon: "fa-book" },
    { id: StepEnum.SCENES, name: "Phân cảnh", icon: "fa-images" }
  ];

  return (
    <div className={`relative ${className}`}>
      <div className="flex justify-between mb-6 relative">
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-700 -z-10 transform -translate-y-1/2"></div>
        
        {steps.map((step) => (
          <StepItem 
            key={step.id} 
            step={step} 
            currentStep={currentStep} 
            onClick={onStepClick} 
          />
        ))}
      </div>
    </div>
  );
};

export default StepIndicator;