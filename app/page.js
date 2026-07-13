'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Send,
  Mic,
  Image as ImageIcon,
  MessageSquare,
  MapPin,
  Navigation,
  Ambulance,
  Car,
  FileText,
  CheckCircle,
  X,
  Menu,
  AlertTriangle,
  Sun,
  Moon,
  Phone,
  Heart,
  Shield,
  Volume2,
  VolumeX,
  Clock,
  Pill,
  Stethoscope,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Info,
  XCircle,
  Check,
} from 'lucide-react';

const MapComponent = dynamic(
  () => import('@/components/MapComponent'),
  { ssr: false, loading: () => (
    <div className="h-full w-full bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400">
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-3 border-slate-300 border-t-primary-600 rounded-full animate-spin" />
        <span className="text-sm">Loading map...</span>
      </div>
    </div>
  )}
);

import StepProgress from '@/components/StepProgress';

// Language detection
function detectLanguage(text) {
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te';
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml';
  return 'en';
}

// Speech synthesis
function speakResponse(text, lang = 'en') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === 'hi' ? 'hi-IN' : lang === 'ta' ? 'ta-IN' : lang === 'te' ? 'te-IN' : lang === 'kn' ? 'kn-IN' : lang === 'ml' ? 'ml-IN' : 'en-US';
  utterance.rate = 0.9;
  utterance.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

// Health tips data
const HEALTH_TIPS = [
  { icon: '💧', title: 'Stay Hydrated', text: 'Drink at least 8 glasses of clean water daily, especially in hot weather.' },
  { icon: '🧼', title: 'Hand Hygiene', text: 'Wash hands with soap for 20 seconds before eating and after using the toilet.' },
  { icon: '🦟', title: 'Malaria Prevention', text: 'Sleep under insecticide-treated bed nets and remove stagnant water near homes.' },
  { icon: '🍎', title: 'Balanced Diet', text: 'Eat seasonal fruits, vegetables, and include proteins like dal and eggs in meals.' },
  { icon: '💉', title: 'Vaccinations', text: 'Keep vaccination records up to date for children and pregnant women.' },
  { icon: '🏃', title: 'Daily Exercise', text: 'Walk for 30 minutes daily. Physical activity reduces risk of heart disease and diabetes.' },
];

