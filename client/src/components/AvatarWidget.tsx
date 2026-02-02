import { useEffect, useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAvatarStore } from "@/store/avatarStore";
import { 
  MessageCircle, 
  X, 
  Mic, 
  MicOff, 
  Square, 
  Volume2,
  VolumeX,
  Loader2,
  Send
} from "lucide-react";
import StreamingAvatar, { 
  AvatarQuality, 
  StreamingEvents,
  TaskType,
  VoiceEmotion
} from "@heygen/streaming-avatar";
import { apiRequest } from "@/lib/queryClient";

const SYSTEM_PROMPT = `You are a senior AI consultant for Referral Service LLC. Your goal is to qualify the lead by asking about company size, pain points, and budget. Keep responses under 2 sentences. Do not promise specific deliverables without a consultation.`;

export function AvatarWidget() {
  const {
    widgetState,
    sessionStatus,
    messages,
    isListening,
    isSpeaking,
    currentTranscript,
    conversationId,
    setWidgetState,
    setSessionStatus,
    addMessage,
    setIsListening,
    setIsSpeaking,
    setCurrentTranscript,
    setConversationId,
    toggleWidget,
    clearMessages,
  } = useAvatarStore();

  const avatarRef = useRef<StreamingAvatar | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [inputText, setInputText] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const initializeSession = useCallback(async () => {
    if (sessionStatus === "connecting" || sessionStatus === "connected") return;
    
    setSessionStatus("connecting");
    
    try {
      const tokenRes = await apiRequest("POST", "/api/heygen/token");
      const { token } = await tokenRes.json();
      
      const convRes = await apiRequest("POST", "/api/conversations", { title: "AI Consultation" });
      const conversation = await convRes.json();
      setConversationId(conversation.id);

      const avatar = new StreamingAvatar({ token });
      avatarRef.current = avatar;

      avatar.on(StreamingEvents.STREAM_READY, (event: any) => {
        if (videoRef.current && event.detail?.stream) {
          videoRef.current.srcObject = event.detail.stream;
          videoRef.current.play().catch(console.error);
        }
        setSessionStatus("connected");
        
        setTimeout(() => {
          speakText("Hi there. I'm the AI Sales Rep for Referral Service LLC. I'm a living proof-of-concept of the Digital Workforce we build for clients. I can help you upgrade your business operations to cut costs by 30%, or we can discuss building your own AI venture. Which path brought you here today?");
        }, 1000);
      });

      avatar.on(StreamingEvents.AVATAR_START_TALKING, () => {
        setIsSpeaking(true);
      });

      avatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => {
        setIsSpeaking(false);
      });

      avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
        setSessionStatus("idle");
      });

      avatar.on(StreamingEvents.USER_START, () => {
        setIsListening(true);
      });

      avatar.on(StreamingEvents.USER_STOP, () => {
        setIsListening(false);
      });

      await avatar.createStartAvatar({
        quality: AvatarQuality.High,
        avatarName: "Anna_public_3_20240108",
        voice: {
          voiceId: "2d5b0e6cf36f460aa7fc47e3eee4ba54",
          rate: 1.0,
          emotion: VoiceEmotion.FRIENDLY,
        },
      });

    } catch (error) {
      console.error("Failed to initialize avatar session:", error);
      setSessionStatus("error");
    }
  }, [sessionStatus, setSessionStatus, setConversationId, setIsSpeaking, setIsListening]);

  const speakText = useCallback(async (text: string) => {
    if (!avatarRef.current || !text.trim()) return;
    
    try {
      addMessage("assistant", text);
      await avatarRef.current.speak({
        text,
        taskType: TaskType.REPEAT,
      });
    } catch (error) {
      console.error("Failed to speak:", error);
    }
  }, [addMessage]);

  const processUserInput = useCallback(async (userMessage: string) => {
    if (!userMessage.trim() || !conversationId) return;

    addMessage("user", userMessage);
    setCurrentTranscript("");
    setSessionStatus("speaking");

    try {
      const response = await apiRequest("POST", `/api/chat/${conversationId}`, { 
        content: userMessage 
      });
      const data = await response.json();
      
      if (data.response) {
        await speakText(data.response);
      }
      
      if (data.functionCalls) {
        for (const call of data.functionCalls) {
          console.log("Function called:", call.name, call.arguments);
        }
      }
      
      setSessionStatus("connected");
    } catch (error) {
      console.error("Failed to process input:", error);
      setSessionStatus("connected");
    }
  }, [conversationId, addMessage, setCurrentTranscript, setSessionStatus, speakText]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(100);
      setIsListening(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  }, [setIsListening]);

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;

    return new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        recorder.stream.getTracks().forEach((t) => t.stop());
        setIsListening(false);

        if (blob.size > 0) {
          try {
            const base64 = await blobToBase64(blob);
            const response = await apiRequest("POST", "/api/transcribe", { audio: base64 });
            const { text } = await response.json();
            if (text) {
              await processUserInput(text);
            }
          } catch (error) {
            console.error("Failed to transcribe:", error);
          }
        }
        resolve();
      };
      recorder.stop();
    });
  }, [setIsListening, processUserInput]);

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.readAsDataURL(blob);
    });
  };

  const handleMicToggle = useCallback(async () => {
    if (isListening) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isListening, startRecording, stopRecording]);

  const handleSendText = useCallback(() => {
    if (inputText.trim()) {
      processUserInput(inputText);
      setInputText("");
    }
  }, [inputText, processUserInput]);

  const handleInterrupt = useCallback(async () => {
    if (avatarRef.current) {
      try {
        await avatarRef.current.interrupt();
        setIsSpeaking(false);
      } catch (error) {
        console.error("Failed to interrupt:", error);
      }
    }
  }, [setIsSpeaking]);

  const endSession = useCallback(async () => {
    if (avatarRef.current) {
      try {
        await avatarRef.current.stopAvatar();
      } catch (error) {
        console.error("Failed to stop avatar:", error);
      }
      avatarRef.current = null;
    }
    setSessionStatus("idle");
    clearMessages();
    setWidgetState("collapsed");
  }, [setSessionStatus, clearMessages, setWidgetState]);

  const handleWidgetClick = useCallback(() => {
    if (widgetState === "collapsed") {
      setWidgetState("expanded");
      initializeSession();
    }
  }, [widgetState, setWidgetState, initializeSession]);

  return (
    <>
      <AnimatePresence>
        {widgetState === "collapsed" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <button
              onClick={handleWidgetClick}
              className="relative group"
              data-testid="button-avatar-collapsed"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg glow-primary">
                <MessageCircle className="w-7 h-7 text-white" />
              </div>
              
              <div className="absolute -top-1 -right-1 flex items-center gap-1">
                <span className="relative flex h-3 w-3">
                  <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
              </div>
              
              <div className="absolute bottom-full right-0 mb-2 invisible group-hover:visible pointer-events-none">
                <div className="bg-card border border-border rounded-md px-3 py-2 shadow-lg whitespace-nowrap">
                  <span className="text-sm font-medium">Online - Ask me about AI</span>
                </div>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {widgetState === "expanded" && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 right-0 top-0 z-50 w-full sm:w-[420px] sm:bottom-6 sm:right-6 sm:top-auto sm:max-h-[700px] sm:rounded-xl overflow-hidden"
          >
            <Card className="h-full sm:h-[700px] flex flex-col border-0 sm:border shadow-2xl">
              <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary/10 to-accent/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">AI Consultant</h3>
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${
                          sessionStatus === "connected" ? "bg-green-500" :
                          sessionStatus === "connecting" ? "bg-yellow-500" :
                          sessionStatus === "error" ? "bg-red-500" : "bg-gray-400"
                        }`}></span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {sessionStatus === "connected" ? "Online" :
                         sessionStatus === "connecting" ? "Connecting..." :
                         sessionStatus === "error" ? "Error" : "Offline"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button 
                    size="icon" 
                    variant="ghost"
                    onClick={() => setIsMuted(!isMuted)}
                    data-testid="button-mute"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={endSession}
                    data-testid="button-close-widget"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="relative flex-shrink-0 bg-gradient-to-br from-card to-muted/30 aspect-video">
                {sessionStatus === "connecting" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center space-y-3">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                      <p className="text-sm text-muted-foreground">Connecting to AI consultant...</p>
                    </div>
                  </div>
                )}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted={isMuted}
                  className="w-full h-full object-cover"
                  data-testid="video-avatar"
                />
                
                {isSpeaking && (
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-center">
                    <div className="bg-background/80 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2">
                      <div className="flex items-center gap-0.5 h-4">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="w-1 h-full bg-primary rounded-full waveform-bar" />
                        ))}
                      </div>
                      <span className="text-xs font-medium">Speaking...</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={handleInterrupt}
                        data-testid="button-interrupt"
                      >
                        <Square className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                {messages.length === 0 && sessionStatus === "connected" && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Start a conversation by speaking or typing below
                  </div>
                )}
                
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-4 py-2.5 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                      data-testid={`message-${message.role}-${message.id}`}
                    >
                      <p className="text-sm">{message.content}</p>
                    </div>
                  </div>
                ))}
                
                {isListening && (
                  <div className="flex justify-end">
                    <div className="bg-primary/20 text-primary rounded-lg px-4 py-2.5 flex items-center gap-2">
                      <div className="flex items-center gap-0.5 h-4">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="w-1 h-full bg-primary rounded-full waveform-bar" />
                        ))}
                      </div>
                      <span className="text-sm">Listening...</span>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t bg-card">
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant={isListening ? "default" : "outline"}
                    onClick={handleMicToggle}
                    disabled={sessionStatus !== "connected"}
                    className={isListening ? "bg-red-500 hover:bg-red-600" : ""}
                    data-testid="button-mic"
                  >
                    {isListening ? (
                      <MicOff className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </Button>
                  
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendText()}
                    placeholder="Type a message..."
                    disabled={sessionStatus !== "connected"}
                    className="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="input-message"
                  />
                  
                  <Button
                    size="icon"
                    onClick={handleSendText}
                    disabled={!inputText.trim() || sessionStatus !== "connected"}
                    data-testid="button-send"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
