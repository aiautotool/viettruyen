import { FC } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";

interface StoryPlotProps {
  plot: string;
  onGenerateStory: () => void;
  isLoading: boolean;
}

const StoryPlot: FC<StoryPlotProps> = ({ plot, onGenerateStory, isLoading }) => {
  return (
    <div className="bg-secondary rounded-lg p-6 shadow-lg max-w-4xl mx-auto">
      <div className="flex items-center mb-6">
        <svg 
          className="w-5 h-5 text-primary mr-2" 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
        </svg>
        <h2 className="text-xl font-semibold">Cốt truyện</h2>
      </div>

      <Card className="bg-background border-gray-700 mb-6">
        <CardContent className="p-6">
          <ScrollArea className="h-[40vh] rounded-md">
            <div className="whitespace-pre-wrap leading-relaxed">
              {plot.split("\n").map((paragraph, index) => (
                <p key={index} className={paragraph.trim() === "" ? "h-4" : "mb-4"}>
                  {paragraph}
                </p>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="mt-8 flex justify-center">
        <Button
          onClick={onGenerateStory}
          className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-md flex items-center justify-center transition-colors font-medium text-lg"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Đang tạo...
            </>
          ) : (
            <>
              <svg 
                className="w-5 h-5 mr-2" 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
              Tạo truyện đầy đủ
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default StoryPlot;
