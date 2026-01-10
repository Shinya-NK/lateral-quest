# Lateral Quest

A browser-based lateral thinking puzzle game powered by Claude AI, built with React and Vite.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure API Key

This game uses the Anthropic Claude API to generate puzzles. You need an API key to play.

#### For Local Development (Recommended)

1. Get your API key from [Anthropic Console](https://console.anthropic.com/settings/keys)
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` and add your API key:
   ```
   VITE_ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
   ```

#### For GitHub Pages / Production

On GitHub Pages, you'll be prompted to enter your API key in the settings screen when you start the game. The key is stored in your browser's localStorage.

**⚠️ Security Note**: API keys entered in the browser are visible in localStorage. Only use this method if you understand the risks. For production use, consider implementing a backend proxy.

## Development

Run the development server:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Deployment to GitHub Pages

This project is configured to automatically deploy to GitHub Pages when you push to the `main` branch.

### Initial Setup

1. Go to your repository settings on GitHub
2. Navigate to **Settings** > **Pages**
3. Under **Source**, select **GitHub Actions**
4. Push to the `main` branch to trigger the deployment

### Manual Deployment

The GitHub Actions workflow (`.github/workflows/deploy.yml`) will automatically:
- Build the project with Vite
- Deploy to GitHub Pages
- Make the game available at: `https://<username>.github.io/lateral-quest/`

## Tech Stack

- React 18
- Vite 6
- Anthropic Claude API (claude-sonnet-4)
- Web Audio API for sound effects

## How to Play

1. Start the game and choose difficulty & genre
2. Enter your Anthropic API key (if not using .env)
3. AI generates a unique lateral thinking puzzle
4. Ask yes/no questions to uncover the truth
5. Make your final guess to solve the mystery!