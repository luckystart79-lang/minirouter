# Technical Specification: macOS Parental Control System

**Version**: 1.0  
**Date**: 2026-05-17  
**Status**: Draft  
**Related PRD**: `.claude/prds/macos-parental-control.prd.md`

---

## 1. System Overview

### 1.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     macOS Native App                         │
│                    (Swift + SwiftUI)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Monitor    │  │   Blocker    │  │   Learning   │     │
│  │   Engine     │  │   Engine     │  │   Module     │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
│                   ┌────────▼────────┐                       │
│                   │  Time Banking   │                       │
│                   │     Engine      │                       │
│                   └────────┬────────┘                       │
│                            │                                 │
│                   ┌────────▼────────┐                       │
│                   │   CoreData DB   │                       │
│                   └─────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  NSWorkspace    │  │  Screen Time    │  │  AVFoundation   │
│      API        │  │      API        │  │  (Audio Player) │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 1.2 Technology Stack

#### Phase 1: MVP (macOS Native App)

| Component | Technology | Version | Justification |
|-----------|-----------|---------|---------------|
| Language | Swift | 5.9+ | **Required** - Screen Time API only available in Swift/Objective-C. Native performance, full macOS API access |
| UI Framework | SwiftUI | macOS 12+ | Modern declarative UI, less code than AppKit, reactive data binding |
| Database | CoreData | Built-in | Local persistence, no external dependencies, Apple-optimized |
| Audio | AVFoundation | Built-in | Native audio playback for learning module, low-level control |
| Monitoring | NSWorkspace | Built-in | Track foreground apps, process lifecycle events |
| Blocking | FamilyControls | macOS 12+ | **Required** - Official Screen Time API for app blocking, system-level enforcement |
| Background | BackgroundTasks | Built-in | Periodic quota checks, energy-efficient scheduling |

**Why Swift is mandatory:**
- Screen Time API (`FamilyControls` framework) has no JavaScript/Python bindings
- NSWorkspace, CoreData, AVFoundation are Objective-C/Swift only
- Electron/web wrappers cannot access system-level blocking APIs
- Performance: Native Swift is 10-100x faster than interpreted languages for system monitoring

**Alternatives considered and rejected:**
- ❌ **Electron + Node.js**: Cannot access Screen Time API, high memory footprint (200MB+)
- ❌ **Python + PyObjC**: Poor performance for 5-second polling, no SwiftUI bindings
- ❌ **React Native macOS**: Immature ecosystem, limited native API access

#### Phase 2: Browser Extensions

| Component | Technology | Justification |
|-----------|-----------|---------------|
| Safari Extension | Swift + JavaScript | Safari extensions require Swift wrapper, JavaScript for content scripts |
| Chrome Extension | TypeScript (Manifest V3) | Type safety, modern async/await, better tooling than vanilla JS |
| Native Messaging | Swift (host app) | Bridge between extension and macOS app |

**Why TypeScript for Chrome:**
- Type safety prevents runtime errors in extension lifecycle
- Better IDE support (autocomplete, refactoring)
- Easier to maintain as codebase grows
- Compiles to ES2020+ for modern Chrome

#### Phase 3: Backend & Web Dashboard

| Component | Technology | Justification |
|-----------|-----------|---------------|
| Backend API | **Node.js + TypeScript** | Rich ecosystem (Express/NestJS), WebSocket support (Socket.io), fast development |
| Alternative Backend | Go | Higher performance, better concurrency, smaller binary - but smaller ecosystem |
| Database | PostgreSQL 15+ | ACID compliance, JSON support, mature ecosystem |
| Cache | Redis 7+ | Fast in-memory cache, pub/sub for real-time updates |
| Web Framework | Next.js 14 (App Router) | React Server Components, built-in API routes, excellent DX |
| UI Library | Tailwind CSS + shadcn/ui | Utility-first CSS, accessible components, fast prototyping |
| Real-time | Socket.io | Bi-directional WebSocket, fallback to polling, room support |
| ORM | Prisma | Type-safe queries, migrations, excellent TypeScript integration |

