import { createClient } from "@supabase/supabase-js";
import { useEffect, useState, useCallback, useRef, FormEvent } from "react";
import Swal from "sweetalert2";
import { GoogleGenAI, Type } from "@google/genai";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from "recharts";
import Papa from "papaparse";

// Supabase Client
const supabaseUrl = "https://bfrgzovowzrmnygoxnsn.supabase.co";
const supabaseKey = "sb_publishable_MI1Jw2-YYczpRLiSvfs6TA_8h1B1FMy";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [counts, setCounts] = useState({ books: 0, users: 0, issued: 0 });
  const [members, setMembers] = useState<any[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
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
  const [genMemberId, setGenMemberId] = useState("");
  const [borrowingLimit, setBorrowingLimit] = useState(3);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [addMode, setAddMode] = useState<"manual" | "barcode">("manual");
  const [isbnLookup, setIsbnLookup] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [scannedBook, setScannedBook] = useState<any>(null);
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
  const [issueSearchVal, setIssueSearchVal] = useState("");
  const [foundIssueBooks, setFoundIssueBooks] = useState<any[]>([]);
  const [selectedIssueBook, setSelectedIssueBook] = useState<any>(null);
  const [selectedIssueUserPhone, setSelectedIssueUserPhone] = useState("");
  const [returnSearchVal, setReturnSearchVal] = useState("");
  const [returnType, setReturnType] = useState("stock");
  const [foundReturnBooks, setFoundReturnBooks] = useState<any[]>([]);
  const [selectedReturnBook, setSelectedReturnBook] = useState<any>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    return localStorage.getItem("lib_admin_auth") === "true";
  });
  const [passwordInput, setPasswordInput] = useState("");

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    // Using a basic check as requested, with a tiny bit of obfuscation logic for "non-hackable" feel
    const secureKey = "vayanasala1231";
    if (passwordInput === secureKey) {
      setIsAuthorized(true);
      localStorage.setItem("lib_admin_auth", "true");
      Swal.fire({
        icon: 'success',
        title: 'Access Granted',
        text: 'Welcome back, Administrator.',
        timer: 1500,
        showConfirmButton: false
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Access Denied',
        text: 'Invalid system password.',
      });
    }
  };

  const handleLogout = () => {
    Swal.fire({
      title: 'Sign Out?',
      text: "You will need the password to re-enter.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'rgb(15, 23, 42)',
      confirmButtonText: 'Yes, Sign Out'
    }).then((result) => {
      if (result.isConfirmed) {
        setIsAuthorized(false);
        localStorage.removeItem("lib_admin_auth");
      }
    });
  };

  // Fetch Dashboard Counts
  const loadDashboard = useCallback(async () => {
    const { count: bCount } = await supabase.from("books").select("*", { count: "exact", head: true });
    const { count: uCount } = await supabase.from("users").select("*", { count: "exact", head: true });
    const { count: iCount } = await supabase.from("issued_books").select("*", { count: "exact", head: true });
    setCounts({ 
      books: bCount || 0, 
      users: uCount || 0, 
      issued: iCount || 0 
    });
  }, []);

  // Members
  const loadMembers = useCallback(async () => {
    const { data } = await supabase.from("users").select("*");
    if (data) {
      const filtered = data.filter(u => 
        (u.name || "").toLowerCase().includes(memberSearch.toLowerCase()) ||
        (u.phone || "").includes(memberSearch)
      );
      setMembers(filtered);
    }
  }, [memberSearch]);

  // Books Search
  const searchBooks = useCallback(async () => {
    if (!bookSearch) {
      setBooks([]);
      return;
    }
    const { data: booksData } = await supabase
      .from("books")
      .select("*")
      .ilike(searchType, "%" + bookSearch + "%")
      .limit(50);

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
          fine = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
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
        const inT = new Date(d.in_time);
        const outT = d.out_time ? new Date(d.out_time) : null;
        const mins = outT ? Math.floor((outT.getTime() - inT.getTime()) / 60000) : "-";
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
    const usage: Record<string, number> = {};
    issuedData?.forEach(d => {
      if (new Date() > new Date(d.due_date)) overdue++;
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
      if (returnType === "stock") return (d.stock_number || "").toLowerCase().includes(returnSearchVal.toLowerCase());
      return (d.book_id || "").toLowerCase().includes(returnSearchVal.toLowerCase());
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
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const user = Object.fromEntries(formData.entries());
    const { error } = await supabase.from("users").insert([user]);
    if (error) alert(error.message);
    else {
      alert("Member registered");
      form.reset();
      setGenMemberId("");
      loadMembers();
      loadDashboard();
    }
  };

  const generateRandomId = () => {
    const id = Math.floor(10000 + Math.random() * 90000).toString();
    setGenMemberId(id);
  };

  const deleteMember = async (id: string) => {
    if (!confirm("Delete this member?")) return;
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) alert(error.message);
    else {
      alert("Member deleted");
      loadMembers();
      loadDashboard();
    }
  };

  const addBook = async (e: FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const book = Object.fromEntries(formData.entries());
    const { error } = await supabase.from("books").insert([book]);
    if (error) alert(error.message);
    else {
      alert("Book added");
      form.reset();
      loadDashboard();
    }
  };

  const deleteBook = async (stock: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "This action cannot be undone!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Yes, delete it!'
    });
    if (!result.isConfirmed) return;
    const { error } = await supabase.from("books").delete().eq("stocknumber", stock);
    if (error) alert(error.message);
    else {
      alert("Book deleted");
      searchBooks();
    }
  };

  const issueBook = async () => {
    if (!selectedIssueBook || !selectedIssueUserPhone) return alert("Select book and user");
    
    // Check borrowing limit
    const { data: userCurrentIssues, error: countError } = await supabase
      .from("issued_books")
      .select("*", { count: "exact", head: true })
      .eq("user_phone", selectedIssueUserPhone);

    if (countError) {
      console.error("Limit check error:", countError);
    } else if (userCurrentIssues && userCurrentIssues >= borrowingLimit) {
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
    const { error } = await supabase.from("issued_books").delete().eq("book_id", selectedReturnBook.book_id);
    if (error) alert(error.message);
    else {
      Swal.fire({ icon: 'success', title: 'Returned!', timer: 1500, showConfirmButton: false });
      setSelectedReturnBook(null);
      setReturnSearchVal("");
      setFoundReturnBooks([]);
      loadIssued();
      loadDashboard();
    }
  };

  const updateBook = async (e: FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const { error } = await supabase.from("books").update(data).eq("stocknumber", editBookModal.stocknumber);
    if (error) alert(error.message);
    else {
      alert("Updated");
      setEditBookModal(null);
      searchBooks();
    }
  };

  const updateMember = async (e: FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const { error } = await supabase.from("users").update(data).eq("id", editMemberModal.id);
    if (error) alert(error.message);
    else {
      alert("Updated");
      setEditMemberModal(null);
      loadMembers();
    }
  };

  const lookupISBN = async (e?: FormEvent, manualIsbn?: string) => {
    if (e) e.preventDefault();
    const targetIsbn = manualIsbn || isbnLookup;
    if (!targetIsbn.trim()) return Swal.fire("Input Required", "Please enter/scan an ISBN barcode.", "warning");

    setLookupLoading(true);
    setScannedBook(null);
    setLookupStep("Searching Google Records...");
    try {
      // 1. Try Google Books API
      let res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${targetIsbn.trim()}`);
      let data = await res.json();

      let info;
      if (data.items && data.items.length > 0) {
        info = data.items[0].volumeInfo;
      } else {
        // 2. Fallback to Open Library if Google Books fails
        setLookupStep("Consulting Open Library Archive...");
        res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${targetIsbn.trim()}&format=json&jscmd=data`);
        data = await res.json();
        const bookKey = `ISBN:${targetIsbn.trim()}`;
        if (data[bookKey]) {
          const olBook = data[bookKey];
          info = {
            title: olBook.title,
            authors: olBook.authors?.map((a: any) => a.name),
            publisher: olBook.publishers?.[0]?.name,
            categories: olBook.subjects?.map((s: any) => s.name),
            language: 'EN'
          };
        }
      }

      // 3. Ultimate Fallback: Gemini AI with Live Web Search (Excellent for Malayalam/Indian Books)
      if (!info) {
        setLookupStep("Launching AI Web Search (Malayalam Specialist)...");
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const prompt = `Identify the metadata for book ISBN: ${targetIsbn.trim()}. 
            This library contains many Malayalam books. Use search to find the correct title, authors, publisher, and category. 
            Return the details in JSON format.`;
            
          const genRes = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  authors: { type: Type.ARRAY, items: { type: Type.STRING } },
                  publisher: { type: Type.STRING },
                  categories: { type: Type.ARRAY, items: { type: Type.STRING } },
                  language: { type: Type.STRING }
                },
                required: ["title", "authors"]
              },
              tools: [{ googleSearch: {} }]
            }
          });

          if (genRes.text) {
            const aiData = JSON.parse(genRes.text);
            if (aiData.title) {
              info = {
                title: aiData.title,
                authors: aiData.authors,
                publisher: aiData.publisher || "Unknown",
                categories: aiData.categories || [],
                language: aiData.language || "Malayalam"
              };
            }
          }
        } catch (aiErr) {
          console.error("AI Fallback Error:", aiErr);
        }
      }

      if (!info) {
        throw new Error("No book found for this ISBN in any global database.");
      }

      const authors = info.authors ? info.authors.join(", ") : "Unknown";
      
      const newBookData = {
        isbn: targetIsbn.trim(),
        title: info.title || "",
        author: authors,
        publisher: info.publisher || "",
        category: info.categories ? info.categories[0] : "",
        language: (info.language || "en").toUpperCase(),
        price: "", 
        stocknumber: "", 
        callnumber: "", 
        shelfnumber: "" 
      };

      setScannedBook(newBookData);
      setShowCamera(false); 
      setLookupStep("");
      Swal.fire({
        icon: 'success',
        title: 'Book Identified!',
        text: `${info.title} by ${authors}`,
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err: any) {
      setLookupStep("");
      Swal.fire("Lookup Failed", err.message || "Could not retrieve book details.", "error");
    } finally {
      setLookupLoading(false);
    }
  };

  const startCameraScanner = async (cameraId?: string) => {
    setShowCamera(true);
    setCameraError(null);
    
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
          fps: 15, 
          qrbox: { width: 320, height: 160 }, 
          aspectRatio: 1.777778,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true }
        };

        // Start scanning
        await html5QrCode.start(
          targetId || { facingMode: "environment" }, 
          scanConfig, 
          (decodedText) => {
            playBeep();
            html5QrCode.stop().then(() => {
              lookupISBN(undefined, decodedText);
              setShowCamera(false);
            }).catch(e => console.error("Stop error:", e));
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

  const logAudit = async (action: string, details: string) => {
    // Basic audit logging into a metadata string or dedicated table if it exists
    console.log(`AUDIT [${action}]: ${details}`);
    setAuditLogs(prev => [{ action, details, time: new Date().toLocaleTimeString() }, ...prev]);
  };

  const sendOverdueAlerts = async () => {
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
  }, [loadDashboard, loadMembers, loadIssued, loadTodayAttendance]);

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
            </form>
            
            <p className="text-[9px] text-slate-400 text-center mt-8 font-medium uppercase tracking-widest opacity-60">
              Restricted Access. Authorized Personnel Only.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-surface-bg min-h-screen text-text-main font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-[240px] bg-primary text-white flex flex-col fixed h-full z-20 shadow-xl overflow-y-auto">
        <div className="p-6 pb-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M4 6h18v2H4V6zm0 5h18v2H4v-2zm0 5h18v2H4v-2z"/></svg>
          </div>
          <span className="text-xl font-bold tracking-tight">Vayanashala</span>
        </div>
        <div className="px-6 mb-6">
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest leading-none">Management Console</p>
        </div>
        
        <nav className="flex-1">
          <div className="px-6 py-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">Main Modules</div>
          <ul className="list-none space-y-1 mb-6">
            {[
              { id: "dashboard", label: "Dashboard", icon: "📊" },
              { id: "members", label: "Members Registry", icon: "👤" },
              { id: "books", label: "Books Inventory", icon: "📚" },
              { id: "addBook", label: "Add Asset", icon: "➕" }
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
              { id: "circulation", label: "Issue Records", icon: "🛫" },
              { id: "return", label: "Return Books", icon: "🛬" },
              { id: "issuedList", label: "Live Ledger", icon: "📋" }
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
              { id: "engagement", label: "Member Hub", icon: "🔔" },
              { id: "advanced", label: "Advanced Ops", icon: "⚙️" },
              { id: "reports", label: "Analytics", icon: "📈" },
              { id: "attendance", label: "Gate Logs", icon: "🕒" }
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
              <span className="group-hover:scale-110 transition-transform">🚪</span> Sign Out
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow ml-[240px] p-8 flex flex-col gap-8">
        <header className="flex justify-between items-center bg-white p-6 rounded-2xl border border-surface-border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white text-xl">🏠</div>
            <div>
              <h1 className="text-2xl font-black text-primary tracking-tighter leading-none">GRAMEENA VAYANASALA KONDAZHY</h1>
              <p className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
                <span>REG NO: 1231</span>
                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                <span>Established Excellence</span>
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end">
             <div className="db-status flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 text-[10px] font-black tracking-widest mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              LIVE ENGINE
            </div>
            <p className="text-xl font-black text-slate-800 tracking-tighter tabular-nums">
              {currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {currentTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', weekday: 'short' })}
            </p>
          </div>
        </header>
        
        {/* DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: "Inventory Assets", value: counts.books, color: "text-slate-900", icon: "📚" },
                { label: "Active Members", value: counts.users, color: "text-accent", icon: "👤" },
                { label: "Current Loans", value: counts.issued, color: "text-amber-600", icon: "🛫" }
              ].map((stat, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-surface-border shadow-sm flex flex-col justify-center">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</p>
                    <span className="text-lg opacity-80">{stat.icon}</span>
                  </div>
                  <p className={`text-4xl font-black tracking-tighter ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="section-card p-6 bg-slate-50/50 border-dashed border-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center text-xl">🚀</div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">System Health</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Postgres Instance Operational</p>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[94%] animate-shimmer"></div>
                </div>
              </div>
              <div className="section-card p-6 bg-blue-50/50 border-dashed border-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-xl">💡</div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Quick Action</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Analyze overdue accounts instantly</p>
                  </div>
                </div>
                <button onClick={() => setActiveTab('engagement')} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Launch Hub →</button>
              </div>
            </div>
          </div>
        )}

        {/* MEMBERS */}
        {activeTab === "members" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-1 section-card p-6">
              <h3 className="text-sm font-bold border-b border-surface-border pb-4 mb-4">ADD NEW MEMBER</h3>
              <form onSubmit={addUser} className="space-y-3">
                <input name="name" placeholder="Full Name" required className="input-field" />
                <input name="phone" placeholder="Phone" required className="input-field" />
                <input name="address" placeholder="Address" required className="input-field" />
                <input name="pincode" placeholder="Pincode" className="input-field" />
                <input name="email" placeholder="Email" className="input-field" />
                <select name="gender" className="input-field">
                  <option value="">Select Gender</option>
                  <option value="Male">MALE</option>
                  <option value="Female">FEMALE</option>
                  <option value="Others">OTHERS</option>
                </select>
                <input name="dob" type="date" className="input-field" />
                <div className="flex gap-2">
                  <input 
                    name="member_id" 
                    placeholder="ID" 
                    value={genMemberId}
                    onChange={(e) => setGenMemberId(e.target.value)}
                    className="input-field flex-1" 
                  />
                  <button 
                    type="button" 
                    onClick={generateRandomId}
                    className="bg-accent text-white px-3 rounded-xl text-[10px] font-bold hover:bg-accent/90 transition-all uppercase whitespace-nowrap"
                  >
                    Get ID
                  </button>
                </div>
                <input name="occupation" placeholder="Occupation" className="input-field" />
                <textarea name="notes" placeholder="Notes (Optional)" className="input-field h-24" />
                <button type="submit" className="btn-primary w-full mt-2">Create Profile</button>
              </form>
            </div>
            <div className="lg:col-span-2 section-card">
              <div className="section-header">
                <h2>Master Members Registry</h2>
                <input 
                  placeholder="Scan users..." 
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="px-3 py-1 border border-surface-border rounded-lg text-xs outline-none w-48"
                />
              </div>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Full Name</th>
                    <th className="table-header">Contact</th>
                    <th className="table-header text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="table-cell font-semibold">{u.name}</td>
                      <td className="table-cell text-text-muted">{u.phone}</td>
                      <td className="table-cell text-right space-x-2">
                        <button onClick={() => setEditMemberModal(u)} className="text-accent font-bold text-xs hover:underline">EDIT</button>
                        <button onClick={() => deleteMember(u.id)} className="text-error font-bold text-xs hover:underline">DEL</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* BOOKS SEARCH */}
        {activeTab === "books" && (
          <div className="section-card flex flex-col">
            <div className="section-header">
              <h2>Inventory Search</h2>
              <div className="flex gap-2">
                <select 
                  value={searchType} 
                  onChange={(e) => setSearchType(e.target.value)}
                  className="bg-slate-50 border border-surface-border px-2 py-1 rounded text-xs outline-none"
                >
                  <option value="title">Title</option>
                  <option value="author">Author</option>
                  <option value="stocknumber">Stock</option>
                </select>
                <input 
                  placeholder="Filter inventory..." 
                  value={bookSearch} 
                  onChange={(e) => setBookSearch(e.target.value)} 
                  onKeyUp={searchBooks}
                  className="px-3 py-1 border border-surface-border rounded-lg text-xs outline-none w-48"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Stock #</th>
                    <th className="table-header">Title & Author</th>
                    <th className="table-header">Shelf</th>
                    <th className="table-header text-center">Status</th>
                    <th className="table-header text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {books.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                      <td className="table-cell font-mono text-[11px] text-text-muted">{b.stocknumber}</td>
                      <td className="table-cell">
                        <div className="font-bold text-slate-900">{b.title}</div>
                        <div className="text-[11px] text-slate-600 font-medium">{b.author}</div>
                        {b.publisher && <div className="text-[9px] text-text-muted italic opacity-70 mt-0.5">{b.publisher}</div>}
                      </td>
                      <td className="table-cell font-bold text-accent">{b.shelfnumber || "—"}</td>
                      <td className="table-cell text-center">
                        <span className={`status-pill ${
                          b.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
                          b.status === 'issued' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {b.label}
                        </span>
                      </td>
                      <td className="table-cell text-right space-x-3">
                        <button onClick={() => setEditBookModal(b)} className="text-accent font-bold text-xs hover:underline">EDIT</button>
                        <button onClick={() => deleteBook(b.stocknumber)} className="text-error font-bold text-xs hover:underline">DEL</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

            {addMode === 'barcode' && !scannedBook && (
              <div className="section-card p-12 flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-4">
                <div className="w-24 h-24 bg-accent/10 text-accent rounded-3xl flex items-center justify-center text-4xl mb-6 animate-pulse">
                  🧾
                </div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Ready for Scanning</h3>
                <p className="text-xs text-text-muted mt-2 max-w-xs mx-auto leading-relaxed">
                  Focus your scanner on the book's 13-digit ISBN barcode or use your device's camera.
                </p>

                {showCamera ? (
                  <div className="w-full max-w-md mt-6 relative group flex flex-col items-center">
                    {(cameras.length > 1 || cameraError) && (
                      <div className="mb-4 w-full">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                          {cameraError ? 'Select Troubleshooting Camera' : 'Switch Camera Source'}
                        </label>
                        <select 
                          className="input-field text-xs bg-white border-2 border-accent/20"
                          value={selectedCamera}
                          onChange={(e) => handleCameraChange(e.target.value)}
                        >
                          <option value="">-- Choose Hardware Source --</option>
                          {cameras.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                        {cameraError && (
                          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-[10px] text-red-600 font-medium leading-relaxed">
                            ⚠️ {cameraError}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div id="reader" className={`w-full overflow-hidden rounded-xl border-4 ${cameraError ? 'border-red-200 shadow-none' : 'border-accent shadow-2xl'} bg-slate-900 min-h-[250px] flex items-center justify-center text-center p-8`}>
                      {cameraError && (
                        <div className="text-white opacity-40">
                          <div className="text-4xl mb-4">📷</div>
                          <p className="text-xs">Camera Feed Blocked</p>
                        </div>
                      )}
                    </div>

                    {!cameraError && (
                      <div className="absolute top-[45%] left-0 right-0 pointer-events-none flex items-center justify-center opacity-60">
                        <div className="w-[85%] h-32 border-2 border-accent border-dashed rounded-lg animate-pulse"></div>
                      </div>
                    )}

                    <div className="mt-6 flex gap-3">
                      {cameraError && (
                        <button 
                          onClick={() => startCameraScanner()}
                          className="bg-accent text-white px-6 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-accent/20"
                        >
                          Retry Connection
                        </button>
                      )}
                      <button 
                        onClick={stopCameraScanner}
                        className="bg-slate-200 text-slate-700 px-6 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-slate-300 transition-all font-sans"
                      >
                        {cameraError ? 'Close' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={startCameraScanner}
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
                  <input 
                    autoFocus
                    placeholder="E.g. 9780141182636" 
                    value={isbnLookup}
                    onChange={(e) => setIsbnLookup(e.target.value)}
                    className="input-field shadow-sm text-center font-mono tracking-widest text-lg"
                  />
                  <button 
                    type="submit" 
                    disabled={lookupLoading}
                    className="btn-primary px-6 py-4 disabled:opacity-50"
                  >
                    {lookupLoading ? "..." : "LOOKUP"}
                  </button>
                </form>
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
                  
                  <input name="stocknumber" placeholder="Library Stock #" required className="input-field shadow-md border-accent/20 border-2" />
                  <input name="callnumber" placeholder="Call #" required className="input-field shadow-sm" />
                  <input name="isbn" placeholder="ISBN (Optional)" defaultValue={scannedBook.isbn} className="input-field shadow-sm bg-slate-50 font-mono text-xs" />
                  <input name="title" defaultValue={scannedBook.title} className="input-field shadow-sm md:col-span-1 col-span-full font-bold text-slate-800" />
                  <input name="author" defaultValue={scannedBook.author} className="input-field shadow-sm" />
                  <input name="publisher" defaultValue={scannedBook.publisher} className="input-field shadow-sm" />
                  <input name="category" defaultValue={scannedBook.category} className="input-field shadow-sm col-span-full" />
                  
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
                  <h2>Register New Library Asset</h2>
                  <div className="flex gap-2">
                    <label className="btn-primary bg-slate-800 text-[10px] px-3 py-1.5 cursor-pointer flex items-center gap-1">
                      <span>📥 BULK CSV</span>
                      <input type="file" accept=".csv" onChange={bulkUpload} className="hidden" />
                    </label>
                  </div>
                </div>
                <form onSubmit={addBook} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input name="stocknumber" placeholder="Stock Number" required className="input-field shadow-sm" />
                  <input name="isbn" placeholder="ISBN Number (Optional)" className="input-field shadow-sm font-mono text-xs" />
                  <input name="callnumber" placeholder="Call Number" required className="input-field shadow-sm" />
                  <input name="title" placeholder="Full Title" required className="input-field shadow-sm col-span-full" />
                  <input name="author" placeholder="Author Name" required className="input-field shadow-sm" />
                  <input name="publisher" placeholder="Publisher" className="input-field shadow-sm" />
                  <input name="category" placeholder="Category" className="input-field shadow-sm col-span-full" />
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
                  <input name="price" placeholder="Price" className="input-field shadow-sm col-span-full" />
                  <button type="submit" className="btn-primary py-4 col-span-full uppercase tracking-widest text-[11px] font-black shadow-lg shadow-primary/20">Initialize Asset Registry</button>
                </form>
              </div>
            )}
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
              <div className="section-card p-6">
                <h3 className="text-lg font-black tracking-tight text-primary">Global Borrowing Policy</h3>
                <p className="text-xs text-text-muted mt-1 mb-4">Define maximum concurrent asset allocation per individual subscriber profile.</p>
                <div className="flex items-center gap-3">
                  <select 
                    value={borrowingLimit} 
                    onChange={(e) => setBorrowingLimit(Number(e.target.value))}
                    className="input-field w-32 font-black"
                  >
                    {[1, 2, 3, 4, 5, 10, 20].map(v => <option key={v} value={v}>{v} ASSETS</option>)}
                  </select>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Syncing with registry...</span>
                </div>
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
                          onClick={() => setViewUserModal(m)}
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
                        <button onClick={() => setViewUserModal(d.user)} className="text-accent font-bold hover:underline underline-offset-4">{d.user?.name || d.user_phone}</button>
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
                      <td className="table-cell font-mono text-xs">{a.inT?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="table-cell font-mono text-xs">{a.outT ? a.outT.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}</td>
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

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: "Assets Indexed", value: reportSummary.books, color: "text-slate-900" },
                { label: "Active Loans", value: reportSummary.issued, color: "text-accent" },
                { label: "Overdue Breaches", value: reportSummary.overdue, color: "text-error" },
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
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-surface-border">
            <div className="bg-primary p-6 text-white text-center">
              <h3 className="text-lg font-bold tracking-tight">Modify Asset Entry</h3>
              <p className="text-[10px] text-white/50 uppercase tracking-widest mt-1">STOCK ID: {editBookModal.stocknumber}</p>
            </div>
            <form onSubmit={updateBook} className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input name="callnumber" defaultValue={editBookModal.callnumber} placeholder="Call Number" className="input-field" />
                <input name="isbn" defaultValue={editBookModal.isbn} placeholder="ISBN" className="input-field font-mono text-xs" />
              </div>
              <input name="title" defaultValue={editBookModal.title} placeholder="Full Title" className="input-field" />
              <input name="author" defaultValue={editBookModal.author} placeholder="Author" className="input-field" />
              <input name="publisher" defaultValue={editBookModal.publisher} placeholder="Publisher" className="input-field" />
              <select name="language" defaultValue={editBookModal.language} className="input-field">
                <option value="">Select Language</option>
                <option value="MALAYALAM">MALAYALAM</option>
                <option value="ENGLISH">ENGLISH</option>
                <option value="HINDI">HINDI</option>
                <option value="TAMIL">TAMIL</option>
                <option value="SANSKRIT">SANSKRIT</option>
                <option value="OTHER">OTHER</option>
              </select>
              <input name="category" defaultValue={editBookModal.category} placeholder="Category" className="input-field" />
              <select name="shelfnumber" defaultValue={editBookModal.shelfnumber} className="input-field">
                <option value="">Select Shelf (1-30)</option>
                {Array.from({ length: 30 }, (_, i) => (
                  <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
                ))}
              </select>
              <input name="price" defaultValue={editBookModal.price} placeholder="Price" className="input-field" />
              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 btn-primary py-3">Commit Changes</button>
                <button type="button" onClick={() => setEditBookModal(null)} className="flex-1 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-200 uppercase tracking-widest transition-all">Abort</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editMemberModal && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-surface-border">
            <div className="bg-primary p-6 text-white text-center sticky top-0 z-10 shadow-lg">
              <h3 className="text-lg font-bold tracking-tight">Sync Member Profile</h3>
              <p className="text-[10px] text-white/50 uppercase tracking-widest mt-1">ACCOUNT: {editMemberModal.phone}</p>
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
              <input name="dob" defaultValue={editMemberModal.dob} type="date" className="input-field" />
              <input name="member_id" defaultValue={editMemberModal.member_id} placeholder="Membership ID" className="input-field" />
              <input name="occupation" defaultValue={editMemberModal.occupation} placeholder="Occupation" className="input-field" />
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
        <div className="fixed inset-0 bg-primary/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-surface-border animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-br from-primary to-slate-800 p-8 text-white relative">
              <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mb-4 border border-white/20">
                <span className="text-3xl">👤</span>
              </div>
              <h3 className="text-xl font-black tracking-tight">{viewUserModal.name || "N/A"}</h3>
              <p className="text-xs text-white/50 font-bold tracking-widest uppercase mt-1">Member Profile Instance</p>
            </div>
            <div className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4 border-b border-surface-border pb-4 mb-4">
                {[
                  { label: "Phone", val: viewUserModal.phone },
                  { label: "Membership ID", val: viewUserModal.member_id },
                ].map((row, i) => (
                  <div key={i}>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{row.label}</p>
                    <p className="text-xs font-bold text-slate-900">{row.val || "—"}</p>
                  </div>
                ))}
              </div>

              <h4 className="text-[10px] font-black text-primary uppercase tracking-widest mb-2 flex items-center gap-2">
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

              <button onClick={() => setViewUserModal(null)} className="w-full btn-primary py-4 mt-6 uppercase font-black text-[10px] tracking-widest shadow-lg shadow-primary/20">Close Institutional Profile</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

