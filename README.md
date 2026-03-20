# Salesgen (EduFlow Demo)

## Overview
Salesgen is an intelligent B2B SaaS platform designed to streamline customer interactions, lead generation, and knowledge management. It integrates an AI-powered conversational sales widget, an admin dashboard, a vector database indexer, and a mobile application built exclusively for sales representatives. The platform helps businesses deploy a knowledgeable AI assistant on their website, sync it seamlessly with their custom knowledge base, and manage leads in real-time through a scalable mobile architecture.

## Key Features
* **AI Chat Widget:** A fully styled, embeddable conversational assistant offering real-time customer support, lead qualification, and Calendly integration.
* **Vector Knowledge Base:** Ingests customized CSV knowledge data (`sample_kb_data.csv`) stored into vector embeddings (ChromaDB) to accurately answer domain-specific questions (RAG).
* **Cross-Platform Mobile App:** A React Native mobile app (built with Expo) allowing sales reps and admins to track incoming leads, manage knowledge sources, and oversee team performance on-the-go.
* **Scalable Backend:** A blazingly fast Python backend using FastAPI, integrated into Supabase for secure authentication and PostgreSQL database storage.

## Tech Stack
* **Frontend (Demo):** HTML5, Tailwind CSS, JavaScript 
* **Mobile App:** React Native, Expo Router, TypeScript, Nativewind
* **Backend Core:** Python 3, FastAPI, Supabase client
* **AI & Data:** OpenAI / Anthropic models, ChromaDB for Vector Search

## Project Structure
* `backend/` - The core REST API handling routing, database connectivity, auth, and LLM generative responses.
* `mobile/` - The Expo-based mobile application with dedicated views for Authenticated Admins and Sales Reps.
* `eduflow-demo.html` - A fully functional static web implementation showing the AI Chat Widget within a SaaS marketing site.
* `sample_kb_data.csv` - Sample conversational intent and query data used to seed the vector database.

## Setup Instructions

### 1. Backend Setup
1. Navigate to the backend directory: 
   ```bash
   cd backend
   ```
2. Configure your environment variables: Copy `.env.example` to `.env` and fill out your appropriate Supabase and LLM API keys.
3. Install the required Python dependencies: 
   ```bash
   pip install -r requirements.txt
   ```
4. Run the API locally: 
   ```bash
   uvicorn main:app --reload --port 8000
   ```

### 2. Mobile App Setup
1. Open a new terminal and navigate to the mobile directory: 
   ```bash
   cd mobile
   ```
2. Install dependencies: 
   ```bash
   npm install
   ```
3. Start the Expo application: 
   ```bash
   npx expo start
   ```
4. Use the Expo Go mobile app (iOS/Android) or a local emulator to view your deployment.

### 3. Web Demo Setup
Simply double-click or open `eduflow-demo.html` in your favorite web browser to test the widget implementation locally without any required build steps.

## License
Created for SalesMediator. All rights reserved.
