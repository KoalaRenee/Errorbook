import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, deleteUser } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { Book, Plus, Image as ImageIcon, BrainCircuit, List, Trash2, X, ChevronRight, Loader2, LogOut, User, Search, CheckSquare, Mail, Lock, Settings, Calendar as CalendarIcon, Globe, Camera, Timer, Send, Folder, FolderPlus, CalendarDays, Clock, Play, Pause, Square, BarChart2, PieChart as PieChartIcon, FileText, AlertCircle, AlertTriangle, Download, Upload, Printer, Check } from 'lucide-react';

// --- Firebase Initialization (正式部署準備) ---
const localFirebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : localFirebaseConfig;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'my-production-app';

// --- DSE Subjects & Categories ---
const DSE_CORE = ['中國語文', '英國語文', '數學', '公民與社會發展'];
const DSE_CAT_A = ['物理', '化學', '生物', '資訊及通訊科技 (ICT)', '企業、會計與財務概論 (BAFS)', '經濟', '地理', '歷史', '中國歷史', '旅遊與款待', '視覺藝術', '體育', '中國文學', '英語文學', '健康管理與社會關懷', '倫理與宗教', '設計與應用科技', '科技與生活', '音樂'];
const DSE_CAT_B = ['數學延伸部分單元一 (M1)', '數學延伸部分單元二 (M2)'];
const DEFAULT_REASONS = ['粗心大意', '概念不清', '審題錯誤', '計算錯誤', '公式用錯', '完全不會', '其他'];

// --- Translation Dictionary ---
const DICT = {
  '中國語文': 'Chinese Language', '英國語文': 'English Language', '數學': 'Mathematics', '公民與社會發展': 'Citizenship and Social Dev.',
  '物理': 'Physics', '化學': 'Chemistry', '生物': 'Biology', '資訊及通訊科技 (ICT)': 'ICT', '企業、會計與財務概論 (BAFS)': 'BAFS',
  '經濟': 'Economics', '地理': 'Geography', '歷史': 'History', '中國歷史': 'Chinese History', '旅遊與款待': 'Tourism & Hospitality',
  '視覺藝術': 'Visual Arts', '體育': 'Physical Education', '中國文學': 'Chinese Literature', '英語文學': 'Literature in English',
  '健康管理與社會關懷': 'Health Mgt & Social Care', '倫理與宗教': 'Ethics & Religious Studies', '設計與應用科技': 'Design & Applied Tech',
  '科技與生活': 'Tech & Living', '音樂': 'Music', '數學延伸部分單元一 (M1)': 'Math Extended Part (M1)', '數學延伸部分單元二 (M2)': 'Math Extended Part (M2)',
  '開始時間 (選填)': 'Start Time (Optional)',
  '其他': 'Others', '全部': 'All Subjects', '無': 'None',
  '粗心大意': 'Careless Mistake', '概念不清': 'Misconception', '審題錯誤': 'Misread Question', '計算錯誤': 'Calculation Error',
  '公式用錯': 'Wrong Formula', '完全不會': 'Completely Clueless', '自訂': 'Custom',
  '匯出題庫檔': 'Export Data', '匯入題庫檔': 'Import Data', '列印為 PDF': 'Print to PDF',
  '題目來源 (選填)': 'Source (Optional)'
};

const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#f43f5e', '#ef4444', '#8b5cf6', '#06b6d4', '#14b8a6', '#f97316', '#3b82f6'];

// --- Helpers ---
const resizeImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; const MAX_HEIGHT = 800;
        let width = img.width; let height = img.height;
        if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
        else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
    reader.onerror = (error) => reject(error);
  });
};

