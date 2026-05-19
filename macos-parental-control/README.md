# macOS Parental Control System

Time-banking parental control app for macOS that helps 13-year-olds balance screen time and study habits.

## Project Overview

**Problem**: Kids play games/watch YouTube all day without studying, leading to poor academic performance.

**Solution**: Auto-block entertainment apps after 2 hours, unlock 10-minute bonuses through English learning.

## Documentation

- **[PRD](docs/macos-parental-control.prd.md)** - Product Requirements Document
- **[Technical Spec](docs/macos-parental-control.spec.md)** - Technical Specification

## Project Structure

```
macos-parental-control/
├── docs/                           # Documentation
│   ├── macos-parental-control.prd.md
│   └── macos-parental-control.spec.md
├── src/                            # Source code (to be created)
│   ├── MonitorEngine/
│   ├── BlockerEngine/
│   ├── TimeBankingEngine/
│   └── LearningModule/
├── tests/                          # Tests (to be created)
└── README.md
```

## Tech Stack

- **Language**: Swift 5.9+
- **UI**: SwiftUI
- **Database**: CoreData
- **APIs**: Screen Time API (FamilyControls), NSWorkspace, AVFoundation

## Requirements

- macOS 12.0+ (Monterey)
- Xcode 14+
- Apple Developer account (for Screen Time API entitlements)

## Core Features (MVP)

1. **Activity Monitoring**
   - Track game/YouTube/TikTok usage
   - 5-second polling interval
   - Categorize apps automatically

2. **Time Banking**
   - 2-hour daily entertainment quota
   - Auto-block when quota exhausted
   - Earn 10 minutes per 60 minutes of study

3. **Learning Module**
   - English listening exercises
   - Multiple choice quizzes
   - Progress tracking

4. **Parental Controls**
   - Configure blocked apps
   - Set daily quotas
   - View usage reports
   - Manual override

## Development Phases

### Phase 1: MVP (Local macOS App)
- ✅ PRD created
- ✅ Technical spec created
- ⏳ POC development
- ⏳ MVP implementation

### Phase 2: Browser Extensions
- Safari extension
- Chrome extension
- Deep web tracking

### Phase 3: Remote Dashboard
- Backend API (Node.js)
- Web dashboard (Next.js)
- Real-time sync
- Mobile app

### Phase 4: Advanced Features
- AI content analysis
- Multi-child management
- Gamification
- Smart scheduling

## Getting Started

### Prerequisites

```bash
# Install Xcode
xcode-select --install

# Clone repository
git clone <repo-url>
cd macos-parental-control
```

### Build & Run

```bash
# Open Xcode project (to be created)
open ParentalControl.xcodeproj

# Or use xcodebuild
xcodebuild -scheme ParentalControl -configuration Debug
```

## Testing

```bash
# Run unit tests
xcodebuild test -scheme ParentalControl

# Run integration tests
./scripts/run-integration-tests.sh
```

## Deployment

**Option A**: Direct download (recommended for MVP)
- Notarization required
- Full system access

**Option B**: Mac App Store
- Sandboxing limitations
- Apple review process

## License

TBD

## Contact

TBD

---

**Status**: Planning phase - PRD and technical spec completed, ready for POC development.

**Last Updated**: 2026-05-19
