import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ThemeToggle from "@/components/ThemeToggle";
import Navbar from "@/components/Navbar";
import Home from "./pages/Home.jsx";
import Quiz from "./pages/Quiz.jsx";
import Analytics from "./pages/Analytics.jsx";
import PDFQuiz from "./pages/PDFQuiz.jsx";
import PDFResults from "./pages/PDFResults.jsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/quiz/:topicId" element={<Quiz />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/pdf-quiz" element={<PDFQuiz />} />
          <Route path="/pdf-results" element={<PDFResults />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
