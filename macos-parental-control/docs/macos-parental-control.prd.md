# macOS Parental Control with Time-Banking System

## Problem
Parents of 13-year-old children struggle to balance screen time and study habits when kids play games and watch YouTube/TikTok from morning to night, leading to poor academic performance. Existing solutions like Apple Screen Time only report usage without enforcing limits or providing incentive systems to motivate self-regulation.

## Evidence
- **Observed behavior**: Child plays games and watches YouTube/TikTok continuously from morning to night without studying
- **Academic impact**: Test scores declining due to lack of study time
- **Failed intervention**: Parent verbal warnings ignored, child continues excessive screen time
- **Existing tools inadequate**: Apple Screen Time reports usage but doesn't auto-block or provide reward mechanisms

## Users
- **Primary**: Parents of 13-year-old children who need to enforce screen time limits while encouraging study habits through positive reinforcement
- **Secondary**: 13-year-old children who need structure and motivation to balance entertainment with learning
- **Not for**: 
  - Children under 10 (different developmental needs)
  - Teenagers 16+ (should have more autonomy)
  - Workplace productivity monitoring

## Hypothesis
We believe **a time-banking parental control system that auto-blocks entertainment apps after 2 hours and unlocks 10-minute bonuses through English learning** will **help 13-year-olds balance play and study time** for **parents seeking to improve their child's academic habits**.

We'll know we're right when **daily play time stays within 2-hour limit and study time increases to 1+ hour/day through the earning mechanism**.

## Success Metrics
| Metric | Target | How measured |
|---|---|---|
| Daily play time | ≤ 2 hours/day | App logs: total time in games + YouTube/TikTok |
| Daily study time | ≥ 1 hour/day | App logs: total time in learning module |
| Play/study balance | Study time increases relative to baseline | Compare week 1 vs week 4 ratios |
| System effectiveness | Child uses learning module to unlock play time | Track: bonus time earned vs manual parent unlocks |

## Scope

### MVP — Phase 1 (Core Local System)
**Goal**: Validate time-banking mechanism works on single macOS device

**Features**:
- macOS native app with activity monitoring
  - Track foreground app usage (games, YouTube app, browsers)
  - Detect game apps (Steam, Epic, Roblox, Minecraft, etc.)
  - Monitor YouTube/TikTok via app detection
- Auto-blocking mechanism
  - Force quit apps when 2-hour entertainment quota exhausted
  - Block app launches until quota replenished
- Time-banking system
  - 2 hours (120 minutes) entertainment quota per day (games + YouTube/TikTok combined)
  - Earn 10 minutes bonus per 60 minutes of English learning
  - Daily quota reset at midnight
- English learning module (embedded in app)
  - Audio listening exercises (pre-loaded MP3s)
  - Multiple choice quizzes (local JSON database)
  - Timer tracking: must complete 60 minutes to earn bonus
  - Simple progress tracking (CoreData)
- Parent configuration panel
  - Set daily entertainment quota
  - Configure blocked apps list
  - View daily usage reports
  - Manual override (unlock/lock)

**Technical constraints**:
- macOS 12+ (Screen Time API requirement)
- Single device, single child
- Local storage only (no cloud sync)
- Parent must have admin access to install

### Phase 2 (Browser Extensions)
**Goal**: Deep tracking of web content, not just app-level

**Features**:
- Safari extension: URL tracking, YouTube video time detection
- Chrome extension: Same capabilities + native messaging to macOS app
- Content-level blocking (specific domains, not just apps)
- YouTube video time accumulation (even in browser)

### Phase 3 (Remote Monitoring Dashboard)
**Goal**: Parent can monitor and control from anywhere

**Features**:
- Backend API (Node.js + PostgreSQL)
  - User authentication (parent/child accounts)
  - Activity logging and sync
  - Real-time WebSocket for live updates
- Web dashboard (Next.js)
  - Real-time activity feed
  - Daily/weekly usage charts
  - Remote block/unblock controls
  - Rule configuration UI
- macOS app sync
  - Bi-directional sync with server
  - Offline mode with queue
  - Push notifications for parent

### Phase 4 (Advanced Features)
- Mobile companion app (iOS/Android) for parent
- AI content analysis (classify YouTube videos as educational vs entertainment)
- Multi-child management
- Gamification (streaks, achievements, levels)
- Smart scheduling (auto-adjust rules based on school calendar)

### Out of scope
- **Windows/Linux support** — macOS only for MVP, other platforms require different APIs
- **iOS/iPadOS monitoring** — separate Screen Time API, different architecture
- **Content filtering (inappropriate content)** — focus is time management, not content safety
- **Social features** — no leaderboards, friend comparisons, or sharing
- **Stealth mode** — child will be aware of monitoring (transparent approach)
- **School integration** — no grade tracking, teacher communication, or LMS integration
- **Multi-language learning** — English only for MVP

