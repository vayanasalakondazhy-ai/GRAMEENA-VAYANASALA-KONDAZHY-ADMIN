import { createClient } from "@supabase/supabase-js";
import { useEffect, useState, useCallback, useRef, FormEvent } from "react";
import Swal from "sweetalert2";

// Supabase Client
const supabaseUrl = "https://bfrgzovowzrmnygoxnsn.supabase.co";
const supabaseKey = "sb_publishable_MI1Jw2-YYczpRLiSvfs6TA_8h1B1FMy";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
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

  // Issue/Return States
  const [issueSearchVal, setIssueSearchVal] = useState("");
  const [foundIssueBooks, setFoundIssueBooks] = useState<any[]>([]);
  const [selectedIssueBook, setSelectedIssueBook] = useState<any>(null);
  const [selectedIssueUserPhone, setSelectedIssueUserPhone] = useState("");
  const [returnSearchVal, setReturnSearchVal] = useState("");
  const [returnType, setReturnType] = useState("stock");
  const [foundReturnBooks, setFoundReturnBooks] = useState<any[]>([]);
  const [selectedReturnBook, setSelectedReturnBook] = useState<any>(null);

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
      topUsers: topUsersList
    });
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
      loadMembers();
      loadDashboard();
    }
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

  return (
    <div className="flex bg-surface-bg min-h-screen text-text-main font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-[240px] bg-primary text-white flex flex-col fixed h-full z-20 shadow-xl">
        <div className="p-6 pb-8 flex items-center gap-3">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M4 6h18v2H4V6zm0 5h18v2H4v-2zm0 5h18v2H4v-2z"/></svg>
          </div>
          <span className="text-xl font-bold tracking-tight">LibSys Admin</span>
        </div>
        
        <nav className="flex-1">
          <ul className="list-none">
            {[
              { id: "dashboard", label: "Dashboard" },
              { id: "members", label: "Members" },
              { id: "books", label: "Books Inventory" },
              { id: "addBook", label: "Add Book" },
              { id: "circulation", label: "Issue Records" },
              { id: "return", label: "Return Books" },
              { id: "issuedList", label: "Issued List" },
              { id: "attendance", label: "System Logs" },
              { id: "reports", label: "Reports" }
            ].map(tab => (
              <li
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3.5 text-sm cursor-pointer transition-all flex items-center gap-3 border-r-4 ${
                  activeTab === tab.id 
                    ? 'bg-white/10 text-white border-accent font-semibold' 
                    : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </li>
            ))}
          </ul>
        </nav>
        
        <div className="p-6 border-t border-white/5 text-[10px] text-slate-500 font-bold tracking-widest uppercase">
          Supabase v1.0
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow ml-[240px] p-8 flex flex-col gap-8">
        <header className="flex justify-between items-end">
          <div className="header-title">
            <h1 className="text-2xl font-bold text-slate-900 capitalize">{activeTab.replace(/([A-Z])/g, ' $1')}</h1>
            <p className="text-sm text-text-muted">Supabase Real-time Management Portal</p>
          </div>
          <div className="db-status flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100 text-[11px] font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            SUPABASE CONNECTED
          </div>
        </header>
        
        {/* DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: "Total Books", value: counts.books, color: "text-slate-900" },
              { label: "Registered Users", value: counts.users, color: "text-accent" },
              { label: "Currently Issued", value: counts.issued, color: "text-amber-600" }
            ].map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-xl border border-surface-border shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">{stat.label}</p>
                <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
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
                <input name="email" placeholder="Email" className="input-field" />
                <input name="pincode" placeholder="Pincode" className="input-field" />
                <select name="gender" className="input-field">
                  <option value="">Select Gender</option>
                  <option value="Male">MALE</option>
                  <option value="Female">FEMALE</option>
                  <option value="Others">OTHERS</option>
                </select>
                <input name="dob" type="date" className="input-field" />
                <input name="member_id" placeholder="ID" className="input-field" />
                <input name="occupation" placeholder="Occupation" className="input-field" />
                <input name="notes" placeholder="Notes" className="input-field" />
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
                        <div className="text-[11px] text-text-muted">{b.author}</div>
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
          <div className="max-w-2xl section-card">
            <div className="section-header">
              <h2>Register New Library Asset</h2>
            </div>
            <form onSubmit={addBook} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <input name="stocknumber" placeholder="Stock Number" required className="input-field shadow-sm" />
              <input name="callnumber" placeholder="Call Number" required className="input-field shadow-sm" />
              <input name="title" placeholder="Full Title" required className="input-field shadow-sm col-span-full" />
              <input name="author" placeholder="Author Name" required className="input-field shadow-sm col-span-full" />
              <input name="language" placeholder="Language" className="input-field shadow-sm" />
              <input name="category" placeholder="Category" className="input-field shadow-sm" />
              <input name="shelfnumber" placeholder="Storage Shelf" className="input-field shadow-sm" />
              <input name="price" placeholder="Asset Value" className="input-field shadow-sm" />
              <button type="submit" className="btn-primary py-3 col-span-full uppercase tracking-widest text-[11px] font-black">Initialize Asset Registry</button>
            </form>
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
            <div className="section-card p-6 bg-primary text-white border-none flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black tracking-tighter">ANALYTICS INSIGHTS</h2>
                <p className="text-[10px] text-white/50 uppercase font-bold tracking-widest mt-1">Cross-Database Performance Metrics</p>
              </div>
              <button onClick={exportExcel} className="btn-primary bg-white text-primary border-none font-black hover:bg-slate-100 px-6">EXPORT DATA ENGINE</button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: "Assets Indexed", value: reportSummary.books, color: "text-slate-900" },
                { label: "Active Loans", value: reportSummary.issued, color: "text-accent" },
                { label: "Overdue Breaches", value: reportSummary.overdue, color: "text-error" },
                { label: "Gate Traffic", value: reportSummary.visitors, color: "text-emerald-600" }
              ].map((s, i) => (
                <div key={i} className="section-card p-6 border-l-4 border-l-accent">
                  <span className="text-[10px] font-black uppercase text-text-muted mb-2 block">{s.label}</span>
                  <span className={`text-4xl font-black ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </div>

            <div className="section-card">
              <div className="section-header">
                <h2>Top Engagement Profiles</h2>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="table-header">Identity</th>
                    <th className="table-header">Account Phone</th>
                    <th className="table-header text-right">Circulation Count</th>
                  </tr>
                </thead>
                <tbody>
                  {reportSummary.topUsers.map(u => (
                    <tr key={u.phone} className="hover:bg-slate-50">
                      <td className="table-cell font-bold">{u.name || "Anon."}</td>
                      <td className="table-cell text-text-muted font-mono text-xs">{u.phone}</td>
                      <td className="table-cell text-right font-black text-accent">{u.count} Assets</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* MODALS */}
      {editBookModal && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-surface-border">
            <div className="bg-primary p-6 text-white text-center">
              <h3 className="text-lg font-bold tracking-tight">Modify Asset Entry</h3>
              <p className="text-[10px] text-white/50 uppercase tracking-widest mt-1">STOCK ID: {editBookModal.stocknumber}</p>
            </div>
            <form onSubmit={updateBook} className="p-8 space-y-4">
              <input name="callnumber" defaultValue={editBookModal.callnumber} placeholder="Call Number" className="input-field" />
              <input name="title" defaultValue={editBookModal.title} placeholder="Full Title" className="input-field" />
              <input name="author" defaultValue={editBookModal.author} placeholder="Author" className="input-field" />
              <input name="language" defaultValue={editBookModal.language} placeholder="Language" className="input-field" />
              <input name="category" defaultValue={editBookModal.category} placeholder="Category" className="input-field" />
              <input name="shelfnumber" defaultValue={editBookModal.shelfnumber} placeholder="Storage Shelf" className="input-field" />
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
              <input name="email" defaultValue={editMemberModal.email} placeholder="Email" className="input-field" />
              <input name="pincode" defaultValue={editMemberModal.pincode} placeholder="Pincode" className="input-field" />
              <select name="gender" defaultValue={editMemberModal.gender} className="bg-slate-100 border border-surface-border px-3 py-3 rounded-xl text-xs font-bold w-full uppercase outline-none">
                <option value="">Select Gender</option>
                <option value="Male">MALE</option>
                <option value="Female">FEMALE</option>
                <option value="Others">OTHERS</option>
              </select>
              <input name="dob" defaultValue={editMemberModal.dob} type="date" className="input-field" />
              <input name="member_id" defaultValue={editMemberModal.member_id} placeholder="Membership ID" className="input-field" />
              <input name="occupation" defaultValue={editMemberModal.occupation} placeholder="Occupation" className="input-field" />
              <textarea name="notes" defaultValue={editMemberModal.notes} placeholder="Additional Metadata" className="input-field h-24" />
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
              {[
                { label: "Phone", val: viewUserModal.phone },
                { label: "Location", val: viewUserModal.address },
                { label: "Email Contact", val: viewUserModal.email },
                { label: "Membership ID", val: viewUserModal.member_id },
                { label: "Current Status", val: "ACTIVE", colored: "text-emerald-500 font-black" }
              ].map((row, i) => (
                <div key={i} className="flex justify-between items-center border-b border-surface-border pb-2">
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">{row.label}</span>
                  <span className={`text-[11px] font-bold ${row.colored || "text-slate-900"}`}>{row.val || "—"}</span>
                </div>
              ))}
              <button onClick={() => setViewUserModal(null)} className="w-full btn-primary py-3 mt-4">Close Profile</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

