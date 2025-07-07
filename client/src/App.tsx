import { Switch, Route, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import VoiceTest from "@/pages/VoiceTest";
import VideoTester from "@/pages/VideoTester";
import Nav from "@/components/Nav";

// Trang Podcast (redirect đến trang Home với tab podcast)
function Podcast() {
  return <Home defaultTab="podcast" />;
}

// Trang GPT Voice (redirect đến trang Home với tab gptvoice)
function GPTVoice() {
  return <Home defaultTab="gptvoice" />;
}

function Router() {
  return (
    <>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/voice-test" component={VoiceTest} />
        <Route path="/video-tester" component={VideoTester} />
        <Route path="/podcast" component={Podcast} />
        <Route path="/gpt-voice" component={GPTVoice} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col min-h-screen">
        <Router />
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