**Backend: Node.js vs Go comparison:**

| Criteria | Node.js + TypeScript | Go |
|----------|---------------------|-----|
| Performance | Good (V8 JIT) | Excellent (compiled) |
| Ecosystem | Huge (npm) | Growing |
| WebSocket | Socket.io (mature) | gorilla/websocket (manual) |
| Development Speed | Fast (hot reload) | Medium (compile step) |
| Type Safety | TypeScript (compile-time) | Built-in (compile-time) |
| Deployment | Docker + PM2 | Single binary |
| Team Familiarity | High (JavaScript devs) | Medium (fewer Go devs) |

**Recommendation**: Start with Node.js + TypeScript for MVP backend (faster development), migrate to Go if performance becomes bottleneck (unlikely for <10k users).

**Why Next.js 14:**
- Server Components reduce client bundle size (faster page loads)
- Built-in API routes (no separate Express server needed)
- File-based routing (intuitive structure)
- Vercel deployment (zero-config)
- React 18 features (Suspense, streaming SSR)

#### Phase 4: Mobile App (Optional)

| Option | Technology | Justification |
|--------|-----------|---------------|
| **Option A** | React Native | Code sharing with web dashboard (70%+ shared logic), large ecosystem |
| **Option B** | Flutter | Better performance, single codebase for iOS/Android, modern UI |
| **Option C** | Native (Swift + Kotlin) | Best performance, full platform access, but 2x development time |

**Recommendation**: React Native for faster time-to-market, Flutter if performance is critical.

### 1.3 Development Environment

**Required Tools:**
- **Xcode 15+** (macOS app development)
- **Swift 5.9+** (language)
- **Node.js 20+** (backend, if Phase 3)
- **PostgreSQL 15+** (database, if Phase 3)
- **Git** (version control)

**Recommended Tools:**
- **VS Code** (TypeScript/web development)
- **Postman** (API testing)
- **TablePlus** (database GUI)
- **Docker Desktop** (local backend services)

