import { useState, useRef } from 'react';

export const useVoiceDictation = (onResult: (text: string) => void) => {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const start = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = "en-US";
    recognition.interimResults = false;

    let finalTranscript = '';

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => {
        setIsRecording(false);
        if (finalTranscript.trim()) {
            onResult(finalTranscript);
        }
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }
    };
    
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stop = () => {
      if (recognitionRef.current) {
          recognitionRef.current.stop();
      }
  };

  return { isRecording, start, stop };
};
