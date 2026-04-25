# AdaptIQ – Adaptive Learning System

**🌐 Live Demo:** [https://adapt-iq-delta.vercel.app/](https://adapt-iq-delta.vercel.app/)
AdaptIQ is an intelligent, self-contained educational platform that leverages Artificial Intelligence and Item Response Theory (IRT) to provide a deeply personalized learning experience. Instead of static question banks, AdaptIQ dynamically generates questions on any topic and adjusts difficulty in real-time based on student performance.

## 🌟 Key Features

* **AI-Powered Question Generation**: Uses the Groq API (Llama 3.1) to instantly generate unique, high-quality questions on any custom topic.
* **Smart Adaptive Engine**: Implements Item Response Theory (IRT) to calculate student ability ($\theta$) and serve questions in the optimal Zone of Proximal Development (ZPD).
* **PDF-to-Quiz Pipeline**: Upload any study material (PDF). The system extracts the text, identifies key topics, and generates a comprehensive, adaptive quiz based purely on your document.
* **Real-time Analytics**: Tracks performance, topic mastery, and difficulty progression with interactive charts.
* **Fluid UI/UX**: Built with React and Framer Motion for a premium, distraction-free experience.

## 🛠️ Technology Stack

* **Frontend**: React, Vite, Framer Motion, Lucide React
* **Backend**: Node.js, Express, Multer, PDF-Parse
* **AI Provider**: Groq (`llama-3.1-8b-instant`)

## 🚀 Quick Start

The easiest way to start both the frontend and backend servers is using the provided shell script:

```bash
./start.sh
```

Alternatively, you can run them manually:

**1. Start the Backend (Port 4000)**
```bash
cd backend
npm install
npm start
```

**2. Start the Frontend (Port 5173 / 8080)**
```bash
cd frontend
npm install
npm run dev
```

## 📁 Project Structure

* `/frontend` - React application containing all UI components, pages, and the adaptive scoring engine (`adaptive.js`).
* `/backend` - Express server handling AI prompt generation, Groq API communication, and PDF text extraction.
* `/start.sh` - Convenience script to launch the full stack.

## ⚙️ Configuration

The application requires a Groq API key to generate questions. 
By default, the backend includes a development key. For production, create a `.env` file in the `/backend` directory:

```env
GROQ_API_KEY=your_groq_api_key_here
PORT=4000
```