**Learning Resources:**
- [Swift Documentation](https://swift.org/documentation/)
- [SwiftUI Tutorials](https://developer.apple.com/tutorials/swiftui)
- [Screen Time API Guide](https://developer.apple.com/documentation/familycontrols)
- [Next.js Learn](https://nextjs.org/learn)

### 1.3 System Requirements

**Minimum**:
- macOS 12.0 (Monterey) or later
- 100 MB disk space
- Admin privileges for installation
- Apple Developer account (for Screen Time entitlements)

**Recommended**:
- macOS 13.0 (Ventura) or later
- 200 MB disk space (with learning content)

---

## 2. Core Components

### 2.1 Monitor Engine

**Responsibility**: Track app usage in real-time

#### 2.1.1 App Detection

```swift
class MonitorEngine {
    // Tracked app categories
    enum AppCategory {
        case game           // Steam, Epic, Roblox, Minecraft, etc.
        case entertainment  // YouTube, TikTok, Netflix, etc.
        case browser        // Safari, Chrome, Firefox (for web tracking)
        case learning       // Internal learning module
        case other          // Everything else (not tracked)
    }
    
    // App registry
    let gameApps: [String] = [
        "com.valvesoftware.steam",
        "com.epicgames.EpicGamesLauncher",
        "com.roblox.RobloxPlayer",
        "com.mojang.minecraft",
        // ... more
    ]
    
    let entertainmentApps: [String] = [
        "com.google.android.youtube.tvkids",  // YouTube
        "com.zhiliaoapp.musically",            // TikTok
        // ... more
    ]
}
```

#### 2.1.2 Time Tracking Algorithm

```swift
class ActivityTracker {
    private var currentSession: Session?
    private var lastCheckTime: Date = Date()
    
    // Poll every 5 seconds
    func startTracking() {
        Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { _ in
            self.checkForegroundApp()
        }
    }
    
    func checkForegroundApp() {
        guard let app = NSWorkspace.shared.frontmostApplication else { return }
        let bundleID = app.bundleIdentifier ?? ""
        let category = categorize(bundleID)
        
        let now = Date()
        let elapsed = now.timeIntervalSince(lastCheckTime)
        
        // Only count if same app and < 10 seconds gap (prevent idle time)
        if currentSession?.bundleID == bundleID && elapsed < 10 {
            currentSession?.duration += elapsed
        } else {
            // Save previous session
            if let session = currentSession {
                saveSession(session)
            }
            // Start new session
            currentSession = Session(
                bundleID: bundleID,
                category: category,
                startTime: now,
                duration: 0
            )
        }
        
        lastCheckTime = now
        
        // Update quota
        if category == .game || category == .entertainment {
            TimeBankingEngine.shared.consumeEntertainmentTime(elapsed)
        }
    }
}
```

#### 2.1.3 Data Model

```swift
struct Session: Codable {
    let id: UUID
    let bundleID: String
    let appName: String
    let category: AppCategory
    let startTime: Date
    var duration: TimeInterval  // in seconds
    
    init(bundleID: String, category: AppCategory, startTime: Date, duration: TimeInterval) {
        self.id = UUID()
        self.bundleID = bundleID
        self.appName = NSWorkspace.shared.runningApplications
            .first(where: { $0.bundleIdentifier == bundleID })?
            .localizedName ?? "Unknown"
        self.category = category
        self.startTime = startTime
        self.duration = duration
    }
}
```

### 2.2 Time Banking Engine

**Responsibility**: Manage entertainment quota and learning rewards

#### 2.2.1 Quota Model

```swift
class TimeBankingEngine {
    static let shared = TimeBankingEngine()
    
    // Daily quotas (in seconds)
    private let BASE_ENTERTAINMENT_QUOTA: TimeInterval = 2 * 60 * 60  // 2 hours
    private let LEARNING_REWARD_RATIO: TimeInterval = 10 * 60 / 60 * 60  // 10 min per 60 min
    
    // Current state
    private(set) var entertainmentQuotaRemaining: TimeInterval
    private(set) var learningTimeAccumulated: TimeInterval
    private(set) var lastResetDate: Date
    
    init() {
        // Load from CoreData or initialize
        self.entertainmentQuotaRemaining = BASE_ENTERTAINMENT_QUOTA
        self.learningTimeAccumulated = 0
        self.lastResetDate = Date()
    }
    
    // Consume entertainment time
    func consumeEntertainmentTime(_ seconds: TimeInterval) {
        entertainmentQuotaRemaining -= seconds
        
        if entertainmentQuotaRemaining <= 0 {
            // Trigger block
            BlockerEngine.shared.blockEntertainmentApps()
        }
        
        // Persist to CoreData
        save()
    }
    
    // Earn bonus time through learning
    func earnBonusTime(learningSeconds: TimeInterval) {
        learningTimeAccumulated += learningSeconds
        
        // Every 60 minutes of learning = 10 minutes bonus
        let bonusEarned = floor(learningTimeAccumulated / (60 * 60)) * (10 * 60)
        
        if bonusEarned > 0 {
            entertainmentQuotaRemaining += bonusEarned
            learningTimeAccumulated -= floor(learningTimeAccumulated / (60 * 60)) * (60 * 60)
            
            // Unblock if was blocked
            if entertainmentQuotaRemaining > 0 {
                BlockerEngine.shared.unblockEntertainmentApps()
            }
            
            // Notify user
            showNotification("🎉 Earned \(Int(bonusEarned / 60)) minutes of play time!")
        }
        
        save()
    }
    
    // Reset at midnight
    func checkDailyReset() {
        let calendar = Calendar.current
        if !calendar.isDateInToday(lastResetDate) {
            entertainmentQuotaRemaining = BASE_ENTERTAINMENT_QUOTA
            learningTimeAccumulated = 0
            lastResetDate = Date()
            save()
        }
    }
}
```

#### 2.2.2 Quota Persistence (CoreData)

```swift
// CoreData Entity: DailyQuota
@objc(DailyQuota)
class DailyQuota: NSManagedObject {
    @NSManaged var date: Date
    @NSManaged var entertainmentQuotaRemaining: Double
    @NSManaged var learningTimeAccumulated: Double
    @NSManaged var totalEntertainmentUsed: Double
    @NSManaged var totalLearningTime: Double
}
```

### 2.3 Blocker Engine

**Responsibility**: Block/unblock apps based on quota

#### 2.3.1 Screen Time API Integration

```swift
import FamilyControls
import ManagedSettings

class BlockerEngine {
    static let shared = BlockerEngine()
    private let store = ManagedSettingsStore()
    
    // Apps to block
    private var blockedApps: Set<ApplicationToken> = []
    
    func initialize() async {
        // Request Family Controls authorization
        do {
            try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
        } catch {
            print("Failed to authorize Family Controls: \(error)")
        }
    }
    
    func blockEntertainmentApps() {
        // Get tokens for game/entertainment apps
        let gameTokens = getApplicationTokens(for: MonitorEngine.shared.gameApps)
        let entertainmentTokens = getApplicationTokens(for: MonitorEngine.shared.entertainmentApps)
        
        blockedApps = gameTokens.union(entertainmentTokens)
        
        // Apply shield (block)
        store.shield.applications = blockedApps
        store.shield.applicationCategories = .all(except: [])
        
        // Show notification
        showBlockNotification()
    }
    
    func unblockEntertainmentApps() {
        blockedApps.removeAll()
        store.shield.applications = nil
        
        showUnblockNotification()
    }
    
    // Fallback: Force quit if Screen Time API fails
    func forceQuitApp(bundleID: String) {
        NSWorkspace.shared.runningApplications
            .first(where: { $0.bundleIdentifier == bundleID })?
            .forceTerminate()
    }
}
```

#### 2.3.2 Block UI

When app is blocked, Screen Time API shows system shield. We can customize message:

```swift
extension BlockerEngine {
    func showBlockNotification() {
        let content = UNMutableNotificationContent()
        content.title = "⏰ Entertainment Time Used Up"
        content.body = "You've used your 2-hour daily limit. Study for 1 hour to earn 10 more minutes!"
        content.sound = .default
        
        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil
        )
        
        UNUserNotificationCenter.current().add(request)
    }
}
```

### 2.4 Learning Module

**Responsibility**: Provide English learning content and track progress

#### 2.4.1 Content Structure

```
LearningContent/
├── audio/
│   ├── lesson_001.mp3
│   ├── lesson_002.mp3
│   └── ...
├── quizzes/
│   ├── quiz_001.json
│   ├── quiz_002.json
│   └── ...
└── manifest.json
```

**manifest.json**:
```json
{
  "lessons": [
    {
      "id": "lesson_001",
      "title": "Basic Greetings",
      "audioFile": "audio/lesson_001.mp3",
      "duration": 300,
      "quizFile": "quizzes/quiz_001.json",
      "difficulty": "beginner"
    }
  ]
}
```

**quiz_001.json**:
```json
{
  "questions": [
    {
      "id": 1,
      "question": "What does 'Hello' mean?",
      "options": ["Xin chào", "Tạm biệt", "Cảm ơn", "Xin lỗi"],
      "correctAnswer": 0,
      "explanation": "'Hello' nghĩa là 'Xin chào'"
    }
  ]
}
```

#### 2.4.2 Learning Session Flow

```swift
class LearningModule {
    enum SessionState {
        case idle
        case listening(Lesson)
        case quiz(Quiz)
        case completed
    }
    
    private var currentState: SessionState = .idle
    private var sessionStartTime: Date?
    private var accumulatedTime: TimeInterval = 0
    
    func startLesson(_ lesson: Lesson) {
        currentState = .listening(lesson)
        sessionStartTime = Date()
        
        // Play audio
        AudioPlayer.shared.play(lesson.audioFile)
    }
    
    func completeListening() {
        guard case .listening(let lesson) = currentState else { return }
        
        // Load quiz
        let quiz = loadQuiz(lesson.quizFile)
        currentState = .quiz(quiz)
    }
    
    func submitQuiz(answers: [Int]) -> QuizResult {
        guard case .quiz(let quiz) = currentState else { 
            return QuizResult(score: 0, passed: false) 
        }
        
        let score = calculateScore(quiz, answers)
        let passed = score >= 0.7  // 70% to pass
        
        if passed {
            // Calculate time spent
            if let startTime = sessionStartTime {
                accumulatedTime += Date().timeIntervalSince(startTime)
                
                // Award bonus time
                TimeBankingEngine.shared.earnBonusTime(learningSeconds: accumulatedTime)
                
                // Reset for next session
                accumulatedTime = 0
            }
            
            currentState = .completed
        } else {
            // Retry quiz
            currentState = .quiz(quiz)
        }
        
        return QuizResult(score: score, passed: passed)
    }
}
```

#### 2.4.3 Learning UI (SwiftUI)

```swift
struct LearningView: View {
    @StateObject var viewModel = LearningViewModel()
    
    var body: some View {
        VStack {
            // Progress bar
            ProgressView(value: viewModel.progress)
                .padding()
            
            // Timer
            Text("Time: \(viewModel.elapsedTime.formatted())")
                .font(.title2)
            
            // Content
            switch viewModel.state {
            case .listening(let lesson):
                AudioPlayerView(lesson: lesson)
            case .quiz(let quiz):
                QuizView(quiz: quiz, onSubmit: viewModel.submitQuiz)
            case .completed:
                CompletionView(timeEarned: viewModel.bonusTimeEarned)
            default:
                LessonListView(lessons: viewModel.lessons)
            }
        }
    }
}
```

---

## 3. Data Models

### 3.1 CoreData Schema

```swift
// Entity: DailyQuota
@objc(DailyQuota)
class DailyQuota: NSManagedObject {
    @NSManaged var date: Date
    @NSManaged var entertainmentQuotaRemaining: Double  // seconds
    @NSManaged var learningTimeAccumulated: Double      // seconds
    @NSManaged var totalEntertainmentUsed: Double       // seconds
    @NSManaged var totalLearningTime: Double            // seconds
}

// Entity: ActivitySession
@objc(ActivitySession)
class ActivitySession: NSManagedObject {
    @NSManaged var id: UUID
    @NSManaged var bundleID: String
    @NSManaged var appName: String
    @NSManaged var category: String  // "game", "entertainment", "learning", "other"
    @NSManaged var startTime: Date
    @NSManaged var duration: Double  // seconds
}

// Entity: LearningProgress
@objc(LearningProgress)
class LearningProgress: NSManagedObject {
    @NSManaged var lessonID: String
    @NSManaged var completedAt: Date
    @NSManaged var quizScore: Double
    @NSManaged var timeSpent: Double  // seconds
}
```

### 3.2 User Defaults (Settings)

```swift
struct AppSettings {
    @AppStorage("baseEntertainmentQuota") var baseQuota: Double = 7200  // 2 hours
    @AppStorage("learningRewardRatio") var rewardRatio: Double = 600    // 10 min per 60 min
    @AppStorage("parentPassword") var parentPassword: String = ""
    @AppStorage("blockedApps") var blockedAppsJSON: String = "[]"
    @AppStorage("isFirstLaunch") var isFirstLaunch: Bool = true
}
```

---

## 4. APIs & Interfaces

### 4.1 Internal APIs

#### MonitorEngine API
```swift
protocol MonitorEngineProtocol {
    func startTracking()
    func stopTracking()
    func getCurrentActivity() -> Session?
    func getTodayStats() -> DailyStats
}

struct DailyStats {
    let totalScreenTime: TimeInterval
    let entertainmentTime: TimeInterval
    let learningTime: TimeInterval
    let otherTime: TimeInterval
}
```

#### TimeBankingEngine API
```swift
protocol TimeBankingEngineProtocol {
    func consumeEntertainmentTime(_ seconds: TimeInterval)
    func earnBonusTime(learningSeconds: TimeInterval)
    func getRemainingQuota() -> TimeInterval
    func checkDailyReset()
}
```

#### BlockerEngine API
```swift
protocol BlockerEngineProtocol {
    func blockEntertainmentApps()
    func unblockEntertainmentApps()
    func isBlocked() -> Bool
    func manualOverride(unlock: Bool, password: String) -> Bool
}
```

### 4.2 External APIs (Future Phases)

#### Phase 3: Backend API Endpoints
```
POST   /api/v1/auth/login
POST   /api/v1/devices/register
POST   /api/v1/activities/sync
GET    /api/v1/activities/today
GET    /api/v1/quota/status
POST   /api/v1/remote/block
POST   /api/v1/remote/unlock
```

---

## 5. Security & Privacy

### 5.1 Data Protection

**Local Data**:
- CoreData encrypted with FileProtection.complete
- Parent password hashed with bcrypt
- No sensitive data in UserDefaults

**Network (Phase 3)**:
- HTTPS only
- JWT authentication
- End-to-end encryption for activity logs

### 5.2 Permissions Required

```xml
<!-- Info.plist -->
<key>NSUserNotificationUsageDescription</key>
<string>Show notifications when quota is exhausted or bonus earned</string>

<key>NSAppleEventsUsageDescription</key>
<string>Monitor app usage to enforce screen time limits</string>

<!-- Entitlements -->
<key>com.apple.developer.family-controls</key>
<true/>

<key>com.apple.security.app-sandbox</key>
<true/>
```

### 5.3 Bypass Prevention

**Implemented**:
- System Extension (requires admin password to uninstall)
- Tamper detection (alert parent if app is force quit)
- Launch agent (auto-restart if killed)

**Not Implemented (Limitations)**:
- Cannot prevent boot into Windows/Recovery Mode
- Cannot prevent if child has admin access
- Cannot prevent use of other devices (iPad, phone)

---

## 6. Performance Requirements

### 6.1 Resource Usage

| Metric | Target | Measurement |
|--------|--------|-------------|
| CPU usage (idle) | < 1% | Activity Monitor |
| CPU usage (active) | < 5% | Activity Monitor |
| Memory footprint | < 50 MB | Activity Monitor |
| Disk space | < 200 MB | Finder |
| Battery impact | < 2%/hour | Energy Impact |

### 6.2 Responsiveness

| Operation | Target | Notes |
|-----------|--------|-------|
| App launch | < 2s | Cold start |
| Block app | < 1s | From quota exhaustion |
| Unblock app | < 1s | After earning bonus |
| UI interaction | < 100ms | Button clicks, navigation |
| Daily reset | < 500ms | Midnight reset |

---

## 7. Testing Strategy

### 7.1 Unit Tests

```swift
// TimeBankingEngineTests.swift
class TimeBankingEngineTests: XCTestCase {
    func testConsumeQuota() {
        let engine = TimeBankingEngine()
        engine.consumeEntertainmentTime(3600)  // 1 hour
        XCTAssertEqual(engine.entertainmentQuotaRemaining, 3600)  // 1 hour left
    }
    
    func testEarnBonus() {
        let engine = TimeBankingEngine()
        engine.earnBonusTime(learningSeconds: 3600)  // 1 hour
        XCTAssertEqual(engine.entertainmentQuotaRemaining, 7800)  // 2h + 10min
    }
    
    func testDailyReset() {
        let engine = TimeBankingEngine()
        engine.consumeEntertainmentTime(7200)  // Use all
        engine.checkDailyReset()  // Simulate next day
        XCTAssertEqual(engine.entertainmentQuotaRemaining, 7200)
    }
}
```

### 7.2 Integration Tests

- Monitor Engine + Time Banking: Verify quota consumption
- Blocker Engine + Screen Time API: Verify apps are blocked
- Learning Module + Time Banking: Verify bonus time awarded

### 7.3 Manual Testing Checklist

- [ ] Install app with admin privileges
- [ ] Launch game app, verify tracking starts
- [ ] Play for 2 hours, verify auto-block
- [ ] Complete 1-hour learning session, verify 10-min bonus
- [ ] Force quit app, verify auto-restart
- [ ] Reboot Mac, verify app launches on startup
- [ ] Test midnight reset
- [ ] Test parent override with password

---

## 8. Deployment

### 8.1 Build Configuration

```swift
// Debug
#if DEBUG
let API_BASE_URL = "http://localhost:3000"
let LOG_LEVEL = "verbose"
#else
// Release
let API_BASE_URL = "https://api.parentalcontrol.app"
let LOG_LEVEL = "error"
#endif
```

### 8.2 Distribution Options

**Option A: Mac App Store**
- Pros: Trusted distribution, auto-updates
- Cons: Sandboxing limits, Apple review delays
- Requirements: Apple Developer Program ($99/year)

**Option B: Direct Download**
- Pros: Full system access, faster updates
- Cons: Gatekeeper warnings, manual updates
- Requirements: Notarization (still needs Apple Developer)

**Recommended**: Start with direct download for MVP, submit to App Store later.

### 8.3 Installation Flow

```
1. User downloads .dmg file
2. Drag app to /Applications
3. Launch app
4. Request admin password (for System Extension)
5. Request Family Controls authorization
6. Request Notification permission
7. Setup wizard:
   - Set parent password
   - Configure blocked apps
   - Set daily quota (default 2h)
8. Install launch agent (auto-start on boot)
9. Start monitoring
```

---

## 9. Monitoring & Logging

### 9.1 Logging Strategy

```swift
import os.log

extension OSLog {
    static let monitor = OSLog(subsystem: "com.app.parentalcontrol", category: "monitor")
    static let blocker = OSLog(subsystem: "com.app.parentalcontrol", category: "blocker")
    static let learning = OSLog(subsystem: "com.app.parentalcontrol", category: "learning")
}

// Usage
os_log("Started tracking app: %{public}@", log: .monitor, type: .info, appName)
os_log("Blocked apps due to quota exhaustion", log: .blocker, type: .default)
os_log("Earned bonus time: %{public}d minutes", log: .learning, type: .info, minutes)
```

### 9.2 Analytics (Local Only for MVP)

```swift
struct AnalyticsEvent {
    let timestamp: Date
    let eventType: String
    let metadata: [String: Any]
}

// Track events
Analytics.track(.quotaExhausted, metadata: ["remainingTime": 0])
Analytics.track(.bonusEarned, metadata: ["minutes": 10])
Analytics.track(.appBlocked, metadata: ["bundleID": "com.game"])
```

---

## 10. Future Enhancements (Post-MVP)

### Phase 2: Browser Extensions
- Safari extension for URL tracking
- Chrome extension with native messaging
- YouTube video time detection

### Phase 3: Remote Dashboard
- Backend API (Node.js + PostgreSQL)
- Web dashboard (Next.js)
- Real-time sync via WebSocket
- Mobile app (iOS/Android)

### Phase 4: Advanced Features
- AI content classification
- Multi-child management
- Smart scheduling
- Gamification (streaks, achievements)

---

## 11. Open Technical Questions

- [ ] **Screen Time API reliability**: Does it work consistently across macOS versions?
- [ ] **System Extension approval**: How long does Apple review take?
- [ ] **Battery impact**: Real-world testing needed with 5-second polling
- [ ] **Learning content licensing**: Can we bundle copyrighted audio?
- [ ] **Bypass methods**: What if child boots into Windows via Boot Camp?

---

## 12. Success Criteria

**Technical**:
- [ ] App successfully blocks entertainment apps after 2h
- [ ] Learning module awards 10min bonus per 60min study
- [ ] Daily reset works correctly at midnight
- [ ] App survives force quit and reboot
- [ ] CPU usage < 5%, memory < 50MB

**Product**:
- [ ] Parent can install and configure in < 5 minutes
- [ ] Child understands quota system without explanation
- [ ] No false positives (blocking wrong apps)
- [ ] No false negatives (missing tracked apps)

---

**Status**: DRAFT - Ready for technical review and POC development

**Next Step**: Build Proof-of-Concept to validate Screen Time API and monitoring approach
