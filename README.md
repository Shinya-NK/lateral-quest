# Lateral Quest

A browser-based lateral thinking puzzle game built with React and Vite.

## Features

- 🎮 **15+ Curated Puzzles**: Hand-crafted lateral thinking challenges
- 🎯 **7 Genres**: Daily life, work, school, relationship, medical, mystery, dark
- ⚙️ **3 Difficulty Levels**: Easy, normal, hard
- 🎵 **Dynamic Audio**: Synthesized sound effects and background music
- 📱 **Fully Responsive**: Play on any device
- ⚡ **No API Required**: Play immediately without setup

## Setup

Install dependencies:

```bash
npm install
```

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
- Web Audio API for sound effects and music

## How to Play

1. Click "ゲームを始める" (Start Game)
2. Choose your difficulty level and genre
3. Click "スタート" to begin
4. Ask yes/no questions to uncover the truth behind the puzzle
5. Use hints (max 3) if you get stuck
6. When progress reaches 90%, reveal the truth or make your guess
7. Get scored on your deduction skills!

## Game Tips

- Pay attention to specific details in the problem statement
- Ask about people's roles, relationships, and motivations
- Consider time, place, and circumstances
- Think outside the box - lateral thinking is key!
- Use hints wisely - they affect your final score