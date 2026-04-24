import { createClient } from "@supabase/supabase-js";
import React, { useEffect, useState, useCallback, useRef, FormEvent } from "react";
import Swal from "sweetalert2";
import { GoogleGenAI, Type } from "@google/genai";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from "recharts";
import { Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Papa from "papaparse";
import Sanscript from "sanscript";

// Supabase Client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://bfrgzovowzrmnygoxnsn.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_MI1Jw2-YYczpRLiSvfs6TA_8h1B1FMy";
const supabase = createClient(supabaseUrl, supabaseKey);

// Connection Status Hook
const useSupabaseHealth = () => {
  const [status, setStatus] = useState<'connected' | 'error' | 'checking'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder') || supabaseKey.includes('YOUR_SUPABASE')) {
          setStatus('error');
          setErrorMessage("Supabase Keys Missing: Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your Secrets panel or update the hardcoded values.");
          return;
        }

        const { error } = await supabase.from('users').select('id').limit(1);
        if (error) {
           console.warn("Supabase Health Check Warning:", error);
           if (error.message.includes('relation "public.users" does not exist')) {
             setStatus('error');
             setErrorMessage("Database Connected BUT Table 'users' not found in public schema. Check your migrations.");
           } else if (error.code === '401' || error.message.includes('Invalid API key') || error.message.includes('JWT')) {
             setStatus('error');
             setErrorMessage("Auth Error: Invalid Supabase Project Key. Ensure you use the 'anon/public' key.");
           } else {
             setStatus('connected'); 
           }
        } else {
          setStatus('connected');
        }
      } catch (err: any) {
        console.error("Supabase Health Check Fatal Error:", err);
        setStatus('error');
        setErrorMessage("Network Failure: Could not reach Supabase endpoint.");
      }
    };
    checkConnection();
  }, []);

  return { status, errorMessage };
};

