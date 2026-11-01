# 🧠 Medha AI

### Agentic AI · Multimodal Intelligence · Hybrid RAG · Real-Time Web Search

**Medha AI** is a full-stack AI assistant designed and developed by **Anil Panchitha**.

It combines **LLM intelligence, real-time web search, multimodal image understanding, Hybrid RAG, conversation memory, intelligent model routing, and persistent cloud storage** in a modern conversational interface.

The goal of Medha AI is to go beyond a basic chatbot and demonstrate how a practical AI system can combine multiple AI capabilities behind a single user experience.

---

## ✨ What Medha AI Can Do

### 💬 Intelligent AI Assistant

Medha AI provides conversational AI capabilities with contextual multi-turn conversations and progressive response generation.

The system intelligently routes requests through available LLM providers while maintaining a consistent Medha AI experience.

---

### 🌐 Real-Time Web Intelligence

For questions that require fresh or current information, Medha AI can automatically use **Tavily Web Search**.

This enables the assistant to handle queries involving:

- Latest AI developments
- Current technology news
- Recent events
- Up-to-date technical information

Web search is triggered only when the query requires current information instead of being executed for every request.

---

### 📚 Document Intelligence with Hybrid RAG

Users can upload PDF documents and ask questions directly about their content.

The RAG pipeline performs:

**PDF Upload → Text Extraction → Chunking → Embeddings → Vector Retrieval → Context Generation → Grounded Answer**

Medha AI combines document retrieval with LLM reasoning to generate responses based on the uploaded document rather than relying only on the model's general knowledge.

This makes the system useful for:

- Technical documentation
- Research papers
- Reports
- Study material
- Knowledge bases
- Enterprise documents

---

### 👁️ Multimodal Image Intelligence

Medha AI can understand images directly using multimodal AI.

Users can upload:

- Screenshots
- UI designs
- Error screenshots
- Architecture diagrams
- Flowcharts
- Charts
- Technical diagrams
- Photographs
- Images containing visible text

The image and the user's question are processed together to generate a contextual response.

---

### 🧠 Intelligent LLM Routing

Medha AI uses a provider-routing architecture instead of depending on a single LLM.

```text
User Request
     │
     ▼
Intent / Context Processing
     │
     ▼
Provider Router
     │
     ├──── Gemini
     │
     └──── Groq Fallback
     │
     ▼
AI Response
```

This architecture improves reliability and makes the application less dependent on a single model provider.

---

### ⚡ Intelligent Response Cache

Frequently reusable AI responses can be stored in a **Supabase-backed response cache**.

The system determines when caching should be bypassed, including queries involving:

- Current information
- Context-dependent follow-ups
- Real-time web results
- Image analysis

This reduces unnecessary LLM requests while preserving response quality.

---

### 💾 Persistent Conversation History

Medha AI stores conversation data using **Supabase**.

Users can:

- Start new conversations
- Reopen previous conversations
- Search conversation history
- Delete individual conversations
- Clear conversation history

Each visitor receives an anonymous identifier so conversations can remain separated without requiring traditional account creation.

---

## 🏗️ Architecture

```text
                         ┌──────────────────────┐
                         │        User          │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   Next.js Frontend   │
                         │   Medha AI Web UI    │
                         └──────────┬───────────┘
                                    │
                   ┌────────────────┼────────────────┐
                   │                │                │
                   ▼                ▼                ▼
             Text Assistant    Document RAG      Image Vision
                   │                │                │
                   ▼                ▼                ▼
              AI Agent        PDF Processing      Gemini
                   │                │
            ┌──────┴──────┐         ▼
            │             │     Text Chunking
            ▼             ▼         │
        Web Search     LLM Router    ▼
         Tavily        │         Embeddings
                       │             │
                 ┌─────┴─────┐       ▼
                 ▼           ▼    Supabase
              Gemini       Groq     pgvector
                 │           │       │
                 └─────┬─────┘       ▼
                       │        Relevant Context
                       │             │
                       └──────┬──────┘
                              ▼
                        AI Response
                              │
                              ▼
                          Supabase
                     Conversations + Cache
```

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Backend | Next.js API Routes |
| Primary AI | Google Gemini |
| LLM Fallback | Groq |
| Image Intelligence | Gemini Multimodal |
| Web Search | Tavily |
| Database | Supabase PostgreSQL |
| Vector Database | Supabase pgvector |
| Embeddings | Gemini Embeddings |
| RAG | Custom Retrieval Pipeline |
| Storage | Supabase |
| Response Cache | Supabase |
| Deployment | Vercel |
| UI Icons | Lucide React |
| Markdown Rendering | React Markdown |

---

## 🔄 Request Flow

A normal Medha AI request follows an intelligent execution pipeline:

