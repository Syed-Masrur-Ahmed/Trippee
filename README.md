# Trippee

**Collaborative Trip Planning Made Intelligent**

Trippee is a real-time collaborative travel planning application that combines interactive mapping, AI-powered assistance, and shared note-taking to help groups plan their perfect trip together.

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Database-3FCF8E?style=flat-square&logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=flat-square&logo=tailwindcss)

---

## Features

### Interactive Collaborative Map
- **Real-time place markers** synced across all collaborators
- **Live cursor tracking** to see where your friends are looking
- **Mapbox GL integration** for beautiful, responsive maps
- **Quick search** to find and add places instantly

### AI Travel Assistant
- **"Hey Trippee" activation** in group chat
- **Smart place recommendations** based on your location and preferences
- **Automatic itinerary generation** with intelligent clustering
- **Detailed place information** including ratings, reviews, and opening hours
- Powered by Google Gemini AI

### Smart Itinerary Builder
- **Drag-and-drop organization** for day-by-day planning
- **AI-powered auto-generation** that clusters nearby places
- **Route optimization** using nearest-neighbor algorithms
- **PDF export** for offline access during your trip

### Collaborative Notes
- **Real-time rich text editing** with presence indicators
- **Per-place notes** to capture details about each destination
- **General trip notes** for overall planning
- Built with Tiptap editor

### Team Collaboration
- **Email invitations** with secure tokens
- **Invites dashboard** to view and manage pending invitations
- **One-click accept/decline** for trip invitations
- **Role-based access** (owner, member)
- **Real-time synchronization** of all changes
- **Ownership transfer** when creators leave

---

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 15 (App Router) |
| **Frontend** | React 19, TypeScript 5 |
| **Styling** | Tailwind CSS 4 |
| **Database** | Supabase (PostgreSQL) |
| **Authentication** | Supabase Auth (Email/Password, Google OAuth) |
| **Real-time** | Supabase Realtime |
| **AI** | Vercel AI SDK, Google Gemini (2.5 Flash) |
| **Maps** | Mapbox GL JS, react-map-gl |
| **Rich Text** | Tiptap |
| **Drag & Drop** | @dnd-kit |
| **Email** | Resend |
| **PDF Generation** | jsPDF |

---

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- API keys for Mapbox, Google Places, and Google AI

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/trippee.git
   cd trippee/trippee
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the `trippee` directory:
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=

   # Mapbox
   NEXT_PUBLIC_MAPBOX_TOKEN=

   # Google APIs
   GOOGLE_PLACES_API_KEY=
   GOOGLE_GENERATIVE_AI_API_KEY=

   # Email (Resend)
   RESEND_API_KEY=

   # App URL (for email links)
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Set up the database**
   
   Run the SQL migrations in `supabase/migrations/` in order against your Supabase project.

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
trippee/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── dashboard/         # User dashboard
│   ├── trip/[tripId]/     # Trip pages
│   └── invite/[token]/    # Invitation acceptance
├── components/            # React components
│   ├── ai/               # AI chat components
│   ├── auth/             # Authentication components
│   ├── itinerary/        # Itinerary panel
│   ├── map/              # Map and search components
│   ├── notes/            # Notes editor
│   └── trip/             # Trip management components
├── lib/                   # Utility libraries
│   ├── ai/               # AI prompts and tools
│   ├── hooks/            # Custom React hooks
│   ├── supabase/         # Supabase clients and types
│   └── utils/            # Utility functions
└── supabase/
    └── migrations/        # Database migrations
```

---

## Authentication

Trippee supports two authentication methods:

1. **Email/Password** - Traditional signup with email confirmation
2. **Google OAuth** - One-click Google sign-in

See `AUTH_SETUP.md` and `GOOGLE_OAUTH_SETUP.md` for detailed setup instructions.

---

## License

This project is private and proprietary.

---

## Contributing

This is a private project. Please contact the repository owner for contribution guidelines.
