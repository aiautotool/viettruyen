import { Link } from "wouter";
import { featureConfig } from "../config/features";

export default function Nav() {
  return (
    <nav className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          Story Generator
        </Link>
        
        <div className="flex space-x-4">
          <Link href="/" className="hover:text-blue-300">
            Trang chủ
          </Link>
          
          {/* Hiển thị liên kết kiểm thử podcast nếu tính năng podcast được bật */}
          {featureConfig.showPodcastGeneration && (
            <Link href="/podcast" className="hover:text-blue-300">
              Podcast
            </Link>
          )}
          
          {/* Hiển thị liên kết GPT Voice nếu tính năng GPT Voice được bật */}
          {featureConfig.showGPTVoice && (
            <Link href="/gpt-voice" className="hover:text-blue-300">
              GPT Voice
            </Link>
          )}
          
          {/* Hiển thị liên kết kiểm thử video nếu tính năng video được bật */}
          {featureConfig.showVideoGeneration && (
            <Link href="/video-tester" className="hover:text-blue-300">
              Kiểm thử video
            </Link>
          )}
          
          {/* Hiển thị liên kết kiểm thử voice nếu tính năng audio được bật */}
          {featureConfig.showAudioGeneration && (
            <Link href="/voice-test" className="hover:text-blue-300">
              Kiểm thử voice
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}