## Delivery Milestones

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | Technical feasibility validation | Proof-of-concept: Screen Time API can block apps, activity monitoring works | pending | — |
| 2 | MVP macOS app | Parent can install app, child's game/YouTube time auto-blocked after 2 hours, learning module unlocks 10min bonus per 60min study | pending | — |
| 3 | Browser extensions | YouTube time tracked in Safari/Chrome, not just app | pending | — |
| 4 | Remote dashboard | Parent can monitor and control from web/mobile | pending | — |

## Open Questions

### Technical
- [ ] **Bypass prevention**: How to prevent child from uninstalling app, force quitting, or booting into Windows/Recovery Mode?
  - Mitigation options: System Extension (requires SIP), admin password protection, tamper detection
- [ ] **Browser content access**: Can we reliably detect YouTube video playback in browsers without extension? (Network Extension vs Browser Extension tradeoff)
- [ ] **Multi-browser support**: Child can use Safari, Chrome, Firefox, Edge — do we need extensions for all?
- [ ] **Offline learning content**: How much English learning content to bundle? (file size vs variety)

### Product
- [ ] **Transparency vs stealth**: Should child see real-time quota countdown, or only know when blocked?
  - Hypothesis: Transparent countdown encourages self-regulation
- [ ] **Punishment vs reward framing**: Is auto-blocking perceived as punishment? Does it create adversarial relationship?
  - Mitigation: Emphasize earning bonus time, not losing base time
- [ ] **Learning content quality**: Pre-made quizzes vs integrate with Duolingo/Khan Academy API?
- [ ] **Quota flexibility**: Should parent be able to grant emergency unlocks (e.g., school project needs YouTube research)?

### Business
- [ ] **Pricing model**: Free with premium features, or paid upfront?
- [ ] **Distribution**: Mac App Store (requires Apple review, sandboxing limits) vs direct download (easier updates, full system access)?
- [ ] **Privacy compliance**: COPPA (child under 13 data collection), GDPR if expanding to EU

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Child finds bypass method** (uninstall, boot Windows, use other device) | High | Critical — system becomes useless | System Extension + admin password + tamper alerts to parent |
| **Apple rejects app from App Store** (Screen Time API restrictions) | Medium | High — limits distribution | Offer direct download option, document entitlements clearly |
| **Learning module feels like punishment** (child resents forced learning) | Medium | High — defeats self-regulation goal | Gamification (points, levels), variety of content, short sessions (10min chunks) |
| **Parent over-relies on automation** (stops communicating with child) | Medium | Medium — damages parent-child relationship | In-app tips encouraging dialogue, weekly family review feature |
| **Performance impact** (constant monitoring drains battery/CPU) | Low | Medium — user uninstalls | Optimize polling intervals, use system APIs efficiently, background mode |
| **Privacy concerns** (child feels surveilled) | Medium | Medium — trust issues | Transparent UI showing what's tracked, parent-child agreement feature |
| **Scope creep** (parents request content filtering, homework help, etc.) | High | Medium — delays core feature | Strict MVP scope, defer feature requests to post-launch roadmap |

## Technical Feasibility Assessment

### ✅ **Confirmed Feasible**
- App usage tracking (NSWorkspace API)
- Force quit apps (NSRunningApplication)
- Screen Time API for app blocking (macOS 12+)
- Local time-banking logic
- Embedded learning module (AVFoundation for audio, SwiftUI for quiz)

### ⚠️ **Feasible with Constraints**
- **Browser URL tracking**: Requires browser extensions (Safari + Chrome minimum)
- **YouTube video time**: Can detect app/domain, but not specific video content without extension
- **Bypass prevention**: System Extension helps but not foolproof (child with admin access can disable)

### ❌ **Not Feasible in MVP**
- **Reading iframe content**: Cannot see YouTube embeds in other websites without browser extension
- **Cross-device sync**: Requires backend infrastructure (deferred to Phase 3)
- **Preventing uninstall**: macOS security model allows user to remove apps (can only make it harder)

## Dependencies

### External
- **Apple Developer Program** ($99/year) — required for Screen Time API entitlements
- **Notarization** — required for macOS Gatekeeper (even for direct download)
- **English learning content** — need licensed audio/quiz content or create original

### Internal
- **Design**: Learning module UX must feel rewarding, not punitive
- **Content**: 20+ hours of English learning material for variety
- **Testing**: Real parent-child pilot (2-4 weeks) before public release

---

**Status**: DRAFT — requirements validated with user evidence. Implementation planning pending.

**Next step**: `/plan .claude/prds/macos-parental-control.prd.md` to create technical implementation plan for Milestone 1 (feasibility validation).