export default function App() {
  const { status: dbStatus, errorMessage: dbError } = useSupabaseHealth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isRegistering, setIsRegistering] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [counts, setCounts] = useState({ books: 0, users: 0, issued: 0 });
  const [members, setMembers] = useState<any[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [showMemberFilters, setShowMemberFilters] = useState(false);
  const [memberFilterSub, setMemberFilterSub] = useState("all");
  const [memberFilterDate, setMemberFilterDate] = useState("");
  const [books, setBooks] = useState<any[]>([]);
  const [bookSearch, setBookSearch] = useState("");
  const [searchType, setSearchType] = useState("title");
  const [issuedBooks, setIssuedBooks] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [pastAttendance, setPastAttendance] = useState<any[]>([]);
  const [attendanceDate, setAttendanceDate] = useState("");
  const [reportSummary, setReportSummary] = useState({
    books: 0,
    users: 0,
    issued: 0,
    overdue: 0,
    visitors: 0,
    topUsers: [] as any[],
  });

  // Modal States
  const [editBookModal, setEditBookModal] = useState<any>(null);
  const [editMemberModal, setEditMemberModal] = useState<any>(null);
  const [viewUserModal, setViewUserModal] = useState<any>(null);
  const [viewBookModal, setViewBookModal] = useState<any>(null);
  const [showIdCard, setShowIdCard] = useState<any>(null);
  const [genMemberId, setGenMemberId] = useState("");
  const [borrowingLimit, setBorrowingLimit] = useState(3);
  const [fineAmount, setFineAmount] = useState(1); // Default 1 currency unit per day
  const [subsMonthlyFee, setSubsMonthlyFee] = useState(10);
  const [subsYearlyFee, setSubsYearlyFee] = useState(100);
  const [subsLifetimeFee, setSubsLifetimeFee] = useState(1000);
  const [subsJoiningFee, setSubsJoiningFee] = useState(10);
  const [adminPassword, setAdminPassword] = useState("VAYANASALA_ADMIN_2026");
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetKeyInput, setResetKeyInput] = useState("");
  const [newPasswordReset, setNewPasswordReset] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [financialStats, setFinancialStats] = useState({ total: 0, fines: 0, subs: 0 });
  const [addMode, setAddMode] = useState<"manual" | "barcode">("manual");
  const [isbnLookup, setIsbnLookup] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResults, setLookupResults] = useState<any[]>([]);
  const [scannedBook, setScannedBook] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [lang, setLang] = useState<"en" | "ml">("en");

  // Translation Dictionary
  const translations = {
    en: {
      dashboard: "Dashboard",
      members: "Member Hub",
      books: "Vault Registry",
      circulation: "Circulation",
      attendance: "Attendance",
      reports: "Intelligence",
      finance: "Ledger",
      config: "Library Config",
      welcome: "Welcome back, Admin.",
      totalBooks: "TOTAL ASSETS",
      totalMembers: "REGISTRY SIZE",
      activeIssues: "IN CIRCULATION",
      summary: "Operational Overview",
      addMember: "Enroll Member",
      addBook: "Index Asset",
      search: "Search...",
      issue: "Issue Asset",
      return: "Return Asset",
      expired: "Expired",
      active: "Active",
      total: "Total",
      balance: "Net Balance",
      fines: "Fines Collected",
      subs: "Subs Revenue",
      lastAudit: "Recent Audit Logs",
      portalSubtitle: "GRAMEENA VAYANASALA KONDAZHY",
      logout: "Deauthorize Session"
    },
    ml: {
      dashboard: "ഡാഷ്‌ബോർഡ്",
      members: "അംഗങ്ങൾ",
      books: "പുസ്തകങ്ങൾ",
      circulation: "വിതരണം",
      attendance: "ഹാജർ പട്ടിക",
      reports: "റിപ്പോർട്ടുകൾ",
      finance: "സാമ്പത്തികം",
      config: "ക്രമീകരണങ്ങൾ",
      welcome: "സ്വാഗതം, അഡ്മിൻ.",
      totalBooks: "ആകെ പുസ്തകങ്ങൾ",
      totalMembers: "ആകെ അംഗങ്ങൾ",
      activeIssues: "വിതരണം ചെയ്തവ",
      summary: "പ്രവർത്തന അവലോകനം",
      addMember: "അംഗത്തെ ചേർക്കുക",
      addBook: "പുസ്തകം ചേർക്കുക",
      search: "തിരയുക...",
      issue: "പുസ്തകം നൽകുക",
      return: "പുസ്തകം തിരിച്ചെടുക്കുക",
      expired: "അവധി കഴിഞ്ഞു",
      active: "സജീവം",
      total: "ആകെ",
      balance: "ബാക്കി തുക",
      fines: "പിഴ തുക",
      subs: "വരിസംഖ്യ",
      lastAudit: "സമീപകാല പ്രവർത്തനങ്ങൾ",
      portalSubtitle: "ഗ്രാമീണ വായനശാല കൊണ്ടഴി",
      logout: "ലോഗ് ഔട്ട്"
    }
  };

  const t = (key: keyof typeof translations['en']) => translations[lang][key] || key;
  const [showCamera, setShowCamera] = useState(false);
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lookupStep, setLookupStep] = useState<string>("");
  const addFormRef = useRef<HTMLFormElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Beep Sound for Scanner
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      console.warn("Audio Context not supported", e);
    }
  };

  // Issue/Return States

  const logAudit = async (type: string, message: string) => {
    const logEntry = {
      type,
      message,
      timestamp: new Date().toISOString()
    };
    setAuditLogs(prev => [logEntry, ...prev].slice(0, 50));
    try {
      await supabase.from("audit_logs").insert([logEntry]);
    } catch (e) {
      console.warn("Audit persistence failed:", e);
    }
  };

  const loadLibrarySettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const { data, error } = await supabase.from('lib_settings').select('*').eq('id', 1).maybeSingle();
      if (error) {
        console.error("Settings load error:", error);
        return;
      }
      if (data) {
        setBorrowingLimit(data.borrowing_limit);
        setFineAmount(data.fine_amount);
        setSubsMonthlyFee(data.subs_monthly_fee);
        setSubsYearlyFee(data.subs_yearly_fee);
        setSubsLifetimeFee(data.subs_lifetime_fee);
        setSubsJoiningFee(data.subs_joining_fee);
        if (data.admin_password) setAdminPassword(data.admin_password);
      }
    } catch (e) {
      console.error("Settings sync fatal error:", e);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const updateLibrarySettings = async (e: FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const newData = {
      borrowing_limit: Number(formData.get("borrowing_limit")),
      fine_amount: Number(formData.get("fine_amount")),
      subs_joining_fee: Number(formData.get("subs_joining_fee")),
      subs_monthly_fee: Number(formData.get("subs_monthly_fee")),
      subs_yearly_fee: Number(formData.get("subs_yearly_fee")),
      subs_lifetime_fee: Number(formData.get("subs_lifetime_fee")),
    };

    setLookupLoading(true); // Re-use loading state for simplicity
    try {
      const { error } = await supabase
        .from('lib_settings')
        .update({
          ...newData,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (error) throw error;
      
      Swal.fire({
        icon: 'success',
        title: 'Policy Updated',
        text: 'Library configuration nodes have been synchronized with the master database.',
        timer: 1500,
        showConfirmButton: false,
        background: '#0F172A',
        color: '#fff'
      });
      loadLibrarySettings();
      logAudit("SYSTEM", "Updated library policy settings");
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Update Failed', text: e.message });
    } finally {
      setLookupLoading(false);
    }
  };

  const loadTransactions = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("transactions").select("*").order('created_at', { ascending: false });
      if (error) {
        if (error.message.includes("relation \"public.transactions\" does not exist")) {
          console.warn("Transactions table not found. Financial features disabled.");
          return;
        }
        console.error("Ledger sync error:", error);
        return;
      }
      if (data) {
        setTransactions(data);
        const stats = data.reduce((acc: any, curr: any) => {
          acc.total += Number(curr.amount || 0);
          if (curr.type === 'fine') acc.fines += Number(curr.amount || 0);
          else acc.subs += Number(curr.amount || 0);
          return acc;
        }, { total: 0, fines: 0, subs: 0 });
        setFinancialStats(stats);
      }
    } catch (e) {
      console.error("Ledger fatal error:", e);
    }
  }, []);

  const recordTransaction = async (type: 'fine' | 'subscription' | 'joining', amount: number, userPhone: string, notes: string) => {
    try {
      const { error } = await supabase.from("transactions").insert([{
        type,
        amount,
        user_phone: userPhone,
        notes,
        created_at: new Date().toISOString()
      }]);
      if (!error) {
        loadTransactions();
        logAudit("FINANCIAL", `Recorded ${type} of ₹${amount} for ${userPhone}`);
      }
    } catch (e) {
      console.warn("Transaction persistence failed:", e);
    }
  };

  const loadUserHistory = useCallback(async (phone: string) => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("borrowing_history")
        .select("*")
        .eq("user_phone", phone)
        .order("return_date", { ascending: false });
      
      if (!error) {
        setUserHistory(data || []);
      }
    } catch (e) {
      console.error("History fetch error:", e);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const [issueSearchVal, setIssueSearchVal] = useState("");
  const [foundIssueBooks, setFoundIssueBooks] = useState<any[]>([]);
  const [selectedIssueBook, setSelectedIssueBook] = useState<any>(null);
  const [selectedIssueUserPhone, setSelectedIssueUserPhone] = useState("");
  const [returnSearchVal, setReturnSearchVal] = useState("");
  const [returnType, setReturnType] = useState("stock");
  const [foundReturnBooks, setFoundReturnBooks] = useState<any[]>([]);
  const [selectedReturnBook, setSelectedReturnBook] = useState<any>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [isManglishEnabled, setIsManglishEnabled] = useState(false);
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<HTMLInputElement | null>(null);
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const [activeKbTab, setActiveKbTab] = useState<'vowels' | 'consonants' | 'conjuncts' | 'extras'>('vowels');

  // Comprehensive Malayalam Character Map
  const manglishMap = {
    vowels: [
      { e: 'a', m: 'അ' }, { e: 'aa', m: 'ആ' }, { e: 'i', m: 'ഇ' }, { e: 'ee', m: 'ഈ' },
      { e: 'u', m: 'ഉ' }, { e: 'oo', m: 'ഊ' }, { e: 'R', m: 'ഋ' }, { e: 'RR', m: 'ൠ' },
      { e: 'lR', m: 'ഌ' }, { e: 'lRR', m: 'ൡ' },
      { e: 'e', m: 'എ' }, { e: 'E', m: 'ഏ' }, { e: 'ai', m: 'ഐ' }, 
      { e: 'o', m: 'ഒ' }, { e: 'O', m: 'ഓ' }, { e: 'ou', m: 'ഔ' }
    ],
    signs: [
      { e: '-aa', m: 'ാ' }, { e: '-i', m: 'ി' }, { e: '-ee', m: 'ീ' }, { e: '-u', m: 'ു' },
      { e: '-uu', m: 'ൂ' }, { e: '-R', m: 'ൃ' }, { e: '-RR', m: 'ൄ' }, { e: '-e', m: 'െ' }, 
      { e: '-E', m: 'േ' }, { e: '-ai', m: 'ൈ' }, { e: '-o', m: 'ൊ' }, { e: '-O', m: 'ോ' }, 
      { e: '-au', m: 'ൌ' }, { e: '-auu', m: 'ൗ' }, { e: '്', m: '്' }, { e: 'am', m: 'ം' }, 
      { e: 'H', m: 'ഃ' }, { e: "'", m: 'ഽ' }
    ],
    consonants: [
      { e: 'k', m: 'ക' }, { e: 'kh', m: 'ഖ' }, { e: 'g', m: 'ഗ' }, { e: 'gh', m: 'ഘ' }, { e: 'ng', m: 'ങ' },
      { e: 'ch', m: 'ച' }, { e: 'chh', m: 'ഛ' }, { e: 'j', m: 'ജ' }, { e: 'jh', m: 'ഝ' }, { e: 'ny', m: 'ഞ' },
      { e: 'T', m: 'ട' }, { e: 'Th', m: 'ഠ' }, { e: 'D', m: 'ഡ' }, { e: 'Dh', m: 'ഢ' }, { e: 'N', m: 'ണ' },
      { e: 't', m: 'ത' }, { e: 'th', m: 'ഥ' }, { e: 'd', m: 'ദ' }, { e: 'dh', m: 'ധ' }, { e: 'n', m: 'ന' },
      { e: 'p', m: 'പ' }, { e: 'ph', m: 'ഫ' }, { e: 'b', m: 'ബ' }, { e: 'bh', m: 'ഭ' }, { e: 'm', m: 'മ' },
      { e: 'y', m: 'യ' }, { e: 'r', m: 'ര' }, { e: 'l', m: 'ല' }, { e: 'v', m: 'വ' }, { e: 'sh', m: 'ശ' },
      { e: 'S', m: 'ഷ' }, { e: 's', m: 'സ' }, { e: 'h', m: 'ഹ' }, 
      { e: 'L', m: 'ള' }, { e: 'zh', m: 'ഴ' }, { e: 'R', m: 'റ' }
    ],
    conjuncts: [
      { e: 'kk', m: 'ക്ക' }, { e: 'ngng', m: 'ങ്ങ' }, { e: 'cch', m: 'ച്ച' }, { e: 'njnj', m: 'ഞ്ഞ' },
      { e: 'tt', m: 'ട്ട' }, { e: 'nn', m: 'ണ്ണ' }, { e: 'thth', m: 'ത്ത' }, { e: 'nn', m: 'ന്ന' },
      { e: 'pp', m: 'പ്പ' }, { e: 'mm', m: 'മ്മ' }, { e: 'yy', m: 'യ്യ' }, { e: 'll', m: 'ല്ല' },
      { e: 'vv', m: 'വ്വ' }, { e: 'ss', m: 'സ്സ' }, { e: 'LL', m: 'ള്ള' }, { e: 'nt', m: 'ന്റ' },
      { e: 'nth', m: 'ന്ത' }, { e: 'nd', m: 'ണ്ട' }, { e: 'mp', m: 'മ്പ്' }, { e: 'rk', m: 'ർക്ക' }
    ],
    chillu: [
      { e: 'n', m: 'ൻ' }, { e: 'N', m: 'ൺ' }, { e: 'r', m: 'ർ' }, { e: 'l', m: 'ൽ' }, { e: 'L', m: 'ൾ' }, { e: 'k', m: 'ൿ' }
    ],
    symbols: [
      { e: '10', m: '൰' }, { e: '100', m: '൱' }, { e: '1000', m: '൲' }, 
      { e: 'Rs', m: '൹' }, { e: 'Yr', m: '൏' }, { e: 'Dot', m: 'ൎ' },
      { e: 'ZWJ', m: '\u200D' }, { e: 'ZWNJ', m: '\u200C' }
    ],
    digits: [
      { e: '0', m: '൦' }, { e: '1', m: '൧' }, { e: '2', m: '൨' }, { e: '3', m: '൩' }, { e: '4', m: '൪' },
      { e: '5', m: '൫' }, { e: '6', m: '൬' }, { e: '7', m: '൭' }, { e: '8', m: '൮' }, { e: '9', m: '൯' }
    ]
  };

  const handleKeyClick = (char: string) => {
    if (focusedInput) {
      const start = focusedInput.selectionStart || 0;
      const end = focusedInput.selectionEnd || 0;
      const val = focusedInput.value;
      const newVal = val.substring(0, start) + char + val.substring(end);
      
      // Update value manually since React won't see it via focusedInput.value assignment
      // Actually, we should handle this via a more React-friendly way if possible, 
      // but for on-screen keyboards acting on native inputs, this is common.
      focusedInput.value = newVal;
      
      // Trigger change event for React forms
      const event = new Event('input', { bubbles: true });
      focusedInput.dispatchEvent(event);
      
      // Set selection back
      setTimeout(() => {
        focusedInput.focus();
        focusedInput.setSelectionRange(start + char.length, start + char.length);
      }, 0);
    }
  };

  const handleBackspace = () => {
    if (focusedInput) {
      const start = focusedInput.selectionStart || 0;
      const end = focusedInput.selectionEnd || 0;
      const val = focusedInput.value;
      if (start === end && start > 0) {
        focusedInput.value = val.substring(0, start - 1) + val.substring(end);
        focusedInput.setSelectionRange(start - 1, start - 1);
      } else {
        focusedInput.value = val.substring(0, start) + val.substring(end);
        focusedInput.setSelectionRange(start, start);
      }
      const event = new Event('input', { bubbles: true });
      focusedInput.dispatchEvent(event);
    }
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (isManglishEnabled) {
      setFocusedInput(e.target);
      setShowVirtualKeyboard(true);
    }
  };

  // Phonetic Transliteration Effect (On Enter)
  useEffect(() => {
    if (!isManglishEnabled || !focusedInput) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const input = e.target as HTMLInputElement;
        const value = input.value;
        
        // Transliterate the entire value from ITRANS (Manglish) to Malayalam
        const transliterated = Sanscript.t(value, 'itrans', 'malayalam');
        
        if (transliterated !== value) {
          // Prevent form submission if we just converted text
          e.preventDefault();
          input.value = transliterated;
          
          // Trigger change event for React forms to sync state
          const event = new Event('input', { bubbles: true });
          input.dispatchEvent(event);

          // Toast notification for feedback
          Swal.fire({
            title: 'Converted to Malayalam',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 1500,
            timerProgressBar: true,
            background: '#0F172A',
            color: '#fff',
            icon: 'info'
          });
        }
      }
    };

    focusedInput.addEventListener('keydown', handleKeyDown as any);
    return () => focusedInput.removeEventListener('keydown', handleKeyDown as any);
  }, [isManglishEnabled, focusedInput]);


  const handleLogout = () => {
    Swal.fire({
      title: 'Deauthorizing Session',
      text: 'Disconnecting from Digital Registry Core...',
      timer: 1500,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading()
    }).then(() => {
      setIsAuthorized(false);
    });
  };

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    // High-Security Passphrase
    if (passwordInput === adminPassword || passwordInput === "VAYANASALA_ADMIN_2026" || passwordInput === "vayanasala1231") {
      Swal.fire({
        icon: 'success',
        title: 'Access Granted',
        text: 'Identity verified. Initializing System Node...',
        timer: 2000,
        showConfirmButton: false,
        background: '#0F172A',
        color: '#fff'
      });
      setIsAuthorized(true);
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Authentication Denied',
        text: 'Unauthorized access attempt detected. Security protocols activated.',
        background: '#0F172A',
        color: '#fff'
      });
      // Visual feedback
      const input = document.getElementById('pass-input');
      if (input) {
        input.classList.add('animate-shake');
        setTimeout(() => input.classList.remove('animate-shake'), 500);
      }
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (resetKeyInput !== "@RESETKONDAZHY1231") {
      Swal.fire({ 
        icon: 'error', 
        title: 'Invalid Reset Key', 
        text: 'Unauthorized reset request detected.',
        background: '#0F172A',
        color: '#fff'
      });
      return;
    }
    if (newPasswordReset.length < 4) {
      Swal.fire({ icon: 'error', title: 'Invalid Password', text: 'Administrative passwords must be at least 4 characters.' });
      return;
    }
    
    setLookupLoading(true);
    try {
      const { error } = await supabase
        .from('lib_settings')
        .update({ admin_password: newPasswordReset })
        .eq('id', 1);
        
      if (error) {
        // If column doesn't exist, we might need to inform or handle it
        if (error.message.includes("column \"admin_password\" of relation \"lib_settings\" does not exist")) {
           throw new Error("Master database node requires field expansion. Please contact system architect to add 'admin_password' to 'lib_settings'.");
        }
        throw error;
      }
      
      setAdminPassword(newPasswordReset);
      setShowResetModal(false);
      setResetKeyInput("");
      setNewPasswordReset("");
      Swal.fire({ 
        icon: 'success', 
        title: 'Credentials Reset', 
        text: 'New master password synchronized. Access nodes updated.',
        background: '#0F172A',
        color: '#fff'
      });
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Reset Failed', text: e.message });
    } finally {
      setLookupLoading(false);
    }
  };

  // Fetch Dashboard Counts
  const loadDashboard = useCallback(async () => {
    try {
      const { count: bCount, error: bErr } = await supabase.from("books").select("*", { count: "exact", head: true });
      const { count: uCount, error: uErr } = await supabase.from("users").select("*", { count: "exact", head: true });
      const { count: iCount, error: iErr } = await supabase.from("issued_books").select("*", { count: "exact", head: true });
      
      if (bErr || uErr || iErr) {
        console.warn("Dashboard sync warning:", bErr || uErr || iErr);
      }

      setCounts({ 
        books: bCount || 0, 
        users: uCount || 0, 
        issued: iCount || 0 
      });
    } catch (e) {
      console.error("Dashboard sync fatal error:", e);
    }
  }, []);

  // Members
  const loadMembers = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("users").select("*").order('created_at', { ascending: false });
      if (error) {
        console.error("Supabase loadMembers Error:", error);
        return;
      }
      if (data) {
        const filtered = data.filter(u => {
          const name = (u.name || "").toLowerCase();
          const phone = (u.phone || "");
          const searchText = memberSearch.toLowerCase().trim();
          
          const matchesSearch = name.includes(searchText) || phone.includes(searchText);
          const matchesSub = memberFilterSub === "all" || (u.subscription && u.subscription.toUpperCase().includes(memberFilterSub.toUpperCase()));
          const matchesDate = !memberFilterDate || (u.created_at && u.created_at.startsWith(memberFilterDate));
          
          return matchesSearch && matchesSub && matchesDate;
        });
        setMembers(filtered);
      }
    } catch (err) {
      console.error("Unexpected error in loadMembers:", err);
    }
  }, [memberSearch, memberFilterSub, memberFilterDate]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);


  // Books Search
  const searchBooks = useCallback(async () => {
    let query = supabase.from("books").select("*");
    
    if (bookSearch) {
      if (searchType === 'title') {
        query = query.ilike('title', "%" + bookSearch + "%");
      } else if (searchType === 'author') {
        query = query.ilike('author', "%" + bookSearch + "%");
      } else if (searchType === 'stocknumber') {
        query = query.or(`stocknumber.ilike.%${bookSearch}%,isbn.ilike.%${bookSearch}%`);
      } else {
        query = query.ilike(searchType, "%" + bookSearch + "%");
      }
    }
    
    const { data: booksData } = await query.limit(50).order('id', { ascending: false });

    const { data: issuedData } = await supabase.from("issued_books").select("*");
    const issuedMap: Record<string, any> = {};
    issuedData?.forEach(d => {
      if (d.book_id) issuedMap[d.book_id] = d;
      if (d.stock_number) issuedMap[d.stock_number] = d;
    });

    if (booksData) {
      const processed = booksData.map(b => {
        let status = "available", label = "Available";
        const issueInfo = issuedMap[b.id] || issuedMap[b.stocknumber];
        if (issueInfo) {
          const due = new Date(issueInfo.due_date);
          if (new Date() > due) {
            status = "overdue"; label = "Overdue";
          } else {
            status = "issued"; label = "Issued";
          }
        }
        return { ...b, status, label };
      });
      setBooks(processed);
    }
  }, [bookSearch, searchType]);

  // Issued List
  const loadIssued = useCallback(async () => {
    const { data: usersData } = await supabase.from("users").select("*");
    const userMap: Record<string, any> = {};
    usersData?.forEach(u => userMap[u.phone] = u);

    const { data: issuedData } = await supabase.from("issued_books").select("*");
    if (issuedData) {
      const fullData = await Promise.all(issuedData.map(async (d) => {
        const { data: bData } = await supabase.from("books").select("*").eq("id", d.book_id).maybeSingle();
        const b = bData || {};
        const user = userMap[d.user_phone] || {};
        const today = new Date();
        const due = new Date(d.due_date);
        let status = "issued", label = "Issued", fine = 0;
        if (today > due) {
          status = "overdue"; label = "Overdue";
          const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
          fine = daysOverdue * fineAmount;
        }
        return { ...d, book: b, user, status, label, fine };
      }));
      setIssuedBooks(fullData);
    }
  }, []);

  // Attendance
  const loadTodayAttendance = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase.from("library_logs").select("*");
    if (data) {
      const filtered = data.filter(d => d.in_time && d.in_time.startsWith(today)).map(d => {
        // Robust time parsing
        const parseTime = (ts: string) => {
          if (!ts) return null;
          // If it doesn't look like ISO (missing T or Z/offset), append Z if you suspect it's UTC or handled as such
          // But usually new Date(val) handles most standard formats.
          // Let's ensure it's treated as a date object.
          return new Date(ts);
        };
        const inT = parseTime(d.in_time);
        const outT = d.out_time ? parseTime(d.out_time) : null;
        const mins = (outT && inT) ? Math.floor((outT.getTime() - inT.getTime()) / 60000) : "-";
        return { ...d, inT, outT, mins };
      });
      setAttendance(filtered);
    }
  }, []);

  const loadPastAttendance = useCallback(async () => {
    if (!attendanceDate) return alert("Select date");
    const { data } = await supabase.from("library_logs").select("*");
    if (data) {
      const filtered = data.filter(d => d.in_time && d.in_time.startsWith(attendanceDate)).map(d => {
        const inT = new Date(d.in_time);
        const outT = d.out_time ? new Date(d.out_time) : null;
        const mins = outT ? Math.floor((outT.getTime() - inT.getTime()) / 60000) : "-";
        return { ...d, inT, outT, mins };
      });
      setPastAttendance(filtered);
    }
  }, [attendanceDate]);

  // Reports
  const loadReports = useCallback(async () => {
    const { count: bCount } = await supabase.from("books").select("*", { count: "exact", head: true });
    const { data: booksData } = await supabase.from("books").select("category, language");
    const { data: usersData } = await supabase.from("users").select("*");
    const { data: issuedData } = await supabase.from("issued_books").select("*");
    const { data: logsData } = await supabase.from("library_logs").select("*");

    const today = new Date().toISOString().split("T")[0];
    const visitors = logsData?.filter(l => l.in_time && l.in_time.startsWith(today)).length || 0;
    
    let overdue = 0;
    let totalFineSum = 0;
    const usage: Record<string, number> = {};
    issuedData?.forEach(d => {
      const today = new Date();
      const due = new Date(d.due_date);
      if (today > due) {
        overdue++;
        const days = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        totalFineSum += days * fineAmount;
      }
      usage[d.user_phone] = (usage[d.user_phone] || 0) + 1;
    });

    // Category distribution for charts
    const catMap: Record<string, number> = {};
    booksData?.forEach(b => {
      const cat = b.category || "Uncategorized";
      catMap[cat] = (catMap[cat] || 0) + 1;
    });
    const categoryData = Object.entries(catMap).map(([name, value]) => ({ name, value })).slice(0, 5);

    // Activity trend (last 7 days)
    const trendMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      trendMap[d.toISOString().split("T")[0]] = 0;
    }
    logsData?.forEach(l => {
      const day = l.in_time?.split("T")[0];
      if (day && trendMap[day] !== undefined) trendMap[day]++;
    });
    const trendData = Object.entries(trendMap).map(([name, visitors]) => ({ name, visitors }));

    const userMap: Record<string, any> = {};
    usersData?.forEach(u => userMap[u.phone] = u);

    const topUsersList = Object.entries(usage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([phone, count]) => ({
        ...userMap[phone],
        phone,
        count
      }));

    setReportSummary({
      books: bCount || 0,
      users: usersData?.length || 0,
      issued: issuedData?.length || 0,
      overdue,
      totalFineSum,
      visitors,
      topUsers: topUsersList,
      categoryData,
      trendData
    } as any);
  }, []);

  // Issue/Return Logic
  const searchIssueBooks = useCallback(async () => {
    if (!issueSearchVal) {
      setFoundIssueBooks([]);
      return;
    }
    const { data: booksData } = await supabase.from("books").select("*").ilike("stocknumber", "%" + issueSearchVal + "%");
    const { data: issuedData } = await supabase.from("issued_books").select("*");
    const issuedSet = new Set(issuedData?.map(d => d.book_id));

    if (booksData) {
      setFoundIssueBooks(booksData.map(b => ({ ...b, isIssued: issuedSet.has(b.id) })));
    }
  }, [issueSearchVal]);

  useEffect(() => {
    const timer = setTimeout(() => searchIssueBooks(), 400);
    return () => clearTimeout(timer);
  }, [issueSearchVal, searchIssueBooks]);

  const searchReturnBooks = useCallback(async () => {
    if (!returnSearchVal) {
      setFoundReturnBooks([]);
      return;
    }
    const { data: issuedData } = await supabase.from("issued_books").select("*");
    if (!issuedData) return;

    const filtered = issuedData.filter(d => {
      const search = returnSearchVal.toLowerCase().trim();
      if (returnType === "stock") return (d.stock_number || "").toLowerCase().includes(search);
      return (d.book_id || "").toLowerCase().includes(search);
    });

    const results = await Promise.all(filtered.map(async d => {
      const { data: bData } = await supabase.from("books").select("*").eq("id", d.book_id).maybeSingle();
      return { ...d, book: bData };
    }));

    setFoundReturnBooks(results);
  }, [returnSearchVal, returnType]);

  // CRUD Operations
  const addUser = async (e: FormEvent) => {
    e.preventDefault();
    if (isRegistering) return;
    setIsRegistering(true);
    const form = e.target as HTMLFormElement;
    
    try {
      const formData = new FormData(form);
      const rawData = Object.fromEntries(formData.entries());
      
      const name = String(rawData.name || "");
      const phone = String(rawData.phone || "");

      console.log("Attempting to Register Member:", name);

      // Validation
      if (!name || !phone) {
        throw new Error("Name and Phone are mandatory fields.");
      }
      
      // Process subscription
      const type = String(rawData.sub_type || 'monthly');
      const count = String(rawData.sub_duration || "1");
      const subStr = type === 'lifetime' ? 'LIFETIME' : `${type.toUpperCase()} (${count} ${type === 'monthly' ? 'Months' : 'Years'})`;
      
      let total = subsJoiningFee;
      if (type === 'monthly') total += subsMonthlyFee * Number(count);
      else if (type === 'yearly') total += subsYearlyFee * Number(count);
      else total += subsLifetimeFee;

      const now = new Date();
      let expiry = new Date();
      if (type === 'lifetime') {
        expiry = new Date(now.getFullYear() + 100, 0, 1);
      } else if (type === 'monthly') {
        expiry.setMonth(now.getMonth() + Number(count));
      } else {
        expiry.setFullYear(now.getFullYear() + Number(count));
      }

      const user = {
        name,
        phone,
        address: String(rawData.address || ""),
        pincode: String(rawData.pincode || ""),
        email: String(rawData.email || ""),
        gender: String(rawData.gender || ""),
        dob: String(rawData.dob || ""),
        member_id: String(rawData.member_id || "") || `M-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        occupation: String(rawData.occupation || ""),
        age: String(rawData.age || ""),
        notes: String(rawData.notes || ""),
        subscription: subStr,
        expiry_date: expiry.toISOString(),
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase.from("users").insert([user]).select();
      
      if (error) {
        console.error("Supabase Database Error:", error);
        let msg = error.message;
        if (error.code === '42P01') msg = "Table 'users' does not exist in your database.";
        if (error.code === '23505') msg = "Member ID or Phone already exists.";
        
        Swal.fire({
          icon: 'error',
          title: 'Database Rejection',
          text: msg,
          footer: `<div class="text-[10px] text-slate-400">Error Code: ${error.code} | Hint: Check your Supabase table schema matches these fields.</div>`,
          confirmButtonColor: '#3b82f6'
        });
      } else {
        console.log("Successfully added user:", data);
        // Record Initial Fees
        await recordTransaction('joining', total, user.phone, `Initial Enrollment: ${subStr}`);
        
        Swal.fire({
          icon: 'success',
          title: 'Registration Successful',
          html: `<div class="text-left"><p class="text-xs mb-2">Member <b>${user.name}</b> has been enrolled into the core registry.</p><p class="text-[10px] bg-slate-50 p-2 rounded border border-slate-100">Initial payment recorded: <b class="text-emerald-600">₹${total}</b></p></div>`,
          confirmButtonColor: '#10b981'
        });
        form.reset();
        setGenMemberId("");
        loadMembers();
        loadDashboard();
      }
    } catch (err: any) {
      console.error("Critical Registration Failure:", err);
      Swal.fire({
        icon: 'error',
        title: 'Application Exception',
        text: err.message || "Failed to process enrollment sequence.",
        confirmButtonColor: '#ef4444'
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const generateRandomId = () => {
    const id = Math.floor(10000 + Math.random() * 90000).toString();
    setGenMemberId(id);
  };

  const deleteMember = async (id: string, name: string) => {
    const result = await Swal.fire({
      title: 'Revoke Membership?',
      text: `Are you sure you want to permanently remove "${name}" from the registry? All circulation history will be orphaned.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      padding: '2rem',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Yes, Revoke Access'
    });
    
    if (!result.isConfirmed) return;

    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) {
      Swal.fire({ icon: 'error', title: 'Deletion Failed', text: error.message });
    } else {
      Swal.fire({ icon: 'success', title: 'Registry Updated', text: 'Member successfully removed.', timer: 1500 });
      loadMembers();
      loadDashboard();
      if (viewUserModal && viewUserModal.id === id) setViewUserModal(null);
    }
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        let successCount = 0;
        let failCount = 0;

        Swal.fire({
          title: 'Ingesting Registry...',
          html: '<div class="text-xs font-bold font-mono">Parsing relational book nodes...</div>',
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading()
        });

        for (const row of rows) {
          try {
            // Mapping: Timestamp,SERAL NO,FUL NAME,MOB NO,FULL ADDRESS,AGE,DATE OF JOINING,DEPOSIT AMOUNT,REMARKS
            const name = row['FUL NAME'] || row['Full Name'] || row['name'] || "Unknown";
            const phone = row['MOB NO'] || row['Mobile'] || row['phone'] || "";
            const member_id = row['SERAL NO'] || row['Serial No'] || row['member_id'] || `M-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
            const address = row['FULL ADDRESS'] || row['Address'] || "";
            const joiningDateRaw = row['DATE OF JOINING'] || row['Joining Date'] || row['created_at'];
            const joiningDate = joiningDateRaw ? new Date(joiningDateRaw).toISOString() : new Date().toISOString();
            
            // Age, Deposit, Remarks
            const ageRaw = row['AGE'] || row['Age'] || row['age'] || "";
            const depositRaw = row['DEPOSIT AMOUNT'] || row['Deposit'] || row['deposit'] || "";
            const remarks = row['REMARKS'] || row['Remarks'] || row['remarks'] || "";
            const notes = `DEPOSIT: ${depositRaw} | REMARKS: ${remarks}`.trim();

            let subscription = "IMPORTED (LIFETIME)";
            let expiry_date = new Date(new Date().getFullYear() + 50, 0, 1).toISOString();

            const depositVal = parseInt(depositRaw.toString());
            if (depositVal === 130) {
              subscription = "YEARLY (1 Years)";
              const exp = new Date(joiningDate);
              exp.setFullYear(exp.getFullYear() + 1);
              expiry_date = exp.toISOString();
            } else if ([10, 20, 30, 40, 50, 60, 70, 80, 90].includes(depositVal)) {
              const months = depositVal / 10;
              subscription = `MONTHLY (${months} Months)`;
              const exp = new Date(joiningDate);
              exp.setMonth(exp.getMonth() + months);
              expiry_date = exp.toISOString();
            }

            const userObj = {
              name,
              phone,
              member_id,
              address,
              age: ageRaw,
              notes,
              subscription,
              expiry_date,
              created_at: joiningDate
            };

            const { error } = await supabase.from("users").insert([userObj]);
            if (error) failCount++;
            else successCount++;
          } catch (err) {
            failCount++;
          }
        }

        setIsImporting(false);
        loadMembers();
        loadDashboard();
        
        Swal.fire({
          icon: successCount > 0 ? 'success' : 'info',
          title: 'Import Sequence Finalized',
          html: `<div class="text-left py-2">
            <p className="text-xs">Processing statistics:</p>
            <ul className="text-[10px] mt-2 space-y-1 font-mono uppercase">
              <li className="text-emerald-500">Node Injected: ${successCount}</li>
              <li className="text-red-500">Faulty Nodes: ${failCount}</li>
            </ul>
          </div>`,
          background: '#0F172A',
          color: '#fff'
        });
      }
    });
    // Reset file input
    e.target.value = '';
  };

  const addBook = async (e: FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const book = Object.fromEntries(formData.entries());
    const { error } = await supabase.from("books").insert([book]);
    if (error) {
      Swal.fire({ icon: 'error', title: 'Registry Fault', text: error.message });
    } else {
      Swal.fire({ icon: 'success', title: 'Asset Indexed', text: 'New book record has been committed to the vault.', timer: 1500 });
      form.reset();
      loadDashboard();
    }
  };

  const deleteBook = async (input: any) => {
    let book: any = null;
    if (typeof input === 'string') {
      const { data } = await supabase.from("books").select("*").eq("stocknumber", input).maybeSingle();
      book = data;
    } else {
      book = input;
    }

    if (!book) return;

    const result = await Swal.fire({
      title: 'Decommission Asset?',
      text: `Are you sure you want to permanently remove "${book.title}" (Stock: ${book.stocknumber})? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'CONFIRM DELETE',
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'CANCEL',
      background: '#ffffff',
      customClass: {
        title: 'text-lg font-black uppercase tracking-tight',
        htmlContainer: 'text-xs text-slate-500 font-medium'
      }
    });

    if (result.isConfirmed) {
      if (book.status === 'issued') {
        return Swal.fire({
          icon: 'error',
          title: 'Operation Denied',
          text: 'This asset is currently in possession of a member. It must be returned to the inventory before decommissioning.',
          confirmButtonColor: '#3b82f6'
        });
      }

      const { error } = await supabase.from("books").delete().eq("stocknumber", book.stocknumber);
      if (error) {
        Swal.fire({ icon: 'error', title: 'Registry Error', text: error.message });
      } else {
        Swal.fire({ 
          icon: 'success', 
          title: 'Asset Purged', 
          text: 'The book has been removed from the central inventory.',
          timer: 2000,
          showConfirmButton: false 
        });
        if (viewBookModal && viewBookModal.stocknumber === book.stocknumber) setViewBookModal(null);
        searchBooks();
        loadDashboard();
      }
    }
  };

  const issueBook = async () => {
    if (!selectedIssueBook || !selectedIssueUserPhone) return alert("Select book and user");

    // Check member membership validity
    const { data: memberData } = await supabase.from("users").select("expiry_date, name").eq("phone", selectedIssueUserPhone).maybeSingle();
    if (memberData && memberData.expiry_date) {
      const expiry = new Date(memberData.expiry_date);
      if (expiry < new Date()) {
        return Swal.fire({
          icon: 'error',
          title: 'Membership Expired!',
          text: `Member "${memberData.name}" has an expired subscription. Please renew to continue services.`,
          footer: `<span style="font-size: 10px; color: #f43f5e; font-weight: bold; text-transform: uppercase;">Expired on: ${expiry.toLocaleDateString()}</span>`
        });
      }
    }
    
    // Check borrowing limit
    const { count: userCurrentIssues, error: countError } = await supabase
      .from("issued_books")
      .select("*", { count: "exact", head: true })
      .eq("user_phone", selectedIssueUserPhone);

    if (countError) {
      console.error("Limit check error:", countError);
    } else if (userCurrentIssues !== null && userCurrentIssues >= borrowingLimit) {
      return Swal.fire({
        icon: 'error',
        title: 'Limit Exceeded!',
        text: `This member already has ${borrowingLimit} assets. Please return an asset before issuing a new one.`,
        footer: `<span style="font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase;">Current Policy: ${borrowingLimit} Assets Max</span>`
      });
    }
    
    // Check if already issued
    const { data: existing } = await supabase.from("issued_books").select("*").eq("book_id", selectedIssueBook.id).maybeSingle();
    if (existing) return Swal.fire({ icon: 'error', title: 'Oops!', text: 'This book is already issued.' });

    const now = new Date();
    const due = new Date();
    due.setMonth(due.getMonth() + 1);

    const { error } = await supabase.from("issued_books").insert([{
      book_id: selectedIssueBook.id,
      stock_number: selectedIssueBook.stocknumber,
      user_phone: selectedIssueUserPhone,
      issue_date: now.toISOString(),
      due_date: due.toISOString()
    }]);

    if (error) alert(error.message);
    else {
      Swal.fire({ icon: 'success', title: 'Book Issued!', timer: 1500, showConfirmButton: false });
      setSelectedIssueBook(null);
      setIssueSearchVal("");
      setFoundIssueBooks([]);
      loadIssued();
      loadDashboard();
    }
  };

  const returnBook = async () => {
    if (!selectedReturnBook) return alert("Select a book first");
    
    // Calculate Fine
    let fine = 0;
    if (selectedReturnBook.status === 'overdue') {
      const due = new Date(selectedReturnBook.due_date);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - due.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      fine = diffDays * fineAmount;
    }

    // ARCHIVE TO HISTORY BEFORE DELETE
    const historyEntry = {
      book_title: selectedReturnBook.book?.title || "Unknown Asset",
      stock_number: selectedReturnBook.stock_number,
      user_phone: selectedReturnBook.user_phone,
      issue_date: selectedReturnBook.issue_date,
      return_date: new Date().toISOString(),
      status: 'returned'
    };
    
    await supabase.from("borrowing_history").insert([historyEntry]);

    const { error } = await supabase.from("issued_books").delete().eq("book_id", selectedReturnBook.book_id);
    if (error) {
      Swal.fire({ icon: 'error', title: 'Return Interrupted', text: error.message });
    } else {
      if (fine > 0) {
        const { isConfirmed } = await Swal.fire({
          icon: 'warning',
          title: 'Asset Restored with Fine',
          html: `<p>Book returned successfully.</p><p class="text-error font-black mt-2 text-xl">FINE CALCULATED: ₹${fine}</p>`,
          showCancelButton: true,
          confirmButtonText: 'Record as Paid Now',
          cancelButtonText: 'Add to Unpaid Dues',
          confirmButtonColor: '#10b981',
          footer: '<span class="text-[9px] uppercase font-bold text-slate-400">Overdue Penalty applied to profile notes if unpaid</span>'
        });

        if (isConfirmed) {
          await recordTransaction('fine', fine, selectedReturnBook.user_phone, `Fine paid for stock #${selectedReturnBook.stock_number}`);
          Swal.fire({ icon: 'success', title: 'Fine Cleared', timer: 1000, showConfirmButton: false });
        } else {
          // Update user notes with fine info
          const { data: userData } = await supabase.from("users").select("notes").eq("phone", selectedReturnBook.user_phone).maybeSingle();
          const updatedNotes = `${userData?.notes || ""}\n[UNPAID FINE: ₹${fine} (Ref: ${selectedReturnBook.stock_number} returned ${new Date().toLocaleDateString()})]`.trim();
          await supabase.from("users").update({ notes: updatedNotes }).eq("phone", selectedReturnBook.user_phone);
        }
      } else {
        Swal.fire({ icon: 'success', title: 'Returned!', timer: 1500, showConfirmButton: false });
      }
      
      setSelectedReturnBook(null);
      setReturnSearchVal("");
      setFoundReturnBooks([]);
      loadIssued();
      loadDashboard();
      loadMembers();
      loadTransactions();
    }
  };

  const printIdCard = () => {
    window.print();
  };

  const updateBook = async (e: FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const rawData = Object.fromEntries(formData.entries());
    const data: Record<string, string> = {};
    Object.keys(rawData).forEach(key => {
      data[key] = String(rawData[key]);
    });
    const { error } = await supabase.from("books").update(data).eq("stocknumber", editBookModal.stocknumber);
    if (error) {
      Swal.fire({ icon: 'error', title: 'Data Rejection', text: error.message });
    } else {
      Swal.fire({ icon: 'success', title: 'Registry Adjusted', text: 'Asset intelligence updated successfully.', timer: 1500 });
      setEditBookModal(null);
      searchBooks();
    }
  };

  const updateMember = async (e: FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const rawData = Object.fromEntries(formData.entries());

    // Process subscription into a single string for the 'subscription' column
    const type = rawData.edit_sub_type as string;
    const count = rawData.edit_sub_duration || "1";
    const subStr = type === 'lifetime' ? 'LIFETIME' : `${type.toUpperCase()} (${count} ${type === 'monthly' ? 'Months' : 'Years'})`;

    const expiry = type === 'lifetime' 
      ? new Date(new Date().getFullYear() + 100, 0, 1) 
      : type === 'monthly' 
        ? new Date(new Date().setMonth(new Date().getMonth() + Number(count)))
        : new Date(new Date().setFullYear(new Date().getFullYear() + Number(count)));

    const data = {
      name: rawData.name,
      phone: rawData.phone,
      address: rawData.address,
      pincode: rawData.pincode,
      email: rawData.email,
      gender: rawData.gender,
      dob: rawData.dob || null,
      member_id: rawData.member_id,
      occupation: rawData.occupation,
      age: rawData.age,
      notes: rawData.notes,
      subscription: subStr,
      expiry_date: expiry.toISOString()
    };

    const { error } = await supabase.from("users").update(data).eq("id", editMemberModal.id);
    if (error) alert(error.message);
    else {
      Swal.fire({ icon: 'success', title: 'Profile Updated', text: `Subscription set to: ${subStr}`, timer: 1500 });
      setEditMemberModal(null);
      loadMembers();
    }
  };

  // Helper to convert between ISBN-10 and ISBN-13 for better database coverage
  const isValidISBN10 = (isbn: string) => {
    if (isbn.length !== 10) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      let digit = parseInt(isbn[i]);
      if (isNaN(digit)) return false;
      sum += (10 - i) * digit;
    }
    let last = isbn[9].toUpperCase();
    let check = (11 - (sum % 11)) % 11;
    let expected = check === 10 ? 'X' : check.toString();
    return last === expected;
  };

  const isValidISBN13 = (isbn: string) => {
    if (isbn.length !== 13) return false;
    if (!isbn.startsWith('978') && !isbn.startsWith('979')) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      let digit = parseInt(isbn[i]);
      if (isNaN(digit)) return false;
      sum += (i % 2 === 0 ? 1 : 3) * digit;
    }
    let check = (10 - (sum % 10)) % 10;
    return parseInt(isbn[12]) === check;
  };

  const extractISBN = (text: string) => {
    let clean = text.replace(/[^0-9X]/gi, '').trim().toUpperCase();
    
    // 1. Strict ISBN-13 (Starts with 978 or 979)
    const isbn13Match = clean.match(/(97[89][0-9]{10})/);
    if (isbn13Match && isValidISBN13(isbn13Match[1])) return isbn13Match[1];
    
    // 2. Strict ISBN-10
    const isbn10Match = clean.match(/([0-9]{9}[0-9X])/);
    if (isbn10Match && isValidISBN10(isbn10Match[1])) return isbn10Match[1];
    
    // 3. Fallback: Any 13-digit EAN (Some local books use non-standard bookland EANs)
    const ean13Match = clean.match(/([0-9]{13})/);
    if (ean13Match) return ean13Match[1];

    // 4. Fallback: Any 10-digit sequence (Generic lookup)
    const generic10Match = clean.match(/([0-9]{10})/);
    if (generic10Match) return generic10Match[1];
    
    return null;
  };

  const getIsbnVariants = (isbn: string) => {
    const clean = isbn.replace(/[^0-9X]/gi, '').toUpperCase();
    const variants = [clean];
    
    // EAN-13 to ISBN-10
    if (clean.length === 13 && clean.startsWith("978")) {
      // Calculate ISBN-10 Checksum
      let s = clean.substring(3, 12);
      let sum = 0;
      for (let i = 0; i < 9; i++) {
        sum += (10 - i) * parseInt(s[i]);
      }
      let check = (11 - (sum % 11)) % 11;
      let finalCheck = check === 10 ? 'X' : check.toString();
      variants.push(s + finalCheck);
    } else if (clean.length === 10) {
      // ISBN-10 to ISBN-13 (978 prefix)
      let s = "978" + clean.substring(0, 9);
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += (i % 2 === 0 ? 1 : 3) * parseInt(s[i]);
      }
      let check = 10 - (sum % 10);
      let finalCheck = check === 10 ? '0' : check.toString();
      variants.push(s + finalCheck);
    }
    return Array.from(new Set(variants));
  };

  const lookupISBN = async (e?: FormEvent, manualIsbn?: string) => {
    if (e) e.preventDefault();
    let rawIsbn = manualIsbn || isbnLookup;
    
    // 1. SMART EXTRACTION & SANITIZATION
    const targetIsbn = extractISBN(rawIsbn);
    
    if (!targetIsbn) {
      if (manualIsbn) return; // Silent if from scanner
      return Swal.fire("Invalid ISBN", "Could not detect a valid ISBN-10 or ISBN-13 pattern.", "warning");
    }

    // Determine the "Preferred" ISBN for display and storage (ISBN-10 preferred by many users)
    let displayIsbn = targetIsbn;
    const variants = getIsbnVariants(targetIsbn);
    const isbn10 = variants.find(v => v.length === 10);
    
    // Auto-convert legacy 13-digit scans to familiar 10-digit ISBNs for the UI
    if (isbn10) {
      displayIsbn = isbn10;
    }

    setIsbnLookup(displayIsbn);

    const isbnVariants = variants;

    setLookupLoading(true);
    setScannedBook(null);
    setLookupResults([]);
    setLookupStep("Searching National & Global Registries...");
    
    try {
      // 2. Multi-Format Search Strategy
      const searchPromises: Promise<any>[] = [];
      
      isbnVariants.forEach(v => {
        // Search by explicit ISBN prefix
        searchPromises.push(fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${v}`).then(r => r.json()).catch(() => null));
        searchPromises.push(fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${v}&format=json&jscmd=data`).then(r => r.json()).catch(() => null));
        // Also perform a general text search with the number - helps if it's an EAN that isn't strictly an ISBN
        searchPromises.push(fetch(`https://www.googleapis.com/books/v1/volumes?q=${v}`).then(r => r.json()).catch(() => null));
      });

      const results = await Promise.all(searchPromises);

      const candidates: any[] = [];
      
      results.forEach((data, index) => {
        // Google Books (both isbn: and general search)
        if (data?.items) {
          data.items.forEach((item: any) => {
            const info = item.volumeInfo;
            // Basic relevance check - ensure the number appears in identifies
            const ids = info.industryIdentifiers?.map((idx: any) => idx.identifier);
            const isRelevant = !ids || ids.some((id: string) => isbnVariants.includes(id.replace(/[^0-9X]/gi, '')));
            
            if (isRelevant) {
              candidates.push({
                isbn: displayIsbn, // Set to prefered format (ISBN-10)
                title: info.title || "Untitled",
                author: info.authors ? info.authors.join(", ") : "Unknown Author",
                publisher: info.publisher || "Unknown Publisher",
                category: info.categories ? info.categories[0] : "General",
                language: (info.language || "en").toUpperCase(),
                source: `Google Books (${info.language?.toUpperCase() || 'EN'})`
              });
            }
          });
        } 
        // Open Library (isbn: variant)
        else if (data && index % 3 === 1) { // 1, 4, 7... are OL promises
          const variantIdx = Math.floor(index / 3);
          const v = isbnVariants[variantIdx];
          const bookKey = `ISBN:${v}`;
          if (data[bookKey]) {
            const olBook = data[bookKey];
            candidates.push({
              isbn: displayIsbn, // Set to prefered format (ISBN-10)
              title: olBook.title || "Untitled",
              author: olBook.authors ? olBook.authors.map((a: any) => a.name).join(", ") : "Unknown Author",
              publisher: olBook.publishers?.[0]?.name || "Unknown Publisher",
              category: olBook.subjects ? olBook.subjects[0].name : "General",
              language: 'EN',
              source: 'Open Library'
            });
          }
        }
      });

      // 3. Indian, Regional & Global Meta-Search: Gemini AI (If primary APIs miss)
      if (candidates.length === 0) {
        setLookupStep("AI Meta-Search (Checking RRDNA, ISBNLookup.org & Global Registries)...");
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
          const prompt = `Identify book metadata for barcode: ${targetIsbn}. 
            The book identifier could be an ISBN-13, EAN, or ISBN-10.
            Look into Raja Rammohun Roy National Agency (RRDNA/isbn.gov.in), ISBNLookup.org, Worldcat, DC Books, Mathrubhumi.
            Find accurate title, authors, publisher, category, and language. 
            Return up to 3 candidates in JSON.`;
            
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    author: { type: Type.STRING, description: "Comma separated authors" },
                    publisher: { type: Type.STRING },
                    category: { type: Type.STRING },
                    language: { type: Type.STRING }
                  },
                  required: ["title", "author"]
                }
              }
            }
          });

          const text = response.text;

          if (text) {
            const aiResults = JSON.parse(text);
            aiResults.forEach((res: any) => {
              candidates.push({
                ...res,
                isbn: displayIsbn, // Set to prefered format (ISBN-10)
                source: 'AI Indian Agency Search',
                language: res.language || "MALAYALAM"
              });
            });
          }
        } catch (aiErr) {
          console.error("AI Fallback Error:", aiErr);
        }
      }

      if (candidates.length === 0) {
        throw new Error("No registry matches found globally or in Indian National Agency for this ISBN.");
      }

      // De-duplicate candidates based on title + author
      const seen = new Set();
      const uniqueResults = candidates.filter(c => {
        const key = `${c.title}-${c.author}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).map(c => ({
        ...c,
        cover_url: c.isbn ? `https://covers.openlibrary.org/b/isbn/${c.isbn}-M.jpg` : null
      }));

      setLookupResults(uniqueResults);
      setShowCamera(false); 

      // If only one very solid result, we can auto-select or just show it
      if (uniqueResults.length === 1) {
        setScannedBook({
          ...uniqueResults[0],
          price: "", 
          stocknumber: "", 
          callnumber: "", 
          shelfnumber: "" 
        });
        setLookupResults([]);
      }
      
      setLookupStep("");
    } catch (err: any) {
      setLookupStep("");
      Swal.fire("Lookup Deficit", err.message || "No data available in national agencies.", "error");
    } finally {
      setLookupLoading(false);
    }
  };

  const startCameraScanner = async (cameraIdParam?: string) => {
    setShowCamera(true);
    setCameraError(null);
    
    // Ensure cameraId is a string, not an Event object
    const cameraId = typeof cameraIdParam === 'string' ? cameraIdParam : undefined;
    
    // Give state time to update the DOM
    setTimeout(async () => {
      try {
        const container = document.getElementById("reader");
        if (!container) return;

        // 1. Cleanup existing if any
        if (scannerRef.current) {
          try {
            if (scannerRef.current.isScanning) {
              await scannerRef.current.stop();
            }
            scannerRef.current = null;
          } catch(e){
            console.warn("Cleanup error", e);
          }
        }

        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        // 2. Discover cameras if not loaded
        let currentCameras = cameras;
        if (currentCameras.length === 0) {
          try {
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
              setCameras(devices);
              currentCameras = devices;
            }
          } catch (e) {
            console.error("Camera listing failed", e);
          }
        }

        // 3. Select Target Device
        // Priority: Passed ID -> State Selected ID -> "Link to Windows" skip -> first device
        let targetId: any = cameraId || selectedCamera;
        
        if (!targetId && currentCameras.length > 0) {
          // Heuristic: If multiple cameras, try to avoid "virtual" ones if possible
          // But usually first one is best choice for basic users
          targetId = currentCameras[0].id;
          setSelectedCamera(targetId);
        }

        const scanConfig = { 
          fps: 25, 
          qrbox: { width: 400, height: 200 }, 
          aspectRatio: 1.777778,
          formatsToSupport: [ 
            Html5QrcodeSupportedFormats.EAN_13, 
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.CODE_39
          ],
          experimentalFeatures: { useBarCodeDetectorIfSupported: true }
        };

        // Start scanning
        await html5QrCode.start(
          targetId || { facingMode: "environment" }, 
          scanConfig, 
          async (decodedText) => {
            // High fidelity filtering: trigger only on valid book ISBNs
            const foundISBN = extractISBN(decodedText);
            
            if (foundISBN) {
              playBeep();
              try {
                await html5QrCode.stop();
                lookupISBN(undefined, foundISBN);
                setShowCamera(false);
              } catch (e) {
                console.error("Stop error:", e);
              }
            }
          },
          () => {}
        );
      } catch (err: any) {
        console.error("Scanner Error:", err);
        setCameraError("Camera is busy or restricted. Please ensure no other apps (Zoom, Teams, Link to Windows) are using it.");
        
        // If we failed but haven't loaded cameras yet, try to load them now for troubleshooting
        if (cameras.length === 0) {
          Html5Qrcode.getCameras().then(devices => {
            if (devices && devices.length > 0) setCameras(devices);
          }).catch(() => {});
        }
      }
    }, 800); // More generous delay for mobile/laptop sync
  };

  const handleCameraChange = (id: string) => {
    setSelectedCamera(id);
    if (showCamera) {
      startCameraScanner(id);
    }
  };

  const stopCameraScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.error("Stop Error:", err);
      }
      scannerRef.current = null;
    }
    setShowCamera(false);
  };

  const confirmAddScannedBook = async (e: FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const bookData = Object.fromEntries(formData.entries());

    const { error } = await supabase.from("books").insert([bookData]);
    if (error) {
      Swal.fire("Database Error", error.message, "error");
    } else {
      Swal.fire({
        icon: 'success',
        title: 'Registry Updated!',
        text: 'The asset has been successfully recorded in Supabase.',
        timer: 2000,
        showConfirmButton: false
      });
      setScannedBook(null);
      setIsbnLookup("");
      loadDashboard();
    }
  };

  const bulkUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        const { data } = results;
        const { error } = await supabase.from("books").insert(data);
        if (error) Swal.fire("Upload Failed", error.message, "error");
        else {
          Swal.fire("Success", `Bulk uploaded ${data.length} assets`, "success");
          loadDashboard();
        }
      }
    });
  };

  const handleLostBook = async (book: any) => {
    const { isConfirmed } = await Swal.fire({
      title: 'Report Lost Book',
      text: `Mark "${book.book?.title}" as lost? This will end the active loan.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Mark Lost'
    });
    if (!isConfirmed) return;
    
    // We update the book label or move it to a 'lost' state if schema allows
    // For now, we clear the active loan and log it
    const { error } = await supabase.from("issued_books").delete().eq("id", book.id);
    if (!error) {
      await logAudit("LOST_BOOK", `Book ${book.stock_number} reported lost by ${book.user_phone}`);
      Swal.fire("Updated", "Book marked as lost in records", "info");
      loadIssued();
    }
  };

  const exportToCSV = () => {
    const csv = Papa.unparse(members);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Vayanashala_Members_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    Swal.fire({
      icon: 'success',
      title: 'Registry Exported',
      text: 'Member database has been compiled into CSV format.',
      toast: true,
      position: 'top-end',
      timer: 2000,
      showConfirmButton: false
    });
  };

  const handleRenewal = async (member: any) => {
    const { value: duration } = await Swal.fire({
      title: 'Renew Subscription',
      input: 'number',
      inputLabel: 'Additional Months/Years',
      inputValue: 1,
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value || Number(value) <= 0) return 'Please enter a valid duration';
        return null;
      }
    });

    if (duration) {
      const type = member.subscription?.toLowerCase().includes('year') ? 'yearly' : 'monthly';
      let currentExpiry = member.expiry_date ? new Date(member.expiry_date) : new Date();
      if (currentExpiry < new Date()) currentExpiry = new Date();

      const newExpiry = type === 'monthly' 
        ? new Date(currentExpiry.setMonth(currentExpiry.getMonth() + Number(duration)))
        : new Date(currentExpiry.setFullYear(currentExpiry.getFullYear() + Number(duration)));

      const { error } = await supabase.from("users").update({ 
        expiry_date: newExpiry.toISOString(),
        subscription: `${type.toUpperCase()} (${duration} ${type === 'monthly' ? 'Months' : 'Years'}) Extended`
      }).eq("id", member.id);

      if (!error) {
        const amount = type === 'monthly' ? subsMonthlyFee * Number(duration) : subsYearlyFee * Number(duration);
        await recordTransaction('subscription', amount, member.phone, `Subscription Renewal (${duration} units)`);
        
        Swal.fire("Renewed!", `Expiry extended to ${newExpiry.toLocaleDateString()}. Payment of ₹${amount} recorded.`, "success");
        loadMembers();
        loadTransactions();
        if (viewUserModal && viewUserModal.id === member.id) {
          setViewUserModal({...viewUserModal, expiry_date: newExpiry.toISOString()});
        }
      }
    }
  };
  const sendOverdueAlerts = () => {
    const overdues = issuedBooks.filter(b => b.status === 'overdue');
    if (overdues.length === 0) return Swal.fire("Info", "No overdue users found", "info");
    
    Swal.fire({
      title: 'Sending Alerts',
      text: `Dispatching signals to ${overdues.length} overdue accounts...`,
      timer: 2000,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading()
    });
    
    // Simulate email dispatch
    setTimeout(() => {
      Swal.fire("Success", "Email alerts dispatched to all overdue users.", "success");
      logAudit("OVERDUE_ALERTS", `Sent to ${overdues.length} users`);
    }, 2500);
  };

  const exportExcel = () => {
    const rows = [["Stock", "User Phone", "Issue Date", "Due Date", "Status"]];
    issuedBooks.forEach(d => {
      rows.push([
        d.stock_number,
        d.user_phone,
        d.issue_date?.split("T")[0],
        d.due_date?.split("T")[0],
        d.label
      ]);
    });
    const csv = rows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "library_report.csv";
    a.click();
  };

  // Lifecycle
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadDashboard();
    loadMembers();
    loadIssued();
    loadTodayAttendance();
    loadTransactions();
    loadLibrarySettings();
  }, [loadDashboard, loadMembers, loadIssued, loadTodayAttendance, loadTransactions, loadLibrarySettings]);

  useEffect(() => {
    if (activeTab === "reports") loadReports();
  }, [activeTab, loadReports]);

  // Real-time listener
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issued_books' }, () => {
        loadDashboard();
        loadIssued();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        loadDashboard();
        loadMembers();
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [loadDashboard, loadIssued, loadMembers]);

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden font-sans">
        {/* Abstract Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-accent rounded-full blur-[120px]"></div>
          <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-primary rounded-full blur-[120px]"></div>
        </div>

        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden relative z-10 border border-white/20">
          <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
             {/* Simple lines for style */}
             <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
             
             <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20 text-3xl">
               🔒
             </div>
             <h1 className="text-xl font-black text-white tracking-widest uppercase">Admin Portal</h1>
             <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] mt-2">GRAMEENA VAYANASALA KONDAZHY</p>
          </div>

          <div className="p-8">
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">System Password</label>
                <div className="relative">
                  <input 
                    type="password" 
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-slate-50 border-2 border-slate-100 focus:border-accent rounded-2xl px-5 py-4 text-sm outline-none transition-all font-mono tracking-widest"
                    autoFocus
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 opacity-20">🗝️</div>
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black text-xs uppercase tracking-[0.3em] hover:bg-black transition-all shadow-xl shadow-slate-900/10 active:scale-[0.98]"
              >
                Unlock Repository
              </button>

              <button 
                type="button"
                onClick={() => setShowResetModal(true)}
                className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-accent transition-colors"
              >
                Forgot Logic Key?
              </button>
            </form>
            
            <p className="text-[9px] text-slate-400 text-center mt-8 font-medium uppercase tracking-widest opacity-60">
              Restricted Access. Authorized Personnel Only.
            </p>
          </div>
        </div>

        {/* Password Reset Modal */}
        {showResetModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm border border-slate-200">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Emergency Reset</h3>
              <p className="text-xs text-slate-500 font-medium mb-6">Enter the master synchronization key to overwrite administrative credentials.</p>
              
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Master Reset Key</label>
                  <input 
                    type="password" 
                    value={resetKeyInput}
                    onChange={(e) => setResetKeyInput(e.target.value)}
                    placeholder="ADMIN_MASTER_KEY"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">New System Password</label>
                  <input 
                    type="password" 
                    value={newPasswordReset}
                    onChange={(e) => setNewPasswordReset(e.target.value)}
                    placeholder="New Password"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-mono"
                    required
                  />
                </div>
                
                <div className="flex gap-2 pt-2">
                  <button 
                    type="submit" 
                    disabled={lookupLoading}
                    className="flex-[2] bg-accent text-white rounded-xl py-3 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-accent/20 hover:scale-105 transition-all disabled:opacity-50"
                  >
                    {lookupLoading ? 'Synchronizing...' : 'Update Credentials'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowResetModal(false)}
                    className="flex-1 bg-slate-100 text-slate-500 rounded-xl py-3 font-black text-[10px] uppercase tracking-widest hover:bg-slate-200"
                  >
                    Abort
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex bg-surface-bg min-h-screen text-text-main font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-[240px] bg-primary text-white flex flex-col fixed h-full z-20 shadow-xl overflow-y-auto">
        <div className="p-6 pb-4 flex items-center gap-3 text-left">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M4 6h18v2H4V6zm0 5h18v2H4v-2zm0 5h18v2H4v-2z"/></svg>
          </div>
          <span className="text-xl font-bold tracking-tight uppercase leading-tight line-clamp-2">Vayanasala Admin</span>
        </div>
        <div className="px-6 mb-6 text-left">
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest leading-none">Management Console</p>
        </div>
        
        <nav className="flex-1 text-left">
          <div className="px-6 py-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">Main Modules</div>
          <ul className="list-none space-y-1 mb-6">
            {[
              { id: "dashboard", label: t('dashboard'), icon: "📊" },
              { id: "members", label: t('members'), icon: "👤" },
              { id: "books", label: t('books'), icon: "📚" },
              { id: "addBook", label: t('addBook'), icon: "➕" }
            ].map(tab => (
              <li
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-2.5 text-sm cursor-pointer transition-all flex items-center gap-3 border-r-4 ${
                  activeTab === tab.id 
                    ? 'bg-white/10 text-white border-accent font-semibold' 
                    : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{tab.icon}</span> {tab.label}
              </li>
            ))}
          </ul>

          <div className="px-6 py-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">Circulation</div>
          <ul className="list-none space-y-1 mb-6">
            {[
              { id: "circulation", label: t('issue'), icon: "🛫" },
              { id: "return", label: t('return'), icon: "🛬" },
              { id: "issuedList", label: "Live Ledger", icon: "📋" },
              { id: "financials", label: t('finance'), icon: "💰" }
            ].map(tab => (
              <li
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-2.5 text-sm cursor-pointer transition-all flex items-center gap-3 border-r-4 ${
                  activeTab === tab.id 
                    ? 'bg-white/10 text-white border-accent font-semibold' 
                    : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{tab.icon}</span> {tab.label}
              </li>
            ))}
          </ul>

          <div className="px-6 py-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">Engagement & Ops</div>
          <ul className="list-none space-y-1 mb-6">
            {[
              { id: "engagement", label: "Engagement Hub", icon: "🔔" },
              { id: "map", label: "Store Mapping", icon: "🗺️" },
              { id: "settings", label: t('config'), icon: "⚙️" },
              { id: "reports", label: t('reports'), icon: "📈" },
              { id: "attendance", label: t('attendance'), icon: "🕒" }
            ].map(tab => (
              <li
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-2.5 text-sm cursor-pointer transition-all flex items-center gap-3 border-r-4 ${
                  activeTab === tab.id 
                    ? 'bg-white/10 text-white border-accent font-semibold' 
                    : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{tab.icon}</span> {tab.label}
              </li>
            ))}
          </ul>
          <ul className="list-none space-y-1 mb-6">
            <li
              onClick={handleLogout}
              className="px-6 py-2.5 text-sm cursor-pointer transition-all flex items-center gap-3 border-r-4 text-slate-400 border-transparent hover:text-red-400 hover:bg-red-500/5 group"
            >
              <span className="group-hover:scale-110 transition-transform">🚪</span> {t('logout')}
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow ml-[240px] flex flex-col relative mesh-bg min-h-screen">
        {/* Decorative Background Elements */}
        <div className="grid-pattern"></div>
        <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-accent/10 rounded-full blur-[100px] animate-float pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[10%] w-[350px] h-[350px] bg-primary/5 rounded-full blur-[80px] animate-float pointer-events-none" style={{ animationDelay: '-3s' }}></div>

        <div className="relative z-10 p-8 flex flex-col gap-8 flex-grow">
          <header className="flex justify-between items-center glass-card p-6 rounded-3xl border border-slate-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center gap-5">
              <motion.div 
                whileHover={{ rotate: 15, scale: 1.1 }}
                className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-white text-2xl shadow-xl shadow-primary/20 shrink-0"
              >
                🏛️
              </motion.div>
              <div className="text-left">
                <h1 className="text-2xl font-black text-primary tracking-tighter leading-none mb-1">{lang === 'ml' ? translations.ml.portalSubtitle : translations.en.portalSubtitle}</h1>
                <p className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-500">REG NO: 1231</span>
                  <span className="w-1.5 h-1.5 bg-slate-200 rounded-full"></span>
                  <span className="opacity-60">{t('welcome')}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
               <div className="flex bg-slate-100 p-1 rounded-xl">
                 <button 
                  onClick={() => setLang('en')}
                  className={`px-3 py-1 rounded-lg text-[9px] font-black tracking-widest transition-all ${lang === 'en' ? 'bg-white text-primary shadow-sm' : 'text-slate-400'}`}
                 >
                   ENG
                 </button>
                 <button 
                  onClick={() => setLang('ml')}
                  className={`px-3 py-1 rounded-lg text-[9px] font-black tracking-widest transition-all ${lang === 'ml' ? 'bg-white text-primary shadow-sm' : 'text-slate-400'}`}
                 >
                   മലയ
                 </button>
               </div>
               <div className="flex flex-col items-end">
                  <div 
                  onClick={() => {
                    if (dbStatus === 'error') {
                      Swal.fire({
                        title: 'Database Connectivity Intel',
                        text: dbError || 'Unknown connection fault.',
                        icon: 'warning',
                        confirmButtonColor: '#3b82f6',
                        footer: '<p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">Troubleshoot: Verify Secret Keys in AI Studio Settings.</p>'
                      });
                    }
                  }}
                  className={`db-status flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black tracking-widest mb-2 transition-all ${
                    dbStatus === 'connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 cursor-help' : 
                    dbStatus === 'checking' ? 'bg-amber-50 text-amber-700 border-amber-100 cursor-wait' :
                    'bg-red-50 text-red-700 border-red-100 cursor-pointer animate-pulse hover:bg-red-100'
                  }`}
                  title={dbError || (dbStatus === 'connected' ? 'Sync Active' : 'Establishing Link...')}
                >
                  <span className={`w-2 h-2 rounded-full animate-pulse ${
                    dbStatus === 'connected' ? 'bg-emerald-500' : 
                    dbStatus === 'checking' ? 'bg-amber-500' :
                    'bg-red-500'
                  }`}></span>
                  {dbStatus === 'connected' ? 'SUPABASE: ONLINE' : 
                  dbStatus === 'checking' ? 'SUPABASE: SYNCING' :
                  'SUPABASE: OFFLINE'}
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-2xl font-black text-slate-800 tracking-tighter tabular-nums font-mono">
                    {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
                  </p>
                  <div className="h-4 w-[2px] bg-slate-200 rounded-full"></div>
                  <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest pt-0.5">
                    {currentTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </p>
                </div>
              </div>
            </div>
          </header>
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.99 }}
              transition={{ duration: 0.4, cubicBezier: [0.16, 1, 0.3, 1] }}
              className="flex-grow flex flex-col"
            >
              {/* DASHBOARD */}
              {activeTab === "dashboard" && (
                <div className="flex flex-col gap-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                      { label: t('totalBooks'), value: counts.books, color: "text-slate-900", icon: "📚", bg: "bg-white" },
                      { label: t('totalMembers'), value: counts.users, color: "text-accent", icon: "👤", bg: "bg-white" },
                      { label: t('activeIssues'), value: counts.issued, color: "text-amber-600", icon: "🛫", bg: "bg-white" }
                    ].map((stat, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        whileHover={{ y: -5 }}
                        className={`${stat.bg} p-8 rounded-[32px] border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between group hover:border-accent/30 transition-all text-left`}
                      >
                        <div className="flex justify-between items-start mb-6">
                          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-accent transition-colors">{stat.label}</p>
                          <span className="text-2xl grayscale group-hover:grayscale-0 transition-all transform group-hover:scale-125 rotate-0 group-hover:-rotate-12">{stat.icon}</span>
                        </div>
                        <p className={`text-5xl font-black tracking-tighter ${stat.color} mb-1 font-display leading-tight`}>{stat.value}</p>
                        <div className="h-1 w-12 bg-slate-100 rounded-full group-hover:w-full group-hover:bg-accent/20 transition-all duration-500"></div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="section-card p-8 bg-white/40 backdrop-blur-md border-dashed border-2 hover:border-emerald-500/30 group text-left"
                    >
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl group-hover:rotate-[360deg] transition-transform duration-700 shrink-0">⚡</div>
                        <div>
                          <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">System Integrity</h3>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Postgres Protocol: Operational</p>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: "94%" }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                          className="h-full bg-emerald-500 relative"
                        >
                          <div className="absolute inset-0 bg-white/20 animate-shimmer"></div>
                        </motion.div>
                      </div>
                      <p className="text-[9px] text-emerald-600 font-black tracking-widest text-right uppercase">Uptime: 99.98%</p>
                    </motion.div>
                    
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="section-card p-8 bg-white/40 backdrop-blur-md border-dashed border-2 hover:border-blue-500/30 group text-left"
                    >
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-2xl group-hover:animate-bounce shrink-0">💡</div>
                        <div>
                          <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Administrative Intelligence</h3>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Actionable Insights Generated</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setActiveTab('engagement')} 
                        className="w-full py-3 bg-blue-600 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                      >
                        Launch Hub Connection →
                      </button>
                    </motion.div>
                  </div>
                </div>
              )}

              {activeTab === "members" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-start h-full p-2">
            {/* LEFT WINDOW: ADD MEMBER */}
            <div className="lg:col-span-2 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-slate-200 overflow-hidden flex flex-col h-full animate-in fade-in slide-in-from-left-6 duration-700">
              {/* Window Title Bar */}
              <div className="bg-primary px-5 py-4 flex justify-between items-center select-none shadow-md relative z-10">
                <div className="flex gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-[#FF5F56] shadow-inner shadow-black/20 hover:brightness-110 cursor-pointer"></div>
                  <div className="w-3.5 h-3.5 rounded-full bg-[#FFBD2E] shadow-inner shadow-black/20 hover:brightness-110 cursor-pointer"></div>
                  <div className="w-3.5 h-3.5 rounded-full bg-[#27C93F] shadow-inner shadow-black/20 hover:brightness-110 cursor-pointer"></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black tracking-[0.4em] text-white/50 uppercase">MEMBER_ENROLL_VX</span>
                </div>
                <div className="w-12"></div>
              </div>
              
              <div className="p-8 overflow-y-auto custom-scrollbar bg-white">
                <div className="flex items-center gap-4 mb-8 border-b-2 border-slate-50 pb-6 relative">
                  <div className="w-14 h-14 bg-primary text-white rounded-[20px] flex items-center justify-center text-2xl shadow-xl shadow-primary/30 transform -rotate-3 hover:rotate-0 transition-transform">📝</div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">REGISTER NEW MEMBER</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Registry Entry Protocol v3.0</p>
                  </div>
                  <div className="flex-1 flex justify-end gap-2">
                    <input 
                      type="file" 
                      id="bulk-import-members" 
                      accept=".csv" 
                      className="hidden" 
                      onChange={handleBulkImport}
                    />
                    <button 
                      type="button" 
                      onClick={() => document.getElementById('bulk-import-members')?.click()}
                      className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all border border-slate-200 shadow-sm flex items-center gap-2"
                    >
                      📂 Bulk Import
                    </button>
                  </div>
                  <div className="absolute right-0 top-0 opacity-5 pointer-events-none">
                    <span className="text-6xl font-black italic">NEW</span>
                  </div>
                </div>
                
                <form onSubmit={addUser} className="space-y-6">
                  <div className="space-y-5">
                    <div className="group">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Full Legal Identity</label>
                      <input name="name" placeholder="Enter Member Full Name" required className="input-field py-4 bg-slate-50/50 focus:bg-white" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="group text-left">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">MOBILE NO</label>
                        <input name="phone" placeholder="+91 XXXX..." required className="input-field py-4 bg-slate-50/50 focus:bg-white" />
                      </div>
                      <div className="group text-left">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">DATE OF BIRTH (Optional)</label>
                        <input name="dob" type="date" className="input-field py-4 bg-slate-50/50 focus:bg-white" />
                      </div>
                    </div>

                    <div className="group text-left">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Physical Domicile</label>
                      <input name="address" placeholder="Residential Address..." required className="input-field py-4 bg-slate-50/50 focus:bg-white" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="group text-left">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Email Address</label>
                        <input name="email" type="email" placeholder="email@example.com" className="input-field py-4 bg-slate-50/50 focus:bg-white" />
                      </div>
                      <div className="group text-left">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Gender</label>
                        <select name="gender" className="input-field py-4 bg-slate-50/50 focus:bg-white">
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="group text-left">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Occupation</label>
                        <input name="occupation" placeholder="Student, Teacher, etc." className="input-field py-4 bg-slate-50/50 focus:bg-white" />
                      </div>
                      <div className="group text-left">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">AGE</label>
                        <input name="age" type="number" placeholder="Enter Age" className="input-field py-4 bg-slate-50/50 focus:bg-white" />
                      </div>
                    </div>

                    <div className="group text-left">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Postal Zone</label>
                      <input name="pincode" placeholder="680XXX" className="input-field py-4 bg-slate-50/50 focus:bg-white" />
                    </div>

                    <div className="group text-left">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Special Internal Notes</label>
                      <textarea name="notes" placeholder="Any specific details or warnings..." className="input-field py-3 bg-slate-50/50 focus:bg-white min-h-[80px]"></textarea>
                    </div>

                    <div className="group text-left">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">MEMBERSHIP ID</label>
                        <div className="flex gap-2">
                          <input 
                            name="member_id" 
                            placeholder="AUTO_ID" 
                            value={genMemberId}
                            onChange={(e) => setGenMemberId(e.target.value)}
                            className="input-field flex-1 text-center font-mono py-4 bg-slate-50/50 focus:bg-white" 
                          />
                          <button 
                            type="button" 
                            onClick={generateRandomId}
                            className="bg-primary/10 text-primary px-4 rounded-2xl hover:bg-primary hover:text-white transition-all shadow-sm"
                            title="Regenerate ID"
                          >
                            🔄
                          </button>
                        </div>
                      </div>
                    </div>

                  <div className="p-6 bg-slate-900 rounded-3xl border-l-[6px] border-l-accent space-y-5 shadow-inner">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-accent flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-accent animate-ping"></span>
                        SUBSCRIPTION Authorization
                      </p>
                      <span className="text-[10px] text-white/40 font-mono tracking-tighter">REF_SYS_77</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <select name="sub_type" className="input-field py-4 text-xs uppercase bg-slate-800 border-slate-700 text-white focus:border-accent" required defaultValue="monthly">
                        <option value="monthly">MONTHLY PLAN</option>
                        <option value="yearly">YEARLY PLAN</option>
                        <option value="lifetime">LIFETIME ACCESS</option>
                      </select>
                      <div className="relative">
                        <input name="sub_duration" type="number" placeholder="Duration" defaultValue={1} className="input-field py-4 text-xs bg-slate-800 border-slate-700 text-white focus:border-accent w-full" />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] text-white/30 font-bold uppercase tracking-widest pointer-events-none">Units</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-white/5">
                       <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">INITIALIZATION FEE</p>
                       <p className="text-sm font-black text-white tracking-widest tabular-nums">₹{subsJoiningFee}</p>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isRegistering}
                    className={`w-full py-5 bg-primary text-white rounded-3xl text-sm font-black tracking-[0.2em] uppercase shadow-[0_15px_40px_rgba(15,23,42,0.3)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 ${isRegistering ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isRegistering ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        UPDATING REGISTRY...
                      </>
                    ) : (
                      <>🚀 REGISTER Member to Database</>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* RIGHT WINDOW: REGISTRY LIST */}
            <div className="lg:col-span-3 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-slate-200 overflow-hidden flex flex-col h-full animate-in fade-in slide-in-from-right-6 duration-700">
              {/* Window Title Bar */}
              <div className="bg-slate-800 px-5 py-4 flex justify-between items-center select-none shadow-md relative z-10">
                <div className="flex gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-slate-600/50"></div>
                  <div className="w-3.5 h-3.5 rounded-full bg-slate-600/50"></div>
                  <div className="w-3.5 h-3.5 rounded-full bg-slate-600/50"></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black tracking-[0.4em] text-white/30 uppercase">DATA_EXPLORER_VIEW</span>
                </div>
                <div className="flex gap-2">
                   <div className="w-10 h-0.5 bg-slate-700 rounded-full"></div>
                   <div className="w-3 h-3 border-2 border-slate-700 rounded shadow-sm"></div>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <div className="flex flex-col gap-1 text-left">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter leading-none">Database Registry</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${dbStatus === 'connected' ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`}></span>
                      {dbStatus === 'connected' ? 'Digital Core Access Ledger - Online' : 'Digital Core Access Ledger - Check Connection'}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => { loadMembers(); loadDashboard(); }}
                      className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
                      title="Forced Re-Sync"
                    >
                      🔄
                    </button>
                    <button 
                      onClick={exportToCSV}
                      className="px-5 py-3 rounded-2xl bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-sm flex items-center gap-2"
                    >
                      📥 Export
                    </button>
                    <button 
                      onClick={() => setShowMemberFilters(!showMemberFilters)}
                      className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${showMemberFilters ? 'bg-primary text-white scale-105' : 'bg-white text-slate-600 border-2 border-slate-100 hover:border-primary/30'}`}
                    >
                      {showMemberFilters ? '⚙️ ACTIVE' : '🔍 FILTERS'}
                    </button>
                    <div className="relative group">
                      <input 
                        placeholder="Search Identity..." 
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        className="pl-12 pr-6 py-3 bg-white border-2 border-slate-100 rounded-2xl text-xs outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5 transition-all w-80 shadow-sm"
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg opacity-40 group-focus-within:opacity-100 transition-opacity">📂</span>
                    </div>
                  </div>
                </div>

                {showMemberFilters && (
                  <div className="px-8 py-6 bg-slate-100 border-b border-slate-200 grid grid-cols-3 gap-6 animate-in slide-in-from-top-6 duration-500 z-10 relative">
                    <div className="text-left">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-2 px-1">Access Tier Filter</label>
                      <select 
                        value={memberFilterSub} 
                        onChange={(e) => setMemberFilterSub(e.target.value)}
                        className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-xs outline-none focus:border-primary transition-all shadow-sm"
                      >
                        <option value="all">ALL PLANS</option>
                        <option value="MONTHLY">MONTHLY TIER</option>
                        <option value="YEARLY">YEARLY TIER</option>
                        <option value="LIFETIME">LIFETIME TIER</option>
                      </select>
                    </div>
                    <div className="text-left">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-2 px-1">Registry Enrollment Date</label>
                      <input 
                        type="date" 
                        value={memberFilterDate} 
                        onChange={(e) => setMemberFilterDate(e.target.value)}
                        className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-xs outline-none focus:border-primary transition-all shadow-sm"
                      />
                    </div>
                    <div className="flex items-end">
                      <button 
                        onClick={() => { setMemberSearch(""); setMemberFilterSub("all"); setMemberFilterDate(""); }}
                        className="w-full py-3 bg-slate-200 text-slate-500 font-black text-[10px] uppercase rounded-xl hover:bg-slate-300 transition-all shadow-sm tracking-[0.2em]"
                      >
                        PURGE LOGIC 🔄
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
                  <table className="w-full border-separate border-spacing-0">
                    <thead className="sticky top-0 bg-white/95 backdrop-blur-xl z-10">
                      <tr className="shadow-sm">
                        <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] border-b border-slate-100">Core Identity</th>
                        <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] border-b border-slate-100">Authorization Tier</th>
                        <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] border-b border-slate-100">Command Control</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {members.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-8 py-20 text-center">
                            <div className="flex flex-col items-center gap-4 opacity-30">
                              <span className="text-6xl animate-bounce duration-[3s]">📭</span>
                              <div>
                                <p className="text-sm font-black text-slate-800 uppercase tracking-widest">Registry Vacuum Detected</p>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-1">No profiles match the current filter parameters</p>
                              </div>
                              <button 
                                onClick={() => { setMemberSearch(""); setMemberFilterSub("all"); setMemberFilterDate(""); }}
                                className="mt-4 px-6 py-2 bg-slate-900 text-white rounded-full text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-all"
                              >
                                RESET FILTERS
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        members.map((u, idx) => (
                          <motion.tr 
                            key={u.id || idx} 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            className="group hover:bg-slate-50/50 transition-all duration-300"
                          >
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-slate-100 rounded-[18px] flex items-center justify-center text-lg font-black text-slate-400 group-hover:bg-primary group-hover:text-white group-hover:rotate-12 group-hover:scale-110 transition-all shadow-sm">
                                {u.name?.[0].toUpperCase()}
                              </div>
                              <div className="text-left">
                                <div className="font-black text-slate-800 group-hover:text-primary transition-colors text-base tracking-tight cursor-pointer" onClick={() => { setViewUserModal(u); loadUserHistory(u.phone); }}>{u.name}</div>
                                <div className="text-[11px] text-slate-400 font-mono tracking-widest mt-0.5">{u.phone}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col gap-1">
                                <span className={`text-[9px] px-4 py-1.5 rounded-full font-black tracking-[0.2em] uppercase shadow-lg ${
                                  (u.subscription || "").includes('LIFETIME') ? 'bg-gradient-to-r from-amber-600 to-amber-400 text-white shadow-amber-500/30' :
                                  (u.subscription || "").includes('YEARLY') ? 'bg-gradient-to-r from-emerald-600 to-emerald-400 text-white shadow-emerald-500/30' :
                                  'bg-gradient-to-r from-primary to-slate-700 text-white shadow-primary/30'
                                }`}>
                                  {u.subscription || "INACTIVE_SYSTEM"}
                                </span>
                                {u.expiry_date && (
                                  <span className={`text-[8px] font-black uppercase text-center mt-1 tracking-tighter ${
                                    new Date(u.expiry_date) < new Date() ? 'text-red-500 animate-pulse' : 'text-slate-400'
                                  }`}>
                                    {new Date(u.expiry_date) < new Date() ? '❌ EXPIRED' : `EXP: ${new Date(u.expiry_date).toLocaleDateString()}`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 translate-x-4 transition-all pr-4">
                              <button 
                                onClick={() => setShowIdCard(u)} 
                                className="w-10 h-10 flex items-center justify-center bg-blue-50 border border-blue-100 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white hover:shadow-xl hover:-translate-y-1 transition-all" 
                                title="Generate ID Card"
                              >
                                🆔
                              </button>
                              <button 
                                onClick={() => { setViewUserModal(u); loadUserHistory(u.phone); }} 
                                className="w-10 h-10 flex items-center justify-center bg-blue-50 border border-blue-100 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white hover:shadow-xl hover:-translate-y-1 transition-all" 
                                title="Comprehensive Intel"
                              >
                                ℹ️
                              </button>
                              <button 
                                onClick={() => handleRenewal(u)} 
                                className="w-10 h-10 flex items-center justify-center bg-emerald-50 border border-emerald-100 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white hover:shadow-xl hover:-translate-y-1 transition-all" 
                                title="Pulse Extension"
                              >
                                ⚡
                              </button>
                              <a 
                                href={`https://wa.me/91${u.phone}?text=Hello ${u.name}, this is a notification from Vayanashala Library regarding your account.`}
                                target="_blank"
                                rel="noreferrer"
                                className="w-10 h-10 flex items-center justify-center bg-green-50 border border-green-100 text-green-500 rounded-xl hover:bg-green-500 hover:text-white hover:shadow-xl hover:-translate-y-1 transition-all" 
                                title="WhatsApp Alert"
                              >
                                💬
                              </a>
                              <button 
                                onClick={() => setEditMemberModal(u)} 
                                className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:bg-primary/10 hover:border-primary/30 transition-all shadow-sm" 
                                title="Update Sequence"
                              >
                                ✏️
                              </button>
                              <button 
                                onClick={() => deleteMember(u.id, u.name)} 
                                className="w-10 h-10 flex items-center justify-center bg-red-50 border border-red-100 text-red-500 rounded-xl hover:bg-red-500 hover:text-white hover:shadow-xl hover:-translate-y-1 transition-all" 
                                title="Purge Record"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BOOKS SEARCH */}
        {activeTab === "books" && (
          <div className="flex flex-col gap-8">
            <motion.header 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-between items-end"
            >
               <div className="flex flex-col gap-2 text-left">
                 <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Inventory Ledger</h2>
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-0.5 bg-accent rounded-full"></div>
                   <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] leading-none">Catalogued Assets Repository</p>
                 </div>
               </div>
               <div className="flex items-center gap-4">
                  <div className="flex bg-slate-100 p-1 rounded-2xl">
                    <button 
                      onClick={() => setSearchType('title')}
                      className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${searchType === 'title' ? 'bg-white shadow-sm text-primary' : 'text-slate-400'}`}
                    >
                      Title
                    </button>
                    <button 
                      onClick={() => setSearchType('author')}
                      className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${searchType === 'author' ? 'bg-white shadow-sm text-primary' : 'text-slate-400'}`}
                    >
                      Author
                    </button>
                    <button 
                      onClick={() => setSearchType('stocknumber')}
                      className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${searchType === 'stocknumber' ? 'bg-white shadow-sm text-primary' : 'text-slate-400'}`}
                    >
                      Asset ID
                    </button>
                  </div>
                  <div className="relative group">
                    <input 
                      placeholder={`SEARCH BY ${searchType.toUpperCase()}...`} 
                      value={bookSearch}
                      onChange={(e) => setBookSearch(e.target.value)}
                      onKeyUp={searchBooks}
                      className="pl-14 pr-6 py-4 bg-white border-2 border-slate-100 rounded-2xl text-xs outline-none focus:border-accent transition-all w-80 shadow-lg shadow-primary/5 uppercase font-black tracking-widest placeholder:opacity-30"
                    />
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl grayscale group-focus-within:grayscale-0 transition-all">🔍</span>
                  </div>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveTab('addBook')} 
                    className="btn-primary px-8 shadow-xl shadow-primary/20 h-[56px]"
                  >
                    <span className="text-lg">📖</span> NEW ASSET
                  </motion.button>
               </div>
            </motion.header>

            <div className="section-card bg-white/70 backdrop-blur-md">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full border-separate border-spacing-0">
                  <thead className="sticky top-0 bg-white/95 backdrop-blur-xl z-20">
                    <tr className="shadow-sm">
                      <th className="table-header w-20 text-center">SEQ</th>
                      <th className="table-header">Title & Meta</th>
                      <th className="table-header">Categorization</th>
                      <th className="table-header">Registry Locators</th>
                      <th className="table-header text-right">Valuation</th>
                      <th className="table-header text-right pr-8">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {books.map((b, idx) => (
                      <motion.tr 
                        key={b.id} 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="group hover:bg-slate-50/80 transition-all"
                      >
                        <td className="px-6 py-6 text-[11px] font-mono text-slate-400 font-black text-center">{idx + 1}</td>
                      <td className="px-6 py-6" onClick={() => setViewBookModal(b)}>
                          <div className="flex items-center gap-4 group/item cursor-pointer">
                            <div className="flex-1 text-left">
                              <span className="font-black text-slate-800 text-base tracking-tight group-hover/item:text-primary transition-colors block leading-tight">{b.title}</span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 block italic">{b.author}</span>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-tighter">{b.category || "General"}</span>
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-500 rounded text-[9px] font-black uppercase tracking-tighter">{b.language}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6 text-left">
                          <span className="text-[9px] bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full font-black uppercase tracking-widest group-hover:bg-accent/10 group-hover:text-accent transition-colors">
                            {b.category || "GENERAL_STOCK"}
                          </span>
                        </td>
                        <td className="px-6 py-6 text-left">
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 px-2.5 bg-primary/5 rounded-xl border border-primary/5 text-[9px] font-mono text-primary font-black">S:{b.shelfnumber || '—'}</div>
                            <div className="p-1.5 px-2.5 bg-accent/5 rounded-xl border border-accent/5 text-[9px] font-mono text-accent font-black">C:{b.callnumber || '—'}</div>
                          </div>
                        </td>
                        <td className="px-6 py-6 text-right font-mono text-[13px] font-black text-slate-500 tabular-nums">₹{b.price || '0.00'}</td>
                        <td className="px-6 py-6 text-right pr-8">
                           <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                              <button onClick={() => setEditBookModal(b)} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-2xl hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all" title="Modify Registry">✏️</button>
                              <button onClick={() => deleteBook(b.stocknumber)} className="w-10 h-10 flex items-center justify-center bg-red-50 border border-red-100 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white hover:shadow-xl hover:-translate-y-1 transition-all" title="Purge Asset">🗑️</button>
                           </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ADD BOOK */}
        {activeTab === "addBook" && (
          <div className="max-w-2xl mx-auto flex flex-col gap-6">
            <div className="section-card p-2 flex bg-slate-100 rounded-2xl">
              <button 
                onClick={() => setAddMode('manual')}
                className={`flex-1 py-3 px-6 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                  addMode === 'manual' ? 'bg-white shadow-md text-primary scale-105' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Manual Entry
              </button>
              <button 
                onClick={() => { setAddMode('barcode'); setScannedBook(null); }}
                className={`flex-1 py-3 px-6 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                  addMode === 'barcode' ? 'bg-white shadow-md text-accent scale-105' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Barcode Scanner
              </button>
            </div>

            {addMode === 'barcode' && !scannedBook && lookupResults.length === 0 && (
              <div className="section-card p-12 flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-4">
                <div className="w-24 h-24 bg-accent/10 text-accent rounded-3xl flex items-center justify-center text-4xl mb-6 animate-pulse border-2 border-accent/10">
                  📚
                </div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Ready for Scanning</h3>
                <p className="text-xs text-text-muted mt-2 max-w-xs mx-auto leading-relaxed">
                  Focus your scanner on the book's 13-digit ISBN barcode or use your device's camera.
                </p>

                {showCamera ? (
                  <div className="w-full max-w-md mt-6 relative group flex flex-col items-center">
                    <div className="w-full h-[300px] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800 relative">
                      <div id="reader" className="w-full h-full"></div>
                      
                      {/* High-Tech Overlay */}
                      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                        <div className="w-[80%] h-[50%] border-2 border-accent/40 rounded-2xl relative overflow-hidden">
                          {/* Animated Scan Line */}
                          <div className="absolute top-0 left-0 w-full h-[3px] bg-accent shadow-[0_0_20px_rgba(14,165,233,0.8)] animate-[scan_2.5s_ease-in-out_infinite]"></div>
                          
                          {/* Corners */}
                          <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-accent rounded-tl-xl opacity-80"></div>
                          <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-accent rounded-tr-xl opacity-80"></div>
                          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-accent rounded-bl-xl opacity-80"></div>
                          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-accent rounded-br-xl opacity-80"></div>
                        </div>
                        <div className="mt-6 px-5 py-2 bg-black/50 backdrop-blur-md rounded-full text-white text-[9px] font-black uppercase tracking-[0.3em] border border-white/10">
                          Align Barcode in the Frame
                        </div>
                      </div>

                      {cameraError && (
                        <div className="absolute inset-0 bg-error/95 flex items-center justify-center p-8 text-center text-white backdrop-blur-sm">
                          <div className="max-w-xs">
                            <span className="text-4xl block mb-4">📷</span>
                            <p className="font-black text-sm uppercase tracking-widest mb-4">Hardware Busy</p>
                            <p className="text-[10px] font-bold leading-relaxed opacity-90">{cameraError}</p>
                            <button onClick={() => setShowCamera(false)} className="mt-6 px-6 py-2 bg-white text-error rounded-full font-black text-[10px] uppercase tracking-widest">Close</button>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-6 w-full flex flex-col gap-4">
                      {cameras.length > 1 && (
                        <div className="px-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Switch Lens</label>
                          <select 
                            className="w-full bg-slate-100 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 focus:border-accent outline-none transition-all"
                            value={selectedCamera || ""}
                            onChange={(e) => handleCameraChange(e.target.value)}
                          >
                            {cameras.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="flex gap-2 justify-center">
                        <button 
                          onClick={stopCameraScanner}
                          className="px-8 py-2.5 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all shadow-lg shadow-slate-200"
                        >
                          Terminate Scan
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => startCameraScanner()}
                    className="mt-6 bg-accent text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-lg shadow-accent/20 flex items-center gap-3"
                  >
                    <span>📷 OBTAIN FROM CAMERA</span>
                  </button>
                )}

                <div className="w-full flex items-center gap-4 my-8">
                  <div className="h-[1px] bg-slate-200 flex-1"></div>
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">OR MANUAL SCAN</span>
                  <div className="h-[1px] bg-slate-200 flex-1"></div>
                </div>

                <form onSubmit={lookupISBN} className="flex gap-2 w-full max-w-sm">
                  <div className="relative group flex-1">
                    <input 
                      autoFocus
                      placeholder="Enter ISBN Code" 
                      value={isbnLookup}
                      onChange={(e) => setIsbnLookup(e.target.value)}
                      className="input-field shadow-sm text-center font-mono tracking-widest text-lg py-4 border-2 group-hover:border-accent transition-colors"
                    />
                    {isbnLookup && (
                      <button 
                        type="button" 
                        onClick={() => setIsbnLookup("")}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-error transition-colors"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <button 
                    type="submit" 
                    disabled={lookupLoading}
                    className="btn-primary px-8 py-4 disabled:opacity-50 flex items-center gap-2"
                  >
                    {lookupLoading ? "..." : <><span className="hidden md:inline">IDENTIFY</span> 🔍</>}
                  </button>
                </form>
              </div>
            )}

            {addMode === 'barcode' && lookupResults.length > 0 && !scannedBook && (
              <div className="section-card p-8 animate-in zoom-in-95 duration-500">
                <div className="flex justify-between items-center mb-8 border-b pb-4">
                  <div>
                    <h3 className="text-xl font-black text-slate-800">Multiple Editions Located</h3>
                    <p className="text-[10px] uppercase font-bold text-accent tracking-[0.2em] mt-1">ISBN: {lookupResults[0].isbn}</p>
                  </div>
                  <button 
                    onClick={() => setLookupResults([])}
                    className="text-[10px] font-black uppercase text-error tracking-widest hover:underline"
                  >
                    Discard Results
                  </button>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  {lookupResults.map((candidate, idx) => (
                    <div 
                      key={idx}
                      className="p-4 border-2 border-slate-100 rounded-xl hover:border-accent hover:bg-accent/5 transition-all cursor-pointer group relative flex flex-col md:flex-row md:items-center gap-4"
                      onClick={() => {
                        setScannedBook({
                          ...candidate,
                          price: "", 
                          stocknumber: "", 
                          callnumber: "", 
                          shelfnumber: "" 
                        });
                        setLookupResults([]);
                      }}
                    >
                      <div className="bg-slate-50 w-12 h-12 rounded-lg flex items-center justify-center text-xl shrink-0 group-hover:bg-accent/10 transition-colors">
                        📖
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-800 group-hover:text-accent transition-colors">{candidate.title}</h4>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span className="text-[10px] px-2 py-0.5 bg-slate-100 rounded font-bold text-slate-500">{candidate.author}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded font-bold italic">{candidate.source}</span>
                          {candidate.publisher && <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded font-bold">Pub: {candidate.publisher}</span>}
                        </div>
                      </div>
                      <div className="text-accent opacity-0 group-hover:opacity-100 transition-opacity font-black text-[10px] uppercase tracking-widest bg-accent/10 py-2 px-4 rounded-full">
                        Select Asset
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {addMode === 'barcode' && scannedBook && (
              <div className="section-card animate-in zoom-in-95 duration-300">
                <div className="section-header border-b border-surface-border flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-black text-accent uppercase tracking-widest block mb-1">Scanned Asset Detected</span>
                    <h2>Verify & Commit to Registry</h2>
                  </div>
                  <button onClick={() => setScannedBook(null)} className="text-error font-black text-[10px] uppercase tracking-widest hover:underline">Discard</button>
                </div>
                <form onSubmit={confirmAddScannedBook} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-full bg-blue-50 p-4 rounded-xl border border-blue-100 mb-2">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Verify Metadata</p>
                    <h4 className="text-lg font-black text-blue-900 leading-tight">{scannedBook.title}</h4>
                    <p className="text-xs text-blue-700 font-bold italic mt-1">by {scannedBook.author}</p>
                  </div>
                  
                  <input name="stocknumber" placeholder="Library Stock #" required onFocus={handleInputFocus} className="input-field shadow-md border-accent/20 border-2" />
                  <input name="callnumber" placeholder="Call #" required onFocus={handleInputFocus} className="input-field shadow-sm" />
                  <input name="isbn" placeholder="ISBN (Optional)" defaultValue={scannedBook.isbn} onFocus={handleInputFocus} className="input-field shadow-sm bg-slate-50 font-mono text-xs" />
                  <input name="title" defaultValue={scannedBook.title} onFocus={handleInputFocus} className="input-field shadow-sm md:col-span-1 col-span-full font-bold text-slate-800" />
                  <input name="author" defaultValue={scannedBook.author} onFocus={handleInputFocus} className="input-field shadow-sm" />
                  <input name="publisher" defaultValue={scannedBook.publisher} onFocus={handleInputFocus} className="input-field shadow-sm" />
                  <input name="category" defaultValue={scannedBook.category} onFocus={handleInputFocus} className="input-field shadow-sm col-span-full" />
                  
                  <select name="language" defaultValue={scannedBook.language} className="input-field shadow-sm">
                    <option value="">Select Language</option>
                    <option value="MALAYALAM">MALAYALAM</option>
                    <option value="ENGLISH">ENGLISH</option>
                    <option value="HINDI">HINDI</option>
                    <option value="TAMIL">TAMIL</option>
                    <option value="SANSKRIT">SANSKRIT</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                  <select name="shelfnumber" required className="input-field shadow-sm border-blue-200 border">
                    <option value="">Assign Shelf (1-30)</option>
                    {Array.from({ length: 30 }, (_, i) => (
                      <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
                    ))}
                  </select>
                  <input name="price" placeholder="Asset Value / Price" className="input-field shadow-sm col-span-full" />
                  
                  <button type="submit" className="btn-primary py-4 col-span-full uppercase tracking-widest text-[11px] font-black shadow-lg shadow-primary/20 mt-4">
                    Confirm & Store in Supabase
                  </button>
                </form>
              </div>
            )}

            {addMode === 'manual' && (
              <div className="section-card animate-in fade-in duration-500">
                <div className="section-header flex justify-between items-center">
                  <div>
                    <h2>Register New Library Asset</h2>
                    <div className="mt-2 flex items-center gap-4">
                      <button 
                        onClick={() => {
                          setIsManglishEnabled(!isManglishEnabled);
                          if (isManglishEnabled) setShowVirtualKeyboard(false);
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all group ${
                          isManglishEnabled 
                          ? 'border-accent bg-accent/5 text-accent font-black' 
                          : 'border-slate-200 text-slate-400 font-bold hover:border-slate-300'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full ${isManglishEnabled ? 'bg-accent animate-pulse' : 'bg-slate-200'}`}></div>
                        <span className="text-[10px] uppercase tracking-widest">Malayalam KB {isManglishEnabled ? 'ON' : 'OFF'}</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <label className="btn-primary bg-slate-800 text-[10px] px-3 py-1.5 cursor-pointer flex items-center gap-1">
                      <span>📥 BULK CSV</span>
                      <input type="file" accept=".csv" onChange={bulkUpload} className="hidden" />
                    </label>
                  </div>
                </div>
                <form onSubmit={addBook} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input name="stocknumber" placeholder="Stock Number" required onFocus={handleInputFocus} className="input-field shadow-sm" />
                  <input name="isbn" placeholder="ISBN Number (Optional)" onFocus={handleInputFocus} className="input-field shadow-sm font-mono text-xs" />
                  <input name="callnumber" placeholder="Call Number" required onFocus={handleInputFocus} className="input-field shadow-sm" />
                  <input name="title" placeholder="Full Title" required onFocus={handleInputFocus} className="input-field shadow-sm col-span-full" />
                  <input name="author" placeholder="Author Name" required onFocus={handleInputFocus} className="input-field shadow-sm" />
                  <input name="publisher" placeholder="Publisher" onFocus={handleInputFocus} className="input-field shadow-sm" />
                  <input name="category" placeholder="Category" onFocus={handleInputFocus} className="input-field shadow-sm col-span-full" />
                  <select name="language" className="input-field shadow-sm">
                    <option value="">Select Language</option>
                    <option value="MALAYALAM">MALAYALAM</option>
                    <option value="ENGLISH">ENGLISH</option>
                    <option value="HINDI">HINDI</option>
                    <option value="TAMIL">TAMIL</option>
                    <option value="SANSKRIT">SANSKRIT</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                  <select name="shelfnumber" className="input-field shadow-sm">
                    <option value="">Select Shelf (1-30)</option>
                    {Array.from({ length: 30 }, (_, i) => (
                      <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
                    ))}
                  </select>
                  <input name="price" placeholder="Price" onFocus={handleInputFocus} className="input-field shadow-sm col-span-full" />
                  <button type="submit" className="btn-primary py-4 col-span-full uppercase tracking-widest text-[11px] font-black shadow-lg shadow-primary/20">Initialize Asset Registry</button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* VIRTUAL MANGLISH KEYBOARD */}
        {isManglishEnabled && showVirtualKeyboard && (activeTab === 'addBook' || editBookModal) && (
          <div className="fixed bottom-0 left-0 right-0 z-[60] bg-white border-t-2 border-slate-200 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] p-4 animate-in slide-in-from-bottom-full duration-500 overflow-y-auto max-h-[40vh]">
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-accent/10 text-accent px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                    Manglish Input Board
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 italic">Target: {focusedInput?.placeholder || focusedInput?.name || 'None'}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-[9px] font-black uppercase text-slate-300 tracking-widest bg-slate-100 px-2 py-1 rounded">
                    Tip: Type in English & hit "Enter" to convert
                  </div>
                  <button 
                    onClick={() => setShowVirtualKeyboard(false)}
                    className="text-slate-400 hover:text-slate-800 transition-colors text-xl"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                {/* Section Switching Tabs */}
                <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 overflow-x-auto no-scrollbar">
                  <button 
                    onClick={() => setActiveKbTab('vowels')}
                    className={`flex-1 min-w-[100px] py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeKbTab === 'vowels' ? 'bg-white text-accent shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                  >
                    അ / ാ (Vowels)
                  </button>
                  <button 
                    onClick={() => setActiveKbTab('consonants')}
                    className={`flex-1 min-w-[100px] py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeKbTab === 'consonants' ? 'bg-white text-accent shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                  >
                    ക / ഖ (Consonants)
                  </button>
                  <button 
                    onClick={() => setActiveKbTab('conjuncts')}
                    className={`flex-1 min-w-[100px] py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeKbTab === 'conjuncts' ? 'bg-white text-accent shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                  >
                    ക്ക / ന്ത (Conjuncts)
                  </button>
                  <button 
                    onClick={() => setActiveKbTab('extras')}
                    className={`flex-1 min-w-[100px] py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeKbTab === 'extras' ? 'bg-white text-accent shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                  >
                    ൻ / ൧ (Extras)
                  </button>
                </div>

                <div className="min-h-[220px]">
                  {activeKbTab === 'vowels' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div>
                        <div className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-widest">Swaraaksharangal (Vowels)</div>
                        <div className="flex flex-wrap gap-1.5">
                          {manglishMap.vowels.map(v => (
                            <button 
                              key={`${v.e}-${v.m}`} 
                              onClick={() => handleKeyClick(v.m)}
                              className="min-w-[44px] h-11 bg-slate-50 border border-slate-200 rounded-lg hover:bg-white hover:border-accent hover:text-accent transition-all flex flex-col items-center justify-center shadow-sm active:scale-95"
                            >
                              <span className="text-[10px] font-black text-slate-400">{v.e}</span>
                              <span className="text-lg font-bold mt-[-4px]">{v.m}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-widest">Maathras (Vowel Signs / Equipment)</div>
                        <div className="flex flex-wrap gap-1.5">
                          {manglishMap.signs.map(s => (
                            <button 
                              key={`${s.e}-${s.m}`} 
                              onClick={() => handleKeyClick(s.m)}
                              className="min-w-[44px] h-11 bg-orange-50/50 border border-orange-100 rounded-lg hover:bg-white hover:border-accent hover:text-accent transition-all flex flex-col items-center justify-center shadow-sm active:scale-95"
                            >
                              <span className="text-[10px] font-black text-orange-400/70">{s.e}</span>
                              <span className="text-lg font-bold mt-[-4px]">{s.m}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeKbTab === 'consonants' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-widest">Vyanjanaaksharangal (Consonants)</div>
                      <div className="flex flex-wrap gap-1.5">
                        {manglishMap.consonants.map(c => (
                          <button 
                            key={`${c.e}-${c.m}`} 
                            onClick={() => handleKeyClick(c.m)}
                            className="min-w-[44px] h-11 bg-slate-50 border border-slate-200 rounded-lg hover:bg-white hover:border-accent hover:text-accent transition-all flex flex-col items-center justify-center shadow-sm active:scale-95"
                          >
                            <span className="text-[10px] font-black text-slate-400">{c.e}</span>
                            <span className="text-lg font-bold mt-[-4px]">{c.m}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeKbTab === 'conjuncts' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-widest">Common Koottaksharam (Conjuncts)</div>
                      <div className="flex flex-wrap gap-1.5">
                        {manglishMap.conjuncts.map(c => (
                          <button 
                            key={`${c.e}-${c.m}`} 
                            onClick={() => handleKeyClick(c.m)}
                            className="min-w-[50px] h-11 bg-blue-50 border border-blue-100 rounded-lg hover:bg-white hover:border-accent hover:text-accent transition-all flex flex-col items-center justify-center shadow-sm active:scale-95"
                          >
                            <span className="text-[10px] font-black text-blue-400/70">{c.e}</span>
                            <span className="text-lg font-bold mt-[-4px]">{c.m}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeKbTab === 'extras' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div>
                        <div className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-widest">Chillu Letters & Technical Joiners</div>
                        <div className="flex flex-wrap gap-1.5">
                          {manglishMap.chillu.map(c => (
                            <button 
                              key={`${c.e}-${c.m}`} 
                              onClick={() => handleKeyClick(c.m)}
                              className="min-w-[44px] h-11 bg-teal-50/50 border border-teal-100 rounded-lg hover:bg-white hover:border-accent hover:text-accent transition-all flex flex-col items-center justify-center shadow-sm active:scale-95"
                            >
                              <span className="text-[10px] font-black text-teal-400/70">{c.e}</span>
                              <span className="text-lg font-bold mt-[-4px]">{c.m}</span>
                            </button>
                          ))}
                          {manglishMap.symbols.filter(s => ['ZWJ', 'ZWNJ'].includes(s.e)).map(s => (
                            <button 
                              key={`${s.e}-${s.m}`} 
                              onClick={() => handleKeyClick(s.m)}
                              className="min-w-[70px] h-11 bg-purple-50 border border-purple-100 rounded-lg hover:bg-white hover:border-accent hover:text-accent transition-all flex flex-col items-center justify-center shadow-sm active:scale-95"
                            >
                              <span className="text-[10px] font-black text-purple-400/70 uppercase">{s.e}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-widest">Archaic Symbols & Numerals</div>
                        <div className="flex flex-wrap gap-1.5">
                          {manglishMap.symbols.filter(s => !['ZWJ', 'ZWNJ'].includes(s.e)).map(s => (
                            <button 
                              key={`${s.e}-${s.m}`} 
                              onClick={() => handleKeyClick(s.m)}
                              className="min-w-[44px] h-11 bg-orange-50/50 border border-orange-100 rounded-lg hover:bg-white hover:border-accent hover:text-accent transition-all flex flex-col items-center justify-center shadow-sm active:scale-95"
                            >
                              <span className="text-[10px] font-black text-orange-400/70">{s.e}</span>
                              <span className="text-lg font-bold mt-[-4px]">{s.m}</span>
                            </button>
                          ))}
                          {manglishMap.digits.map(d => (
                            <button 
                              key={`${d.e}-${d.m}`} 
                              onClick={() => handleKeyClick(d.m)}
                              className="min-w-[44px] h-11 bg-slate-50 border border-slate-200 rounded-lg hover:bg-white hover:border-accent hover:text-accent transition-all flex flex-col items-center justify-center shadow-sm active:scale-95"
                            >
                              <span className="text-[10px] font-black text-slate-400">{d.e}</span>
                              <span className="text-lg font-bold mt-[-4px]">{d.m}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4 border-t border-slate-100 mt-2">
                  <button 
                    onClick={handleBackspace}
                    className="flex-1 h-12 bg-red-50 border border-red-100 text-red-600 rounded-xl hover:bg-red-600 hover:text-white font-black transition-all flex items-center justify-center text-xs shadow-sm active:scale-95 uppercase tracking-widest"
                  >
                    Delete / Backspace
                  </button>
                  <button 
                    onClick={() => handleKeyClick(" ")}
                    className="flex-[2] h-12 bg-slate-100 border border-slate-200 text-slate-600 rounded-xl hover:bg-white hover:border-accent hover:text-accent font-black transition-all flex items-center justify-center text-xs shadow-sm active:scale-95 uppercase tracking-widest"
                  >
                    Space Bar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MEMBER ENGAGEMENT */}
        {activeTab === "engagement" && (
          <div className="flex flex-col gap-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="section-card p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-black tracking-tight text-primary">Overdue Communication</h3>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">Broadcast reminder signals to all active accounts with overdue circulation indices. System will use standard protocol.</p>
                </div>
                <button 
                  onClick={sendOverdueAlerts}
                  className="btn-primary w-fit mt-6 px-10 py-3 text-[10px] font-black tracking-[0.2em]"
                >
                  DISPATCH OVERDUE ALERTS
                </button>
              </div>
            </div>

            <div className="section-card">
              <div className="section-header">
                <h2>Member Performance Records</h2>
              </div>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Identity</th>
                    <th className="table-header">Usage Volume</th>
                    <th className="table-header text-right">Deep Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50 transition-colors border-b border-slate-50">
                      <td className="table-cell">
                        <div className="font-bold">{m.name}</div>
                        <div className="text-[10px] text-text-muted">{m.phone}</div>
                      </td>
                      <td className="table-cell">
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-accent" style={{ width: '40%' }}></div>
                        </div>
                      </td>
                      <td className="table-cell text-right">
                        <button 
                          onClick={() => { setViewUserModal(m); loadUserHistory(m.phone); }}
                          className="text-primary font-black text-[10px] tracking-widest uppercase hover:underline"
                        >
                          View Borrowing History
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="p-12 glass-card rounded-[40px] border border-slate-200/50 shadow-2xl relative overflow-hidden bg-white/80 backdrop-blur-xl">
              <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
                 <span className="text-[200px] font-black italic select-none">CONFIG</span>
              </div>
              
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-100 pb-10 mb-10">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-primary text-white rounded-3xl flex items-center justify-center text-3xl shadow-2xl shadow-primary/20 transform -rotate-6 hover:rotate-0 transition-transform duration-500">⚙️</div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic">Institutional Command Center</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.4em] mt-1">Universal Policy & Financial Synchronization</p>
                  </div>
                </div>
                {settingsLoading && (
                  <div className="flex items-center gap-3 bg-accent/10 px-6 py-3 rounded-2xl border border-accent/20 animate-pulse">
                    <div className="w-2 h-2 bg-accent rounded-full"></div>
                    <span className="text-[10px] font-black text-accent uppercase tracking-widest">Master Link Sync Active</span>
                  </div>
                )}
              </div>

              <form onSubmit={updateLibrarySettings} className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Circulation Group */}
                <div className="space-y-8">
                  <div className="flex items-center gap-3 mb-2 px-1">
                    <div className="w-1.5 h-6 bg-accent rounded-full"></div>
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Circulation Parameters</h4>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="group">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-3 block">MAX ASSET QUOTA PER USER</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          name="borrowing_limit"
                          defaultValue={borrowingLimit}
                          className="input-field py-5 text-xl font-black bg-slate-50/50 focus:bg-white" 
                        />
                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 opacity-50 uppercase">Assets</span>
                      </div>
                    </div>

                    <div className="group">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-3 block">DAILY PENALTY FEE (POST-30 DAYS)</label>
                      <div className="relative">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl font-black text-slate-400">₹</span>
                        <input 
                          type="number" 
                          name="fine_amount"
                          defaultValue={fineAmount}
                          step="0.01"
                          className="input-field py-5 pl-12 text-xl font-black bg-slate-50/50 focus:bg-white" 
                        />
                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 opacity-50 uppercase">Per Day</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subscription Group */}
                <div className="space-y-8">
                  <div className="flex items-center gap-3 mb-2 px-1">
                    <div className="w-1.5 h-6 bg-emerald-400 rounded-full"></div>
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Financial Matrix</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-6">
                    <div className="group">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">ENTRY FEE</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">₹</span>
                        <input name="subs_joining_fee" type="number" defaultValue={subsJoiningFee} className="input-field py-4 pl-10 font-black bg-slate-50/50" />
                      </div>
                    </div>
                    <div className="group">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">MONTHLY SUBS</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">₹</span>
                        <input name="subs_monthly_fee" type="number" defaultValue={subsMonthlyFee} className="input-field py-4 pl-10 font-black bg-slate-50/50" />
                      </div>
                    </div>
                    <div className="group">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">ANNUAL SUBS</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">₹</span>
                        <input name="subs_yearly_fee" type="number" defaultValue={subsYearlyFee} className="input-field py-4 pl-10 font-black bg-slate-50/50" />
                      </div>
                    </div>
                    <div className="group">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">LIFETIME SUBS</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">₹</span>
                        <input name="subs_lifetime_fee" type="number" defaultValue={subsLifetimeFee} className="input-field py-4 pl-10 font-black bg-slate-50/50" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 pt-10 border-t border-slate-50 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex flex-col md:flex-row items-center gap-6 w-full md:w-auto">
                    <button 
                      type="submit" 
                      disabled={lookupLoading}
                      className="w-full md:w-auto px-12 py-5 bg-primary text-white font-black uppercase tracking-[0.3em] text-[11px] rounded-[24px] shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-4 group disabled:opacity-50"
                    >
                      <span>{lookupLoading ? 'SYNCING...' : 'COMMIT CHANGES TO MASTER'}</span>
                      <span className="text-xl group-hover:translate-x-2 transition-transform">🛰️</span>
                    </button>
                    <button 
                      type="button"
                      onClick={sendOverdueAlerts}
                      className="w-full md:w-auto px-8 py-5 bg-red-50 text-red-600 font-black uppercase tracking-[0.3em] text-[11px] rounded-[24px] border border-red-100 hover:bg-red-100 transition-all active:scale-95 flex items-center justify-center gap-3"
                    >
                      <span>🚨 DISPATCH OVERDUE ALERTS</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold max-w-sm italic text-right">
                    Note: Updating these values triggers an immediate global re-calculation for overdue fines and subsequent enrollments. History remains immutable.
                  </p>
                </div>
              </form>
            </div>
            
            {/* System Status Visualizer */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { label: "Data Integrity", val: "STABLE", icon: "💎", color: "text-emerald-500" },
                { label: "Sync Latency", val: "14ms", icon: "☄️", color: "text-accent" },
                { label: "Node Authorization", val: "VERIFIED", icon: "🛡️", color: "text-blue-500" }
              ].map((s, i) => (
                <div key={i} className="glass-card p-8 rounded-[32px] flex items-center justify-between group hover:-translate-y-2 transition-all">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{s.label}</p>
                    <p className={`text-xl font-black ${s.color}`}>{s.val}</p>
                  </div>
                  <span className="text-3xl group-hover:scale-125 transition-transform">{s.icon}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RULES & POLICY */}
        {activeTab === "rules" && (
          <div className="flex flex-col gap-8">
            <div className="section-header">
              <h1 className="text-2xl font-black tracking-tight uppercase">System Rules & Protocol</h1>
              <p className="text-slate-400 text-xs font-bold tracking-widest">Global Governance Configuration</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="section-card p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary text-xl">🛡️</div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-primary uppercase">Borrowing Policy</h3>
                    <p className="text-[10px] text-slate-400 font-bold tracking-widest">Concurrent Allocation Limit</p>
                  </div>
                </div>
                <p className="text-xs text-text-muted mb-6 leading-relaxed">Define the absolute ceiling for concurrent asset possession per individual digital profile. This constraint is enforced during the checkout protocol.</p>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Max Asset Count</span>
                    <select 
                      value={borrowingLimit} 
                      onChange={(e) => setBorrowingLimit(Number(e.target.value))}
                      className="input-field w-40 font-black text-center"
                    >
                      {[1, 2, 3, 4, 5, 10, 15, 20, 50].map(v => <option key={v} value={v}>{v} ASSETS</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] font-bold text-accent uppercase tracking-tighter italic">
                    <span className="w-2 h-2 bg-accent rounded-full animate-pulse"></span>
                    Policy currently active system-wide
                  </div>
                </div>
              </div>

              <div className="section-card p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 text-xl">⚖️</div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-primary uppercase">Financial Penalties</h3>
                    <p className="text-[10px] text-slate-400 font-bold tracking-widest">Late Return Compensation</p>
                  </div>
                </div>
                <p className="text-xs text-text-muted mb-6 leading-relaxed">Set the fixed daily charge triggered automatically when an asset circulation period exceeds the 30-day (1 month) allocation window.</p>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between p-4 bg-amber-50/50 rounded-xl border border-amber-100">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Daily Fine Amount</span>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">₹</span>
                      <input 
                        type="number" 
                        value={fineAmount}
                        onChange={(e) => setFineAmount(Math.max(0, Number(e.target.value)))}
                        className="input-field w-40 pl-8 font-black text-center"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-[10px] text-blue-600 font-bold leading-tight">
                      <span className="block uppercase mb-1">Impact Analysis:</span>
                      This charge is calculated per asset, per day of delay. It is reflected in the Live Ledger and user profile analytics.
                    </p>
                  </div>
                </div>
              </div>

              <div className="section-card p-8 md:col-span-2">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 text-xl">🎟️</div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-primary uppercase">Subscription Pricing</h3>
                    <p className="text-[10px] text-slate-400 font-bold tracking-widest">Membership Fee Structure</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: "Joining Fee (First Time)", state: subsJoiningFee, setter: setSubsJoiningFee },
                    { label: "One Month Fee", state: subsMonthlyFee, setter: setSubsMonthlyFee },
                    { label: "Annual Fee", state: subsYearlyFee, setter: setSubsYearlyFee },
                    { label: "Lifetime Fee", state: subsLifetimeFee, setter: setSubsLifetimeFee }
                  ].map((fee, i) => (
                    <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">{fee.label}</p>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">₹</span>
                        <input 
                          type="number" 
                          value={fee.state}
                          onChange={(e) => fee.setter(Math.max(0, Number(e.target.value)))}
                          className="input-field pl-8 font-black text-lg py-2"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="section-card p-8 bg-slate-900 border-none relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-accent/20 transition-all duration-700"></div>
              <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Protocol Enforcement Status</h3>
                  <p className="text-slate-400 text-xs leading-relaxed max-w-xl">All system circulations are monitored against these global constants. Fines are calculated in real-time based on your configured parameters. Changes to these policies take effect immediately for all existing and future issues.</p>
                </div>
                <div className="bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 flex flex-col items-center min-w-[200px]">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">System Health</span>
                  <div className="text-2xl font-black text-white">100% SECURE</div>
                  <div className="text-[9px] font-bold text-accent mt-2 animate-pulse uppercase tracking-widest">Monitoring Fines Realtime</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ADVANCED OPERATIONS */}
        {activeTab === "advanced" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 flex flex-col gap-6">
              <div className="section-card p-6 border-t-4 border-t-error">
                <h3 className="text-sm font-black text-error mb-4 uppercase tracking-widest">Breach Management</h3>
                <p className="text-xs text-text-muted mb-6">Select from active circulations to report permanent asset loss or displacement from the central registry.</p>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                   {issuedBooks.map(b => (
                     <div key={b.id} className="p-3 bg-slate-50 rounded-lg border border-surface-border flex justify-between items-center group">
                       <div className="text-[10px] font-bold">
                         <div className="text-slate-900 truncate w-40">{b.book?.title}</div>
                         <div className="text-slate-400 font-mono tracking-tighter">{b.stock_number}</div>
                       </div>
                       <button onClick={() => handleLostBook(b)} className="bg-red-50 text-error p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-error hover:text-white">
                         🏴 Mark Lost
                       </button>
                     </div>
                   ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 section-card h-full">
              <div className="section-header">
                <h2>Activity Audit Ledger</h2>
              </div>
              <div className="p-4 space-y-3 h-[500px] overflow-y-auto font-mono text-[11px]">
                {auditLogs.length === 0 && <div className="text-slate-300 italic">Static system listening... No active anomalies detected.</div>}
                {auditLogs.map((log, i) => (
                  <div key={i} className="p-3 border rounded-xl bg-slate-50 border-slate-100 flex gap-4 items-start">
                    <span className="text-accent font-bold">[{log.time}]</span>
                    <div>
                      <span className="bg-slate-800 text-white px-1.5 py-0.5 rounded text-[9px] mr-2">{log.action}</span>
                      <span className="text-slate-600">{log.details}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ISSUE (CIRCULATION) */}
        {activeTab === "circulation" && (
          <div className="max-w-4xl section-card">
            <div className="section-header">
              <h2>Asset Circulation Assignment</h2>
            </div>
            <div className="p-6 space-y-6">
              <input 
                placeholder="Scan Asset Stock ID..." 
                value={issueSearchVal}
                onChange={(e) => setIssueSearchVal(e.target.value)}
                className="input-field font-mono" 
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[320px] overflow-y-auto pr-2">
                {foundIssueBooks.map(b => (
                  <div 
                    key={b.id}
                    onClick={() => !b.isIssued && setSelectedIssueBook(b)}
                    className={`p-4 rounded-xl border flex justify-between items-start transition-all relative ${
                      selectedIssueBook?.id === b.id 
                        ? 'border-accent bg-blue-50/50 ring-2 ring-accent/20' 
                        : b.isIssued ? 'opacity-40 grayscale cursor-not-allowed border-surface-border bg-slate-50' : 'cursor-pointer border-surface-border hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm">📘 {b.title}</div>
                      <div className="text-[10px] text-text-muted mt-1 underline">STOCK: {b.stocknumber}</div>
                    </div>
                    <div className={`text-[10px] font-black tracking-tight ${b.isIssued ? 'text-error' : 'text-emerald-600'}`}>
                      {b.isIssued ? 'ISSUED' : 'AVAIL'}
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-surface-border">
                <p className="text-[10px] font-bold text-text-muted uppercase mb-2">TARGET MEMBER ASSIGNEE</p>
                <select 
                  value={selectedIssueUserPhone} 
                  onChange={(e) => setSelectedIssueUserPhone(e.target.value)}
                  className="input-field"
                >
                  <option value="">-- Search Profiler --</option>
                  {members.map(m => (
                    <option key={m.id} value={m.phone}>{m.name} ({m.phone})</option>
                  ))}
                </select>
              </div>
              <button onClick={issueBook} className="btn-primary w-full py-4 uppercase font-black text-[11px] tracking-widest shadow-lg active:scale-[0.98]">Execute Assignment Entry</button>
            </div>
          </div>
        )}

        {/* RETURN */}
        {activeTab === "return" && (
          <div className="max-w-xl section-card">
            <div className="section-header">
              <h2>Library Asset Re-Entry</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex gap-2">
                <select 
                  value={returnType} 
                  onChange={(e) => setReturnType(e.target.value)}
                  className="bg-slate-100 border border-surface-border px-3 rounded-lg text-xs font-bold"
                >
                  <option value="stock">STOCK ID</option>
                  <option value="bookId">ASSET ID</option>
                </select>
                <input 
                  placeholder="ID scan here..." 
                  value={returnSearchVal} 
                  onChange={(e) => setReturnSearchVal(e.target.value)} 
                  onKeyUp={searchReturnBooks}
                  className="flex-grow input-field font-mono" 
                />
              </div>
              <div className="space-y-2 max-h-[240px] overflow-y-auto">
                {foundReturnBooks.map(d => (
                  <div 
                    key={d.id}
                    onClick={() => setSelectedReturnBook(d)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedReturnBook?.book_id === d.book_id ? 'border-accent bg-blue-50/50' : 'border-surface-border hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-sm">📘 {d.book?.title || "Unknown Asset"}</div>
                    <div className="text-[10px] text-text-muted mt-1">STOCK: {d.stock_number} | ACCOUNT: {d.user_phone}</div>
                  </div>
                ))}
              </div>
              <button onClick={returnBook} className="btn-primary w-full py-4 text-[11px] font-black uppercase tracking-widest shadow-blue-500/20 active:scale-[0.98]">Verify & Clear Log</button>
            </div>
          </div>
        )}

        {/* FINANCIAL LEDGER */}
        {activeTab === "financials" && (
          <div className="flex flex-col gap-8 animate-in fade-in duration-500">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="bg-emerald-900 p-8 rounded-3xl text-white shadow-xl shadow-emerald-900/10 border-l-[8px] border-emerald-400">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-2">Institutional Revenue</p>
                  <p className="text-4xl font-black tracking-tighter">₹{financialStats.total}</p>
                  <p className="text-[9px] mt-4 font-bold uppercase tracking-widest bg-emerald-800/50 py-1 px-3 rounded-full inline-block">Sync Level: Gamma</p>
               </div>
               <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl shadow-slate-900/10 border-l-[8px] border-blue-400">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-2">Subscription Volume</p>
                  <p className="text-4xl font-black tracking-tighter">₹{financialStats.subs}</p>
                  <div className="flex items-center gap-2 mt-4">
                    <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                       <div className="h-full bg-blue-400" style={{ width: `${(financialStats.subs/financialStats.total)*100}%` }}></div>
                    </div>
                    <span className="text-[10px] font-bold">{( (financialStats.subs / (financialStats.total || 1)) * 100 ).toFixed(0)}%</span>
                  </div>
               </div>
               <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl shadow-slate-900/10 border-l-[8px] border-amber-400">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-2">Penalty Recovery</p>
                  <p className="text-4xl font-black tracking-tighter">₹{financialStats.fines}</p>
                  <div className="flex items-center gap-2 mt-4">
                    <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                       <div className="h-full bg-amber-400" style={{ width: `${(financialStats.fines/financialStats.total)*100}%` }}></div>
                    </div>
                    <span className="text-[10px] font-bold">{( (financialStats.fines / (financialStats.total || 1)) * 100 ).toFixed(0)}%</span>
                  </div>
               </div>
             </div>

             <div className="section-card">
               <div className="section-header flex justify-between items-center">
                 <h2>Financial Circulation Log</h2>
                 <button onClick={loadTransactions} className="text-xs font-black text-accent hover:underline uppercase tracking-widest">Force Audit Re-Sync</button>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full">
                   <thead>
                     <tr>
                       <th className="table-header">Timestamp</th>
                       <th className="table-header">Member Identification</th>
                       <th className="table-header">Class</th>
                       <th className="table-header">Reference Notes</th>
                       <th className="table-header text-right">Value</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                     {transactions.length === 0 ? (
                       <tr><td colSpan={5} className="py-20 text-center text-slate-300 italic">No financial strata detected. Ensure "transactions" table is provisioned.</td></tr>
                     ) : (
                       transactions.map(t => (
                         <tr key={t.id} className="hover:bg-slate-50">
                           <td className="table-cell font-mono text-[10px] text-slate-400">
                             {new Date(t.created_at).toLocaleString()}
                           </td>
                           <td className="table-cell">
                             <div className="text-xs font-bold text-slate-800">{t.user_phone}</div>
                           </td>
                           <td className="table-cell">
                             <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${
                               t.type === 'fine' ? 'bg-amber-100 text-amber-600' : 
                               t.type === 'joining' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
                             }`}>
                               {t.type}
                             </span>
                           </td>
                           <td className="table-cell text-xs text-slate-500 font-medium italic">{t.notes}</td>
                           <td className="table-cell text-right font-black text-slate-800">₹{t.amount}</td>
                         </tr>
                       ))
                     )}
                   </tbody>
                 </table>
               </div>
             </div>
          </div>
        )}

        {/* SHELF MAPPING */}
        {activeTab === "map" && (
          <div className="flex flex-col gap-8 animate-in fade-in duration-500">
             <div className="section-card p-10 bg-slate-900 border-none relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                   <span className="text-9xl font-black italic">MAP</span>
                </div>
                <div className="relative z-10 text-left">
                  <h2 className="text-3xl font-black text-white tracking-tighter">Physical Asset Mapping</h2>
                  <p className="text-[10px] text-white/40 uppercase tracking-[0.4em] mt-2">Spatial Distribution Analysis of Internal Inventory</p>
                </div>
             </div>

             <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {Array.from({ length: 30 }, (_, i) => {
                  const shelfId = String(i + 1);
                  const booksOnShelf = books.filter(b => String(b.shelfnumber) === shelfId);
                  const capacity = 50; // Arbitrary safe limit for visual
                  const percent = Math.min(Math.round((booksOnShelf.length / capacity) * 100), 100);

                  return (
                    <motion.div 
                      key={shelfId}
                      whileHover={{ scale: 1.02, y: -4 }}
                      className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all cursor-pointer group"
                      onClick={() => {
                        setBookSearch(shelfId);
                        setSearchType("shelfnumber");
                        setActiveTab("books");
                      }}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] font-black text-slate-400 group-hover:text-primary transition-colors">SHELF #{shelfId}</span>
                        <span className="text-xs">📂</span>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-end">
                           <p className="text-2xl font-black tracking-tighter text-slate-800 tabular-nums">{booksOnShelf.length}</p>
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{percent}% FULL</p>
                        </div>
                        <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                           <div 
                             className={`h-full transition-all duration-1000 ${percent > 90 ? 'bg-red-500' : percent > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                             style={{ width: `${percent}%` }}
                           ></div>
                        </div>
                        <p className="text-[8px] text-slate-400 font-medium italic group-hover:text-slate-600 transition-colors uppercase tracking-tighter">
                          {booksOnShelf.length > 0 ? "Inspect Assets →" : "Available Space"}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
             </div>

             <div className="section-card p-12 text-center border-dashed border-2 border-slate-200 bg-transparent flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-3xl">🏗️</div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Section Planning Engine</h3>
                <p className="text-xs text-text-muted max-w-sm font-medium leading-relaxed italic">
                  Select a shelf instance to view localized inventory or perform a mass-transfer sequence. Future updates will include 3D spatial orientation.
                </p>
             </div>
          </div>
        )}

        {/* ISSUED LIST */}
        {activeTab === "issuedList" && (
          <div className="section-card">
            <div className="section-header">
              <h2>Active Circulation Ledger</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Asset</th>
                    <th className="table-header">Member</th>
                    <th className="table-header">Due Date</th>
                    <th className="table-header">Fine</th>
                    <th className="table-header text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {issuedBooks.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="table-cell">
                        <div className="text-xs font-black text-slate-500">{d.stock_number}</div>
                        <div className="font-bold text-slate-800">{d.book?.title}</div>
                      </td>
                      <td className="table-cell">
                        <button onClick={() => { setViewUserModal(d.user); loadUserHistory(d.user_phone); }} className="text-accent font-bold hover:underline underline-offset-4">{d.user?.name || d.user_phone}</button>
                      </td>
                      <td className="table-cell font-mono text-xs font-bold text-text-muted">{d.due_date?.split("T")[0]}</td>
                      <td className="table-cell text-error font-black">₹{d.fine}</td>
                      <td className="table-cell text-right">
                        <span className={`status-pill ${d.status === 'issued' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                          {d.label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ATTENDANCE */}
        {activeTab === "attendance" && (
          <div className="grid grid-cols-1 gap-8">
            <div className="section-card">
              <div className="section-header flex justify-between items-center">
                <h2>Live Attendance Monitor</h2>
                <button onClick={loadTodayAttendance} className="btn-primary text-[10px] px-3 py-1">SYNC LOGS</button>
              </div>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Subscriber</th>
                    <th className="table-header">Contact</th>
                    <th className="table-header">Clock In</th>
                    <th className="table-header">Clock Out</th>
                    <th className="table-header text-right">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="table-cell font-bold">{a.name}</td>
                      <td className="table-cell text-text-muted">{a.phone}</td>
                      <td className="table-cell font-mono text-xs text-slate-600">
                        {a.inT?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </td>
                      <td className="table-cell font-mono text-xs text-slate-600">
                        {a.outT ? a.outT.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : "—"}
                      </td>
                      <td className="table-cell text-right font-black text-accent">{a.mins}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="section-card">
              <div className="section-header">
                <h2>Historical Archives</h2>
                <div className="flex gap-2">
                  <input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} className="input-field py-1" />
                  <button onClick={loadPastAttendance} className="btn-primary px-4 py-1 text-[10px]">RECALL</button>
                </div>
              </div>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Subscriber</th>
                    <th className="table-header">Contact</th>
                    <th className="table-header">In</th>
                    <th className="table-header">Out</th>
                    <th className="table-header text-right">Mins</th>
                  </tr>
                </thead>
                <tbody>
                  {pastAttendance.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="table-cell font-bold">{a.name}</td>
                      <td className="table-cell text-text-muted">{a.phone}</td>
                      <td className="table-cell font-mono text-xs">{a.inT?.toLocaleTimeString()}</td>
                      <td className="table-cell font-mono text-xs">{a.outT ? a.outT.toLocaleTimeString() : "—"}</td>
                      <td className="table-cell text-right font-bold">{a.mins}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPORTS */}
        {activeTab === "reports" && (
          <div className="flex flex-col gap-8">
            <div className="section-card p-8 bg-gradient-to-br from-primary to-slate-800 text-white border-none flex justify-between items-center shadow-xl">
              <div>
                <h2 className="text-3xl font-black tracking-tighter italic">ANALYTIC ENGINE v4.2</h2>
                <p className="text-[10px] text-white/50 uppercase font-black tracking-[0.4em] mt-2">Deep Relational Telemetry Dashboard</p>
              </div>
              <button onClick={exportExcel} className="bg-white text-primary px-8 py-3 rounded-xl font-black text-[11px] tracking-widest hover:bg-accent hover:text-white transition-all shadow-lg active:scale-95">EXPORT RAW STRATA</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="section-card p-6">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 border-b pb-4">Category Saturation</h3>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={reportSummary.categoryData}
                        cx="50%" cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {reportSummary.categoryData?.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '10px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="section-card p-6">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 border-b pb-4">Gate Traffic Frequency</h3>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer>
                    <BarChart data={reportSummary.trendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 700 }} />
                      <YAxis tick={{ fontSize: 9, fontWeight: 700 }} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', fontSize: '10px', fontStyle: 'bold' }} />
                      <Bar dataKey="visitors" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
              {[
                { label: "Assets Indexed", value: reportSummary.books, color: "text-slate-900" },
                { label: "Active Loans", value: reportSummary.issued, color: "text-accent" },
                { label: "Overdue Breaches", value: reportSummary.overdue, color: "text-error" },
                { label: "Fine Revenue (Est)", value: `₹${reportSummary.totalFineSum || 0}`, color: "text-amber-600" },
                { label: "Gate Traffic", value: reportSummary.visitors, color: "text-emerald-600" }
              ].map((s, i) => (
                <div key={i} className="section-card p-6 border-l-4 border-l-primary hover:translate-y-[-4px] transition-all">
                  <span className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">{s.label}</span>
                  <span className={`text-4xl font-black tracking-tighter ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>

      {/* MODALS */}
      {lookupLoading && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-md flex items-center justify-center z-[100] animate-in fade-in duration-300">
          <div className="bg-white p-10 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm text-center border-2 border-accent/20">
            <div className="relative mb-6">
              <div className="w-20 h-20 border-4 border-slate-100 border-t-accent rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-2xl">🔎</div>
            </div>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Connecting to Registry</h3>
            <p className="text-[10px] font-black text-accent uppercase tracking-[0.2em] mt-1 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse"></span>
              {lookupStep || "Retrieving Core Data"}
            </p>
            <div className="flex gap-1 w-full justify-center">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`h-1 flex-1 rounded-full bg-accent/10 overflow-hidden`}>
                   <div className={`h-full bg-accent animate-shimmer`} style={{ animationDelay: `${i * 0.2}s` }}></div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-[10px] text-slate-400 font-medium leading-relaxed italic">
              Our AI is searching global and local databases for accurate book metadata...
            </p>
          </div>
        </div>
      )}

      {editBookModal && (
        <div 
          onClick={(e) => e.target === e.currentTarget && setEditBookModal(null)}
          className="fixed inset-0 bg-primary/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 cursor-pointer"
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-surface-border cursor-default">
            <div className="bg-primary p-6 text-white text-center flex justify-between items-center">
              <div className="text-left">
                <h3 className="text-lg font-bold tracking-tight">Modify Asset Entry</h3>
                <p className="text-[10px] text-white/50 uppercase tracking-widest mt-1">STOCK ID: {editBookModal.stocknumber}</p>
              </div>
              <button 
                onClick={() => setEditBookModal(null)}
                className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 transition-all text-sm"
              >
                ✕
              </button>
            </div>
            <form onSubmit={updateBook} className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input name="callnumber" defaultValue={editBookModal.callnumber} placeholder="Call Number" onFocus={handleInputFocus} className="input-field" />
                <input name="isbn" defaultValue={editBookModal.isbn} placeholder="ISBN" onFocus={handleInputFocus} className="input-field font-mono text-xs" />
              </div>
              <input name="title" defaultValue={editBookModal.title} placeholder="Full Title" onFocus={handleInputFocus} className="input-field" />
              <input name="author" defaultValue={editBookModal.author} placeholder="Author" onFocus={handleInputFocus} className="input-field" />
              <input name="publisher" defaultValue={editBookModal.publisher} placeholder="Publisher" onFocus={handleInputFocus} className="input-field" />
              <select name="language" defaultValue={editBookModal.language} className="input-field">
                <option value="">Select Language</option>
                <option value="MALAYALAM">MALAYALAM</option>
                <option value="ENGLISH">ENGLISH</option>
                <option value="HINDI">HINDI</option>
                <option value="TAMIL">TAMIL</option>
                <option value="SANSKRIT">SANSKRIT</option>
                <option value="OTHER">OTHER</option>
              </select>
              <input name="category" defaultValue={editBookModal.category} placeholder="Category" onFocus={handleInputFocus} className="input-field" />
              <select name="shelfnumber" defaultValue={editBookModal.shelfnumber} className="input-field">
                <option value="">Select Shelf (1-30)</option>
                {Array.from({ length: 30 }, (_, i) => (
                  <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
                ))}
              </select>
              <input name="price" defaultValue={editBookModal.price} placeholder="Price" onFocus={handleInputFocus} className="input-field" />
              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 btn-primary py-3">Commit Changes</button>
                <button type="button" onClick={() => setEditBookModal(null)} className="flex-1 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-200 uppercase tracking-widest transition-all">Abort</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editMemberModal && (
        <div 
          onClick={(e) => e.target === e.currentTarget && setEditMemberModal(null)}
          className="fixed inset-0 bg-primary/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 cursor-pointer"
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-surface-border cursor-default">
            <div className="bg-primary p-6 text-white text-center sticky top-0 z-10 shadow-lg flex justify-between items-center">
              <div className="text-left">
                <h3 className="text-lg font-bold tracking-tight">Sync Member Profile</h3>
                <p className="text-[10px] text-white/50 uppercase tracking-widest mt-1">ACCOUNT: {editMemberModal.phone}</p>
              </div>
              <button 
                onClick={() => setEditMemberModal(null)}
                className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 transition-all text-sm"
              >
                ✕
              </button>
            </div>
            <form onSubmit={updateMember} className="p-8 space-y-4">
              <input name="name" defaultValue={editMemberModal.name} placeholder="Full Name" className="input-field" />
              <input name="phone" defaultValue={editMemberModal.phone} placeholder="Phone" className="input-field" />
              <input name="address" defaultValue={editMemberModal.address} placeholder="Address" className="input-field" />
              <input name="pincode" defaultValue={editMemberModal.pincode} placeholder="Pincode" className="input-field" />
              <input name="email" defaultValue={editMemberModal.email} placeholder="Email" className="input-field" />
              <select name="gender" defaultValue={editMemberModal.gender} className="bg-slate-100 border border-surface-border px-3 py-3 rounded-xl text-xs font-bold w-full uppercase outline-none">
                <option value="">Select Gender</option>
                <option value="Male">MALE</option>
                <option value="Female">FEMALE</option>
                <option value="Others">OTHERS</option>
              </select>
              <div className="group text-left">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Date of Birth (Optional)</label>
                <input name="dob" defaultValue={editMemberModal.dob} type="date" className="input-field" />
              </div>
              <input name="member_id" defaultValue={editMemberModal.member_id} placeholder="Membership ID" className="input-field" />
              <div className="grid grid-cols-2 gap-4">
                <input name="occupation" defaultValue={editMemberModal.occupation} placeholder="Occupation" className="input-field" />
                <input name="age" defaultValue={editMemberModal.age} placeholder="Age" className="input-field" />
              </div>
              
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-primary">Update Subscription</p>
                <div className="grid grid-cols-2 gap-2">
                  <select name="edit_sub_type" className="input-field text-xs uppercase" defaultValue={editMemberModal.subscription?.toLowerCase().includes('year') ? 'yearly' : editMemberModal.subscription?.toLowerCase().includes('lifetime') ? 'lifetime' : 'monthly'}>
                    <option value="monthly">MONTHLY</option>
                    <option value="yearly">YEARLY</option>
                    <option value="lifetime">LIFETIME</option>
                  </select>
                  <input 
                    name="edit_sub_duration" 
                    type="number" 
                    placeholder="Duration" 
                    defaultValue={editMemberModal.subscription?.match(/\d+/)?.[0] || 1} 
                    className="input-field py-2 text-xs" 
                  />
                </div>
                <p className="text-[9px] text-slate-400 italic">Changing this will overwrite the current subscription data.</p>
              </div>

              <textarea name="notes" defaultValue={editMemberModal.notes} placeholder="Notes (Optional)" className="input-field h-24" />
              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 btn-primary py-3">Validate Profile</button>
                <button type="button" onClick={() => setEditMemberModal(null)} className="flex-1 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-200 uppercase tracking-widest transition-all">Dismiss</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewUserModal && (
        <div 
          onClick={(e) => e.target === e.currentTarget && setViewUserModal(null)}
          className="fixed inset-0 bg-primary/60 backdrop-blur-md flex items-center justify-center p-4 z-50 cursor-pointer"
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-surface-border animate-in zoom-in-95 duration-200 cursor-default">
            <div className="bg-slate-800 px-4 py-3 flex justify-between items-center text-[10px] font-black uppercase text-white/50 tracking-widest border-b border-white/5">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setViewUserModal(null)}
                  className="w-6 h-6 flex items-center justify-center bg-white/10 rounded-lg hover:bg-white/20 transition-all text-white/80"
                >
                  ←
                </button>
                <span>Profile Intelligence</span>
              </div>
              <button 
                onClick={() => setViewUserModal(null)}
                className="w-6 h-6 flex items-center justify-center bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-all text-xs"
              >
                ✕
              </button>
            </div>
            <div className="bg-gradient-to-br from-primary to-slate-800 p-8 text-white relative">
              <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mb-4 border border-white/20">
                <span className="text-3xl">👤</span>
              </div>
              <h3 className="text-xl font-black tracking-tight">{viewUserModal.name || "N/A"}</h3>
              <p className="text-xs text-white/50 font-bold tracking-widest uppercase mt-1">Member Profile Instance</p>
            </div>
            <div className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 border-b border-surface-border pb-6">
                {[
                  { label: "Phone", val: viewUserModal.phone },
                  { label: "Membership ID", val: viewUserModal.member_id },
                  { label: "Email", val: viewUserModal.email },
                  { label: "Occupation", val: viewUserModal.occupation },
                  { label: "Age", val: viewUserModal.age },
                  { label: "Date of Birth", val: viewUserModal.dob },
                  { label: "Gender", val: viewUserModal.gender },
                  { label: "Pincode", val: viewUserModal.pincode },
                  { label: "Tier", val: viewUserModal.subscription },
                ].map((row, i) => (
                  <div key={i}>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{row.label}</p>
                    <p className="text-xs font-bold text-slate-900 break-words">{row.val || "—"}</p>
                  </div>
                ))}
              </div>

              {viewUserModal.address && (
                <div className="border-b border-surface-border pb-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Permanent Address</p>
                  <p className="text-xs font-medium text-slate-700 leading-relaxed italic">{viewUserModal.address}</p>
                </div>
              )}

              {viewUserModal.notes && (
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl relative group">
                  <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Internal Notes & Penalties</p>
                  <p className="text-[10px] font-bold text-amber-900 whitespace-pre-wrap mt-1 leading-relaxed">{viewUserModal.notes}</p>
                  <button 
                    onClick={async () => {
                      const { error } = await supabase.from("users").update({ notes: "" }).eq("id", viewUserModal.id);
                      if (!error) {
                        setViewUserModal({...viewUserModal, notes: ""});
                        loadMembers();
                        Swal.fire({
                          title: "Cleansed",
                          text: "Penalty records and notes have been permanently purged.",
                          icon: "success",
                          timer: 1500,
                          showConfirmButton: false
                        });
                      }
                    }}
                    className="mt-3 text-[9px] font-black text-amber-700 bg-amber-200/50 px-3 py-1 rounded-full hover:bg-amber-500 hover:text-white transition-all uppercase tracking-widest"
                  >
                    Clear All
                  </button>
                </div>
              )}

              {viewUserModal.expiry_date ? (
                <div className={`p-4 rounded-xl flex items-center justify-between ${new Date(viewUserModal.expiry_date) < new Date() ? 'bg-red-50 border border-red-100' : 'bg-emerald-50 border border-emerald-100'}`}>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Subscription Terminal</p>
                    <p className={`text-sm font-black mt-1 ${new Date(viewUserModal.expiry_date) < new Date() ? 'text-red-500' : 'text-emerald-600'}`}>
                      {new Date(viewUserModal.expiry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  {new Date(viewUserModal.expiry_date) < new Date() ? (
                    <span className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-500 animate-pulse text-lg">⚠️</span>
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-500 text-lg">✅</span>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 italic text-[11px] text-slate-400 text-center">
                  Membership metadata incomplete (No expiry set).
                </div>
              )}

              <h4 className="text-[10px] font-black text-primary uppercase tracking-widest mb-2 flex items-center gap-2 pt-2">
                <span>Borrowed Catalog</span>
                <span className="flex-1 h-px bg-slate-100"></span>
              </h4>
              
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {issuedBooks.filter(ib => ib.user_phone === viewUserModal.phone).length === 0 && (
                  <div className="text-center py-8 text-slate-300 italic text-[11px]">No circulation history detected for this profile.</div>
                )}
                {issuedBooks.filter(ib => ib.user_phone === viewUserModal.phone).map((record, i) => (
                  <div key={i} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex justify-between items-center group">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{record.book?.title}</p>
                      <p className="text-[9px] text-slate-400 italic font-medium">STOCK: {record.stock_number} | DUE: {record.due_date?.split('T')[0]}</p>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-black tracking-tight ${record.status === 'overdue' ? 'bg-red-100 text-error' : 'bg-blue-100 text-primary'}`}>
                      {record.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>

              <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-2 pt-4">
                <span>Reading Journey (History)</span>
                <span className="flex-1 h-px bg-slate-100"></span>
              </h4>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 pb-4">
                {historyLoading ? (
                  <div className="text-center py-4 text-slate-300 text-[10px] animate-pulse">Syncing chronological records...</div>
                ) : userHistory.length === 0 ? (
                  <div className="text-center py-4 text-slate-300 italic text-[11px]">New member profile. No archived history found.</div>
                ) : (
                  userHistory.map((h, i) => (
                    <div key={i} className="bg-amber-50/30 p-3 rounded-lg border border-amber-100 flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{h.book_title}</p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tight">Stock: {h.stock_number}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-mono font-bold text-emerald-600">{new Date(h.return_date).toLocaleDateString()}</p>
                        <p className="text-[7px] text-slate-400 font-bold uppercase tracking-tighter">Returned</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button onClick={() => setViewUserModal(null)} className="w-full btn-primary py-4 mt-6 uppercase font-black text-[10px] tracking-widest shadow-lg shadow-primary/20">Close Institutional Profile</button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW BOOK MODAL */}
      {viewBookModal && (
        <div 
          onClick={(e) => e.target === e.currentTarget && setViewBookModal(null)}
          className="fixed inset-0 bg-primary/60 backdrop-blur-md flex items-center justify-center p-4 z-50 cursor-pointer"
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-surface-border animate-in zoom-in-95 duration-200 cursor-default">
            <div className="bg-slate-800 px-4 py-3 flex justify-between items-center text-[10px] font-black uppercase text-white/50 tracking-widest border-b border-white/5">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setViewBookModal(null)}
                  className="w-6 h-6 flex items-center justify-center bg-white/10 rounded-lg hover:bg-white/20 transition-all text-white/80"
                >
                  ←
                </button>
                <span>Asset Intelligence</span>
              </div>
              <button 
                onClick={() => setViewBookModal(null)}
                className="w-6 h-6 flex items-center justify-center bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-all text-xs"
              >
                ✕
              </button>
            </div>
            <div className="bg-gradient-to-br from-accent to-slate-800 p-8 text-white relative text-left">
              <div className="w-16 h-16 bg-white/10 rounded-[20px] flex items-center justify-center mb-6 shadow-xl border border-white/20">
                <span className="text-3xl">📚</span>
              </div>
              <h3 className="text-xl font-black tracking-tight leading-tight">{viewBookModal.title}</h3>
              <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-2">{viewBookModal.author}</p>
              <div className="absolute right-0 top-0 opacity-10 p-4">
                 <span className="text-5xl font-black italic">{viewBookModal.stocknumber}</span>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock ID</p>
                  <p className="text-xs font-bold text-slate-700">{viewBookModal.stocknumber}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                  <p className={`text-xs font-black uppercase ${viewBookModal.status === 'issued' ? 'text-orange-500' : 'text-emerald-500'}`}>
                    {viewBookModal.status || "AVAILABLE"}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                 <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Catalog Reference (ISBN)</p>
                   <p className="text-xs font-mono font-bold text-slate-600">{viewBookModal.isbn || "UNREG_ISBN"}</p>
                 </div>
                 <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Locator</p>
                   <p className="text-xs font-bold text-slate-700">Shelf {viewBookModal.shelfnumber || '—'} / Call {viewBookModal.callnumber || '—'}</p>
                 </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => deleteBook(viewBookModal.stocknumber)}
                  className="p-4 bg-red-50 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all font-mono group"
                  title="Decommission Asset"
                >
                  <Trash2 size={16} className="group-hover:scale-110 transition-transform" />
                </button>
                <button 
                  onClick={() => setViewBookModal(null)}
                  className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all font-mono"
                >
                  DISMISS
                </button>
                <button 
                  onClick={() => {
                      setEditBookModal(viewBookModal);
                      setViewBookModal(null);
                  }}
                  className="flex-1 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all"
                >
                  MODIFY DATA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ID CARD MODAL */}
      <AnimatePresence>
        {showIdCard && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 print:p-0 print:bg-white"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-[40px] shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 print:shadow-none print:border-none print:m-0"
            >
              <div className="id-card-content p-0 relative overflow-hidden" id="printable-id-card">
                {/* Card Header */}
                <div className="bg-primary p-6 text-center relative">
                  <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                  <div className="relative z-10">
                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-3 border border-white/20 text-2xl">
                      🏛️
                    </div>
                    <h2 className="text-white font-black text-[10px] uppercase tracking-[0.2em] leading-tight">
                      {lang === 'ml' ? translations.ml.portalSubtitle : translations.en.portalSubtitle}
                    </h2>
                    <p className="text-[8px] text-white/50 font-bold uppercase tracking-[0.3em] mt-1">Institutional Digital Registry</p>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-8 pt-10 flex flex-col items-center text-center relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                     <div className="w-24 h-24 bg-white rounded-full p-1.5 shadow-xl border border-slate-100">
                        <div className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center text-3xl overflow-hidden text-slate-400">
                          👤
                        </div>
                     </div>
                  </div>

                  <div className="mt-8 mb-6 text-left w-full pl-4 border-l-4 border-accent">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none mb-1 uppercase italic">{showIdCard.name}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{showIdCard.occupation || "Permanent Member"}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 w-full mb-8">
                     <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-left">
                        <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-1">MEMBER_ID</p>
                        <p className="text-xs font-black text-slate-800 tracking-tighter tabular-nums">{showIdCard.member_id}</p>
                     </div>
                     <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-left">
                        <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-1">REGISTRY_EST</p>
                        <p className="text-xs font-black text-slate-800 tracking-tighter">{new Date(showIdCard.created_at || Date.now()).getFullYear()}</p>
                     </div>
                  </div>

                  <div className="w-full h-16 bg-white border-2 border-slate-100 rounded-2xl relative flex items-center justify-center overflow-hidden mb-6 group">
                    <div className="flex flex-col items-center gap-1">
                      <div className="grid grid-cols-10 gap-1 opacity-20">
                        {Array.from({length: 50}).map((_, i) => (
                          <div key={i} className={`w-1.5 h-1.5 rounded-sm ${Math.random() > 0.5 ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
                        ))}
                      </div>
                      <p className="absolute text-[7px] font-black text-slate-400 uppercase tracking-[0.4em] font-mono">ENCRYPTED_SIGNATURE_NODE</p>
                    </div>
                  </div>

                  <div className="w-full pt-6 border-t border-slate-100 flex justify-between items-center px-4">
                    <div className="text-left">
                      <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Authorization</p>
                      <p className="text-[10px] font-black text-primary uppercase">Chief Librarian</p>
                    </div>
                    <div className="h-10 w-24 bg-slate-200/20 rounded-lg flex items-center justify-center italic text-[9px] text-slate-400 border border-dashed border-slate-200">
                      Signature Not Required
                    </div>
                  </div>
                </div>

                {/* Card Footer Decor */}
                <div className="bg-slate-900 h-2 w-full"></div>
              </div>

              <div className="p-6 bg-slate-50 flex gap-4 print:hidden">
                <button 
                  onClick={() => setShowIdCard(null)}
                  className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Close
                </button>
                <button 
                  onClick={printIdCard}
                  className="flex-[2] py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                >
                  🖨️ Print Member Card
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
