
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  User, Package, View, FoodLog, UserRole, MoodLog, CycleLog
} from './types';
import { 
  Layout, Home, Settings as SettingsIcon, Package as PackageIcon, 
  User as UserIcon, LogIn, ChevronLeft, CreditCard, 
  Calendar as CalendarIcon, Droplets, Smile, Calculator, Camera, Plus, Trash2, 
  ArrowRight, Search, Bell, History, Play, Utensils, Scan, X, Save, Edit2, Target, Dumbbell, Shield, Moon, Sun, Monitor, Loader2, Sparkles, Image as ImageIcon,
  Zap, Brain, TrendingUp, Info, CheckCircle2, Lock, Eye, BellRing, Star, ShieldCheck, ZapOff, Timer, LogOut, Briefcase
} from 'lucide-react';
import { analyzeFoodImage, getMindfulnessTip, getMacroInsight } from './services/geminiService';

// --- Shared Components ---

const Button: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  disabled?: boolean;
  type?: 'button' | 'submit';
}> = ({ children, onClick, className = '', variant = 'primary', disabled, type = 'button' }) => {
  const base = "w-full py-4 rounded-2xl font-semibold transition-all active:scale-95 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-red-600 text-white shadow-lg shadow-red-200 dark:shadow-red-900/40",
    secondary: "bg-black text-white shadow-lg shadow-gray-200 dark:shadow-none",
    outline: "border-2 border-red-600 text-red-600 bg-transparent dark:text-red-400 dark:border-red-400",
    ghost: "bg-transparent text-gray-500 dark:text-gray-400",
    danger: "bg-red-700 text-white",
  };
  return (
    <button 
      type={type}
      disabled={disabled}
      onClick={onClick} 
      className={`${base} ${variants[variant]} ${className} ${disabled ? 'opacity-50 grayscale' : ''}`}
    >
      {children}
    </button>
  );
};

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input 
    {...props} 
    className="w-full bg-red-50/50 border border-red-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500 focus:outline-none text-black font-bold placeholder-gray-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
  />
);

const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
  <textarea 
    {...props} 
    className="w-full bg-red-50/50 border border-red-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500 focus:outline-none text-black font-bold placeholder-gray-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500 min-h-[100px] resize-none"
  />
);

const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = '', onClick }) => (
  <div onClick={onClick} className={`bg-white p-5 rounded-3xl shadow-sm border border-red-50 dark:bg-slate-800 dark:border-slate-700 dark:shadow-none ${className}`}>
    {children}
  </div>
);