```text
User Question
      │
      ▼
Identity Check
      │
      ▼
Cache Check
      │
      ├── Cache Hit ───────────────► Response
      │
      ▼
Intent Analysis
      │
      ├── Current Information
      │          │
      │          ▼
      │      Tavily Search
      │
      ▼
LLM Provider Router
      │
      ├── Gemini
      │
      └── Groq Fallback
      │
      ▼
Progressive Response
      │
      ▼
Conversation Persistence
      │
      ▼
Supabase
```

---

## 📚 Hybrid RAG Pipeline

Medha AI includes a dedicated document intelligence workflow.

```text
PDF
 │
 ▼
Text Extraction
 │
 ▼
Chunking
 │
 ▼
Gemini Embeddings
 │
 ▼
Supabase pgvector
 │
 ▼
Similarity Retrieval
 │
 ▼
Relevant Document Context
 │
 ▼
LLM
 │
 ▼
Grounded Answer
```

This architecture separates general conversational intelligence from document-grounded question answering.

---

## 👁️ Vision Pipeline

```text
Image Upload
     │
     ▼
Client Validation
     │
     ▼
Medha Vision API
     │
     ▼
Gemini Multimodal Model
     │
     ├── Visual Understanding
     ├── Text Understanding
     ├── Diagram Analysis
     └── User Question
     │
     ▼
Contextual AI Response
```

---

## 🎯 Key Engineering Concepts Demonstrated

Medha AI was built as an end-to-end AI engineering project and demonstrates:

- Full-stack AI application development
- Agentic AI workflows
- LLM provider routing
- Multimodal AI
- Retrieval-Augmented Generation
- Vector embeddings
- Vector similarity search
- Prompt engineering
- Real-time web search integration
- Streaming/progressive AI responses
- Response caching
- Conversation persistence
- REST/API architecture
- Error and rate-limit handling
- Cloud database integration
- Server-side secret management
- Responsive conversational UI
- Cloud deployment

---

## 📂 Project Structure

```text
medha-ai/
│
├── public/
│   └── medha-avatar.png
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/
│   │   │   ├── conversations/
│   │   │   ├── rag/
│   │   │   ├── upload/
│   │   │   └── vision/
│   │   │
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── components/
│   │   ├── chat/
│   │   ├── home/
│   │   ├── rag/
│   │   └── sidebar/
│   │
│   ├── lib/
│   │   ├── llm/
│   │   ├── rag/
│   │   ├── supabase/
│   │   ├── tools/
│   │   ├── agent.ts
│   │   ├── cache.ts
│   │   └── identity.ts
│   │
│   └── types/
│
├── package.json
├── next.config.ts
└── README.md
```

---

## ⚙️ Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/Anilyadav1718/medha-ai.git
cd medha-ai
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create:

```text
.env.local
```

Configure the required credentials:

```env
GEMINI_API_KEY=your_key
GEMINI_MODEL=your_model

GROQ_API_KEY=your_key
GROQ_MODEL=your_model

TAVILY_API_KEY=your_key

NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

> Never commit `.env.local` or API credentials to GitHub.

### 4. Start the development server

```bash
npm run dev
```

Open the local application in your browser.

### 5. Production build

```bash
npm run build
```

---

## 🔐 Security

Medha AI keeps sensitive credentials on the server side.

API keys and service-role credentials should never be exposed in frontend components or committed to source control.

The project separates public Supabase configuration from privileged server-side credentials.

---

## 🚀 Deployment

Medha AI is designed for deployment on **Vercel**.

The deployment environment requires the same server-side environment variables used during local development.

The application uses Next.js API routes for AI orchestration, persistence, RAG, and multimodal requests.

---

## 🔮 Future Improvements

Planned improvements include:

- Faster multimodal inference
- Advanced document reranking
- Multiple-document RAG
- Improved source citations
- Enhanced agent observability
- More AI tools
- Improved long-term contextual memory
- Authentication and personalized workspaces
- Additional model providers
- Advanced monitoring and analytics

---

## 👨‍💻 Developer

### Anil Panchitha

**AI / Software Engineer**

I built Medha AI as an end-to-end AI engineering project to explore how modern LLMs can be combined with **RAG, multimodal intelligence, real-time search, cloud databases, model routing, caching, and full-stack web development** to create a practical AI product.

📧 **Email:** imanilyadav12@gmail.com

🔗 **LinkedIn:**  
https://www.linkedin.com/in/anil-panchitha-507694241/

---

## 💡 Project Vision

> **Medha AI is not just a chatbot — it is an intelligent AI platform that connects reasoning, real-time information, private knowledge, multimodal understanding, and persistent conversations through one unified interface.**

---

## ⭐ Support

If you find Medha AI interesting, consider giving the repository a ⭐.

Feedback, collaboration, and contributions are welcome.

---

**Designed & Developed by Anil Panchitha**