const formatTime = (totalSeconds) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatMinutesToHours = (mins) => {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  
  const [questions, setQuestions] = useState([]);
  const [studySessions, setStudySessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [activeTab, setActiveTab] = useState('errorbook');
  const [localLang, setLocalLang] = useState('zh'); 
  const [selectedSubject, setSelectedSubject] = useState('全部');
  const [selectedFolder, setSelectedFolder] = useState('全部');
  const [selectedReason, setSelectedReason] = useState('全部');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingModalOpen, setIsAddingModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [activeAIQuestion, setActiveAIQuestion] = useState(null);

  const [timer, setTimer] = useState({ isRunning: false, seconds: 0, subject: '', notes: '' });
  const [isTimerExpanded, setIsTimerExpanded] = useState(false);

  const t = (zh, en) => localLang === 'en' ? en : zh;
  const tr = (text) => localLang === 'en' ? (DICT[text] || text) : text;

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body { background: white !important; }
        .print-hide { display: none !important; }
        .print-only { display: block !important; }
        .page-break { page-break-before: always; }
        main, .flex-1, .overflow-y-auto, .overflow-hidden, .h-screen { 
          height: auto !important; overflow: visible !important; display: block !important; 
        }
      }
      @media screen {
        .print-only { display: none; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      const manualLogout = sessionStorage.getItem('manual_logout');
      if (!manualLogout && typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try { await signInWithCustomToken(auth, __initial_auth_token); } catch (err) {}
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!isMounted) return;
      setUser(currentUser);
      
      if (currentUser) {
        try {
          const profileRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'settings', 'profile');
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            const data = profileSnap.data();
            if (data.subjects && data.subjects.length > 0) setUserProfile({ ...data, isNew: false });
            else setUserProfile({ ...data, isNew: true });
            if (data.language) setLocalLang(data.language);
          } else setUserProfile({ isNew: true });
        } catch (err) { setUserProfile({ isNew: true }); }
      } else {
        setUserProfile(null); setQuestions([]); setStudySessions([]);
      }
      setLoading(false);
    });
    return () => { isMounted = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user || !userProfile || userProfile.isNew) return;
    
    const questionsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'error_questions');
    const unsubQ = onSnapshot(questionsRef, (snapshot) => {
      // 依上載時間「正序」排序（最舊的在前面，作為 #1, #2...）
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0));
      setQuestions(fetched);
    }, (err) => { setError(t("無法載入題庫，請檢查連線。", "Failed to load questions, check connection.")); });

    const sessionsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'study_sessions');
    const unsubS = onSnapshot(sessionsRef, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudySessions(fetched);
    });

    return () => { unsubQ(); unsubS(); };
  }, [user, userProfile]);

  useEffect(() => {
    let interval = null;
    if (timer.isRunning) { interval = setInterval(() => setTimer(prev => ({ ...prev, seconds: prev.seconds + 1 })), 1000); } 
    else if (!timer.isRunning && timer.seconds !== 0) { clearInterval(interval); }
    return () => clearInterval(interval);
  }, [timer.isRunning]);

  const handleLogoutConfirm = async () => {
    try { sessionStorage.setItem('manual_logout', 'true'); await signOut(auth); setIsLogoutModalOpen(false); } catch (error) {}
  };

  const handleSaveSubjects = async (subjects) => {
    if (!user) return;
    try {
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile');
      const newProfile = { ...userProfile, subjects, language: localLang, isNew: false, updatedAt: serverTimestamp() };
      await setDoc(profileRef, newProfile, { merge: true });
      setUserProfile(newProfile); setSelectedSubject('全部');
    } catch (err) { }
  };

  const handleSaveProfileSettings = async (settings) => {
    if (!user) return;
    try {
      await updateProfile(user, { displayName: settings.displayName, photoURL: settings.photoURL });
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile');
      const newProfile = { ...userProfile, language: settings.language, dseYear: settings.dseYear, subjects: settings.subjects, isNew: false, updatedAt: serverTimestamp() };
      await setDoc(profileRef, newProfile, { merge: true });
      setUser({ ...user, displayName: settings.displayName, photoURL: settings.photoURL });
      setUserProfile(newProfile); setLocalLang(settings.language); setIsProfileModalOpen(false);
      if (!settings.subjects.includes(selectedSubject) && selectedSubject !== '全部') setSelectedSubject('全部');
    } catch (err) {}
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (confirm(t("警告：這將永久刪除你的帳號及所有個人設定。確定要繼續嗎？", "WARNING: This will permanently delete your account and profile settings. Continue?"))) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'));
        await deleteUser(user); setIsProfileModalOpen(false);
      } catch (err) { alert(t("刪除帳號失敗，可能需要重新登入。", "Failed to delete account. You may need to log in again.")); }
    }
  };

  const handleAddQuestion = async (formData) => {
    if (!user) return;
    try {
      const questionsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'error_questions');
      await addDoc(questionsRef, { ...formData, timestamp: serverTimestamp() });
      setIsAddingModalOpen(false);
    } catch (err) {}
  };

  const handleDeleteQuestion = async (id) => {
    if (!user) return;
    try { await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'error_questions', id)); } catch (err) {}
  };

  const handleSaveStudySession = async (subject, durationMinutes, dateStr, notes = '', startTime = null) => {
    if (!user || durationMinutes <= 0) return;
    try { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'study_sessions'), { subject, durationMinutes, date: dateStr, notes, startTime, timestamp: serverTimestamp() }); } catch (err) {}
  };

  const handleTimerStop = async () => {
    const durationMinutes = Math.floor(timer.seconds / 60);
    if (durationMinutes > 0 && timer.subject) {
      const now = new Date(); const offset = now.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(now.getTime() - offset)).toISOString().split('T')[0];
      const start = new Date(now.getTime() - timer.seconds * 1000);
      const startTimeStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
      await handleSaveStudySession(timer.subject, durationMinutes, localISOTime, timer.notes, startTimeStr);
    } else if (timer.seconds > 0) alert(t("時間少於一分鐘或未選擇科目，不作紀錄。", "Time less than 1 min or no subject selected, record discarded."));
    setTimer({ isRunning: false, seconds: 0, subject: '', notes: '' }); setIsTimerExpanded(false);
  };

  const activeSubjects = Array.from(new Set([...questions.map(q => q.subject), ...studySessions.map(s => s.subject)]));
  const baseSubjects = userProfile?.subjects || [];
  const subjectsToDisplay = ['全部', ...new Set([...baseSubjects, ...activeSubjects])];
  
  const dseDaysRemaining = (() => {
    if (!userProfile?.dseYear) return null;
    const targetDate = new Date(`${userProfile.dseYear}-04-01T00:00:00`);
    const diffDays = Math.ceil((targetDate - new Date()) / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  })();

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /><span className="ml-3 text-slate-600 font-medium">Verifying...</span></div>;
  if (!user) return <AuthScreen lang={localLang} setLang={setLocalLang} t={t} />;
  if (!userProfile) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /><span className="ml-3 text-slate-600 font-medium">{t("載入設定中...", "Loading Profile...")}</span></div>;
  if (userProfile?.isNew) return <SetupProfileScreen onComplete={handleSaveSubjects} t={t} tr={tr} />;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans relative">
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm z-20 print-hide">
        <div className="p-5 border-b border-slate-100 flex items-center space-x-3 shrink-0">
          <div className="bg-blue-600 p-2 rounded-lg text-white shadow-sm"><Book className="w-6 h-6" /></div>
          <h1 className="text-xl font-bold text-slate-800 tracking-wide">{t("溫習神器", "Revision Pro")}</h1>
        </div>
        
        <div className="p-4 border-b border-slate-100 space-y-1 shrink-0">
          <button onClick={() => setActiveTab('errorbook')} className={`w-full flex items-center px-4 py-2.5 rounded-xl font-medium transition-colors ${activeTab === 'errorbook' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Book className="w-5 h-5 mr-3" />{t("我的錯題庫", "Error Book")}
          </button>
          <button onClick={() => setActiveTab('calendar')} className={`w-full flex items-center px-4 py-2.5 rounded-xl font-medium transition-colors ${activeTab === 'calendar' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            <CalendarDays className="w-5 h-5 mr-3" />{t("學習時間表", "Study Calendar")}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2 flex justify-between items-center">{t("科目篩選", "Filter by Subject")}</h2>
          {subjectsToDisplay.map(subject => (
            <button key={subject} onClick={() => { setSelectedSubject(subject); setSelectedFolder('全部'); setSelectedReason('全部'); }} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${selectedSubject === subject ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50 font-medium'}`}>
              <span className="truncate">{tr(subject)}</span>
            </button>
          ))}
        </div>
        
        <div className="p-4 border-t border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center justify-between">
            <button onClick={() => setIsProfileModalOpen(true)} className="flex items-center space-x-3 text-sm text-slate-600 overflow-hidden hover:bg-slate-200 p-2 rounded-xl transition-colors flex-1 mr-2 text-left" title={t("設定個人檔案", "Profile Settings")}>
              <div className="bg-slate-300 p-1 rounded-full shrink-0 relative group">
                {user.photoURL ? <img src={user.photoURL} alt="avatar" className="w-8 h-8 rounded-full object-cover" /> : <User className="w-8 h-8 text-slate-500 p-1" />}
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Settings className="w-4 h-4 text-white" /></div>
              </div>
              <div className="truncate flex-1">
                <p className="font-bold text-slate-800 truncate">{user.displayName || t('學生', 'Student')}</p>
                <p className="text-xs text-slate-500 truncate">{user.email || 'Private Box'}</p>
              </div>
            </button>
            <button onClick={() => setIsLogoutModalOpen(true)} className="text-slate-400 hover:text-red-500 transition-colors p-2 bg-white rounded-lg border border-slate-200 shadow-sm"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </aside>

      {activeTab === 'errorbook' ? (
        <ErrorBookView 
          error={error} user={user} userProfile={userProfile} setUserProfile={setUserProfile} appId={appId} db={db}
          questions={questions} selectedSubject={selectedSubject} selectedFolder={selectedFolder} setSelectedFolder={setSelectedFolder}
          selectedReason={selectedReason} setSelectedReason={setSelectedReason} searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          onAddClick={() => setIsAddingModalOpen(true)} onDeleteQuestion={handleDeleteQuestion} onAskAI={setActiveAIQuestion}
          dseDaysRemaining={dseDaysRemaining} t={t} tr={tr}
        />
      ) : (
        <CalendarView studySessions={studySessions} selectedSubject={selectedSubject} availableSubjects={userProfile?.subjects || DSE_CORE} onAddSession={handleSaveStudySession} localLang={localLang} t={t} tr={tr} />
      )}

      {/* Floating Global Timer Widget */}
      <div className={`fixed bottom-6 right-6 z-40 transition-all duration-300 shadow-2xl rounded-2xl overflow-hidden border border-slate-200 bg-white print-hide ${isTimerExpanded || timer.isRunning || timer.seconds > 0 ? 'w-80' : 'w-14 h-14 rounded-full'}`}>
        {!isTimerExpanded && !timer.isRunning && timer.seconds === 0 ? (
          <button onClick={() => setIsTimerExpanded(true)} className="w-full h-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg transition-colors" title={t("開啟計時器", "Open Timer")}><Clock className="w-6 h-6" /></button>
        ) : (
          <div className="flex flex-col">
            <div className={`px-4 py-3 flex justify-between items-center ${timer.isRunning ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
              <div className="flex items-center space-x-2 font-bold"><Clock className="w-4 h-4" /><span>{timer.isRunning ? t("正在溫習...", "Studying...") : t("溫習計時器", "Study Timer")}</span></div>
              {!timer.isRunning && timer.seconds === 0 && <button onClick={() => setIsTimerExpanded(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>}
            </div>
            <div className="p-4 space-y-4">
              {!timer.isRunning && timer.seconds === 0 && (
                <select value={timer.subject} onChange={e => setTimer({...timer, subject: e.target.value})} className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm">
                  <option value="" disabled>{t("選擇溫習科目...", "Select subject...")}</option>
                  {(userProfile?.subjects || DSE_CORE).map(s => <option key={s} value={s}>{tr(s)}</option>)}
                </select>
              )}
              {timer.subject && <div className="text-center text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-md py-1 px-2 mx-auto inline-block truncate max-w-full">{tr(timer.subject)}</div>}
              <div className={`text-4xl font-mono text-center tracking-wider font-bold ${timer.isRunning ? 'text-indigo-600' : 'text-slate-700'}`}>{formatTime(timer.seconds)}</div>
              {(timer.isRunning || timer.seconds > 0) && (
                <div className="relative">
                  <FileText className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input type="text" value={timer.notes} onChange={e => setTimer({...timer, notes: e.target.value})} placeholder={t("備註 (選填)...", "Notes (Optional)...")} className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
              )}
              <div className="flex justify-center space-x-3 pt-1">
                <button onClick={() => { if (!timer.isRunning && !timer.subject) { alert(t("請先選擇科目", "Please select a subject first")); return; } setTimer(prev => ({ ...prev, isRunning: !prev.isRunning })); }} className={`flex-1 py-2 rounded-xl font-bold flex items-center justify-center space-x-1 transition-colors ${timer.isRunning ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'}`}>
                  {timer.isRunning ? <><Pause className="w-4 h-4"/><span>{t("暫停", "Pause")}</span></> : <><Play className="w-4 h-4"/><span>{timer.seconds > 0 ? t("繼續", "Resume") : t("開始", "Start")}</span></>}
                </button>
                {(timer.seconds > 0 || timer.isRunning) && (
                  <button onClick={handleTimerStop} className="flex-1 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-bold flex items-center justify-center space-x-1 transition-colors">
                    <Square className="w-4 h-4"/><span>{t("結束儲存", "Save")}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print-hide">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="mx-auto bg-red-100 text-red-600 w-12 h-12 rounded-full flex items-center justify-center mb-4"><LogOut className="w-6 h-6" /></div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">{t("確定要登出嗎？", "Ready to log out?")}</h3>
            <p className="text-slate-500 mb-6 text-sm">{t("登出後你需要重新輸入帳號密碼才能進入題庫。", "You will need to sign in again to access your questions.")}</p>
            <div className="flex space-x-3">
              <button onClick={() => setIsLogoutModalOpen(false)} className="flex-1 py-2.5 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">{t("取消", "Cancel")}</button>
              <button onClick={handleLogoutConfirm} className="flex-1 py-2.5 rounded-xl font-medium text-white bg-red-500 hover:bg-red-600 transition-colors shadow-sm">{t("登出", "Logout")}</button>
            </div>
          </div>
        </div>
      )}
      {isAddingModalOpen && ( <AddQuestionModal onClose={() => setIsAddingModalOpen(false)} onSave={handleAddQuestion} currentSubject={selectedSubject !== '全部' ? selectedSubject : (userProfile?.subjects?.[0] || '中國語文')} availableSubjects={userProfile?.subjects || DSE_CORE} userFolders={userProfile?.folders || {}} currentFolder={selectedFolder} t={t} tr={tr} /> )}
      {activeAIQuestion && ( <AIChatModal question={activeAIQuestion} onClose={() => setActiveAIQuestion(null)} localLang={localLang} t={t} tr={tr} /> )}
      {isProfileModalOpen && ( <UserProfileModal user={user} userProfile={userProfile} onClose={() => setIsProfileModalOpen(false)} onSave={handleSaveProfileSettings} onDeleteAccount={handleDeleteAccount} t={t} tr={tr} /> )}
    </div>
  );
}

// --- Specific Views ---

function ErrorBookView({ error, user, userProfile, setUserProfile, appId, db, questions, selectedSubject, selectedFolder, setSelectedFolder, selectedReason, setSelectedReason, searchQuery, setSearchQuery, onAddClick, onDeleteQuestion, onAskAI, dseDaysRemaining, t, tr }) {
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  
  const [isPrintSelectOpen, setIsPrintSelectOpen] = useState(false);
  const [printQuestionsData, setPrintQuestionsData] = useState(null);

  // 計算每個題目在該科目中的全域順序編號 (Global Sequential Number)
  const subjectQuestionsMap = {};
  questions.forEach(q => {
    if (!subjectQuestionsMap[q.subject]) subjectQuestionsMap[q.subject] = [];
    subjectQuestionsMap[q.subject].push(q.id);
  });

  const filteredQuestions = questions.filter(q => {
    const matchSubject = selectedSubject === '全部' || q.subject === selectedSubject;
    const matchFolder = selectedSubject === '全部' || selectedFolder === '全部' || q.folder === selectedFolder;
    const matchReason = selectedReason === '全部' || q.reason === selectedReason;
    const searchLower = searchQuery.toLowerCase();
    const matchSearch = !searchQuery || (q.questionText && q.questionText.toLowerCase().includes(searchLower)) || (q.answerText && q.answerText.toLowerCase().includes(searchLower)) || (tr(q.subject).toLowerCase().includes(searchLower)) || (tr(q.reason).toLowerCase().includes(searchLower)) || (q.folder && q.folder.toLowerCase().includes(searchLower)) || (q.source && q.source.toLowerCase().includes(searchLower));
    return matchSubject && matchFolder && matchReason && matchSearch;
  });

  const activeReasonsForScope = Array.from(new Set(questions.filter(q => {
    if (selectedSubject !== '全部' && q.subject !== selectedSubject) return false;
    if (selectedSubject !== '全部' && selectedFolder !== '全部' && q.folder !== selectedFolder) return false;
    return true;
  }).map(q => q.reason)));

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!user || !newFolderName.trim() || selectedSubject === '全部') return;
    const folderName = newFolderName.trim();
    const currentFolders = userProfile?.folders?.[selectedSubject] || [];
    if (currentFolders.includes(folderName) || folderName === '全部') { setIsCreateFolderModalOpen(false); setNewFolderName(''); return; }
    try {
      const updatedFolders = { ...(userProfile.folders || {}), [selectedSubject]: [...currentFolders, folderName] };
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'), { folders: updatedFolders }, { merge: true });
      setUserProfile({ ...userProfile, folders: updatedFolders });
      setSelectedFolder(folderName);
      setIsCreateFolderModalOpen(false); setNewFolderName('');
    } catch (err) {}
  };

  const handleExportJSON = () => {
    if (filteredQuestions.length === 0) { alert(t("目前沒有可以匯出的題目。", "No questions available to export.")); return; }
    const dataStr = JSON.stringify(filteredQuestions, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `${tr(selectedSubject)}_ErrorBook.json`; link.click(); URL.revokeObjectURL(url);
  };

  const handleImportJSON = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!Array.isArray(data)) throw new Error("Invalid format");
        const questionsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'error_questions');
        let count = 0;
        for (const q of data) {
          if (q.questionText || q.questionImgUrl) {
            const { id, timestamp, ...rest } = q;
            await addDoc(questionsRef, { ...rest, timestamp: serverTimestamp() });
            count++;
          }
        }
        alert(t(`匯入成功！共新增了 ${count} 題。`, `Import successful! Added ${count} questions.`));
      } catch (err) { alert(t("檔案格式錯誤，無法匯入。", "Invalid file format. Import failed.")); } 
      finally { setIsImporting(false); e.target.value = null; }
    };
    reader.readAsText(file);
  };

  if (printQuestionsData) {
    return <PrintLayoutView questions={printQuestionsData} subject={selectedSubject} folder={selectedFolder} allQuestionsMap={subjectQuestionsMap} onClose={() => setPrintQuestionsData(null)} t={t} />;
  }

  // 取得當前檢視範圍內的所有題目供列印視窗選擇
  const printableQuestions = questions.filter(q => {
    const matchSubject = selectedSubject === '全部' || q.subject === selectedSubject;
    const matchFolder = selectedSubject === '全部' || selectedFolder === '全部' || q.folder === selectedFolder;
    return matchSubject && matchFolder;
  });

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50">
      <header className="bg-white p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm z-10 print-hide">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center flex-wrap">
            {tr(selectedSubject)}
            {selectedSubject !== '全部' && selectedFolder !== '全部' && (
              <><ChevronRight className="w-5 h-5 mx-1 text-slate-400" /><span className="text-indigo-600 flex items-center"><Folder className="w-4 h-4 mr-1.5" />{selectedFolder}</span></>
            )}
            {selectedReason !== '全部' && (
              <><ChevronRight className="w-5 h-5 mx-1 text-slate-400" /><span className="text-blue-600">{tr(selectedReason)}</span></>
            )}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{t(`共找到 ${filteredQuestions.length} 題`, `Found ${filteredQuestions.length} items`)}</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          {dseDaysRemaining !== null && (
            <div className="flex items-center space-x-1.5 bg-orange-100 text-orange-700 px-4 py-2.5 rounded-xl font-bold shadow-sm whitespace-nowrap"><Timer className="w-5 h-5" /><span>{t(`距離 ${userProfile?.dseYear} DSE 還有 `, `DSE ${userProfile?.dseYear} in `)}</span><span className="text-xl mx-1">{dseDaysRemaining}</span><span>{t('日', 'Days')}</span></div>
          )}
          
          <div className="relative w-full sm:w-64">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder={t("搜尋題目、答案...", "Search questions, answers...")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition-all" />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
             <button onClick={() => setIsPrintSelectOpen(true)} className="p-2.5 text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-sm shrink-0" title={t("列印為 PDF", "Print to PDF")}><Printer className="w-5 h-5" /></button>
             <button onClick={handleExportJSON} className="p-2.5 text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-sm shrink-0" title={t("匯出題庫檔", "Export Data")}><Download className="w-5 h-5" /></button>
             <label className={`p-2.5 text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-sm shrink-0 cursor-pointer ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`} title={t("匯入題庫檔", "Import Data")}>
                {isImporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                <input type="file" accept=".json" className="hidden" onChange={handleImportJSON} disabled={isImporting} />
             </label>
             <button onClick={onAddClick} className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors shadow-sm active:scale-95 whitespace-nowrap"><Plus className="w-5 h-5" /><span className="hidden sm:inline">{t("新增", "Add")}</span></button>
          </div>
        </div>
      </header>

      {selectedSubject !== '全部' && (
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-2.5 overflow-x-auto flex items-center space-x-3 shrink-0 print-hide">
          <div className="flex items-center text-slate-400 text-sm font-semibold uppercase tracking-wider shrink-0"><Folder className="w-4 h-4 mr-1.5" />{t("資料夾", "Folders")}</div>
          <div className="flex space-x-2 min-w-max">
            {['全部', ...(userProfile?.folders?.[selectedSubject] || [])].map(folder => (
              <button key={folder} onClick={() => { setSelectedFolder(folder); setSelectedReason('全部'); }} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedFolder === folder ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>
                {folder === '全部' ? t('全部', 'All') : folder}
              </button>
            ))}
            <button onClick={() => setIsCreateFolderModalOpen(true)} className="px-3 py-1.5 rounded-lg text-sm font-medium border border-dashed border-slate-300 text-slate-500 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 transition-colors flex items-center space-x-1"><FolderPlus className="w-4 h-4" /> <span>{t("新增", "New Folder")}</span></button>
          </div>
        </div>
      )}

      <div className="bg-white border-b border-slate-200 px-5 py-3 overflow-x-auto shrink-0 print-hide">
        <div className="flex space-x-2 min-w-max">
          <button onClick={() => setSelectedReason('全部')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedReason === '全部' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{t("全部原因", "All Reasons")}</button>
          {activeReasonsForScope.map(reason => (
            <button key={reason} onClick={() => setSelectedReason(reason)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedReason === reason ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{tr(reason)}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-center">{error}</div>}
        {filteredQuestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 print-hide">
            <List className="w-16 h-16 mb-4 text-slate-300" />
            <p className="text-lg font-medium text-slate-500">{t("這個分類目前沒有錯題", "No questions in this category yet")}</p>
            <p className="text-sm mt-1">{t("點擊右上角的「新增錯題」來記錄吧！", "Click 'Add New' on the top right to start!")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-20">
            {filteredQuestions.map(q => {
              const globalIndex = (subjectQuestionsMap[q.subject] || []).indexOf(q.id) + 1;
              return <QuestionCard key={q.id} question={q} sequentialNumber={globalIndex} onDelete={() => onDeleteQuestion(q.id)} onAskAI={() => onAskAI(q)} t={t} tr={tr} />;
            })}
          </div>
        )}
      </div>

      {isCreateFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print-hide">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="bg-indigo-50 border-b border-indigo-100 px-5 py-4 flex justify-between items-center">
              <h3 className="font-bold text-indigo-900 flex items-center"><FolderPlus className="w-5 h-5 mr-2 text-indigo-600" />{t("新增資料夾", "New Folder")}</h3>
              <button onClick={() => setIsCreateFolderModalOpen(false)} className="text-indigo-400 hover:text-indigo-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateFolder} className="p-5">
              <p className="text-sm text-slate-500 mb-3">{t(`在「${tr(selectedSubject)}」科目下建立新資料夾：`, `Create folder under "${tr(selectedSubject)}":`)}</p>
              <input type="text" autoFocus required value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder={t("例如：第一學期測驗", "e.g., Term 1 Test")} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-5" />
              <div className="flex justify-end space-x-3">
                <button type="button" onClick={() => setIsCreateFolderModalOpen(false)} className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium">{t("取消", "Cancel")}</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm">{t("建立", "Create")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPrintSelectOpen && (
        <PrintSelectionModal 
           questions={printableQuestions} 
           allQuestionsMap={subjectQuestionsMap}
           onClose={() => setIsPrintSelectOpen(false)} 
           onPrint={(selectedQ) => { setIsPrintSelectOpen(false); setPrintQuestionsData(selectedQ); }}
           t={t} 
        />
      )}
    </div>
  );
}

// --- Print Specific Components ---

function PrintSelectionModal({ questions, allQuestionsMap, onClose, onPrint, t }) {
  const [selectedIds, setSelectedIds] = useState(new Set(questions.map(q => q.id)));

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAll = () => setSelectedIds(new Set(questions.map(q => q.id)));
  const handleDeselectAll = () => setSelectedIds(new Set());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print-hide">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex justify-between items-center shrink-0">
          <h3 className="font-bold text-slate-800 flex items-center"><Printer className="w-5 h-5 mr-2 text-indigo-600" />{t("選擇列印題目", "Select Questions to Print")}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="px-6 py-3 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
          <span className="text-sm font-medium text-slate-600">{t(`已選 ${selectedIds.size} / ${questions.length} 題`, `Selected ${selectedIds.size} / ${questions.length}`)}</span>
          <div className="space-x-2">
            <button onClick={handleSelectAll} className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium transition-colors">{t("全選", "Select All")}</button>
            <button onClick={handleDeselectAll} className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium transition-colors">{t("取消全選", "Deselect All")}</button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-2 bg-slate-50">
          {questions.map((q) => {
            const seqNum = (allQuestionsMap[q.subject] || []).indexOf(q.id) + 1;
            return (
              <label key={q.id} className={`flex items-start p-4 bg-white border rounded-xl cursor-pointer transition-all ${selectedIds.has(q.id) ? 'border-indigo-400 ring-1 ring-indigo-100 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
                <div className="pt-0.5 mr-4">
                   <div className={`w-5 h-5 rounded flex items-center justify-center border ${selectedIds.has(q.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'}`}>
                     {selectedIds.has(q.id) && <Check className="w-3.5 h-3.5" />}
                   </div>
                   <input type="checkbox" className="hidden" checked={selectedIds.has(q.id)} onChange={() => toggleSelect(q.id)} />
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex space-x-2 mb-1.5">
                     <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">#{seqNum}</span>
                     {q.folder && <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{q.folder}</span>}
                     {q.source && <span className="text-xs font-semibold text-slate-500 truncate border border-slate-100 px-2 py-0.5 rounded">{q.source}</span>}
                  </div>
                  {q.questionText && <p className="text-sm text-slate-700 line-clamp-2 leading-relaxed">{q.questionText}</p>}
                  {q.questionImgUrl && <div className="mt-2 text-xs text-blue-500 font-medium flex items-center"><ImageIcon className="w-3.5 h-3.5 mr-1"/> {t("包含圖片", "Contains Image")}</div>}
                </div>
              </label>
            );
          })}
        </div>

        <div className="p-4 bg-white border-t border-slate-100 flex justify-end space-x-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-medium">{t("取消", "Cancel")}</button>
          <button disabled={selectedIds.size === 0} onClick={() => onPrint(questions.filter(q => selectedIds.has(q.id)))} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium shadow-sm flex items-center">
             <Printer className="w-4 h-4 mr-2" />{t("確定列印", "Print")}
          </button>
        </div>
      </div>
    </div>
  );
}

function PrintLayoutView({ questions, subject, folder, allQuestionsMap, onClose, t }) {
  useEffect(() => {
    const timer = setTimeout(() => { try { window.print(); } catch (e) {} }, 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex-1 bg-white text-black min-h-screen overflow-y-auto w-full relative pb-20">
       <div className="print-hide sticky top-0 bg-blue-50/90 backdrop-blur-sm border-b border-blue-100 p-4 flex justify-between items-center z-50 shadow-sm">
          <div className="text-sm">
             <p className="font-bold text-blue-800">{t("列印預覽模式", "Print Preview Mode")}</p>
             <p className="text-blue-600 mt-0.5">{t("請使用瀏覽器列印功能 (Ctrl+P / Cmd+P)。", "Please use browser print (Ctrl+P / Cmd+P).")}</p>
          </div>
          <button onClick={onClose} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm flex items-center transition-colors">
            <ChevronRight className="w-4 h-4 mr-1 rotate-180" />{t("返回題庫", "Back to Error Book")}
          </button>
       </div>

       <div className="p-8 max-w-4xl mx-auto print:p-0 print:max-w-none">
          {/* Part 1: Questions */}
          <div className="mb-12">
            <div className="text-center mb-10 pb-4 border-b-2 border-black">
               <h1 className="text-3xl font-black mb-2">{subject} {folder !== '全部' ? `- ${folder}` : ''}</h1>
               <h2 className="text-xl font-bold text-gray-600 uppercase tracking-widest">{t("題目部分", "QUESTIONS")}</h2>
            </div>
            
            {questions.map((q) => {
              const seqNum = (allQuestionsMap[q.subject] || []).indexOf(q.id) + 1;
              return (
                <div key={`pq-${q.id}`} className="mb-10 break-inside-avoid border border-gray-200 rounded-lg p-6">
                   <div className="flex items-center space-x-3 mb-4 pb-2 border-b border-gray-100">
                      <span className="bg-black text-white px-3 py-1 text-sm font-bold rounded">#{seqNum}</span>
                      {q.folder && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-medium">{q.folder}</span>}
                      {q.source && <span className="text-sm text-gray-500 border border-gray-300 px-2 py-0.5 rounded">[{q.source}]</span>}
                   </div>
                   {q.questionText && <p className="whitespace-pre-wrap leading-relaxed text-[15px]">{q.questionText}</p>}
                   {q.questionImgUrl && <img src={q.questionImgUrl} className="mt-4 max-w-full max-h-[400px] object-contain border border-gray-200 p-1" alt="Question" />}
                </div>
              );
            })}
          </div>

          <div className="page-break w-full h-8 print-hide flex items-center justify-center my-12 border-t border-b border-dashed border-gray-300">
             <span className="text-gray-400 font-medium text-sm tracking-widest">{t("--- 分頁符號 ---", "--- PAGE BREAK ---")}</span>
          </div>

          {/* Part 2: Answers */}
          <div>
            <div className="text-center mb-10 pb-4 border-b-2 border-black">
               <h1 className="text-3xl font-black mb-2">{subject} {folder !== '全部' ? `- ${folder}` : ''}</h1>
               <h2 className="text-xl font-bold text-gray-600 uppercase tracking-widest">{t("答案部分", "ANSWERS")}</h2>
            </div>
            
            {questions.map((q) => {
              const seqNum = (allQuestionsMap[q.subject] || []).indexOf(q.id) + 1;
              return (
                <div key={`pa-${q.id}`} className="mb-10 break-inside-avoid border border-gray-200 rounded-lg p-6 bg-gray-50/50">
                   <div className="flex items-center space-x-3 mb-4 pb-2 border-b border-gray-100">
                      <span className="bg-black text-white px-3 py-1 text-sm font-bold rounded">#{seqNum}</span>
                      {q.folder && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-medium">{q.folder}</span>}
                      {q.source && <span className="text-sm text-gray-500 border border-gray-300 px-2 py-0.5 rounded">[{q.source}]</span>}
                   </div>
                   {(!q.answerText && !q.answerImgUrl) && <p className="text-gray-400 italic">{t("沒有提供解答", "No answer provided")}</p>}
                   {q.answerText && <p className="whitespace-pre-wrap leading-relaxed text-[15px] text-gray-800">{q.answerText}</p>}
                   {q.answerImgUrl && <img src={q.answerImgUrl} className="mt-4 max-w-full max-h-[400px] object-contain border border-gray-200 p-1 bg-white" alt="Answer" />}
                </div>
              );
            })}
          </div>
       </div>
    </div>
  );
}

function QuestionCard({ question, sequentialNumber, onDelete, onAskAI, t, tr }) {
  const date = question.timestamp ? new Date(question.timestamp.toMillis()).toLocaleDateString() : t('新增', 'New');
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div className="flex space-x-2 items-center flex-wrap gap-y-1">
          <span className="bg-indigo-600 text-white text-xs px-2.5 py-1 rounded-md font-bold">#{sequentialNumber}</span>
          <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-md font-medium">{tr(question.subject)}</span>
          {question.folder && <span className="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-1 rounded-md font-medium flex items-center"><Folder className="w-3 h-3 mr-1" />{question.folder}</span>}
          <span className="bg-rose-100 text-rose-700 text-xs px-2.5 py-1 rounded-md font-medium">{tr(question.reason)}</span>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-xs text-slate-400">{date}</span>
          <button onClick={onDelete} className="text-slate-400 hover:text-red-500 transition-colors p-1" title={t("刪除", "Delete")}><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      
      {question.source && (
        <div className="px-5 pt-4 pb-1">
           <span className="text-sm font-medium text-slate-500 border border-slate-200 px-3 py-1 rounded-full inline-block bg-slate-50">{question.source}</span>
        </div>
      )}

      <div className="p-5 flex-1 flex flex-col">
        <div className="mb-6">
          <h4 className="text-sm font-bold text-slate-500 mb-2 flex items-center"><span className="bg-slate-200 text-slate-600 w-5 h-5 rounded-full flex items-center justify-center text-xs mr-2">Q</span> {t("題目內容", "Question")}</h4>
          {question.questionText && <p className="text-slate-800 whitespace-pre-wrap text-sm leading-relaxed mb-3">{question.questionText}</p>}
          {question.questionImgUrl && <img src={question.questionImgUrl} alt="Question" className="rounded-xl border border-slate-200 max-h-48 object-contain w-full bg-slate-50" />}
        </div>
        <div className="mb-4 flex-1">
          <h4 className="text-sm font-bold text-green-600 mb-2 flex items-center"><span className="bg-green-100 text-green-700 w-5 h-5 rounded-full flex items-center justify-center text-xs mr-2">A</span> {t("正確答案 / 解析", "Answer / Solution")}</h4>
          {question.answerText && <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed mb-3">{question.answerText}</p>}
          {question.answerImgUrl && <img src={question.answerImgUrl} alt="Answer" className="rounded-xl border border-slate-200 max-h-48 object-contain w-full bg-slate-50" />}
        </div>
      </div>
      <div className="p-4 border-t border-slate-100 bg-slate-50">
        <button onClick={() => onAskAI()} className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center space-x-2 font-medium transition-colors">
          <BrainCircuit className="w-5 h-5" /><span>{t("向 AI 提問與分析", "Ask AI for Analysis")}</span>
        </button>
      </div>
    </div>
  );
}

function AddQuestionModal({ onClose, onSave, currentSubject, availableSubjects, userFolders, currentFolder, t, tr }) {
  const [subject, setSubject] = useState(currentSubject);
  const activeFolders = userFolders[subject] || [];
  const [folder, setFolder] = useState(currentFolder !== '全部' ? currentFolder : (activeFolders.length > 0 ? activeFolders[0] : ''));
  const [reason, setReason] = useState(DEFAULT_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [source, setSource] = useState('');
  const [qText, setQText] = useState(''); const [qImg, setQImg] = useState(null);
  const [aText, setAText] = useState(''); const [aImg, setAImg] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImagePick = async (e, setImgBase64) => {
    const file = e.target.files[0];
    if (!file) return;
    try { const base64 = await resizeImage(file); setImgBase64(base64); } catch (err) { }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!qText && !qImg) return;
    setIsSubmitting(true);
    const finalReason = reason === '自訂' ? customReason : reason;
    await onSave({ 
      subject, folder: folder || '', reason: finalReason || '未分類', 
      source: source.trim(),
      questionText: qText, questionImgUrl: qImg, answerText: aText, answerImgUrl: aImg 
    });
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print-hide">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white/95 backdrop-blur z-10 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800">{t("新增錯題記錄", "Add New Record")}</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"><X className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t("科目", "Subject")}</label>
              <select value={subject} onChange={e => { setSubject(e.target.value); setFolder(userFolders[e.target.value]?.[0] || ''); }} className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {availableSubjects.map(s => <option key={s} value={s}>{tr(s)}</option>)}<option value="其他">{t("其他", "Others")}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t("資料夾", "Folder")}</label>
              <select value={folder} onChange={e => setFolder(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">{t("無", "None")}</option>{(userFolders[subject] || []).map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t("錯誤原因", "Reason")}</label>
              <select value={reason} onChange={e => setReason(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2">
                {DEFAULT_REASONS.map(r => <option key={r} value={r}>{tr(r)}</option>)}<option value="自訂">{t("自訂原因...", "Custom...")}</option>
              </select>
              {reason === '自訂' && <input type="text" value={customReason} onChange={e => setCustomReason(e.target.value)} placeholder={t("自訂原因", "Custom reason")} required className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />}
            </div>
          </div>
          
          <div>
             <label className="block text-sm font-medium text-slate-700 mb-2">{t("題目來源 (選填)", "Source (Optional)")}</label>
             <input type="text" value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. 2019 DSE Paper 1, Q3" className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="border-t border-slate-100 my-2"></div>
          <div>
            <h4 className="text-md font-semibold text-slate-800 mb-3 flex items-center"><span className="bg-slate-200 text-slate-700 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">Q</span> {t("題目", "Question")}</h4>
            <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <textarea value={qText} onChange={e => setQText(e.target.value)} placeholder={t("輸入題目文字...", "Enter question text...")} rows="3" className="w-full bg-white border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
              <div>
                <label className="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer hover:text-blue-600 w-max"><ImageIcon className="w-5 h-5" /><span>{t("附加題目圖片", "Add Image")}</span><input type="file" accept="image/*" className="hidden" onChange={e => handleImagePick(e, setQImg)} /></label>
                {qImg && (<div className="mt-3 relative inline-block"><img src={qImg} alt="Preview" className="h-32 rounded-lg border border-slate-200" /><button type="button" onClick={() => setQImg(null)} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow hover:bg-red-600"><X className="w-4 h-4" /></button></div>)}
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-md font-semibold text-slate-800 mb-3 flex items-center"><span className="bg-green-100 text-green-700 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">A</span> {t("正確答案 / 解析", "Answer")}</h4>
            <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <textarea value={aText} onChange={e => setAText(e.target.value)} placeholder={t("輸入正確答案或解題過程...", "Enter answer...")} rows="3" className="w-full bg-white border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"></textarea>
              <div>
                <label className="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer hover:text-green-600 w-max"><ImageIcon className="w-5 h-5" /><span>{t("附加答案圖片", "Add Answer Image")}</span><input type="file" accept="image/*" className="hidden" onChange={e => handleImagePick(e, setAImg)} /></label>
                {aImg && (<div className="mt-3 relative inline-block"><img src={aImg} alt="Preview" className="h-32 rounded-lg border border-slate-200" /><button type="button" onClick={() => setAImg(null)} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow hover:bg-red-600"><X className="w-4 h-4" /></button></div>)}
              </div>
            </div>
          </div>
          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors">{t("取消", "Cancel")}</button>
            <button type="submit" disabled={isSubmitting || (!qText && !qImg)} className="px-6 py-2.5 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors flex items-center disabled:opacity-70">
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}{t("儲存錯題", "Save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CalendarView({ studySessions, selectedSubject, availableSubjects, onAddSession, localLang, t, tr }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().split('T')[0]);
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const filteredSessions = studySessions.filter(s => selectedSubject === '全部' || s.subject === selectedSubject);

  const monthlySessions = filteredSessions.filter(s => new Date(s.date).getFullYear() === year && new Date(s.date).getMonth() === month);
  const totalMinutesThisMonth = monthlySessions.reduce((sum, s) => sum + s.durationMinutes, 0);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  
  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const getSessionsForDay = (day) => {
    if (!day) return [];
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return filteredSessions.filter(s => s.date === dateStr);
  };

  const selectedDaySessions = filteredSessions.filter(s => s.date === selectedDay);
  const selectedDayTotal = selectedDaySessions.reduce((sum, s) => sum + s.durationMinutes, 0);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const handleManualAdd = (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const date = data.get('date');
    const startTime = data.get('startTime') || null;
    const subject = data.get('subject');
    const notes = data.get('notes');
    const hours = parseInt(data.get('hours') || 0);
    const minutes = parseInt(data.get('minutes') || 0);
    const totalMinutes = (hours * 60) + minutes;
    
    if (totalMinutes > 0) {
      onAddSession(subject, totalMinutes, date, notes, startTime);
      setIsManualAddOpen(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 print-hide">
      <header className="bg-white p-6 border-b border-slate-200 flex justify-between items-center shadow-sm shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center">
            <CalendarDays className="w-6 h-6 mr-3 text-indigo-600" />
            {t("學習時間表", "Study Calendar")} - {tr(selectedSubject)}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {t(`本月總溫習時數：`, `Total Study Time This Month: `)}
            <span className="font-bold text-indigo-700 ml-1">{formatMinutesToHours(totalMinutesThisMonth)}</span>
          </p>
        </div>
        <button onClick={() => setIsManualAddOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm flex items-center">
          <Plus className="w-5 h-5 mr-1" />{t("手動新增紀錄", "Add Record")}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col xl:flex-row gap-6 pb-24">
        <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex flex-col min-w-[300px]">
          <div className="flex justify-between items-center mb-6">
            <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"><ChevronRight className="w-6 h-6 rotate-180" /></button>
            <h3 className="text-xl font-bold text-slate-800 tracking-wide">
              {currentDate.toLocaleString(localLang === 'en' ? 'en-US' : 'zh-TW', { year: 'numeric', month: 'long' })}
            </h3>
            <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"><ChevronRight className="w-6 h-6" /></button>
          </div>
          
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
              <div key={i} className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2">{t(['日','一','二','三','四','五','六'][i], d)}</div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-2 flex-1 auto-rows-fr">
            {days.map((day, idx) => {
              if (!day) return <div key={idx} className="bg-slate-50/50 rounded-xl"></div>;
              
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const daySessions = getSessionsForDay(day);
              const dayTotalMins = daySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
              const isSelected = selectedDay === dateStr;
              const isToday = new Date().toISOString().split('T')[0] === dateStr;

              let bgClass = "bg-slate-50 border-slate-100 hover:border-indigo-300";
              if (isSelected) bgClass = "bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200";
              else if (dayTotalMins > 0) {
                 if (dayTotalMins > 180) bgClass = "bg-green-200 border-green-300";
                 else if (dayTotalMins > 60) bgClass = "bg-green-100 border-green-200";
                 else bgClass = "bg-green-50 border-green-100";
              }

              return (
                <button key={idx} onClick={() => setSelectedDay(dateStr)} className={`relative flex flex-col items-center justify-center p-2 rounded-2xl border-2 transition-all min-h-[4rem] md:min-h-[5.5rem] ${bgClass}`}>
                  <span className={`text-sm md:text-lg font-bold ${isToday ? 'text-indigo-600' : 'text-slate-700'}`}>{day}</span>
                  {dayTotalMins > 0 && <span className="mt-1 text-[0.65rem] md:text-xs font-semibold text-green-700 bg-white/60 px-1.5 py-0.5 rounded-md">{formatMinutesToHours(dayTotalMins)}</span>}
                  {daySessions.length > 0 && selectedSubject === '全部' && (
                     <div className="flex mt-1 space-x-0.5">
                       {daySessions.slice(0,3).map((_, i) => <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>)}
                       {daySessions.length > 3 && <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>}
                     </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="w-full xl:w-96 flex flex-col space-y-6">
          {selectedSubject === '全部' && monthlySessions.length > 0 && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col shrink-0">
               <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center">
                  <PieChartIcon className="w-5 h-5 mr-2 text-indigo-500" />
                  <h3 className="font-bold text-slate-800">{t("本月各科溫習比例", "Monthly Study Breakdown")}</h3>
               </div>
               <div className="p-5">
                  <PieChart sessions={monthlySessions} t={t} tr={tr} />
               </div>
            </div>
          )}

          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden flex-1 min-h-[300px]">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 flex items-center">
                <BarChart2 className="w-5 h-5 mr-2 text-indigo-500" />
                {new Date(selectedDay).toLocaleDateString(localLang === 'en' ? 'en-US' : 'zh-TW', { month: 'long', day: 'numeric' })}
              </h3>
              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-bold">{formatMinutesToHours(selectedDayTotal)}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedDaySessions.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10">
                   <Clock className="w-12 h-12 mb-3 text-slate-300" />
                   <p>{t("這天沒有溫習紀錄", "No study records for this day")}</p>
                 </div>
              ) : (
                 selectedDaySessions.map(session => (
                   <div key={session.id} className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col shadow-sm">
                     <div className="flex justify-between items-start">
                       <div>
                         <p className="font-bold text-slate-800">{tr(session.subject)}</p>
                         <p className="text-xs text-slate-400 mt-0.5">
                           {session.startTime ? session.startTime : (session.timestamp ? new Date(session.timestamp.toMillis()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '')}
                         </p>
                       </div>
                       <div className="bg-green-50 text-green-700 px-3 py-1.5 rounded-xl font-bold text-sm shrink-0">{formatMinutesToHours(session.durationMinutes)}</div>
                     </div>
                     {session.notes && (
                       <div className="mt-3 pt-3 border-t border-slate-100 flex items-start text-sm text-slate-600">
                          <FileText className="w-4 h-4 mr-1.5 mt-0.5 text-slate-400 shrink-0" />
                          <p className="leading-relaxed whitespace-pre-wrap">{session.notes}</p>
                       </div>
                     )}
                   </div>
                 ))
              )}
            </div>
          </div>
        </div>
      </div>

      {isManualAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print-hide">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-indigo-50 border-b border-indigo-100 px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-indigo-900 flex items-center"><Clock className="w-5 h-5 mr-2" />{t("新增溫習紀錄", "Add Study Record")}</h3>
              <button onClick={() => setIsManualAddOpen(false)} className="text-indigo-400 hover:text-indigo-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleManualAdd} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t("日期", "Date")}</label>
                  <input type="date" name="date" required defaultValue={selectedDay} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t("開始時間 (選填)", "Start Time (Optional)")}</label>
                  <input type="time" name="startTime" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t("科目", "Subject")}</label>
                <select name="subject" required defaultValue={selectedSubject !== '全部' ? selectedSubject : availableSubjects[0]} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none">
                  {availableSubjects.map(s => <option key={s} value={s}>{tr(s)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t("小時", "Hours")}</label>
                  <input type="number" name="hours" min="0" max="24" defaultValue="0" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t("分鐘", "Minutes")}</label>
                  <input type="number" name="minutes" min="0" max="59" defaultValue="30" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">{t("溫習內容 / 備註 (選填)", "Notes / Content (Optional)")}</label>
                 <textarea name="notes" rows="2" placeholder={t("例如：做了 2019 Past Paper", "e.g. Did 2019 Past Paper")} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"></textarea>
              </div>
              <div className="pt-2 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsManualAddOpen(false)} className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-medium">{t("取消", "Cancel")}</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm">{t("儲存", "Save")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PieChart({ sessions, t, tr }) {
  const [selected, setSelected] = useState(null);
  const dataMap = sessions.reduce((acc, s) => { acc[s.subject] = (acc[s.subject] || 0) + s.durationMinutes; return acc; }, {});
  const data = Object.keys(dataMap).map(subject => ({ subject, minutes: dataMap[subject] })).sort((a,b) => b.minutes - a.minutes);
  const total = data.reduce((sum, d) => sum + d.minutes, 0);
  
  if (total === 0) return null;
  let currentAngle = 0;
  const slices = data.map((d, i) => {
    const angle = (d.minutes / total) * 360;
    const slice = { ...d, startAngle: currentAngle, angle, color: CHART_COLORS[i % CHART_COLORS.length] };
    currentAngle += angle; return slice;
  });

  const createPath = (startAngle, angle) => {
    if (angle >= 359.9) return "M 100, 10 m 0, 180 a 90,90 0 1,0 0,-180 a 90,90 0 1,0 0,180";
    const startRad = (startAngle - 90) * Math.PI / 180; const endRad = (startAngle + angle - 90) * Math.PI / 180;
    const x1 = 100 + 90 * Math.cos(startRad); const y1 = 100 + 90 * Math.sin(startRad);
    const x2 = 100 + 90 * Math.cos(endRad); const y2 = 100 + 90 * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;
    return `M 100 100 L ${x1} ${y1} A 90 90 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  return (
    <div className="relative w-full max-w-[200px] mx-auto group">
      <svg viewBox="0 0 200 200" className="w-full h-auto drop-shadow-sm cursor-pointer">
        {slices.map((s, i) => (
          <path key={i} d={createPath(s.startAngle, s.angle)} fill={s.color} onClick={() => setSelected(selected?.subject === s.subject ? null : s)} className={`transition-all duration-300 hover:opacity-80 ${selected && selected.subject !== s.subject ? 'opacity-20' : 'opacity-100'}`} />
        ))}
        <circle cx="100" cy="100" r="50" fill="white" className="pointer-events-none" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {selected ? (
          <div className="text-center animate-in fade-in zoom-in duration-200">
             <p className="text-[10px] font-bold text-slate-500 mb-0.5 max-w-[70px] truncate">{tr(selected.subject)}</p>
             <p className="text-sm font-bold" style={{ color: selected.color }}>{formatMinutesToHours(selected.minutes)}</p>
          </div>
        ) : ( <div className="text-center text-slate-400"><p className="text-[10px] uppercase font-bold">{t("點擊分析", "Tap Chart")}</p></div> )}
      </div>
    </div>
  );
}

function AuthScreen({ lang, setLang, t }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleLang = () => setLang(lang === 'zh' ? 'en' : 'zh');

  const handleEmailAuth = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (isLogin) { await signInWithEmailAndPassword(auth, email, password); } 
      else { const userCredential = await createUserWithEmailAndPassword(auth, email, password); await updateProfile(userCredential.user, { displayName: name }); }
    } catch (err) {
      let msg = t("發生錯誤，請稍後再試。", "An error occurred. Please try again.");
      if (err.code === 'auth/operation-not-allowed') msg = t('⚠️ 此預覽環境未開啟電郵註冊權限。請自行部署使用。', 'Email registration is disabled in this preview environment.');
      else if (err.code === 'auth/email-already-in-use') msg = t('此電郵已註冊，每個電郵只能建立一個帳戶。', 'Email already registered.');
      else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') msg = t('電郵或密碼錯誤。', 'Invalid email or password.');
      else if (err.code === 'auth/weak-password') msg = t('密碼最少需 6 個字元。', 'Password should be at least 6 characters.');
      setError(msg);
    } finally { setLoading(false); }
  };

  const handleGoogleLogin = async () => {
    setError(''); setLoading(true);
    try { await signInWithPopup(auth, new GoogleAuthProvider()); } 
    catch (err) { 
      if (err.code === 'auth/operation-not-allowed') setError(t('⚠️ 此預覽環境未開放 Google 登入。請自行部署。', 'Google login is disabled in this preview. Please self-host.'));
      else if (err.code !== 'auth/popup-closed-by-user') setError(t("Google 彈出視窗可能被阻擋，請使用電郵登入。", "Google Popup Login blocked. Please use Email/Password."));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 relative">
      <button onClick={toggleLang} className="absolute top-6 right-6 flex items-center space-x-2 bg-white px-4 py-2 rounded-full shadow-sm text-slate-600 hover:text-blue-600 transition-colors">
        <Globe className="w-4 h-4" /><span className="text-sm font-medium">{lang === 'zh' ? 'English' : '中文'}</span>
      </button>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-blue-600 p-8 text-center">
            <div className="inline-flex items-center justify-center bg-white/20 p-3 rounded-full mb-3 backdrop-blur-sm"><Book className="w-8 h-8 text-white" /></div>
            <h1 className="text-2xl font-bold text-white mb-1">{t("溫習神器", "Revision Pro")}</h1>
            <p className="text-blue-100 text-sm">{t("你的個人專屬錯題簿與溫習日曆", "Error Book & Study Calendar")}</p>
        </div>
        <div className="p-8">
            <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">{isLogin ? t('登入你的帳戶', 'Login to your account') : t('建立新帳戶', 'Create new account')}</h2>
            {error && <div className="bg-red-50 border border-red-100 p-4 rounded-xl mb-5 flex items-start space-x-3"><AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" /><span className="text-red-700 text-sm font-medium leading-relaxed">{error}</span></div>}
            <button onClick={handleGoogleLogin} disabled={loading} className="w-full mb-6 flex items-center justify-center space-x-2 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 p-3 rounded-xl font-medium transition-colors disabled:opacity-50">
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" /><span>{t("使用 Google 帳號繼續", "Continue with Google")}</span>
            </button>
            <div className="flex items-center mb-6"><div className="flex-1 border-t border-slate-200"></div><span className="px-4 text-sm text-slate-400">{t("或使用電郵", "OR EMAIL")}</span><div className="flex-1 border-t border-slate-200"></div></div>
            <form onSubmit={handleEmailAuth} className="space-y-4">
                {!isLogin && (
                    <div>
                        <div className="relative"><User className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={t("例如：陳大文", "e.g., John Doe")} /></div>
                    </div>
                )}
                <div>
                    <div className="relative"><Mail className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="student@example.com" /></div>
                </div>
                <div>
                    <div className="relative"><Lock className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input type="password" required minLength="6" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={t("密碼 (最少 6 個字元)", "Password (Min. 6 chars)")} /></div>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl font-medium transition-colors shadow-sm flex justify-center items-center mt-2 disabled:opacity-70">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? t('登入', 'Login') : t('註冊', 'Sign Up'))}
                </button>
            </form>
            <div className="mt-6 text-center text-sm text-slate-600">
                {isLogin ? t("還沒有帳戶？", "Don't have an account?") : t("已有帳戶？", "Already have an account?")}
                <button onClick={() => setIsLogin(!isLogin)} className="ml-1 text-blue-600 font-semibold hover:underline">{isLogin ? t("立即註冊", "Sign up now") : t("登入", "Login here")}</button>
            </div>
        </div>
      </div>
    </div>
  );
}

function UserProfileModal({ user, userProfile, onClose, onSave, onDeleteAccount, t, tr }) {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [language, setLanguage] = useState(userProfile?.language || 'zh');
  const [dseYear, setDseYear] = useState(userProfile?.dseYear || (new Date().getFullYear() + 1));
  const [subjects, setSubjects] = useState(userProfile?.subjects || [...DSE_CORE]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImagePick = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { const base64 = await resizeImage(file); setPhotoURL(base64); } catch (err) { }
  };

  const toggleSubject = (subject) => {
    if (subjects.includes(subject)) setSubjects(subjects.filter(s => s !== subject));
    else setSubjects([...subjects, subject]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (subjects.length === 0) { alert(t("請至少選擇一個科目！", "Please select at least one subject!")); return; }
    setIsSubmitting(true);
    await onSave({ displayName, photoURL, language, dseYear, subjects });
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print-hide">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
            <h3 className="text-lg font-bold text-slate-800 flex items-center"><Settings className="w-5 h-5 mr-2 text-slate-500" />{t("個人檔案設定", "Profile Settings")}</h3>
            <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="flex flex-col items-center">
                <div className="relative group mb-2">
                    {photoURL ? <img src={photoURL} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-4 border-slate-100 shadow-sm" /> : <div className="w-20 h-20 rounded-full bg-slate-100 border-4 border-slate-50 shadow-sm flex items-center justify-center"><User className="w-8 h-8 text-slate-400" /></div>}
                    <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-1.5 rounded-full cursor-pointer shadow-md hover:bg-blue-700 transition-colors"><Camera className="w-4 h-4" /><input type="file" accept="image/*" className="hidden" onChange={handleImagePick} /></label>
                </div>
                <p className="text-xs text-slate-400">{t("點擊相機更改頭像", "Click camera to change avatar")}</p>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t("用戶名稱", "Display Name")}</label>
                <div className="relative">
                    <User className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input type="text" required value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t("介面語言", "Language")}</label>
                    <div className="relative">
                        <Globe className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                        <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"><option value="zh">繁體中文</option><option value="en">English</option></select>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t("DSE 應考年份", "DSE Year")}</label>
                    <div className="relative">
                        <CalendarIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                        <select value={dseYear} onChange={e => setDseYear(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                            {[0,1,2,3,4,5].map(offset => { const y = new Date().getFullYear() + offset; return <option key={y} value={y}>{y}</option>})}
                        </select>
                    </div>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{t("修讀科目 (點擊可新增/刪除)", "Subjects (Click to Add/Remove)")}</label>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    {[...DSE_CORE, ...DSE_CAT_A, ...DSE_CAT_B].map(subj => (
                    <button type="button" key={subj} onClick={() => toggleSubject(subj)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${subjects.includes(subj) ? 'bg-indigo-100 text-indigo-700 border-indigo-200 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                        {tr(subj)}
                    </button>
                    ))}
                </div>
            </div>
            <div className="pt-2">
               <button type="button" onClick={onDeleteAccount} className="w-full flex justify-center items-center py-2.5 rounded-xl border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors text-sm font-bold">
                 <AlertTriangle className="w-4 h-4 mr-2" />{t("刪除這個帳號", "Delete Account")}
               </button>
            </div>
            <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100">
                <button type="button" onClick={onClose} className="px-5 py-2 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors">{t("取消", "Cancel")}</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors flex items-center disabled:opacity-70">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}{t("儲存設定", "Save Settings")}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
}

function SetupProfileScreen({ onComplete, t, tr }) {
  const [selectedSubjects, setSelectedSubjects] = useState([...DSE_CORE]);
  const [isSaving, setIsSaving] = useState(false);

  const toggleSubject = (subject) => {
    if (selectedSubjects.includes(subject)) setSelectedSubjects(selectedSubjects.filter(s => s !== subject));
    else setSelectedSubjects([...selectedSubjects, subject]);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8 font-sans">
      <div className="bg-white max-w-4xl w-full rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-blue-600 p-8 text-center shrink-0">
          <div className="inline-flex items-center justify-center bg-white/20 p-4 rounded-full mb-4 backdrop-blur-sm"><Book className="w-10 h-10 text-white" /></div>
          <h1 className="text-3xl font-bold text-white mb-2">{t("設定你的專屬錯題簿", "Setup Your Error Book")}</h1>
          <p className="text-blue-100">{t("請勾選你正在修讀的 DSE 科目", "Select the subjects you are studying")}</p>
        </div>
        <div className="p-8 flex-1 overflow-y-auto space-y-8">
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center border-b pb-2"><CheckSquare className="w-6 h-6 mr-2 text-blue-500" /> {t("核心科目 (必修)", "Core Subjects")}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {DSE_CORE.map(subject => <button key={subject} onClick={() => toggleSubject(subject)} className={`p-4 rounded-2xl border-2 text-sm font-semibold transition-all ${selectedSubjects.includes(subject) ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm transform scale-[1.02]' : 'bg-white border-slate-100 text-slate-600 hover:border-blue-300 hover:bg-slate-50'}`}>{tr(subject)}</button>)}
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center border-b pb-2"><CheckSquare className="w-6 h-6 mr-2 text-blue-500" /> {t("選修科目 (Category A)", "Electives (Category A)")}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {DSE_CAT_A.map(subject => <button key={subject} onClick={() => toggleSubject(subject)} className={`p-4 rounded-2xl border-2 text-sm font-semibold transition-all ${selectedSubjects.includes(subject) ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm transform scale-[1.02]' : 'bg-white border-slate-100 text-slate-600 hover:border-blue-300 hover:bg-slate-50'}`}>{tr(subject)}</button>)}
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center border-b pb-2"><CheckSquare className="w-6 h-6 mr-2 text-blue-500" /> {t("其他選修科目 (Category B)", "Other Electives (Category B)")}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {DSE_CAT_B.map(subject => <button key={subject} onClick={() => toggleSubject(subject)} className={`p-4 rounded-2xl border-2 text-sm font-semibold transition-all ${selectedSubjects.includes(subject) ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm transform scale-[1.02]' : 'bg-white border-slate-100 text-slate-600 hover:border-blue-300 hover:bg-slate-50'}`}>{tr(subject)}</button>)}
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
          <button onClick={() => { if(selectedSubjects.length>0) { setIsSaving(true); onComplete(selectedSubjects); } }} disabled={isSaving || selectedSubjects.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-medium shadow-md transition-all active:scale-95 flex items-center disabled:opacity-70 text-lg">
            {isSaving ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : null}{t("開始使用", "Start Using")}
          </button>
        </div>
      </div>
    </div>
  );
}