const Toggle: React.FC<{ active: boolean; onToggle: () => void }> = ({ active, onToggle }) => (
  <button onClick={onToggle} className={`w-12 h-6 rounded-full relative transition-colors ${active ? 'bg-red-600' : 'bg-gray-200 dark:bg-slate-700'}`}>
    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${active ? 'translate-x-7' : 'translate-x-1'}`} />
  </button>
);

const MacroBar: React.FC<{ label: string; current: number; goal: number; color: string }> = ({ label, current, goal, color }) => {
  const percentage = Math.min((current / goal) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-black">
        <span>{label}</span>
        <span>{Math.round(current)}/{goal}g</span>
      </div>
      <div className="h-2 w-full bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-500 ${color}`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// --- App Root ---

export default function App() {
  const [currentView, setCurrentView] = useState<View>('splash');
  const [user, setUser] = useState<User | null>(null);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [waterIntake, setWaterIntake] = useState(0);
  const [moodLogs, setMoodLogs] = useState<MoodLog[]>([]);
  const [cycleLogs, setCycleLogs] = useState<CycleLog[]>([]);
  
  // Calorie Goals
  const [dailyGoal, setDailyGoal] = useState({ calories: 2200, protein: 150, carbs: 250, fat: 70 });
  const [waterGoal] = useState(2000); // 2000ml default goal
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showPhotoSourceModal, setShowPhotoSourceModal] = useState(false);

  // Attendance State
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<{id: string, start: Date, end: Date}[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    let interval: number;
    if (checkInTime) {
      interval = window.setInterval(() => {
        setElapsedTime(Math.floor((new Date().getTime() - checkInTime.getTime()) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [checkInTime]);

  const handleCheckIn = () => {
    setCheckInTime(new Date());
    setElapsedTime(0);
  };

  const handleCheckOut = () => {
    if (checkInTime) {
      const now = new Date();
      setAttendanceHistory(prev => [{
        id: Math.random().toString(),
        start: checkInTime,
        end: now
      }, ...prev]);
      setCheckInTime(null);
      setElapsedTime(0);
    }
  };

  // Derive attended days for the calendar from history
  const attendedDays = useMemo(() => {
    const days = new Set<number>();
    attendanceHistory.forEach(log => {
      days.add(new Date(log.start).getDate());
    });
    // Also include today if currently checked in
    if (checkInTime) {
      days.add(new Date(checkInTime).getDate());
    }
    return Array.from(days);
  }, [attendanceHistory, checkInTime]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Mood State
  const [selectedMood, setSelectedMood] = useState<number>(3);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [moodNote, setMoodNote] = useState('');
  const [isLoggingMood, setIsLoggingMood] = useState(false);
  const [aiTip, setAiTip] = useState<string | null>(null);

  // Macro Insight State
  const [macroInsight, setMacroInsight] = useState<string | null>(null);

  // Profile & Settings Settings
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');
  const [notifs, setNotifs] = useState({ dailyReminders: true, goalAlerts: true, healthTips: false });
  const [isPrivate, setIsPrivate] = useState(false);

  // Package State
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const packages: Package[] = [
    { id: 'p1', category: 'fitness', name: 'Elite Member', description: 'Full access to gym sessions, AI trainer, and cycle sync plans.', price: 49.99 },
    { id: 'p2', category: 'fitness', name: 'Premium Member', description: 'Advanced tracking, macro insights, and priority support.', price: 29.99 },
    { id: 'p3', category: 'nutrition', name: 'Nutrition Pro', description: 'Deep AI food analysis, custom recipes, and hydration logs.', price: 19.99 },
  ];

  // Refs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Splash Screen State
  const [splashFade, setSplashFade] = useState(false);

  useEffect(() => {
    if (currentView === 'splash') {
      const timer1 = setTimeout(() => setSplashFade(true), 2500);
      const timer2 = setTimeout(() => setCurrentView('login'), 3500);
      return () => { clearTimeout(timer1); clearTimeout(timer2); };
    }
  }, [currentView]);

  const navigate = (view: View) => setCurrentView(view);

  // Determine if we should apply dark mode class
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Computed Macros
  const totals = useMemo(() => {
    return foodLogs.reduce((acc, log) => {
      acc.calories += log.calories;
      acc.protein += log.macros.protein;
      acc.carbs += log.macros.carbs;
      acc.fat += log.macros.fat;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  }, [foodLogs]);

  useEffect(() => {
    if (totals.calories > 0 && currentView === 'calorie') {
      getMacroInsight(totals.protein, totals.carbs, totals.fat, dailyGoal.protein)
        .then(setMacroInsight)
        .catch(console.error);
    }
  }, [totals, currentView]);

  // --- Views Implementation ---

  const LayoutWrapper = ({ children, className = "" }: { children?: React.ReactNode, className?: string }) => (
    <div className={`${isDark ? 'dark' : ''} h-full`}>
      <div className={`min-h-screen bg-white dark:bg-slate-900 transition-colors duration-300 ${className}`}>
        {children}
      </div>
    </div>
  );

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowPhotoSourceModal(false);
    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];
        try {
          const analysis = await analyzeFoodImage(base64String);
          const newLog: FoodLog = {
            id: Math.random().toString(),
            date: new Date().toISOString(),
            name: analysis.foodName,
            calories: analysis.calories,
            macros: {
              protein: analysis.protein,
              carbs: analysis.carbs,
              fat: analysis.fat,
            },
            amount: 100,
            unit: 'g'
          };
          setFoodLogs(prev => [newLog, ...prev]);
        } catch (error) {
          console.error("AI Analysis failed:", error);
          alert("Failed to analyze image. Please try again or log manually.");
        } finally {
          setIsAnalyzing(false);
          if (cameraInputRef.current) cameraInputRef.current.value = '';
          if (galleryInputRef.current) galleryInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsAnalyzing(false);
    }
  };

  const handleLogMood = async () => {
    setIsLoggingMood(true);
    try {
      const tip = await getMindfulnessTip(selectedMood, moodNote, selectedTags);
      setAiTip(tip);
      const newLog: MoodLog = {
        id: Math.random().toString(),
        date: new Date().toISOString(),
        rating: selectedMood,
        note: moodNote,
        tags: selectedTags
      };
      setMoodLogs(prev => [newLog, ...prev]);
      setMoodNote('');
      setSelectedTags([]);
    } catch (err) {
      console.error(err);
      alert("Failed to log mood. Please try again.");
    } finally {
      setIsLoggingMood(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const getMoodEmoji = (rating: number) => {
    const emojis = ['😫', '😔', '😐', '🙂', '🤩'];
    return emojis[rating - 1] || '😐';
  };

  const getMoodColor = (rating: number) => {
    const colors = ['text-red-950', 'text-red-900', 'text-black', 'text-red-800', 'text-red-900'];
    return colors[rating - 1] || 'text-black';
  };

  if (currentView === 'splash') {
    return (
      <div className={`h-screen flex flex-col items-center justify-center bg-black transition-opacity duration-1000 ${splashFade ? 'opacity-0' : 'opacity-100'}`}>
        <div className="w-24 h-24 bg-red-600 rounded-[2.5rem] flex items-center justify-center shadow-[0_0_50px_rgba(220,38,38,0.3)] mb-10 transform animate-pulse">
          <Dumbbell className="w-12 h-12 text-white" />
        </div>
        <div className="flex flex-col items-center animate-in zoom-in-95 fade-in duration-1000">
           <div className="flex items-center gap-3 mb-2">
             <h1 className="text-6xl font-black text-white tracking-tighter">STRONG</h1>
             <h1 className="text-6xl font-black text-red-600 tracking-tighter italic">HER</h1>
           </div>
           <p className="text-gray-500 font-bold uppercase tracking-[0.4em] text-[10px] mt-2">Power. Precision. Progress.</p>
        </div>
      </div>
    );
  }

  const renderLogin = (role: UserRole) => (
    <LayoutWrapper className="p-8 pt-16 flex flex-col bg-white dark:bg-slate-900 animate-in slide-in-from-bottom-10 duration-500">
      <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-8 shadow-xl ${role === 'trainer' ? 'bg-black text-red-600' : 'bg-red-600 text-white'}`}>
        {role === 'trainer' ? <Briefcase className="w-10 h-10" /> : <UserIcon className="w-10 h-10" />}
      </div>
      <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">
        {role === 'trainer' ? 'Trainer Login' : 'Member Login'}
      </h2>
      <p className="text-gray-500 dark:text-slate-400 mb-12 font-medium">Unlock your full potential.</p>
      
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Identity</label>
          <Input placeholder="Username or email" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Access Key</label>
          <Input type="password" placeholder="••••••••" />
        </div>
        <div className="pt-4">
          <Button 
            variant={role === 'trainer' ? 'secondary' : 'primary'}
            onClick={() => {
              setUser({ id: 'u1', name: role === 'trainer' ? 'Coach Mike' : 'Jane Cooper', username: 'jane', email: 'jane@fitflow.com', phone: '555-0123', role, isEnrolled: false, enrolledPackages: [] });
              navigate('home');
            }}
          >
            Authenticate <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="text-center mt-12 space-y-6">
          <div className="flex items-center gap-4 py-2">
            <div className="h-px bg-gray-100 flex-1" />
            <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Switch Portal</span>
            <div className="h-px bg-gray-100 flex-1" />
          </div>
          
          {role === 'user' ? (
            <button onClick={() => navigate('trainerLogin')} className="w-full py-4 border-2 border-black rounded-2xl text-black font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all">
               <Briefcase className="w-4 h-4 text-red-600" /> Trainer Entrance
            </button>
          ) : (
            <button onClick={() => navigate('login')} className="w-full py-4 border-2 border-red-600 rounded-2xl text-red-600 font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all">
               <UserIcon className="w-4 h-4" /> Member Entrance
            </button>
          )}
          
          <button onClick={() => navigate('signup')} className="w-full text-gray-400 font-bold text-sm tracking-tight flex items-center justify-center gap-2">
            Don't have an account? <span className="text-red-600 border-b border-red-600/30">Sign up now</span>
          </button>
        </div>
      </div>
    </LayoutWrapper>
  );

  if (currentView === 'login') return renderLogin('user');
  if (currentView === 'trainerLogin') return renderLogin('trainer');

  if (currentView === 'signup') {
    return (
      <LayoutWrapper className="p-8 pt-16 flex flex-col animate-in slide-in-from-right duration-500">
        <button onClick={() => navigate('login')} className="w-10 h-10 mb-8 flex items-center justify-center bg-gray-100 rounded-xl"><ChevronLeft className="text-black" /></button>
        <h2 className="text-4xl font-black text-black dark:text-white mb-2 tracking-tight">Join <span className="text-red-600 italic">HER</span></h2>
        <p className="text-gray-500 font-bold mb-10 uppercase text-[10px] tracking-widest">Start your evolution today.</p>
        
        <div className="space-y-4 flex-1">
          <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Full Name</label><Input placeholder="e.g. Sarah J. Parker" /></div>
          <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Email</label><Input type="email" placeholder="sarah@example.com" /></div>
          <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Create Username</label><Input placeholder="sarah_fitness" /></div>
          <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Password</label><Input type="password" placeholder="••••••••" /></div>
        </div>

        <div className="mt-10">
          <Button onClick={() => navigate('enrollChoice')}>Continue to Enrollment</Button>
          <button onClick={() => navigate('login')} className="w-full mt-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Already have an account? Login</button>
        </div>
      </LayoutWrapper>
    );
  }

  if (currentView === 'enrollChoice') {
    return (
      <LayoutWrapper className="p-8 pt-16 flex flex-col animate-in slide-in-from-bottom duration-500 h-full">
        <h2 className="text-3xl font-black text-black mb-2">Tailor Your Path</h2>
        <p className="text-gray-500 font-bold mb-10 text-[10px] uppercase tracking-widest">Choose your focus area</p>

        <div className="space-y-4 flex-1">
           <Card onClick={() => navigate('packages')} className="p-8 flex items-center gap-6 border-red-50 hover:border-red-600 transition-all group cursor-pointer active:scale-95">
              <div className="w-16 h-16 bg-red-600 text-white rounded-[1.5rem] flex items-center justify-center group-hover:rotate-12 transition-transform shadow-lg"><Dumbbell className="w-8 h-8" /></div>
              <div className="flex-1">
                 <h3 className="font-black text-xl">Fitness & Strength</h3>
                 <p className="text-xs text-gray-500 mt-1">Gym plans, cardio, and cycle syncing workouts.</p>
              </div>
           </Card>

           <Card onClick={() => navigate('packages')} className="p-8 flex items-center gap-6 border-red-50 hover:border-red-600 transition-all group cursor-pointer active:scale-95">
              <div className="w-16 h-16 bg-black text-white rounded-[1.5rem] flex items-center justify-center group-hover:rotate-12 transition-transform shadow-lg"><Utensils className="w-8 h-8 text-red-600" /></div>
              <div className="flex-1">
                 <h3 className="font-black text-xl">Nutrition & Macros</h3>
                 <p className="text-xs text-gray-500 mt-1">AI meal analysis, custom macro goals, and water tracking.</p>
              </div>
           </Card>

           <Card onClick={() => navigate('packages')} className="p-8 flex items-center gap-6 border-red-50 hover:border-red-600 transition-all group cursor-pointer active:scale-95">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-[1.5rem] flex items-center justify-center group-hover:rotate-12 transition-transform shadow-sm border border-red-100"><Star className="w-8 h-8" /></div>
              <div className="flex-1">
                 <h3 className="font-black text-xl">Full Transformation</h3>
                 <p className="text-xs text-gray-500 mt-1">Combined fitness and nutrition for the ultimate HER experience.</p>
              </div>
           </Card>
        </div>
      </LayoutWrapper>
    );
  }

  if (currentView === 'packages') {
    return (
      <LayoutWrapper className="pb-20">
        <header className="p-8 flex items-center gap-4">
          <button onClick={() => navigate('enrollChoice')} className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-xl"><ChevronLeft className="text-black" /></button>
          <h2 className="text-2xl font-black text-black">Member Tiers</h2>
        </header>
        
        <div className="px-8 space-y-6">
          {packages.map(pkg => (
            <Card key={pkg.id} className={`p-8 border-2 transition-all cursor-pointer relative ${selectedPackage?.id === pkg.id ? 'border-red-600 bg-red-50 shadow-xl' : 'border-red-50'}`} onClick={() => setSelectedPackage(pkg)}>
               {selectedPackage?.id === pkg.id && <div className="absolute -top-3 left-8 bg-red-600 text-white text-[8px] font-black uppercase px-3 py-1 rounded-full tracking-[0.2em] shadow-lg">Selected Tier</div>}
               <div className="flex justify-between items-start mb-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${pkg.id === 'p1' ? 'bg-black text-red-600' : 'bg-red-50 text-red-600'}`}>
                    {pkg.id === 'p1' ? <ShieldCheck className="w-6 h-6" /> : <Star className="w-6 h-6" />}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-black">${pkg.price}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">per month</p>
                  </div>
               </div>
               <h3 className="font-black text-xl mb-2">{pkg.name}</h3>
               <p className="text-xs text-gray-600 font-bold mb-4 leading-relaxed">{pkg.description}</p>
               <ul className="space-y-2 mb-6">
                  {['AI Driven Insights', 'Daily Progress Tracking', 'Community Access'].map(feature => (
                    <li key={feature} className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                       <CheckCircle2 className="w-3 h-3 text-red-600" /> {feature}
                    </li>
                  ))}
               </ul>
            </Card>
          ))}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-8 bg-white/80 backdrop-blur-md z-40 max-w-[450px] mx-auto">
          <Button disabled={!selectedPackage} onClick={() => navigate('payment')}>Proceed to Payment</Button>
        </div>
      </LayoutWrapper>
    );
  }

  if (currentView === 'payment') {
    return (
      <LayoutWrapper className="p-8 pt-16 flex flex-col animate-in fade-in duration-500">
        <h2 className="text-3xl font-black text-black mb-2">Checkout</h2>
        <p className="text-gray-500 font-bold mb-10 text-[10px] uppercase tracking-widest">Secure Payment Processing</p>

        <Card className="p-6 bg-black text-white border-none shadow-2xl mb-8 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-10 transform scale-150 rotate-12"><CreditCard className="w-32 h-32 text-red-600" /></div>
           <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-6">Order Summary</p>
              <h3 className="text-2xl font-black mb-1">{selectedPackage?.name}</h3>
              <p className="text-xs text-gray-400 mb-6">Monthly Subscription</p>
              <div className="flex justify-between items-end border-t border-white/10 pt-6">
                 <p className="text-sm font-bold">Total Due Now</p>
                 <p className="text-3xl font-black text-red-600">${selectedPackage?.price}</p>
              </div>
           </div>
        </Card>

        <div className="space-y-4 flex-1">
           <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Cardholder Name</label><Input placeholder="Jane Doe" /></div>
           <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Card Number</label><Input placeholder="•••• •••• •••• ••••" /></div>
           <div className="grid grid-cols-2 gap-4">
              <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Expiry Date</label><Input placeholder="MM/YY" /></div>
              <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">CVC</label><Input placeholder="•••" /></div>
           </div>
        </div>

        <div className="mt-10">
          <Button onClick={() => {
            setUser({ id: 'u1', name: 'New Member', username: 'member', email: 'member@test.com', phone: '', role: 'user', isEnrolled: true, enrolledPackages: selectedPackage ? [selectedPackage] : [] });
            navigate('home');
          }}>Complete Enrollment</Button>
          <div className="mt-4 flex items-center justify-center gap-2 text-[8px] font-black text-gray-400 uppercase tracking-widest">
             <ShieldCheck className="w-3 h-3 text-red-600" /> AES-256 BANK GRADE ENCRYPTION
          </div>
        </div>
      </LayoutWrapper>
    );
  }

  if (currentView === 'home') {
    const activePackage = user?.enrolledPackages?.[0];
    return (
      <LayoutWrapper className="pb-24">
        <header className="p-6 pb-2 flex justify-between items-center sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
               <Dumbbell className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] text-red-600 font-black uppercase tracking-widest">Dashboard</p>
              <h2 className="text-xl font-bold text-black dark:text-white">Hi, {user?.name.split(' ')[0]} 👋</h2>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('settings')} className="w-10 h-10 bg-red-50 dark:bg-slate-800 rounded-xl shadow-sm flex items-center justify-center text-red-600 dark:text-slate-500"><SettingsIcon className="w-5 h-5" /></button>
            <button onClick={() => navigate('profile')} className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl shadow-sm flex items-center justify-center text-red-600 font-bold overflow-hidden border border-red-50 dark:border-slate-700">
               <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`} className="w-full h-full object-cover" />
            </button>
          </div>
        </header>
        <div className="p-6 space-y-6">
          <Card 
            onClick={() => navigate('packages')}
            className="bg-black text-white p-8 rounded-[2rem] border-none relative overflow-hidden shadow-xl group cursor-pointer active:scale-[0.98] transition-transform"
          >
             <div className="absolute top-0 right-0 p-4 opacity-5 transform scale-150 rotate-12 group-hover:rotate-0 transition-transform">
                <ShieldCheck className="w-40 h-40 text-red-600" />
             </div>
             <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                    <Star className="w-4 h-4 text-white fill-current" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">Membership Active</p>
                </div>
                
                <h3 className="text-3xl font-black text-white mb-1">
                  {activePackage?.name || "Standard Member"}
                </h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-6">
                  Elite Status • {user?.role === 'trainer' ? 'Coach Level' : 'Pro Tier'}
                </p>

                <div className="flex items-center justify-between pt-6 border-t border-white/10">
                   <div>
                      <p className="text-[10px] text-gray-500 font-black uppercase mb-1">Renew Date</p>
                      <p className="text-sm font-black text-white">Oct 12, 2025</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] text-gray-500 font-black uppercase mb-1">Account</p>
                      <p className="text-sm font-black text-red-600">VERIFIED</p>
                   </div>
                </div>
             </div>
          </Card>

          <Card 
            onClick={() => navigate('calorie')}
            className="bg-red-50/50 border-red-100 flex items-center justify-between p-6 group cursor-pointer active:bg-red-100 transition-colors"
          >
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-600 text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform">
                   <Zap className="w-6 h-6" />
                </div>
                <div>
                   <p className="text-[10px] text-red-600 font-black uppercase tracking-widest">Daily Fuel</p>
                   <p className="text-xl font-black text-black">
                     {Math.round(totals.calories)} <span className="text-xs text-gray-500">/ {dailyGoal.calories} kcal</span>
                   </p>
                </div>
             </div>
             <ArrowRight className="text-red-600 group-hover:translate-x-1 transition-transform" />
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card onClick={() => navigate('calorie')} className="hover:ring-2 hover:ring-red-100 transition-all cursor-pointer bg-red-50/20">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center mb-3"><Calculator className="w-5 h-5" /></div>
              <p className="font-bold text-black dark:text-white">Calorie Hub</p>
              <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mt-1">AI Logs & Macros</p>
            </Card>
            <Card onClick={() => navigate('period')} className="hover:ring-2 hover:ring-red-100 transition-all cursor-pointer bg-red-50/20">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center mb-3"><Droplets className="w-5 h-5" /></div>
              <p className="font-bold text-black dark:text-white">Cycle Tracker</p>
              <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mt-1">Health Prediction</p>
            </Card>
            <Card onClick={() => navigate('mood')} className="hover:ring-2 hover:ring-red-100 transition-all cursor-pointer bg-red-50/20">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center mb-3"><Smile className="w-5 h-5" /></div>
              <p className="font-bold text-black dark:text-white">Mood Board</p>
              <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mt-1">Journal & Zen</p>
            </Card>
            <Card onClick={() => navigate('attendance')} className="hover:ring-2 hover:ring-red-100 transition-all cursor-pointer bg-red-50/20">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center mb-3"><Target className="w-5 h-5" /></div>
              <p className="font-bold text-black dark:text-white">Attendance</p>
              <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mt-1">Streaks & Logs</p>
            </Card>
          </div>
        </div>
        <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-red-50 dark:border-slate-800 p-4 px-10 flex justify-between items-center max-w-[450px] mx-auto z-30">
          <button onClick={() => navigate('home')} className="text-red-600 dark:text-red-400"><Home className="w-6 h-6" /></button>
          <button onClick={() => navigate('calorie')} className="text-gray-400 dark:text-slate-700"><Calculator className="w-6 h-6" /></button>
          <button onClick={() => navigate('attendance')} className="text-gray-400 dark:text-slate-700"><CalendarIcon className="w-6 h-6" /></button>
          <button onClick={() => navigate('profile')} className="text-gray-400 dark:text-slate-700"><UserIcon className="w-6 h-6" /></button>
        </nav>
      </LayoutWrapper>
    );
  }

  if (currentView === 'calorie') {
    const progress = Math.min((totals.calories / dailyGoal.calories) * 100, 100);
    const waterProgress = Math.min((waterIntake / waterGoal) * 100, 100);

    return (
      <LayoutWrapper className="pb-28">
        {isAnalyzing && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-white text-center p-10 animate-in fade-in">
             <div className="w-20 h-20 bg-red-600 rounded-[2rem] flex items-center justify-center shadow-2xl mb-6">
                <Loader2 className="w-10 h-10 animate-spin" />
             </div>
             <h3 className="text-2xl font-bold mb-2">Analyzing...</h3>
             <p className="text-red-200 opacity-80">Gemini is checking your meal...</p>
          </div>
        )}

        <header className="p-6 bg-white dark:bg-slate-900 sticky top-0 flex justify-between items-center z-20 border-b border-red-50">
          <button onClick={() => navigate('home')} className="dark:text-white"><ChevronLeft className="text-black" /></button>
          <h2 className="text-xl font-bold text-black dark:text-white">Calorie Hub</h2>
          <button onClick={() => setShowGoalModal(true)} className="text-red-600"><Target className="w-6 h-6" /></button>
        </header>

        <div className="p-6 space-y-6">
          <Card className="bg-black text-white p-8 border-none relative overflow-hidden shadow-2xl">
             <div className="flex flex-col gap-4">
               <div className="flex justify-between items-end">
                 <div>
                   <p className="text-[10px] text-red-500 font-black uppercase tracking-[0.2em] mb-1">Energy Consumption</p>
                   <h3 className="text-5xl font-black text-white">{Math.round(totals.calories)}</h3>
                 </div>
                 <div className="text-right">
                   <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Target</p>
                   <p className="text-lg font-black text-red-600">{dailyGoal.calories} kcal</p>
                 </div>
               </div>
               
               <div className="relative h-12 w-full bg-red-900/20 rounded-2xl overflow-hidden border border-white/5">
                 <div 
                   className="h-full bg-red-600 transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(239,68,68,0.5)]" 
                   style={{ width: `${progress}%` }} 
                 />
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-black text-white drop-shadow-md">{Math.round(progress)}% TANK CAPACITY</span>
                 </div>
               </div>

               <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
                  <div>
                    <p className="text-[10px] text-red-500 font-bold uppercase mb-1">Protein</p>
                    <p className="font-black text-xl text-white">{Math.round(totals.protein)}<span className="text-xs text-gray-400 font-normal">g</span></p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-red-500 font-bold uppercase mb-1">Carbs</p>
                    <p className="font-black text-xl text-white">{Math.round(totals.carbs)}<span className="text-xs text-gray-400 font-normal">g</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-red-500 font-bold uppercase mb-1">Fat</p>
                    <p className="font-black text-xl text-white">{Math.round(totals.fat)}<span className="text-xs text-gray-400 font-normal">g</span></p>
                  </div>
               </div>
             </div>
          </Card>

          {/* Hydration Tracker Card */}
          <Card className="bg-red-50 border-red-200 p-6 shadow-sm overflow-hidden relative group">
             <div className="absolute top-0 right-0 p-4 opacity-5 transform scale-150 group-active:scale-125 transition-transform"><Droplets className="w-20 h-20 text-red-600" /></div>
             <div className="flex flex-col gap-3 relative z-10">
                <div className="flex justify-between items-center">
                   <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-red-600 text-white rounded-lg flex items-center justify-center"><Droplets className="w-4 h-4" /></div>
                      <h4 className="text-xs font-black uppercase text-red-600 tracking-wider">Hydration</h4>
                   </div>
                   <p className="text-xs font-black text-black">{waterIntake} <span className="text-gray-500">/ {waterGoal}ml</span></p>
                </div>
                <div className="h-2 w-full bg-red-200/50 rounded-full overflow-hidden">
                   <div 
                      className="h-full bg-red-600 transition-all duration-700" 
                      style={{ width: `${waterProgress}%` }}
                   />
                </div>
                <p className="text-[9px] font-black text-red-800 uppercase italic">
                  {waterIntake >= waterGoal ? "GOAL REACHED! STAY HYDRATED" : `ONLY ${waterGoal - waterIntake}ml LEFT TO GOAL`}
                </p>
             </div>
          </Card>

          <Card className="space-y-4 bg-red-50/20 border-red-50 shadow-sm">
             <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-red-600" />
                <h4 className="text-xs font-black uppercase text-red-600">Dynamic Insights</h4>
             </div>
             <MacroBar label="Protein" current={totals.protein} goal={dailyGoal.protein} color="bg-red-600" />
             <MacroBar label="Carbs" current={totals.carbs} goal={dailyGoal.carbs} color="bg-black dark:bg-white" />
             <MacroBar label="Fat" current={totals.fat} goal={dailyGoal.fat} color="bg-red-400" />
          </Card>

          {macroInsight && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex gap-3 animate-in slide-in-from-left">
               <Sparkles className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
               <p className="text-xs text-red-950 font-bold italic">"{macroInsight}"</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
             <button onClick={() => setShowPhotoSourceModal(true)} className="flex flex-col items-center gap-2 p-5 bg-black text-white rounded-3xl active:scale-95 transition-all">
               <Camera className="w-6 h-6 text-red-600" />
               <span className="text-[10px] font-black uppercase tracking-wider">AI Photo</span>
             </button>
             <button onClick={() => setWaterIntake(v => v + 250)} className="flex flex-col items-center gap-2 p-5 bg-red-50 text-red-600 rounded-3xl active:scale-95 transition-all border border-red-200">
               <Droplets className="w-6 h-6" />
               <span className="text-[10px] font-black uppercase tracking-wider">+Water</span>
             </button>
             <button onClick={() => setShowManualAdd(true)} className="flex flex-col items-center gap-2 p-5 bg-red-50 text-red-600 rounded-3xl active:scale-95 transition-all border border-red-200">
               <Plus className="w-6 h-6" />
               <span className="text-[10px] font-black uppercase tracking-wider">Manual</span>
             </button>
          </div>

          <div className="space-y-4">
             <h4 className="font-black text-black dark:text-white text-lg px-1">Daily Records</h4>
             {foodLogs.length === 0 && (
               <div className="py-12 flex flex-col items-center text-gray-400">
                  <Utensils className="w-12 h-12 mb-2 opacity-20" />
                  <p className="text-sm font-bold italic">Nothing logged today</p>
               </div>
             )}
             {foodLogs.map(log => (
               <Card key={log.id} className="flex items-center justify-between border-red-50 hover:bg-red-50/10 transition-colors">
                 <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center"><Utensils className="w-5 h-5" /></div>
                   <div>
                     <p className="font-black text-black dark:text-white">{log.name}</p>
                     <p className="text-[10px] text-gray-700 font-black uppercase">P:{Math.round(log.macros.protein)}g C:{Math.round(log.macros.carbs)}g F:{Math.round(log.macros.fat)}g</p>
                   </div>
                 </div>
                 <p className="font-black text-black text-lg">{Math.round(log.calories)} kcal</p>
               </Card>
             ))}
          </div>
        </div>

        {showPhotoSourceModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4">
             <div className="w-full max-w-[420px] bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 animate-in slide-in-from-bottom-20">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-black text-black dark:text-white">Upload Food Photo</h3>
                  <button onClick={() => setShowPhotoSourceModal(false)} className="p-2"><X className="text-black" /></button>
                </div>
                <div className="space-y-3">
                   <button onClick={() => cameraInputRef.current?.click()} className="w-full p-6 bg-red-50 rounded-3xl flex items-center gap-5 border border-red-100 active:scale-95 transition-all">
                     <div className="w-12 h-12 bg-red-600 text-white rounded-2xl flex items-center justify-center"><Camera /></div>
                     <div className="text-left"><p className="font-black text-black">Camera</p><p className="text-xs text-gray-600 font-bold">Live capture</p></div>
                   </button>
                   <button onClick={() => galleryInputRef.current?.click()} className="w-full p-6 bg-gray-50 rounded-3xl flex items-center gap-5 border border-gray-100 active:scale-95 transition-all">
                     <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center"><ImageIcon /></div>
                     <div className="text-left"><p className="font-black text-black">Gallery</p><p className="text-xs text-gray-600 font-bold">Device storage</p></div>
                   </button>
                </div>
             </div>
          </div>
        )}

        <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleImageCapture} />
        <input type="file" ref={galleryInputRef} className="hidden" accept="image/*" onChange={handleImageCapture} />
      </LayoutWrapper>
    );
  }

  // --- Profile Related Views ---
  if (currentView === 'profile') {
    return (
      <LayoutWrapper>
        <header className="p-6 bg-white dark:bg-slate-900 flex items-center gap-4 border-b border-red-50 dark:border-slate-800">
          <button onClick={() => navigate('home')} className="dark:text-white"><ChevronLeft className="text-black" /></button>
          <h2 className="text-xl font-bold text-black dark:text-white">Profile</h2>
        </header>
        <div className="p-6 space-y-6">
          <Card className="flex items-center gap-5 p-6 border-red-50 bg-red-50/10">
             <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-[2rem] overflow-hidden flex items-center justify-center border-4 border-white dark:border-slate-700 shadow-lg">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`} className="w-full h-full object-cover" />
             </div>
             <div>
               <p className="font-black text-xl text-black dark:text-white">{user?.name}</p>
               <p className="text-sm text-red-700 font-black">@{user?.username}</p>
             </div>
          </Card>
          <div className="space-y-3">
             <button onClick={() => navigate('accountDetails')} className="w-full p-5 bg-white dark:bg-slate-800 rounded-3xl text-left font-bold border border-red-50 dark:border-slate-700 shadow-sm flex justify-between items-center group active:bg-red-50 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-all"><UserIcon className="w-5 h-5" /></div>
                  <span className="text-black dark:text-slate-200 font-black">Account Details</span>
                </div>
                <ArrowRight className="w-4 h-4 text-black" />
             </button>
             <button onClick={() => navigate('settings')} className="w-full p-5 bg-white dark:bg-slate-800 rounded-3xl text-left font-bold border border-red-50 dark:border-slate-700 shadow-sm flex justify-between items-center group active:bg-red-50 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-all"><SettingsIcon className="w-5 h-5" /></div>
                  <span className="text-black dark:text-slate-200 font-black">General Settings</span>
                </div>
                <ArrowRight className="w-4 h-4 text-black" />
             </button>
             <button onClick={() => { setUser(null); navigate('login'); }} className="w-full p-5 bg-red-600 rounded-3xl text-left font-bold border-none shadow-xl flex justify-between items-center group active:scale-95 transition-all mt-6 text-white">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><LogIn className="w-5 h-5 text-white" /></div>
                  <span className="font-black">Logout</span>
                </div>
             </button>
          </div>
        </div>
      </LayoutWrapper>
    );
  }

  if (currentView === 'accountDetails') {
    return (
      <LayoutWrapper className="bg-white dark:bg-slate-900">
        <header className="p-6 flex items-center gap-4 border-b border-red-50 dark:border-slate-800">
          <button onClick={() => navigate('profile')} className="dark:text-white"><ChevronLeft className="text-black" /></button>
          <h2 className="text-xl font-bold text-black dark:text-white">Account Info</h2>
        </header>
        <div className="p-6 space-y-6">
          <div className="flex flex-col items-center mb-8">
             <div className="w-24 h-24 bg-red-50 dark:bg-slate-800 rounded-[2.5rem] overflow-hidden border-4 border-red-50 dark:border-indigo-900/20 relative group">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`} className="w-full h-full object-cover" />
                <button className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="text-white w-6 h-6" /></button>
             </div>
             <p className="text-red-600 font-black text-sm mt-3">Edit Avatar</p>
          </div>
          <div className="space-y-4">
             <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block ml-1">Full Name</label><Input value={user?.name} onChange={e => setUser(p => p ? {...p, name: e.target.value} : null)} /></div>
             <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block ml-1">Username</label><Input value={user?.username} onChange={e => setUser(p => p ? {...p, username: e.target.value} : null)} /></div>
             <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block ml-1">Email Address</label><Input type="email" value={user?.email} onChange={e => setUser(p => p ? {...p, email: e.target.value} : null)} /></div>
             <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block ml-1">Phone Number</label><Input type="tel" value={user?.phone} onChange={e => setUser(p => p ? {...p, phone: e.target.value} : null)} /></div>
             <div className="pt-6"><Button onClick={() => navigate('profile')}>Save Changes</Button></div>
          </div>
        </div>
      </LayoutWrapper>
    );
  }

  if (currentView === 'settings') {
    return (
      <LayoutWrapper>
        <header className="p-6 bg-white dark:bg-slate-900 flex items-center gap-4 border-b border-red-50">
          <button onClick={() => navigate('profile')} className="dark:text-white"><ChevronLeft className="text-black" /></button>
          <h2 className="text-xl font-bold text-black dark:text-white">Settings</h2>
        </header>
        <div className="p-6 space-y-6">
          <section className="space-y-3">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Privacy & Security</h4>
            <button onClick={() => setIsPrivate(!isPrivate)} className="w-full p-5 bg-white border border-red-50 rounded-3xl flex items-center justify-between group active:bg-red-50 transition-all shadow-sm">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center"><Lock className="w-5 h-5" /></div>
                  <span className="font-black text-black">Private Profile</span>
               </div>
               <Toggle active={isPrivate} onToggle={() => setIsPrivate(!isPrivate)} />
            </button>
            <button onClick={() => alert("Change Password coming soon!")} className="w-full p-5 bg-white border border-red-50 rounded-3xl flex items-center justify-between group active:bg-red-50 transition-all shadow-sm">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center"><Shield className="w-5 h-5" /></div>
                  <span className="font-black text-black">Security Keys</span>
               </div>
               <ArrowRight className="w-4 h-4 text-gray-300" />
            </button>
          </section>

          <section className="space-y-3">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">App Customization</h4>
            <button onClick={() => navigate('notifications')} className="w-full p-5 bg-white border border-red-50 rounded-3xl flex items-center justify-between group active:bg-red-50 transition-all shadow-sm">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center"><BellRing className="w-5 h-5" /></div>
                  <span className="font-black text-black">Notifications</span>
               </div>
               <ArrowRight className="w-4 h-4 text-black" />
            </button>
            <button onClick={() => navigate('theme')} className="w-full p-5 bg-white border border-red-50 rounded-3xl flex items-center justify-between group active:bg-red-50 transition-all shadow-sm">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center"><Moon className="w-5 h-5 text-red-600" /></div>
                  <span className="font-black text-black">Appearance</span>
               </div>
               <ArrowRight className="w-4 h-4 text-black" />
            </button>
          </section>

          <section className="space-y-3">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Support</h4>
            <button className="w-full p-5 bg-white border border-red-50 rounded-3xl flex items-center justify-between group active:bg-red-50 transition-all shadow-sm opacity-60">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-50 text-gray-400 rounded-xl flex items-center justify-center"><Info className="w-5 h-5" /></div>
                  <span className="font-black text-black">Help Center</span>
               </div>
            </button>
          </section>
        </div>
      </LayoutWrapper>
    );
  }

  if (currentView === 'notifications') {
    return (
      <LayoutWrapper>
        <header className="p-6 bg-white dark:bg-slate-900 flex items-center gap-4 border-b border-red-50">
          <button onClick={() => navigate('settings')} className="dark:text-white"><ChevronLeft className="text-black" /></button>
          <h2 className="text-xl font-bold text-black dark:text-white">Notifications</h2>
        </header>
        <div className="p-6 space-y-6">
           <Card className="space-y-8">
              <div className="flex items-center justify-between">
                <div><p className="font-black text-black">Daily Reminders</p><p className="text-[10px] text-gray-500 font-bold">Track meals & workouts</p></div>
                <Toggle active={notifs.dailyReminders} onToggle={() => setNotifs(p => ({...p, dailyReminders: !p.dailyReminders}))} />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="font-black text-black">Goal Alerts</p><p className="text-[10px] text-gray-500 font-bold">Progress milestones</p></div>
                <Toggle active={notifs.goalAlerts} onToggle={() => setNotifs(p => ({...p, goalAlerts: !p.goalAlerts}))} />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="font-black text-black">Health Tips</p><p className="text-[10px] text-gray-500 font-bold">Zen & Nutrition insights</p></div>
                <Toggle active={notifs.healthTips} onToggle={() => setNotifs(p => ({...p, healthTips: !p.healthTips}))} />
              </div>
           </Card>
           <div className="pt-10">
              <Button onClick={() => navigate('settings')}>Back to Settings</Button>
           </div>
        </div>
      </LayoutWrapper>
    );
  }

  if (currentView === 'theme') {
    return (
      <LayoutWrapper>
        <header className="p-6 bg-white dark:bg-slate-900 flex items-center gap-4 border-b border-red-50">
          <button onClick={() => navigate('settings')} className="dark:text-white"><ChevronLeft className="text-black" /></button>
          <h2 className="text-xl font-bold text-black dark:text-white">Appearance</h2>
        </header>
        <div className="p-6 space-y-4">
          <div 
            onClick={() => setTheme('light')}
            className={`p-6 rounded-3xl flex items-center justify-between border-2 transition-all cursor-pointer ${theme === 'light' ? 'bg-red-50 border-red-600 shadow-md' : 'bg-white border-transparent'}`}
          >
             <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${theme === 'light' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600'}`}><Sun /></div>
                <p className="font-black text-black">Light Mode</p>
             </div>
             {theme === 'light' && <CheckCircle2 className="w-6 h-6 text-red-600" />}
          </div>
          <div 
            onClick={() => setTheme('dark')}
            className={`p-6 rounded-3xl flex items-center justify-between border-2 transition-all cursor-pointer ${theme === 'dark' ? 'bg-slate-800 border-red-600 shadow-md' : 'bg-white border-transparent'}`}
          >
             <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600'}`}><Moon /></div>
                <p className="font-black text-black dark:text-white">Dark Mode</p>
             </div>
             {theme === 'dark' && <CheckCircle2 className="w-6 h-6 text-red-600" />}
          </div>
          <div className="pt-10">
             <Button onClick={() => navigate('settings')}>Apply & Return</Button>
          </div>
        </div>
      </LayoutWrapper>
    );
  }

  if (currentView === 'period') {
    const cycleDay = 14;
    const nextPeriodIn = 12;
    const fertileWindow = true;
    const symptoms = ['Cramps', 'Headache', 'Bloating', 'Acne', 'Fatigue', 'Cravings', 'Happy', 'Mood Swings'];

    const toggleSymptom = (s: string) => {
      const today = new Date().toISOString().split('T')[0];
      setCycleLogs(prev => {
        const existing = prev.find(l => l.date === today);
        if (existing) {
          return prev.map(l => l.date === today ? { ...l, symptoms: l.symptoms.includes(s) ? l.symptoms.filter(x => x !== s) : [...l.symptoms, s] } : l);
        } else {
          return [...prev, { id: Math.random().toString(), date: today, symptoms: [s], flow: 'none' }];
        }
      });
    };

    const isSymptomActive = (s: string) => {
      const today = new Date().toISOString().split('T')[0];
      return cycleLogs.find(l => l.date === today)?.symptoms.includes(s);
    };

    return (
      <LayoutWrapper className="bg-red-50/10 pb-20">
        <header className="p-6 bg-white dark:bg-slate-900 border-b border-red-50 flex items-center gap-4 sticky top-0 z-10">
          <button onClick={() => navigate('home')} className="dark:text-white"><ChevronLeft className="text-black" /></button>
          <h2 className="text-xl font-bold text-black dark:text-white">Cycle Tracker</h2>
        </header>

        <div className="p-6 space-y-6">
          <Card className="bg-black text-white p-8 border-none relative overflow-hidden shadow-xl">
             <div className="absolute top-0 right-0 p-4 opacity-10 transform scale-150 rotate-12"><Droplets className="w-32 h-32 text-red-600" /></div>
             <div className="relative z-10 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-2">Next Period Forecast</p>
                <div className="flex flex-col items-center">
                   <div className="text-7xl font-black text-white flex items-baseline gap-1">
                      {nextPeriodIn}
                      <span className="text-lg font-black text-red-600">days</span>
                   </div>
                   <p className="text-xs text-gray-400 font-bold uppercase mt-2">Starts approx. in 12 days</p>
                </div>
                {fertileWindow && (
                  <div className="mt-6 bg-red-600/20 text-red-400 px-4 py-2 rounded-2xl inline-flex items-center gap-2 border border-red-600/30">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">High Fertility Window</span>
                  </div>
                )}
             </div>
          </Card>

          <div className="space-y-4">
             <h4 className="font-black text-black text-lg px-1">Cycle Calendar</h4>
             <div className="grid grid-cols-7 gap-1">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => (
                  <div key={d} className="text-center text-[10px] font-black text-black p-2">{d}</div>
                ))}
                {Array.from({ length: 28 }).map((_, i) => {
                  const isPeriod = i < 5;
                  const isFertile = i > 11 && i < 17;
                  return (
                    <div 
                      key={i} 
                      className={`aspect-square rounded-xl flex items-center justify-center text-xs font-black border transition-all
                        ${isPeriod ? 'bg-red-600 border-red-600 text-white shadow-lg' : ''}
                        ${isFertile ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-transparent text-black'}
                        ${i + 1 === cycleDay ? 'ring-2 ring-black ring-offset-2' : ''}
                      `}
                    >
                      {i + 1}
                    </div>
                  );
                })}
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <Card className="bg-red-50 border-red-200">
                <p className="text-[10px] font-black uppercase text-red-600 mb-1">Current Day</p>
                <p className="text-3xl font-black text-black">Day {cycleDay}</p>
                <p className="text-xs text-black font-bold mt-1">Follicular Phase</p>
             </Card>
             <Card className="bg-red-50 border-red-200">
                <p className="text-[10px] font-black uppercase text-red-600 mb-1">Status</p>
                <p className="text-3xl font-black text-black">Peak</p>
                <p className="text-xs text-black font-bold mt-1">Estrogen Rising</p>
             </Card>
          </div>

          <div className="space-y-4">
             <h4 className="font-black text-black text-lg px-1">Log Today's Symptoms</h4>
             <div className="flex flex-wrap gap-2">
                {symptoms.map(s => (
                  <button 
                    key={s} 
                    onClick={() => toggleSymptom(s)}
                    className={`px-5 py-3 rounded-2xl text-xs font-black border transition-all
                      ${isSymptomActive(s) ? 'bg-red-600 border-red-600 text-white shadow-md active:scale-95' : 'bg-white border-red-200 text-black active:bg-red-100'}
                    `}
                  >
                    {s}
                  </button>
                ))}
             </div>
          </div>

          <Card className="bg-black text-white p-6 flex gap-4">
             <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-red-600 shrink-0"><Brain /></div>
             <div>
                <h5 className="font-black text-white text-sm mb-1">Health Insight</h5>
                <p className="text-xs text-gray-300 font-bold leading-relaxed italic">
                  "Peak estrogen levels detected. High-intensity workouts are recommended today."
                </p>
             </div>
          </Card>
        </div>
      </LayoutWrapper>
    );
  }

  if (currentView === 'mood') {
    const avgMood = moodLogs.length > 0 ? (moodLogs.reduce((acc, l) => acc + l.rating, 0) / moodLogs.length).toFixed(1) : 0;
    const emotions = ['Anxious', 'Calm', 'Stressed', 'Energetic', 'Tired', 'Focused', 'Sad', 'Excited'];

    return (
      <LayoutWrapper className="bg-red-50/10 pb-20">
        <header className="p-6 bg-white dark:bg-slate-900 border-b border-red-50 flex items-center gap-4 sticky top-0 z-30">
          <button onClick={() => navigate('home')} className="dark:text-white"><ChevronLeft className="text-black" /></button>
          <h2 className="text-xl font-bold text-black dark:text-white">Mood Board</h2>
        </header>

        <div className="p-6 space-y-6">
          <Card className="bg-black text-white p-8 border-none relative overflow-hidden shadow-xl">
             <div className="absolute top-0 right-0 p-4 opacity-10 transform scale-150 rotate-12"><Smile className="w-32 h-32 text-red-600" /></div>
             <div className="relative z-10 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-2">Average Resilience</p>
                <div className="flex flex-col items-center">
                   <div className="text-7xl mb-2 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">{getMoodEmoji(Math.round(Number(avgMood)))}</div>
                   <h3 className="text-6xl font-black text-white">{avgMood}</h3>
                   <p className="text-[10px] text-gray-500 font-black uppercase mt-1">Sentiment Score</p>
                </div>
             </div>
          </Card>

          <Card className="space-y-6 p-8 border-red-50">
             <div className="text-center">
                <h4 className="font-black text-black text-lg">Daily Check-In</h4>
                <p className="text-xs text-gray-600 font-bold">How are you feeling?</p>
             </div>
             
             <div className="flex justify-between items-center">
                {[1, 2, 3, 4, 5].map(rating => (
                  <button 
                    key={rating} 
                    onClick={() => setSelectedMood(rating)}
                    className={`text-4xl transition-all ${selectedMood === rating ? 'scale-125 drop-shadow-lg' : 'opacity-20 grayscale'}`}
                  >
                    {getMoodEmoji(rating)}
                  </button>
                ))}
             </div>

             <div className="space-y-4">
                <p className="text-[10px] font-black uppercase text-black text-center">Labels</p>
                <div className="flex flex-wrap gap-2 justify-center">
                   {emotions.map(tag => (
                     <button 
                       key={tag} 
                       onClick={() => toggleTag(tag)}
                       className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all border
                         ${selectedTags.includes(tag) ? 'bg-red-600 border-red-600 text-white' : 'bg-red-50 border-red-200 text-red-950'}
                       `}
                     >
                       {tag}
                     </button>
                   ))}
                </div>
                <TextArea 
                  placeholder="Private journal entry..." 
                  value={moodNote} 
                  onChange={e => setMoodNote(e.target.value)} 
                />
                <Button 
                  onClick={handleLogMood} 
                  disabled={isLoggingMood}
                >
                  {isLoggingMood ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Log Daily Vibe'}
                </Button>
             </div>
          </Card>

          {aiTip && (
            <div className="bg-red-600 p-6 rounded-[2rem] text-white shadow-2xl animate-in fade-in slide-in-from-bottom-4">
               <div className="flex items-center gap-3 mb-3">
                  <Sparkles className="w-6 h-6" />
                  <h5 className="font-black text-xs uppercase tracking-widest">Mindfulness Tip</h5>
               </div>
               <p className="text-sm font-black italic leading-relaxed text-white">"{aiTip}"</p>
            </div>
          )}

          <div className="space-y-4">
             <h4 className="font-black text-black dark:text-white text-lg px-1">Mindset History</h4>
             {moodLogs.map(log => (
               <Card key={log.id} className="flex gap-4 p-5 border-red-50 hover:bg-red-50/10 transition-colors">
                  <div className="text-4xl shrink-0">{getMoodEmoji(log.rating)}</div>
                  <div className="flex-1 min-w-0">
                     <div className="flex justify-between items-start mb-1">
                        <p className={`font-black text-sm ${getMoodColor(log.rating)}`}>
                          {log.rating === 5 ? 'Overjoyed' : log.rating === 4 ? 'Content' : log.rating === 3 ? 'Neutral' : log.rating === 2 ? 'Down' : 'Struggling'}
                        </p>
                        <p className="text-[10px] text-black font-black uppercase">{new Date(log.date).toLocaleDateString()}</p>
                     </div>
                     {log.tags && log.tags.length > 0 && (
                       <div className="flex flex-wrap gap-1 mb-2">
                         {log.tags.map(t => <span key={t} className="text-[8px] bg-red-100 text-black px-2 py-0.5 rounded-full font-black uppercase tracking-wider">{t}</span>)}
                       </div>
                     )}
                     <p className="text-sm text-black font-bold italic leading-relaxed">{log.note || "No notes logged."}</p>
                  </div>
               </Card>
             ))}
          </div>
        </div>
      </LayoutWrapper>
    );
  }

  if (currentView === 'attendance') {
    const todayDate = new Date().getDate();

    return (
      <LayoutWrapper>
        <header className="p-6 bg-white dark:bg-slate-900 border-b border-red-50 flex items-center justify-between sticky top-0 z-10">
          <button onClick={() => navigate('home')} className="dark:text-white"><ChevronLeft className="text-black" /></button>
          <h2 className="text-xl font-bold text-black dark:text-white">Attendance</h2>
          <div className="w-6" />
        </header>
        <div className="p-6 space-y-8">
          <Card className="bg-black text-white p-8 border-none overflow-hidden relative shadow-xl border-b-4 border-red-600">
            <div className="absolute top-0 right-0 p-4 opacity-10 transform scale-150 rotate-12"><Target className="w-32 h-32 text-red-600" /></div>
            <p className="text-[10px] font-black uppercase opacity-60 mb-2">Current Membership</p>
            <h3 className="text-3xl font-black mb-1 text-white">Elite Red</h3>
            <p className="text-sm text-red-500 font-black mb-6">Status: {checkInTime ? 'Session Active' : 'Off-Duty'}</p>
            <div className="w-full h-2.5 bg-red-900/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-red-600 rounded-full shadow-[0_0_10px_#EF4444] transition-all duration-700" 
                style={{ width: `${Math.min((attendedDays.length / 20) * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-3 text-[10px] font-black uppercase tracking-[0.1em] text-gray-500">
              <span>Goal: 20 Sessions</span>
              <span>{Math.round((attendedDays.length / 20) * 100)}% Progress</span>
            </div>
          </Card>

          {/* Manual Check-in / Check-out Control */}
          <Card className="p-8 border-red-100 bg-red-50/20 shadow-lg relative overflow-hidden">
             <div className="relative z-10 text-center space-y-6">
                <div className="flex flex-col items-center">
                   <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mb-4 transition-all duration-500 ${checkInTime ? 'bg-red-600 text-white animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.5)]' : 'bg-gray-100 text-gray-400'}`}>
                      {checkInTime ? <Timer className="w-10 h-10" /> : <Dumbbell className="w-10 h-10" />}
                   </div>
                   <h4 className="text-xl font-black text-black">
                      {checkInTime ? 'Session Active' : 'Ready to Train?'}
                   </h4>
                   <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">
                      {checkInTime ? `Started at ${checkInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Manual entrance log'}
                   </p>
                </div>

                {checkInTime ? (
                  <div className="space-y-6">
                    <div className="text-5xl font-black text-black tracking-tight font-mono">
                       {formatTime(elapsedTime)}
                    </div>
                    <Button variant="secondary" onClick={handleCheckOut}>
                       <LogOut className="w-5 h-5 text-red-600" /> CHECK OUT
                    </Button>
                  </div>
                ) : (
                  <Button onClick={handleCheckIn}>
                     <Play className="w-5 h-5" /> CHECK IN NOW
                  </Button>
                )}
             </div>
          </Card>

          <div className="space-y-4">
             <div className="flex justify-between items-center px-1">
               <h4 className="font-black text-black text-lg">Calendar Log</h4>
               <CalendarIcon className="w-5 h-5 text-red-600" />
             </div>
             <div className="grid grid-cols-7 gap-3">
                {Array.from({ length: 31 }).map((_, i) => {
                  const day = i + 1;
                  const isAttended = attendedDays.includes(day);
                  const isFuture = day > todayDate;
                  const isToday = day === todayDate;
                  return (
                    <div 
                      key={i} 
                      className={`aspect-square rounded-2xl flex items-center justify-center font-black text-xs transition-all border
                        ${isAttended ? 'bg-red-600 border-red-600 text-white shadow-lg scale-105' : 'bg-red-50 border-red-200 text-black'}
                        ${isToday ? 'ring-2 ring-black ring-offset-2 z-10' : ''}
                        ${isFuture ? 'opacity-30 grayscale' : ''}
                      `}
                    >
                      {isAttended ? <CheckCircle2 className="w-4 h-4" /> : day}
                    </div>
                  );
                })}
             </div>
             <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-center italic">Calendar updates automatically upon Check-In</p>
          </div>

          <div className="space-y-4">
             <div className="flex justify-between items-center px-1">
               <h4 className="font-black text-black text-lg">Session History</h4>
               <History className="w-5 h-5 text-gray-400" />
             </div>
             
             {attendanceHistory.length === 0 && !checkInTime && (
                <div className="py-12 flex flex-col items-center text-gray-300">
                   <CalendarIcon className="w-10 h-10 mb-2 opacity-20" />
                   <p className="text-xs font-black uppercase tracking-widest italic">No sessions logged yet</p>
                </div>
             )}

             <div className="space-y-3">
                {attendanceHistory.map(log => (
                  <Card key={log.id} className="flex items-center justify-between border-red-50 hover:bg-red-50/10 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shadow-sm">
                         <ShieldCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-black text-black">Gym Session</p>
                        <p className="text-[10px] text-gray-500 font-black uppercase">
                           {log.start.toLocaleDateString()} • {log.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="font-black text-red-600">
                          {Math.round((log.end.getTime() - log.start.getTime()) / 60000)}m
                       </p>
                       <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Duration</p>
                    </div>
                  </Card>
                ))}
             </div>
          </div>
        </div>
      </LayoutWrapper>
    );
  }

  return (
    <LayoutWrapper className="flex flex-col items-center justify-center p-10 h-screen text-center">
       <Dumbbell className="w-16 h-16 text-red-600 mb-4" />
       <h2 className="text-2xl font-bold text-black dark:text-white mb-2">Syncing Module</h2>
       <p className="text-gray-500 dark:text-slate-400 mb-8 font-bold">Refining the experience...</p>
       <Button onClick={() => navigate('home')}>Return to Dashboard</Button>
    </LayoutWrapper>
  );
}