// Emergency contacts
const EMERGENCY_CONTACTS = [
  { name: 'National Emergency', number: '112', desc: 'All emergencies' },
  { name: 'Ambulance', number: '108', desc: 'Free ambulance service' },
  { name: 'Poison Control', number: '1800-11-7777', desc: 'Poisoning emergencies' },
  { name: 'Women Helpline', number: '181', desc: 'Women in distress' },
  { name: 'Child Helpline', number: '1098', desc: 'Children in need' },
];

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [step, setStep] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [clinics, setClinics] = useState([]);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [transport, setTransport] = useState(null);
  const [userLocation, setUserLocation] = useState({ lat: 12.9716, lng: 77.5946 });
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [trackingData, setTrackingData] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [symptomHistory, setSymptomHistory] = useState([]);
  const [careReminders, setCareReminders] = useState([]);
  const [emergencyTriggered, setEmergencyTriggered] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showHealthTips, setShowHealthTips] = useState(false);
  const [showEmergencyContacts, setShowEmergencyContacts] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [selectedLang, setSelectedLang] = useState('en');
  const [error, setError] = useState(null);
  const [showReminders, setShowReminders] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load dark mode preference
  useEffect(() => {
    const saved = localStorage.getItem('custodia_dark_mode');
    if (saved) {
      setDarkMode(saved === 'true');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
  }, []);

  // Apply dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('custodia_dark_mode', darkMode);
  }, [darkMode]);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {
          // Default to Bangalore if location denied
          setUserLocation({ lat: 12.9716, lng: 77.5946 });
        }
      );
    }
  }, []);

  // Load saved data
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('custodia_symptom_history');
      const storedReminders = localStorage.getItem('custodia_reminders');
      const savedLang = localStorage.getItem('custodia_language');
      if (storedHistory) setSymptomHistory(JSON.parse(storedHistory));
      if (storedReminders) setCareReminders(JSON.parse(storedReminders));
      if (savedLang) setSelectedLang(savedLang);
    } catch (_) {}
  }, []);

  // Save data
  useEffect(() => {
    try {
      localStorage.setItem('custodia_symptom_history', JSON.stringify(symptomHistory));
    } catch (_) {}
  }, [symptomHistory]);

  useEffect(() => {
    try {
      localStorage.setItem('custodia_reminders', JSON.stringify(careReminders));
    } catch (_) {}
  }, [careReminders]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Tracking interval
  useEffect(() => {
    if (step === 4 && sessionId) {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/tracking/${sessionId}`);
          const data = await res.json();
          if (data.error) return;
          setTrackingData(data);
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'bot' && last.type === 'tracking') {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...last,
                text: `🚑 Vehicle tracking\nPickup: ${data.eta_pickup} min · Clinic: ${data.eta_destination} min`,
              };
              return updated;
            }
            return prev;
          });
        } catch (_) {}
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [step, sessionId]);

  const addMessage = (role, text, type = 'text') => {
    setMessages(prev => [...prev, { role, text, type, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
  };

  const addSymptomEntry = (symptom, triage = null) => {
    setSymptomHistory(prev => [{
      id: Date.now(),
      symptom,
      diagnosis: triage?.diagnosis || null,
      needsDoctor: triage?.needsDoctor ?? null,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }, ...prev].slice(0, 10));
  };

  const addReminderEntries = (triage) => {
    const meds = (triage?.suggestedMedicines || []).map((med, index) => ({
      id: `${Date.now()}-${index}`,
      name: med.name || 'Medicine',
      schedule: `${med.dosage || 'As advised'} · ${med.frequency || 'as needed'} · ${med.duration || 'as directed'} · ${med.timing || 'as advised'}`,
      type: med.type || 'OTC',
      taken: false,
      time: new Date().toISOString(),
    }));
    if (meds.length > 0) {
      setCareReminders(prev => [...meds, ...prev].slice(0, 10));
    }
  };

  const goToStep = (num) => {
    setStep(num);
    setShowSidebar(true);
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const userMsg = inputText.trim();
    setInputText('');
    setError(null);
    addMessage('user', userMsg);
    setLoading(true);

    try {
      const lang = detectLanguage(userMsg);
      setSelectedLang(lang);
      localStorage.setItem('custodia_language', lang);

      const res = await fetch('/api/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptoms: userMsg,
          lat: userLocation.lat,
          lng: userLocation.lng,
          lang,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setSessionId(data.sessionId);

      if (data.triage) {
        addSymptomEntry(userMsg, data.triage);
        addReminderEntries(data.triage);
      }

      let botMessage = data.message || 'Here is your initial assessment.';
      if (data.triage) {
        const { diagnosis, suggestedMedicines, careInstructions, score } = data.triage;

        botMessage = `🩺 **Health Assessment**\n\n`;

        if (diagnosis) {
          botMessage += `**Diagnosis:** ${diagnosis}\n`;
        }
        if (score) {
          const urgencyEmoji = score >= 4 ? '🔴' : score >= 3 ? '🟠' : score >= 2 ? '🟡' : '🟢';
          botMessage += `**Urgency:** ${urgencyEmoji} ${score}/5\n\n`;
        }

        if (suggestedMedicines && suggestedMedicines.length > 0) {
          botMessage += `💊 **Suggested Medicines:**\n`;
          suggestedMedicines.forEach((med) => {
            const details = [med.name, med.dosage, med.frequency, med.duration && `for ${med.duration}`, med.timing, med.type && `(${med.type})`].filter(Boolean);
            botMessage += `• ${details.join(' · ')}\n`;
          });
          botMessage += '\n';
        }

        if (careInstructions) {
          botMessage += `🏠 **Care Instructions:**\n${careInstructions}\n`;
        }
      }

      addMessage('bot', botMessage);
      if (voiceEnabled) speakResponse(botMessage, lang);

      if (data.clinics && data.clinics.length > 0) {
        setClinics(data.clinics);
        goToStep(1);
        addMessage('bot', '🏥 Here are the nearest clinics. Please select one:');
        if (voiceEnabled) speakResponse('Please select a clinic', lang);
      } else {
        goToStep(5);
        addMessage('bot', '✅ No clinic visit needed right now. Please follow the care instructions and seek medical help if symptoms worsen.');
      }
    } catch (err) {
      setError(err.message);
      addMessage('bot', '❌ Sorry, something went wrong. Please try again. If this persists, please call emergency services.');
    }
    setLoading(false);
  };

  const handleClinicSelect = async (clinicId) => {
    setLoading(true);
    setError(null);
    if (!sessionId) {
      addMessage('bot', '⚠️ Session not found. Please start a new chat.');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, clinicId }),
      });
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      const clinic = clinics.find(c => c.id === clinicId);
      setSelectedClinic(clinic);
      addMessage('bot', `✅ ${data.message}\n\n📅 Appointment: ${data.appointment?.time || 'Confirmed'}`);
      goToStep(2);
      addMessage('bot', '🚗 How would you like to get to the clinic?');
    } catch (err) {
      setError(err.message);
      addMessage('bot', '❌ Could not book appointment. Please try again.');
    }
    setLoading(false);
  };

  const handleTransportChoice = async (choice) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/transport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, choice }),
      });
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setTransport(data);
      const label = data.type === 'ambulance' ? '🚑 Ambulance' : '🚗 Volunteer Driver';
      addMessage('bot', `${label} booked!\n👤 Driver: ${data.driver}\n📞 Phone: ${data.phone}\n⏱️ Pickup: ${data.eta_pickup} min · Clinic: ${data.eta_destination} min`);
      goToStep(3);
      addMessage('bot', '📍 Tracking your ride in real-time...', 'tracking');
    } catch (err) {
      setError(err.message);
      addMessage('bot', '❌ Could not book transport. Please try again or arrange your own transport.');
    }
    setLoading(false);
  };

  const handleEmergency = async () => {
    setEmergencyTriggered(true);
    setShowEmergencyContacts(true);
    addMessage('user', '🚨 Emergency assistance requested');
    addMessage('bot', '🚨 **Emergency Protocol Activated**\n\n1. **Call 112 or 108 immediately**\n2. Stay calm and describe your location\n3. Do not move if severely injured\n4. Keep the patient comfortable\n\nArranging ambulance...');
    if (voiceEnabled) speakResponse('Emergency protocol activated. Call 112 immediately.', 'en');
    if (sessionId) {
      await handleTransportChoice('ambulance');
    } else {
      setTransport({ type: 'ambulance', driver: 'Emergency Response', phone: '108', eta_pickup: 5, eta_destination: 15, label: 'Emergency Ambulance' });
      goToStep(3);
      addMessage('bot', '🚑 Emergency ambulance is being dispatched. ETA: 5 minutes.', 'tracking');
    }
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/report/${sessionId}`);
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      const reportText = `📋 **Patient Medical Report**\n\n🆔 Patient ID: ${data.patient_id?.slice(0, 8) || 'N/A'}\n🩺 Symptoms: ${data.symptoms}\n📊 Triage Score: ${data.triage_score}/5\n🔍 Diagnosis: ${data.diagnosis}\n💊 Medicines: ${(data.suggested_medicines || []).map(m => m.name).join(', ') || 'None'}\n🏥 Clinic: ${data.clinic_visited || 'None'}\n🚗 Transport: ${data.transport_used || 'Own'}\n📋 Care: ${data.care_instructions || 'N/A'}\n🔄 Follow-up: ${data.followup_instructions || 'Rest and monitor symptoms'}`;
      addMessage('bot', reportText);
      goToStep(5);
      addMessage('bot', '✅ Report generated successfully! You can save this for your records.');
    } catch (err) {
      setError(err.message);
      addMessage('bot', '❌ Could not generate report. Please try again.');
    }
    setLoading(false);
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      addMessage('bot', '⚠️ Image size should be less than 5MB.');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      addMessage('user', '📸 [Image uploaded]');
      setIsAnalyzing(true);
      try {
        const res = await fetch('/api/analyze-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: e.target.result }),
        });
        const result = await res.json();

        let response = `📸 **Image Analysis Result**\n\n`;
        response += `**Condition:** ${result.condition}\n`;
        response += `**Severity:** ${result.severity?.toUpperCase() || 'Unknown'}\n`;
        if (result.confidence) {
          response += `**Confidence:** ${result.confidence}%\n`;
        }
        response += `\n💡 **Recommendation:**\n${result.recommendation}\n`;
        if (result.first_aid) {
          response += `\n🩹 **First Aid:**\n${result.first_aid}\n`;
        }
        if (result.possible_conditions?.length > 0) {
          response += `\n🔍 **Possible Conditions:** ${result.possible_conditions.join(', ')}\n`;
        }
        if (result.seek_care) {
          response += `\n🏥 **When to Seek Care:**\n${result.seek_care}\n`;
        }
        if (result.note) {
          response += `\nℹ️ ${result.note}\n`;
        }

        addMessage('bot', response);
        if (voiceEnabled) speakResponse(`Image analysis: ${result.condition}. Severity: ${result.severity}. ${result.recommendation}`, selectedLang);

        if (result.emergency) {
          addMessage('bot', '🚨 **Emergency detected in image!** Activating emergency protocol.');
          setTimeout(() => handleEmergency(), 1500);
        }
      } catch (err) {
        addMessage('bot', '❌ Image analysis failed. Please describe your symptoms instead.');
      }
      setIsAnalyzing(false);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addMessage('bot', '⚠️ Voice input is not supported in this browser. Please type your symptoms.');
      return;
    }
    setIsListening(true);
    const recognition = new SpeechRecognition();

    // Map language to appropriate recognition code
    const langMap = {
      'hi': 'hi-IN',
      'ta': 'ta-IN',
      'te': 'te-IN',
      'kn': 'kn-IN',
      'ml': 'ml-IN',
      'en': 'en-IN',
    };
    recognition.lang = langMap[selectedLang] || 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setInputText(text);
      setIsListening(false);
      // Auto-send after voice input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    };

    recognition.onerror = (e) => {
      console.error('Voice recognition error:', e.error);
      setIsListening(false);
      if (e.error === 'no-speech') {
        addMessage('bot', '⚠️ No speech detected. Please try again.');
      } else if (e.error === 'not-allowed') {
        addMessage('bot', '⚠️ Microphone access denied. Please allow microphone permissions.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleNewChat = () => {
    setMessages([]);
    setStep(0);
    setClinics([]);
    setSelectedClinic(null);
    setTransport(null);
    setTrackingData(null);
    setSessionId(null);
    setShowSidebar(false);
    setEmergencyTriggered(false);
    setError(null);
    addMessage('bot', '👋 **Hello!** I am Custodia AI, your healthcare assistant.\n\nDescribe your symptoms, upload a photo, or speak to get started.');
  };

  const toggleReminder = (id) => {
    setCareReminders(prev => prev.map(r =>
      r.id === id ? { ...r, taken: !r.taken } : r
    ));
  };

  const clearHistory = () => {
    setSymptomHistory([]);
    setCareReminders([]);
    localStorage.removeItem('custodia_symptom_history');
    localStorage.removeItem('custodia_reminders');
    addMessage('bot', '🗑️ Symptom history and reminders cleared.');
  };

  // Welcome message on first load
  useEffect(() => {
    if (messages.length === 0) {
      addMessage('bot', '👋 **Welcome to Custodia AI!**\n\nI can help you with:\n• 🩺 Symptom assessment\n• 📸 Image analysis (rashes, wounds, bites)\n• 🏥 Finding nearby clinics\n• 🚑 Emergency ambulance booking\n• 📋 Medical reports\n\n**Describe your symptoms, upload a photo, or use voice input to begin.**');
    }
  }, []);

  const languageNames = {
    en: 'English',
    hi: 'हिंदी',
    ta: 'தமிழ்',
    te: 'తెలుగు',
    kn: 'ಕನ್ನಡ',
    ml: 'മലയാളം',
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${darkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
      {/* Error Toast */}
      {error && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] bg-red-500 text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium toast-enter flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-2 hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <header className={`border-b px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-40 transition-colors ${
        darkMode ? 'bg-slate-900/80 border-slate-700' : 'bg-white/80 border-slate-200/60'
      } backdrop-blur-md`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <h1 className={`text-xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              Custodia<span className="text-primary-600">AI</span>
            </h1>
            <p className="text-[10px] text-slate-400 hidden sm:block">Rural Healthcare Access</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language selector */}
          <select
            value={selectedLang}
            onChange={(e) => { setSelectedLang(e.target.value); localStorage.setItem('custodia_language', e.target.value); }}
            className={`text-xs px-2 py-1.5 rounded-lg border transition-colors ${
              darkMode ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
            } focus:outline-none focus:ring-2 focus:ring-primary-500/40`}
          >
            {Object.entries(languageNames).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>

          {/* Voice toggle */}
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`p-2 rounded-xl transition ${voiceEnabled ? 'text-primary-600 hover:bg-primary-50' : 'text-slate-400 hover:bg-slate-100'}`}
            title={voiceEnabled ? 'Voice output on' : 'Voice output off'}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Health tips */}
          <button
            onClick={() => setShowHealthTips(!showHealthTips)}
            className={`p-2 rounded-xl transition ${showHealthTips ? 'text-primary-600 hover:bg-primary-50' : 'text-slate-400 hover:bg-slate-100'}`}
            title="Health tips"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* Emergency contacts */}
          <button
            onClick={() => setShowEmergencyContacts(!showEmergencyContacts)}
            className="p-2 rounded-xl transition text-red-500 hover:bg-red-50"
            title="Emergency contacts"
          >
            <Phone className="w-4 h-4" />
          </button>

          {/* Dark mode */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-xl transition ${darkMode ? 'text-amber-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
            title={darkMode ? 'Light mode' : 'Dark mode'}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={handleNewChat}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              darkMode ? 'text-slate-300 border-slate-600 hover:border-slate-500' : 'text-slate-500 border-slate-200 hover:border-slate-300'
            }`}
          >
            New Chat
          </button>
        </div>
      </header>

      {/* Health Tips Panel */}
      {showHealthTips && (
        <div className={`border-b transition-colors ${darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-emerald-50/50 border-emerald-100'}`}>
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                💡 Daily Health Tips
              </p>
              <button onClick={() => setShowHealthTips(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {HEALTH_TIPS.map((tip, idx) => (
                <div key={idx} className={`rounded-xl p-2.5 text-xs ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-emerald-100'}`}>
                  <span className="text-lg">{tip.icon}</span>
                  <p className={`font-semibold mt-1 ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{tip.title}</p>
                  <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{tip.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Emergency Contacts Panel */}
      {showEmergencyContacts && (
        <div className="bg-red-50 dark:bg-red-950/30 border-b border-red-100 dark:border-red-900">
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Emergency Contacts
              </p>
              <button onClick={() => setShowEmergencyContacts(false)} className="text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {EMERGENCY_CONTACTS.map((contact, idx) => (
                <a
                  key={idx}
                  href={`tel:${contact.number}`}
                  className="flex items-center gap-2 bg-white dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2 hover:bg-red-100 dark:hover:bg-red-900/50 transition"
                >
                  <Phone className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="text-xs font-semibold text-red-800 dark:text-red-300">{contact.name}</p>
                    <p className="text-sm font-bold text-red-600 dark:text-red-400">{contact.number}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step Progress */}
      <div className={`border-b transition-colors ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
        <StepProgress currentStep={step} totalSteps={6} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-6xl mx-auto w-full px-4 gap-4 py-4">
        {/* Chat Area */}
        <div className={`flex-1 flex flex-col rounded-2xl shadow-sm border overflow-hidden min-h-[400px] transition-colors ${
          darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
        }`}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-10">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-3 ${darkMode ? 'bg-slate-700' : 'bg-primary-50'}`}>
                  <Stethoscope className={`w-7 h-7 ${darkMode ? 'text-primary-400' : 'text-primary-600'}`} />
                </div>
                <h2 className={`text-xl font-semibold ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>How can I help you?</h2>
                <p className={`text-sm mt-1 max-w-sm ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>
                  Describe your symptoms, upload a photo, or speak in your language.
                </p>
                <div className="flex flex-wrap gap-2 mt-4 justify-center">
                  <button onClick={() => setInputText('I have a high fever and headache')} className={`text-xs px-4 py-2 rounded-full transition ${darkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                    🤒 Fever & headache
                  </button>
                  <button onClick={() => setInputText('I have chest pain and difficulty breathing')} className={`text-xs px-4 py-2 rounded-full transition ${darkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                    ❤️ Chest pain
                  </button>
                  <button onClick={() => setInputText('I have a cough and cold')} className={`text-xs px-4 py-2 rounded-full transition ${darkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                    🤧 Cough & cold
                  </button>
                  <button onClick={() => setInputText('My child has a rash and fever')} className={`text-xs px-4 py-2 rounded-full transition ${darkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                    👶 Child rash
                  </button>
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} message-enter`} style={{ animationDelay: `${idx * 0.04}s` }}>
                  <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary-600 text-white rounded-br-sm shadow-sm'
                      : darkMode ? 'bg-slate-700 text-slate-200 rounded-bl-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                  }`}>
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                    {msg.type === 'tracking' && trackingData && (
                      <div className={`mt-2 text-xs rounded-lg px-3 py-1.5 flex items-center gap-2 ${darkMode ? 'bg-black/30' : 'bg-black/5'}`}>
                        <span className="animate-pulse text-emerald-400">●</span>
                        ETA: {trackingData.eta_pickup} min to you · {trackingData.eta_destination} min to clinic
                      </div>
                    )}
                    <div className={`text-[10px] mt-0.5 ${msg.role === 'user' ? 'text-teal-100' : darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {msg.timestamp || 'now'}
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className={`rounded-2xl px-5 py-3 flex items-center gap-1.5 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                </div>
              </div>
            )}

            {/* Image analyzing indicator */}
            {isAnalyzing && (
              <div className="flex justify-start">
                <div className={`rounded-2xl px-5 py-3 flex items-center gap-2 text-sm ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-500'}`}>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Analyzing image with AI...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className={`border-t p-3 flex items-center gap-2 transition-colors ${
            darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white/80 border-slate-100'
          }`}>
            {/* Emergency */}
            <button
              onClick={handleEmergency}
              className="p-2.5 rounded-xl hover:bg-red-50 text-red-600 transition"
              title="Emergency SOS"
            >
              <AlertTriangle className="w-5 h-5" />
            </button>

            {/* Image upload */}
            <label className="cursor-pointer p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} capture="environment" />
              <ImageIcon className={`w-5 h-5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
            </label>

            {/* Voice */}
            <button
              onClick={handleVoiceInput}
              className={`p-2.5 rounded-xl transition ${
                isListening ? 'bg-red-100 text-red-600 animate-pulse' : darkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
              }`}
              title={isListening ? 'Listening...' : 'Voice input'}
            >
              <Mic className="w-5 h-5" />
            </button>

            {/* Text input */}
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type symptoms in any language..."
              className={`flex-1 border-0 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-colors ${
                darkMode ? 'bg-slate-700 text-slate-200 placeholder-slate-500' : 'bg-slate-100 text-slate-800 placeholder-slate-400'
              }`}
              disabled={loading}
            />

            {/* Send */}
            <button
              onClick={handleSend}
              disabled={loading || !inputText.trim()}
              className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2.5 rounded-xl transition shadow-sm"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sidebar */}
        {(step >= 1 && step <= 5) && (
          <div className={`w-full lg:w-72 xl:w-80 flex-shrink-0 ${showSidebar ? 'block' : 'hidden lg:block'} mt-3 lg:mt-0`}>
            <div className={`rounded-2xl shadow-sm border p-4 sticky top-24 space-y-4 transition-colors ${
              darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
            }`}>
              {/* Map */}
              <div className="map-wrapper h-44 sm:h-48">
                <MapComponent userLocation={userLocation} clinics={clinics} selectedClinic={selectedClinic} trackingData={trackingData} />
              </div>

              {/* Care Plan */}
              <div className={`space-y-3 border-t pt-3 transition-colors ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                <div className="flex items-center justify-between">
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Care plan</p>
                  <span className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Step {Math.min(step + 1, 5)} / 5</span>
                </div>

                {/* Emergency alert */}
                {emergencyTriggered && (
                  <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs text-red-700 dark:text-red-400 emergency-pulse">
                    <div className="flex items-center gap-1 font-semibold">
                      <AlertTriangle className="w-3 h-3" /> Emergency assistance is active
                    </div>
                  </div>
                )}

                {/* Symptom history */}
                {symptomHistory.length > 0 && (
                  <div className={`rounded-xl p-3 ${darkMode ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                    <p className={`text-xs font-semibold mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Recent symptoms</p>
                    <ul className="space-y-1.5">
                      {symptomHistory.slice(0, 3).map(entry => (
                        <li key={entry.id} className={`flex justify-between gap-2 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          <span className="truncate">{entry.symptom}</span>
                          <span className={`text-[10px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>{entry.time}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Medicine reminders */}
                {careReminders.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowReminders(!showReminders)}
                      className="w-full flex items-center justify-between"
                    >
                      <p className={`text-xs font-semibold ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                        <Pill className="w-3 h-3 inline mr-1" />
                        Medicine reminders ({careReminders.filter(r => !r.taken).length})
                      </p>
                      {showReminders ? <ChevronUp className={`w-3 h-3 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} /> : <ChevronDown className={`w-3 h-3 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />}
                    </button>

                    {showReminders && (
                      <div className={`rounded-xl p-3 mt-2 border ${darkMode ? 'bg-emerald-900/20 border-emerald-800' : 'bg-emerald-50 border-emerald-100'}`}>
                        <ul className="space-y-2">
                          {careReminders.slice(0, 5).map(reminder => (
                            <li key={reminder.id} className="flex items-start gap-2">
                              <button
                                onClick={() => toggleReminder(reminder.id)}
                                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition ${
                                  reminder.taken
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : darkMode ? 'border-slate-600' : 'border-slate-300'
                                }`}
                              >
                                {reminder.taken && <Check className="w-3 h-3" />}
                              </button>
                              <div className={`text-xs leading-relaxed ${darkMode ? 'text-emerald-300' : 'text-emerald-800'} ${reminder.taken ? 'line-through opacity-50' : ''}`}>
                                <span className="font-medium">{reminder.name}</span>
                                <span className={`${darkMode ? 'text-emerald-400/70' : 'text-emerald-700/70'}`}> · {reminder.schedule}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step-specific content */}
              {step === 1 && clinics.length > 0 && (
                <div className="space-y-2">
                  <p className={`text-xs font-medium uppercase tracking-wider flex items-center gap-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    <MapPin className="w-3 h-3" /> Select a clinic
                  </p>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {clinics.map(c => (
                      <button
                        key={c.id}
                        onClick={() => handleClinicSelect(c.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition border ${
                          darkMode
                            ? 'bg-slate-700/50 hover:bg-primary-900/30 border-transparent hover:border-primary-700'
                            : 'bg-slate-50 hover:bg-primary-50 border-transparent hover:border-primary-200'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className={`font-medium ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{c.name}</span>
                          <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{c.distance_km} km</span>
                        </div>
                        <div className={`text-xs mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          Stock {c.stock}% · {c.specialists} specialists
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-2">
                  <p className={`text-xs font-medium uppercase tracking-wider flex items-center gap-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Navigation className="w-3 h-3" /> Choose transport
                  </p>
                  <button onClick={() => handleTransportChoice('ambulance')} className="w-full flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-xl text-red-700 dark:text-red-400 text-sm font-medium transition border border-red-200 dark:border-red-800">
                    <Ambulance className="w-5 h-5" /> Ambulance
                  </button>
                  <button onClick={() => handleTransportChoice('volunteer')} className="w-full flex items-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-xl text-blue-700 dark:text-blue-400 text-sm font-medium transition border border-blue-200 dark:border-blue-800">
                    <Car className="w-5 h-5" /> Volunteer Driver
                  </button>
                  <button onClick={() => { addMessage('bot', 'You chose your own transport. Route shown on map.'); goToStep(3); addMessage('bot', '📍 Follow the route on the map.', 'tracking'); }} className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm transition border ${darkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-300 border-slate-600' : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'}`}>
                    <MapPin className="w-5 h-5" /> I will go myself
                  </button>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-3">
                  <div className={`flex items-center gap-2 text-sm ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    <span className="animate-pulse">●</span> Tracking your ride
                  </div>
                  {trackingData && (
                    <div className={`rounded-xl px-4 py-2.5 text-sm ${darkMode ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                      <div className={`flex justify-between ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        <span>Pickup ETA</span><span className="font-medium">{trackingData.eta_pickup} min</span>
                      </div>
                      <div className={`flex justify-between mt-1 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        <span>Clinic ETA</span><span className="font-medium">{trackingData.eta_destination} min</span>
                      </div>
                    </div>
                  )}
                  <button onClick={handleGenerateReport} className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-xl text-sm font-medium transition">
                    <FileText className="w-4 h-4 inline mr-1" /> Generate Report
                  </button>
                </div>
              )}

              {step === 5 && (
                <div className={`p-4 rounded-xl border text-center ${darkMode ? 'bg-emerald-900/20 border-emerald-800' : 'bg-emerald-50 border-emerald-200'}`}>
                  <CheckCircle className={`w-8 h-8 mx-auto mb-1 ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  <p className={`text-sm font-medium ${darkMode ? 'text-emerald-300' : 'text-emerald-800'}`}>Report Generated</p>
                  <p className={`text-xs ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>Check the chat for details.</p>
                </div>
              )}

              {/* Clear history button */}
              {(symptomHistory.length > 0 || careReminders.length > 0) && (
                <button
                  onClick={clearHistory}
                  className={`w-full text-xs py-2 rounded-xl transition border ${darkMode ? 'text-slate-500 hover:text-slate-300 border-slate-700 hover:bg-slate-700' : 'text-slate-400 hover:text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                >
                  <XCircle className="w-3 h-3 inline mr-1" /> Clear History
                </button>
              )}

              <div className={`text-[10px] text-center border-t pt-3 ${darkMode ? 'text-slate-600 border-slate-700' : 'text-slate-300 border-slate-100'}`}>
                Next.js · Leaflet · Gemini AI · {languageNames[selectedLang]}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile sidebar toggle */}
      {(step >= 1 && step <= 5) && (
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="lg:hidden fixed bottom-20 right-4 z-50 bg-primary-600 text-white p-3 rounded-full shadow-lg hover:bg-primary-700 transition"
        >
          {showSidebar ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      )}
    </div>
  );
}
