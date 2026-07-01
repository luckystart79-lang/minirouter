"use client";

import { useState, useEffect } from "react";
import { Card, Button } from "@/shared/components";
import quizData from "./quizzes.json";

export default function ParentalControlDashboard() {
  const [devices, setDevices] = useState({});
  const [selectedUuid, setSelectedUuid] = useState(null);
  const [loading, setLoading] = useState(false);
  const [customQuotaInput, setCustomQuotaInput] = useState("");
  const [commandSentMessage, setCommandSentMessage] = useState("");
  
  // Learning & Homework states
  const [activeTab, setActiveTab] = useState("control"); // "control" | "learning"
  const [videoUrlInput, setVideoUrlInput] = useState("");
  const [videoTitleInput, setVideoTitleInput] = useState("");
  const [videoLevelInput, setVideoLevelInput] = useState("A2");

  const fetchDevices = async () => {
    try {
      const res = await fetch("/api/parental-control/devices");
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setDevices(data.devices || {});
          
          // Auto-select first device if none is selected
          const uuids = Object.keys(data.devices || {});
          if (uuids.length > 0 && !selectedUuid) {
            setSelectedUuid(uuids[0]);
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch parental control devices:", e);
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [selectedUuid]);

  const sendCommand = async (uuid, type, value = null) => {
    setLoading(true);
    try {
      const res = await fetch("/api/parental-control/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientUuid: uuid,
          commandType: type,
          value
        })
      });
      if (res.ok) {
        const actionText = 
          type === "PAUSE" ? "Đã gửi lệnh khóa thiết bị 🔒" : 
          type === "UNPAUSE" ? "Đã mở khóa thiết bị 🔓" : 
          type === "ADD_TIME" ? `Đã cộng thêm ${value / 60} phút` : 
          `Đã đổi Quota thành ${value / 60} phút`;
        
        setCommandSentMessage(actionText);
        setTimeout(() => setCommandSentMessage(""), 4000);
        await fetchDevices();
      }
    } catch (e) {
      alert("Không thể kết nối đến máy chủ: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignQuiz = async (quiz) => {
    setLoading(true);
    try {
      const res = await fetch("/api/parental-control/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientUuid: selectedUuid,
          type: "QUIZ",
          action: "ASSIGN",
          data: quiz
        })
      });
      if (res.ok) {
        setCommandSentMessage(`Đã giao bài tập "${quiz.title}" thành công!`);
        setTimeout(() => setCommandSentMessage(""), 4000);
        await fetchDevices();
      }
    } catch (e) {
      alert("Không thể giao bài tập: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnassignQuiz = async (quizId) => {
    setLoading(true);
    try {
      const res = await fetch("/api/parental-control/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientUuid: selectedUuid,
          type: "QUIZ",
          action: "UNASSIGN",
          data: { quizId }
        })
      });
      if (res.ok) {
        setCommandSentMessage("Đã hủy giao bài tập thành công!");
        setTimeout(() => setCommandSentMessage(""), 4000);
        await fetchDevices();
      }
    } catch (e) {
      alert("Không thể hủy giao bài tập: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignVideo = async () => {
    if (!videoUrlInput.trim()) {
      alert("Vui lòng nhập link YouTube hợp lệ!");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/parental-control/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientUuid: selectedUuid,
          type: "VIDEO",
          action: "ASSIGN",
          data: {
            url: videoUrlInput.trim(),
            title: videoTitleInput.trim() || "Bài học Video mới",
            level: videoLevelInput
          }
        })
      });
      if (res.ok) {
        setCommandSentMessage("Đã gửi yêu cầu giao Video! Thiết bị sẽ tự động tải, phân tích từ vựng/câu hỏi và đồng bộ lại.");
        setTimeout(() => setCommandSentMessage(""), 5000);
        setVideoUrlInput("");
        setVideoTitleInput("");
        await fetchDevices();
      }
    } catch (e) {
      alert("Không thể giao Video: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnassignVideo = async (videoId) => {
    setLoading(true);
    try {
      const res = await fetch("/api/parental-control/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientUuid: selectedUuid,
          type: "VIDEO",
          action: "UNASSIGN",
          data: { videoId }
        })
      });
      if (res.ok) {
        setCommandSentMessage("Đã hủy giao Video bài học thành công!");
        setTimeout(() => setCommandSentMessage(""), 4000);
        await fetchDevices();
      }
    } catch (e) {
      alert("Không thể hủy giao Video: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const formatSeconds = (sec) => {
    if (sec === undefined || sec === null) return "00:00:00";
    const h = Math.floor(sec / 3600).toString().padStart(2, "0");
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  const formatMinutes = (sec) => {
    if (sec === undefined || sec === null) return "0";
    return Math.floor(sec / 60);
  };

  const getIsOnline = (lastSeenISO) => {
    if (!lastSeenISO) return false;
    const diffMs = Date.now() - new Date(lastSeenISO).getTime();
    return diffMs < 30000; // Online if reported in last 30s
  };

  const uuids = Object.keys(devices);
  const activeDevice = selectedUuid ? devices[selectedUuid] : null;

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            <span className="material-symbols-outlined text-[28px] text-primary">family_history</span>
            Parental Control - Giám sát & Quản lý thiết bị con
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Theo dõi thời gian chơi, quá trình học tập tiếng Anh và khóa/mở khóa từ xa trong cùng mạng gia đình.
          </p>
        </div>
      </div>

      {commandSentMessage && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-500 p-3 rounded-lg text-sm font-semibold animate-pulse">
          ✓ {commandSentMessage} - Lệnh đang được hàng đợi đồng bộ chuyển đi (tối đa 15 giây)...
        </div>
      )}

      {uuids.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <div className="text-4xl text-text-muted">🖥️</div>
          <h3 className="text-lg font-semibold text-text-main">Chưa có thiết bị nào kết nối</h3>
          <p className="text-sm text-text-muted max-w-md mx-auto">
            Vui lòng mở ứng dụng <strong>Parental Control</strong> trên máy tính của con. Ứng dụng sẽ tự động đăng ký và đồng bộ trạng thái lên 9Router tại đây.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Left Side: Devices List */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">Danh sách thiết bị</h3>
            <div className="space-y-3">
              {uuids.map((uuid) => {
                const dev = devices[uuid];
                const online = getIsOnline(dev.lastSeen);
                const isSelected = uuid === selectedUuid;

                return (
                  <div
                    key={uuid}
                    onClick={() => setSelectedUuid(uuid)}
                    className={`p-4 rounded-xl cursor-pointer border transition-all ${
                      isSelected 
                        ? "bg-primary/10 border-primary shadow-lg shadow-primary/5" 
                        : "bg-surface-card border-border hover:bg-surface-hover"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-2xl ${dev.profile?.remoteLocked ? "text-red-500" : "text-text-main"}`}>
                          {dev.profile?.remoteLocked ? "🔒" : "💻"}
                        </span>
                        <div>
                          <div className="font-semibold text-sm text-text-main">{dev.deviceName}</div>
                          <div className="text-xs text-text-muted">User OS: {dev.osUser}</div>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        online ? "bg-green-500/10 text-green-500" : "bg-text-muted/10 text-text-muted"
                      }`}>
                        {online ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Side (2 columns): Device Details & Remote Controls */}
          {activeDevice && (
            <div className="md:col-span-2 space-y-6">
              
              {/* Main Card: Device Status */}
              <Card>
                <div className="p-6 space-y-6">
                  
                  {/* Title & Online badge */}
                  <div className="flex justify-between items-start border-b border-border pb-4">
                    <div>
                      <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                        {activeDevice.deviceName}
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          getIsOnline(activeDevice.lastSeen) ? "bg-green-500" : "bg-text-muted"
                        }`} />
                      </h2>
                      <p className="text-xs text-text-muted">
                        UUID: <span className="font-mono">{selectedUuid}</span> | Cập nhật cuối: {new Date(activeDevice.lastSeen).toLocaleTimeString()}
                      </p>
                    </div>
                    
                    <div className="flex gap-2">
                      {activeDevice.profile?.remoteLocked ? (
                        <span className="bg-red-500/10 border border-red-500/30 text-red-500 px-3 py-1 rounded-full text-xs font-bold">
                          🔒 Đang khóa từ xa
                        </span>
                      ) : (
                        <span className="bg-green-500/10 border border-green-500/30 text-green-500 px-3 py-1 rounded-full text-xs font-bold">
                          🔓 Sẵn sàng hoạt động
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tabs Selector */}
                  <div className="flex border-b border-border gap-6 mb-6">
                    <button
                      onClick={() => setActiveTab("control")}
                      className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === "control"
                          ? "border-primary text-primary"
                          : "border-transparent text-text-muted hover:text-text-main"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">monitor_heart</span>
                      Giám sát & Điều khiển
                    </button>
                    <button
                      onClick={() => setActiveTab("learning")}
                      className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === "learning"
                          ? "border-primary text-primary"
                          : "border-transparent text-text-muted hover:text-text-main"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">school</span>
                      Giao Bài tập & Video
                    </button>
                  </div>

                  {activeTab === "control" ? (
                    <div className="space-y-6">
                      {/* Anti-bypass Alerts */}
                      {(activeDevice.status?.isDnsTampered) && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-xl flex items-start gap-3">
                          <span className="text-xl">⚠️</span>
                          <div>
                            <div className="font-bold text-sm">CẢNH BÁO: PHÁT HIỆN LÁCH LUẬT DNS!</div>
                            <div className="text-xs mt-1 opacity-90">
                              Hệ thống phát hiện con đang cố tình cấu hình đè DNS Google/Cloudflare để vượt bộ lọc. Đã gửi cảnh báo Telegram.
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Grid: Quota & Study Status */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* Time Piggybank & Quota */}
                        <div className="bg-surface-hover/50 p-4 rounded-xl border border-border/60 space-y-3">
                          <div className="text-xs font-bold text-text-muted uppercase tracking-wider">Thời gian giải trí của con</div>
                          <div className="flex justify-between items-end">
                            <div>
                              <div className="text-2xl font-mono font-bold text-text-main">
                                {formatMinutes(activeDevice.profile?.quota)} phút
                              </div>
                              <div className="text-xs text-text-muted mt-1">
                                Quota còn lại ({formatSeconds(activeDevice.profile?.quota)})
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-primary">
                                🐷 {formatMinutes(activeDevice.profile?.timeBank || 0)} phút
                              </div>
                              <div className="text-xs text-text-muted">Ví Heo Đất lưu trữ</div>
                            </div>
                          </div>
                        </div>

                        {/* Gamification Levels & Streak */}
                        <div className="bg-surface-hover/50 p-4 rounded-xl border border-border/60 space-y-3">
                          <div className="text-xs font-bold text-text-muted uppercase tracking-wider">Học tập & Gamification</div>
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="text-sm font-bold text-text-main">
                                🔥 {activeDevice.profile?.studyStreak || 0} ngày liên tiếp
                              </div>
                              <div className="text-xs text-text-muted mt-1">
                                Chuỗi học tập (Streak)
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-green-500">
                                🪙 {activeDevice.profile?.timeCoins || 0} Time Coins
                              </div>
                              <div className="text-xs text-text-muted">Level XP: {activeDevice.profile?.xp || 0}</div>
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* Live Activity Monitoring */}
                      <div className="space-y-3">
                        <div className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                          Trạng thái hoạt động trực tiếp (Real-time feed)
                        </div>
                        <div className="bg-surface-hover/30 p-4 rounded-xl border border-border/40 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-text-muted">Ứng dụng đang mở:</span>
                            <span className="font-semibold text-text-main">{activeDevice.status?.activeApp || "Desktop"}</span>
                          </div>
                          
                          {activeDevice.status?.activeTitle && (
                            <div className="flex justify-between text-sm border-t border-border/40 pt-2">
                              <span className="text-text-muted">Tiêu đề cửa sổ:</span>
                              <span className="font-semibold text-text-main text-right max-w-sm truncate" title={activeDevice.status?.activeTitle}>
                                {activeDevice.status?.activeTitle}
                              </span>
                            </div>
                          )}

                          {activeDevice.status?.activeUrl && (
                            <div className="flex justify-between text-sm border-t border-border/40 pt-2">
                              <span className="text-text-muted">Trang Web / URL:</span>
                              <a 
                                href={activeDevice.status?.activeUrl} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="font-mono text-xs text-primary hover:underline truncate max-w-sm"
                              >
                                {activeDevice.status?.activeUrl}
                              </a>
                            </div>
                          )}

                          <div className="flex justify-between text-sm border-t border-border/40 pt-2">
                            <span className="text-text-muted">Trạng thái giới hạn:</span>
                            <span className={`font-semibold ${
                              activeDevice.status?.isSchoolTime 
                                ? "text-orange-500" 
                                : activeDevice.profile?.quota <= 0 
                                  ? "text-red-500" 
                                  : "text-green-500"
                            }`}>
                              {activeDevice.status?.isSchoolTime 
                                ? "🏫 Đang trong giờ học (Chỉ Whitelist)" 
                                : activeDevice.profile?.quota <= 0 
                                  ? "⌛ Đã hết quota giải trí (Đã khóa)" 
                                  : "🟢 Đang trong giờ giải trí tự do"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Parent Remote Commands Panel */}
                      <div className="space-y-4 border-t border-border pt-6">
                        <h3 className="text-sm font-bold text-text-main">Bảng điều khiển từ xa của Phụ huynh</h3>
                        
                        <div className="flex flex-wrap gap-3">
                          {activeDevice.profile?.remoteLocked ? (
                            <Button 
                              onClick={() => sendCommand(selectedUuid, "UNPAUSE")}
                              loading={loading}
                              variant="outline"
                              className="bg-green-500/10 border-green-500/30 text-green-500 hover:bg-green-500/20"
                            >
                              🔓 Mở Khóa Thiết Bị
                            </Button>
                          ) : (
                            <Button 
                              onClick={() => sendCommand(selectedUuid, "PAUSE")}
                              loading={loading}
                              className="bg-red-500 text-white hover:bg-red-600"
                            >
                              🔒 Tạm Khóa Lập Tức
                            </Button>
                          )}

                          <Button 
                            onClick={() => sendCommand(selectedUuid, "ADD_TIME", 15 * 60)}
                            loading={loading}
                            variant="outline"
                          >
                            ➕ Thêm 15 phút
                          </Button>

                          <Button 
                            onClick={() => sendCommand(selectedUuid, "ADD_TIME", 30 * 60)}
                            loading={loading}
                            variant="outline"
                          >
                            ➕ Thêm 30 phút
                          </Button>

                          <Button 
                            onClick={() => sendCommand(selectedUuid, "ADD_TIME", 60 * 60)}
                            loading={loading}
                            variant="outline"
                          >
                            ➕ Thêm 1 tiếng
                          </Button>
                        </div>

                        {/* Set Custom Quota form */}
                        <div className="flex items-center gap-3 bg-surface-hover/20 p-4 rounded-xl border border-border/40 max-w-md">
                          <div className="flex-1">
                            <label className="block text-xs text-text-muted mb-1 font-semibold">Đặt lại Quota giải trí</label>
                            <input
                              type="number"
                              placeholder="Số phút giải trí..."
                              value={customQuotaInput}
                              onChange={(e) => setCustomQuotaInput(e.target.value)}
                              className="w-full bg-surface-card border border-border rounded-lg px-3 py-1.5 text-sm text-text-main focus:outline-none focus:border-primary font-mono"
                            />
                          </div>
                          <Button
                            onClick={() => {
                              const mins = parseInt(customQuotaInput, 10);
                              if (isNaN(mins) || mins < 0) {
                                alert("Vui lòng nhập số phút hợp lệ >= 0");
                                return;
                              }
                              sendCommand(selectedUuid, "SET_QUOTA", mins * 60);
                              setCustomQuotaInput("");
                            }}
                            loading={loading}
                            className="mt-5"
                          >
                            Áp dụng
                          </Button>
                        </div>

                      </div>
                    </div>
                  ) : (
                    <div className="space-y-8 animate-fadeIn">
                      
                      {/* Sub-section 1: Quizzes Homework */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-border pb-2">
                          <h3 className="text-sm font-bold text-text-main uppercase tracking-wider flex items-center gap-2">
                            📝 Giao bài trắc nghiệm từ thư viện
                          </h3>
                          <span className="text-xs text-text-muted font-semibold">
                            Đã giao: {(activeDevice.profile?.quizzes || []).length} bài
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-1">
                          {quizData.lessons.map((quiz) => {
                            const isAssigned = (activeDevice.profile?.quizzes || []).some((q) => q.id === quiz.id || q.id === `quiz-${quiz.id}`);
                            return (
                              <div key={quiz.id} className="p-3 bg-surface-hover/40 rounded-xl border border-border flex items-center justify-between gap-4">
                                <div className="space-y-1 flex-1">
                                  <div className="font-semibold text-sm text-text-main">{quiz.title}</div>
                                  <div className="text-xs text-text-muted">{quiz.description}</div>
                                  <div className="text-[10px] text-primary font-bold">❓ {quiz.questions.length} câu hỏi trắc nghiệm</div>
                                </div>
                                
                                <div>
                                  {isAssigned ? (
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-1 rounded-md font-bold font-mono">Đã giao</span>
                                      <button
                                        onClick={() => handleUnassignQuiz(quiz.id)}
                                        disabled={loading}
                                        className="text-xs text-red-500 border border-red-500/20 hover:bg-red-500/10 px-2.5 py-1 rounded-md font-semibold transition-all"
                                      >
                                        Hủy giao
                                      </button>
                                    </div>
                                  ) : (
                                    <Button
                                      onClick={() => handleAssignQuiz(quiz)}
                                      disabled={loading}
                                      className="text-xs px-3 py-1 bg-primary text-white hover:bg-primary/95"
                                    >
                                      Giao bài
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Sub-section 2: Video Lessons */}
                      <div className="space-y-4 border-t border-border pt-6">
                        <h3 className="text-sm font-bold text-text-main uppercase tracking-wider flex items-center gap-2">
                          🎬 Giao Bài học Video (YouTube/Elllo)
                        </h3>

                        {/* Assign Video Form */}
                        <div className="p-4 bg-surface-hover/30 rounded-xl border border-border space-y-4 max-w-xl">
                          <div className="text-xs text-text-muted font-semibold">
                            Nhập link video tiếng Anh, hệ thống ở máy con sẽ tự động phân tích captions, dịch nghĩa và trích từ vựng.
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="block text-[11px] text-text-muted font-bold uppercase">YouTube / Elllo URL</label>
                              <input
                                type="text"
                                placeholder="https://www.youtube.com/watch?v=..."
                                value={videoUrlInput}
                                onChange={(e) => setVideoUrlInput(e.target.value)}
                                className="w-full bg-surface-card border border-border rounded-lg px-3 py-1.5 text-xs text-text-main focus:outline-none focus:border-primary"
                              />
                            </div>
                            
                            <div className="space-y-1">
                              <label className="block text-[11px] text-text-muted font-bold uppercase">Tiêu đề bài học</label>
                              <input
                                type="text"
                                placeholder="Ví dụ: Steve Jobs Commencements..."
                                value={videoTitleInput}
                                onChange={(e) => setVideoTitleInput(e.target.value)}
                                className="w-full bg-surface-card border border-border rounded-lg px-3 py-1.5 text-xs text-text-main focus:outline-none focus:border-primary"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="space-y-1">
                              <label className="block text-[11px] text-text-muted font-bold uppercase">Độ khó (Level)</label>
                              <select
                                value={videoLevelInput}
                                onChange={(e) => setVideoLevelInput(e.target.value)}
                                className="bg-surface-card border border-border rounded-lg px-3 py-1.5 text-xs text-text-main focus:outline-none focus:border-primary"
                              >
                                <option value="A1">A1 (Beginner)</option>
                                <option value="A2">A2 (Elementary)</option>
                                <option value="B1">B1 (Intermediate)</option>
                                <option value="B2">B2 (Upper-Intermediate)</option>
                                <option value="C1">C1 (Advanced)</option>
                              </select>
                            </div>
                            
                            <Button
                              onClick={handleAssignVideo}
                              disabled={loading}
                              className="mt-5 text-xs bg-primary text-white hover:bg-primary/95"
                            >
                              🚀 Phân tích & Giao Video
                            </Button>
                          </div>
                        </div>

                        {/* Assigned Videos List */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-text-muted uppercase">Danh sách video đã giao cho con:</h4>
                          {(!activeDevice.profile?.videos || activeDevice.profile.videos.length === 0) ? (
                            <div className="p-4 bg-surface-hover/20 rounded-xl border border-border border-dashed text-center text-xs text-text-muted">
                              Chưa có video bài học nào được giao.
                            </div>
                          ) : (
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                              {activeDevice.profile.videos.map((vid) => {
                                const attempts = vid.attempts || [];
                                return (
                                  <div key={vid.id} className="p-3 bg-surface-hover/40 rounded-xl border border-border flex items-center justify-between gap-4">
                                    <div className="space-y-1 flex-1">
                                      <div className="font-semibold text-sm text-text-main flex items-center gap-2">
                                        📺 {vid.title}
                                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold font-mono">{vid.level || "A2"}</span>
                                      </div>
                                      <div className="text-xs text-text-muted truncate max-w-md font-mono">{vid.url}</div>
                                      <div className="text-[10px] text-green-500 font-bold flex items-center gap-2">
                                        <span>✓ {vid.subtitles?.length || 0} câu phụ đề</span>
                                        <span>•</span>
                                        <span>📖 {vid.vocabulary?.length || 0} từ vựng</span>
                                        <span>•</span>
                                        <span>📝 Lượt học: {attempts.length} lần</span>
                                      </div>
                                    </div>
                                    
                                    <div>
                                      <button
                                        onClick={() => handleUnassignVideo(vid.id)}
                                        disabled={loading}
                                        className="text-xs text-red-500 border border-red-500/20 hover:bg-red-500/10 px-2.5 py-1 rounded-md font-semibold transition-all"
                                      >
                                        Hủy giao
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              </Card>

            </div>
          )}

        </div>
      )}
    </div>
  );
}
