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
} from 'lucide-react';

const MapComponent = dynamic(
  () => import('@/components/MapComponent'),
  { ssr: false, loading: () => <div className="h-full w-full bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">Loading map...</div> }
);

import StepProgress from '@/components/StepProgress';
function detectLanguage(text) {
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te';
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml';
  return 'en';
}

function speakResponse(text, lang = 'en') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === 'hi' ? 'hi-IN' : lang === 'ta' ? 'ta-IN' : 'en-US';
  utterance.rate = 0.9;
  utterance.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

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
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  useEffect(() => {
    try {
      const storedHistory = window.localStorage.getItem('custodia_symptom_history');
      const storedReminders = window.localStorage.getItem('custodia_reminders');
      if (storedHistory) setSymptomHistory(JSON.parse(storedHistory));
      if (storedReminders) setCareReminders(JSON.parse(storedReminders));
    } catch (_) {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('custodia_symptom_history', JSON.stringify(symptomHistory));
    } catch (_) {}
  }, [symptomHistory]);

  useEffect(() => {
    try {
      window.localStorage.setItem('custodia_reminders', JSON.stringify(careReminders));
    } catch (_) {}
  }, [careReminders]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
                text: `Vehicle ETA to you: ${data.eta_pickup} min · ETA to clinic: ${data.eta_destination} min`,
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
    setMessages(prev => [...prev, { role, text, type, timestamp: new Date().toLocaleTimeString() }]);
  };

  const addSymptomEntry = (symptom, triage = null) => {
    setSymptomHistory(prev => [{
      id: Date.now(),
      symptom,
      diagnosis: triage?.diagnosis || null,
      needsDoctor: triage?.needsDoctor ?? null,
      time: new Date().toLocaleTimeString(),
    }, ...prev].slice(0, 6));
  };

  const addReminderEntries = (triage) => {
    const meds = (triage?.suggestedMedicines || []).map((med, index) => ({
      id: `${Date.now()}-${index}`,
      name: med.name || 'Medicine',
      schedule: `${med.dosage || 'As advised'} · ${med.frequency || 'as needed'} · ${med.duration || 'as directed'} · ${med.timing || 'as advised'}`,
      type: med.type || 'OTC',
    }));
    if (meds.length > 0) {
      setCareReminders(prev => [...meds, ...prev].slice(0, 8));
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
    addMessage('user', userMsg);
    setLoading(true);

    try {
      const lang = detectLanguage(userMsg);
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
      const data = await res.json();
      setSessionId(data.sessionId);

      if (data.triage) {
        addSymptomEntry(userMsg, data.triage);
        addReminderEntries(data.triage);
      }

      let botMessage = data.message || 'Here is your initial assessment.';
      if (data.triage) {
        const { diagnosis, suggestedMedicines, careInstructions } = data.triage;
        if (diagnosis) {
          botMessage += `\n\n🩺 Possible diagnosis: ${diagnosis}`;
        }
        if (suggestedMedicines && suggestedMedicines.length > 0) {
          botMessage += '\n\n💊 Suggested medicines:';
          suggestedMedicines.forEach((med) => {
            const details = [med.name, med.dosage, med.frequency, med.duration && `for ${med.duration}`, med.timing, med.type && `(${med.type})`].filter(Boolean);
            botMessage += `\n- ${details.join(' · ')}`;
          });
        }
        if (careInstructions) {
          botMessage += `\n\n🏠 Care instructions:\n${careInstructions}`;
        }
      }

      addMessage('bot', botMessage);
      speakResponse(botMessage, lang);

      if (data.clinics && data.clinics.length > 0) {
        setClinics(data.clinics);
        goToStep(1);
        addMessage('bot', 'Here are the nearest clinics. Please select one:');
        speakResponse('Please select a clinic', lang);
      } else {
        goToStep(5);
        addMessage('bot', 'No clinic is needed right now. Please follow the care instructions and seek medical help if symptoms worsen.');
      }
    } catch (err) {
      addMessage('bot', 'Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  const handleClinicSelect = async (clinicId) => {
    setLoading(true);
    if (!sessionId) {
      addMessage('bot', 'Session not found locally — please start a new chat.');
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
        addMessage('bot', 'Error: ' + data.error + (data.sessionIdReceived ? ` (server received: ${data.sessionIdReceived})` : ''));
      } else {
        const clinic = clinics.find(c => c.id === clinicId);
        setSelectedClinic(clinic);
        addMessage('bot', data.message);
        goToStep(2);
        addMessage('bot', 'How would you like to get to the clinic?');
      }
    } catch (_) {
      addMessage('bot', 'Could not book appointment.');
    }
    setLoading(false);
  };

  const handleTransportChoice = async (choice) => {
    setLoading(true);
    try {
      const res = await fetch('/api/transport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, choice }),
      });
      const data = await res.json();
      if (data.error) {
        addMessage('bot', 'Error: ' + data.error);
      } else {
        setTransport(data);
        const label = data.type === 'ambulance' ? 'Ambulance' : 'Volunteer Driver';
        addMessage('bot', `${label} booked — Driver: ${data.driver}, ETA: ${data.eta_pickup} min`);
        goToStep(3);
        addMessage('bot', 'Tracking your ride in real-time...', 'tracking');
      }
    } catch (_) {
      addMessage('bot', 'Could not book transport.');
    }
    setLoading(false);
  };

  const handleEmergency = async () => {
    setEmergencyTriggered(true);
    addMessage('user', '🚨 Emergency assistance requested');
    addMessage('bot', '🚑 Emergency protocol activated. Please call emergency services immediately if symptoms are severe.');
    if (sessionId) {
      await handleTransportChoice('ambulance');
    } else {
      setTransport({ type: 'ambulance', driver: 'Emergency Ambulance', eta_pickup: 5, eta_destination: 10, label: 'Ambulance' });
      goToStep(3);
      addMessage('bot', 'Ambulance arrangement is being prepared.', 'tracking');
    }
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/report/${sessionId}`);
      const data = await res.json();
      if (data.error) {
        addMessage('bot', 'Error: ' + data.error);
      } else {
        const reportText = `📋 Patient Report\n• Symptoms: ${data.symptoms}\n• Triage Score: ${data.triage_score}/5\n• Advice: ${data.advice}\n• Clinic: ${data.clinic_visited}\n• Transport: ${data.transport_used}\n• Follow-up: ${data.followup_instructions}`;
        addMessage('bot', reportText);
        goToStep(5);
        addMessage('bot', '✅ Report generated successfully!');
      }
    } catch (_) {
      addMessage('bot', 'Could not generate report.');
    }
    setLoading(false);
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      addMessage('bot', 'Image size should be less than 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      addMessage('user', '📸 [Image uploaded]');
      addMessage('bot', '🔍 Analyzing image...');
      setIsAnalyzing(true);
      try {
        const res = await fetch('/api/analyze-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: e.target.result }),
        });
        const result = await res.json();
        const response = `📸 **Analysis Result**\n• Condition: ${result.condition}\n• Severity: ${result.severity}\n• Recommendation: ${result.recommendation}\n• First Aid: ${result.first_aid}`;
        addMessage('bot', response);
        if (result.emergency) {
          addMessage('bot', '🚨 Emergency detected! Ambulance dispatched.');
          await handleTransportChoice('ambulance');
        }
      } catch (_) {
        addMessage('bot', 'Image analysis failed.');
      }
      setIsAnalyzing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Voice input not supported in this browser.');
      return;
    }
    setIsListening(true);
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'hi-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setInputText(text);
      setIsListening(false);
      inputRef.current?.focus();
    };
    recognition.onerror = () => setIsListening(false);
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
    addMessage('bot', '👋 Hello! Describe your symptoms or upload an image.');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm">C</div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Custodia<span className="text-primary-600">AI</span></h1>
            <p className="text-[10px] text-slate-400 hidden sm:block">Rural Healthcare Access</p>
          </div>
        </div>
        <button onClick={handleNewChat} className="text-xs text-slate-500 hover:text-slate-700 transition px-3 py-1.5 rounded-full border border-slate-200 hover:border-slate-300">New Chat</button>
      </header>

      <div className="bg-white border-b border-slate-100 py-2">
        <StepProgress currentStep={step} totalSteps={6} />
      </div>

      <div className="flex-1 flex flex-col lg:flex-row max-w-6xl mx-auto w-full px-4 gap-4 py-4">
        <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[400px]">
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-10">
                <div className="w-14 h-14 bg-primary-50 rounded-full flex items-center justify-center text-2xl mb-3">
                  <MessageSquare className="w-7 h-7 text-primary-600" />
                </div>
                <h2 className="text-xl font-semibold text-slate-800">How can I help you?</h2>
                <p className="text-sm text-slate-400 mt-1 max-w-sm">Describe your symptoms, upload a photo, or speak.</p>
                <div className="flex flex-wrap gap-2 mt-4 justify-center">
                  <button onClick={() => setInputText('I have a high fever and headache')} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-full transition">🤒 Fever & headache</button>
                  <button onClick={() => setInputText('I have chest pain and difficulty breathing')} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-full transition">❤️ Chest pain</button>
                  <button onClick={() => setInputText('I have a cough and cold')} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-full transition">🤧 Cough & cold</button>
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} message-enter`} style={{ animationDelay: `${idx * 0.04}s` }}>
                  <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-primary-600 text-white rounded-br-sm shadow-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm'}`}>
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                    {msg.type === 'tracking' && trackingData && (
                      <div className="mt-2 text-xs bg-black/10 rounded-lg px-3 py-1.5 flex items-center gap-2">
                        <span className="animate-pulse text-green-400">●</span>
                        ETA: {trackingData.eta_pickup} min to you · {trackingData.eta_destination} min to clinic
                      </div>
                    )}
                    <div className={`text-[10px] mt-0.5 ${msg.role === 'user' ? 'text-teal-100' : 'text-slate-400'}`}>{msg.timestamp || 'now'}</div>
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-2xl px-5 py-3 flex items-center gap-1.5">
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                </div>
              </div>
            )}
            {isAnalyzing && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-2xl px-5 py-3 flex items-center gap-2 text-sm text-slate-500">
                  <span className="animate-pulse">⏳</span> Analyzing image...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-slate-100 p-3 bg-white/80 flex items-center gap-2">
            <button onClick={handleEmergency} className="p-2 rounded-xl hover:bg-red-50 text-red-600 transition" title="Emergency mode">
              <AlertTriangle className="w-5 h-5" />
            </button>
            <label className="cursor-pointer p-2 rounded-xl hover:bg-slate-100 transition">
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} capture="environment" />
              <ImageIcon className="w-5 h-5 text-slate-500" />
            </label>
            <button onClick={handleVoiceInput} className={`p-2 rounded-xl transition ${isListening ? 'bg-red-100 text-red-600' : 'hover:bg-slate-100 text-slate-500'}`}>
              <Mic className="w-5 h-5" />
            </button>
            <input ref={inputRef} type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Type your symptoms..." className="flex-1 border-0 bg-slate-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40" disabled={loading} />
            <button onClick={handleSend} disabled={loading} className="bg-primary-600 hover:bg-primary-700 text-white p-2.5 rounded-xl transition shadow-sm">
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>

        {(step >= 1 && step <= 5) && (
          <div className={`w-full lg:w-72 xl:w-80 flex-shrink-0 ${showSidebar ? 'block' : 'hidden lg:block'} mt-3 lg:mt-0`}>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sticky top-24 space-y-4">
              <div className="map-wrapper h-44 sm:h-48">
                <MapComponent userLocation={userLocation} clinics={clinics} selectedClinic={selectedClinic} trackingData={trackingData} />
              </div>

              <div className="space-y-3 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Care plan</p>
                  <span className="text-[10px] text-slate-400">Step {Math.min(step + 1, 5)} / 5</span>
                </div>
                {emergencyTriggered && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    Emergency assistance is active.
                  </div>
                )}
                {symptomHistory.length > 0 && (
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-600 mb-2">Recent symptoms</p>
                    <ul className="space-y-1.5 text-xs text-slate-600">
                      {symptomHistory.slice(0, 3).map(entry => (
                        <li key={entry.id} className="flex justify-between gap-2">
                          <span className="truncate">{entry.symptom}</span>
                          <span className="text-[10px] text-slate-400">{entry.time}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {careReminders.length > 0 && (
                  <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-100">
                    <p className="text-xs font-semibold text-emerald-700 mb-2">Medicine reminders</p>
                    <ul className="space-y-1.5 text-xs text-emerald-800">
                      {careReminders.slice(0, 3).map(reminder => (
                        <li key={reminder.id} className="leading-relaxed">
                          <span className="font-medium">{reminder.name}</span> · {reminder.schedule}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {step === 1 && clinics.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1"><MapPin className="w-3 h-3" /> Select a clinic</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {clinics.map(c => (
                      <button key={c.id} onClick={() => handleClinicSelect(c.id)} className="w-full text-left px-3 py-2.5 bg-slate-50 hover:bg-primary-50 rounded-xl text-sm transition border border-transparent hover:border-primary-200">
                        <div className="flex justify-between items-center"><span className="font-medium text-slate-800">{c.name}</span><span className="text-xs text-slate-400">{c.distance_km} km</span></div>
                        <div className="text-xs text-slate-400 mt-0.5">Stock {c.stock}% · {c.specialists} specialists</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1"><Navigation className="w-3 h-3" /> Choose transport</p>
                  <button onClick={() => handleTransportChoice('ambulance')} className="w-full flex items-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 rounded-xl text-red-700 text-sm font-medium">🚑 Ambulance</button>
                  <button onClick={() => handleTransportChoice('volunteer')} className="w-full flex items-center gap-2 px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-xl text-blue-700 text-sm font-medium"><Car className="w-5 h-5" /> Volunteer Driver</button>
                  <button onClick={() => { addMessage('bot', 'You chose your own transport. Route shown on map.'); goToStep(3); addMessage('bot', 'Follow the route on the map.', 'tracking'); }} className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 text-sm"><MapPin className="w-5 h-5" /> I'll go myself</button>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-slate-600"><span className="animate-pulse text-emerald-500">●</span> Tracking your ride</div>
                  {trackingData && (
                    <div className="bg-slate-50 rounded-xl px-4 py-2.5 text-sm">
                      <div className="flex justify-between"><span>Pickup ETA</span><span className="font-medium">{trackingData.eta_pickup} min</span></div>
                      <div className="flex justify-between mt-1"><span>Clinic ETA</span><span className="font-medium">{trackingData.eta_destination} min</span></div>
                    </div>
                  )}
                  <button onClick={handleGenerateReport} className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-xl text-sm font-medium transition"><FileText className="w-4 h-4 inline mr-1" /> Generate Report</button>
                </div>
              )}

              {step === 5 && (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                  <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-1" />
                  <p className="text-sm font-medium text-emerald-800">Report Generated</p>
                  <p className="text-xs text-emerald-600">Check the chat for details.</p>
                </div>
              )}

              <div className="text-[10px] text-slate-300 text-center border-t border-slate-100 pt-3">Next.js · Leaflet · Agentic AI</div>
            </div>
          </div>
        )}
      </div>

      {(step >= 1 && step <= 5) && (
        <button onClick={() => setShowSidebar(!showSidebar)} className="lg:hidden fixed bottom-20 right-4 z-50 bg-primary-600 text-white p-3 rounded-full shadow-lg hover:bg-primary-700 transition">
          {showSidebar ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      )}
    </div>
  );
}