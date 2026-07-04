import React, { useState, useMemo, useEffect } from 'react';
import { IpdAdmission, Patient, FluidEntry } from '../../types';
import { useIpdContext } from './IpdContext';

interface ShiftMed {
  id: string;
  name: string;
  morning: { time: string; sign: string; given: boolean };
  afternoon: { time: string; sign: string; given: boolean };
  evening: { time: string; sign: string; given: boolean };
}

interface ShiftVital {
  timestamp: string;
  temp: string;
  bp: string;
  pulse: string;
  spo2: string;
  customValues: Record<string, string>;
}

interface ShiftIo {
  timestamp: string;
  intakeIv: number;
  intakeOral: number;
  outputUrine: number;
  outputOther: number;
  remarks: string;
}

interface ShiftIvFluid {
  id: string;
  timestamp: string;
  name: string;
  rate: string;
  bagVolume: string;
  startTime: string;
  endTime: string;
}

interface ShiftChart {
  date: string; // e.g. "2026-06-30"
  medications: ShiftMed[];
  vitals: ShiftVital[];
  ioBalance: ShiftIo[];
  ivFluids?: ShiftIvFluid[];
  notes: string;
  nurseName: string;
}

const useAiVoiceInput = (onResult: (text: string) => void) => {
  const [isRecording, setIsRecording] = useState(false);
  const start = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser does not support voice recognition");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = "en-US";
    recognition.interimResults = false;

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };
    recognition.start();
  };
  return { isRecording, start };
};

export const NursingMar: React.FC<{
  activeAdmission: IpdAdmission;
  onUpdateAdmission: (data: Partial<IpdAdmission>) => void;
  patient: Patient;
}> = ({ activeAdmission, onUpdateAdmission, patient }) => {
  const { loggedInUserName } = useIpdContext();

  // Current active date view (formatted as YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  const [activeNurse, setActiveNurse] = useState(() => loggedInUserName || "Nurse Staff");

  useEffect(() => {
    if (loggedInUserName) {
      setActiveNurse(loggedInUserName);
    }
  }, [loggedInUserName]);

  // Load shift charts from EMR customFields
  const shiftCharts: Record<string, ShiftChart> = useMemo(() => {
    try {
      const dataStr = activeAdmission.customFields?.nursingShiftCharts;
      return dataStr ? JSON.parse(dataStr) : {};
    } catch (e) {
      console.error("Failed to parse shift charts", e);
      return {};
    }
  }, [activeAdmission.customFields?.nursingShiftCharts]);

  // Extract directives from the latest round note before the end of this shift (selectedDate + 1 day 8:00 AM)
  const activeDirectives = useMemo(() => {
    const shiftEnd = new Date(`${selectedDate}T08:00:00`);
    shiftEnd.setDate(shiftEnd.getDate() + 1);

    const pastRounds = [...(activeAdmission.roundNotes || [])]
      .filter(r => new Date(r.timestamp).getTime() <= shiftEnd.getTime())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const latest = pastRounds[0];
    return latest?.nursingDirectives || {};
  }, [activeAdmission.roundNotes, selectedDate]);

  // Vitals Input state
  const [vitalsInput, setVitalsInput] = useState({
    temp: "",
    pulse: "",
    bp: "",
    spo2: "",
    customValues: {} as Record<string, string>
  });

  // Intake/Output Input state
  const [ioInput, setIoInput] = useState({
    intakeIv: "",
    intakeOral: "",
    outputUrine: "",
    outputOther: "",
    remarks: ""
  });

  // Nursing notes input state
  const [nurseNotes, setNurseNotes] = useState("");

  const [ivFluidInput, setIvFluidInput] = useState({
    name: "",
    rate: "",
    bagVolume: "",
    startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    endTime: ""
  });

  // Get active shift record, or build draft
  const currentShiftRecord = useMemo<ShiftChart>(() => {
    const existing = shiftCharts[selectedDate];
    if (existing) return existing;

    // Build default medications list for this shift
    // We fetch doctor's prescribed medications from the latest round note
    const shiftEnd = new Date(`${selectedDate}T08:00:00`);
    shiftEnd.setDate(shiftEnd.getDate() + 1);

    const pastRounds = [...(activeAdmission.roundNotes || [])]
      .filter(r => new Date(r.timestamp).getTime() <= shiftEnd.getTime())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const latestRound = pastRounds[0];
    const rawMeds = latestRound?.medication ? latestRound.medication.split('\n').filter(m => m.trim().length > 0) : [];

    const defaultMeds: ShiftMed[] = rawMeds.map((med, idx) => ({
      id: `med-${idx}-${Date.now()}`,
      name: med,
      morning: { time: "", sign: "", given: false },
      afternoon: { time: "", sign: "", given: false },
      evening: { time: "", sign: "", given: false }
    }));

    return {
      date: selectedDate,
      medications: defaultMeds,
      vitals: [],
      ioBalance: [],
      notes: "",
      nurseName: activeNurse
    };
  }, [shiftCharts, selectedDate, activeAdmission.roundNotes]);

  // Synchronize nurse note input when shift changes
  useEffect(() => {
    setNurseNotes(currentShiftRecord.notes || "");
  }, [currentShiftRecord]);

  // List of active custom directives for vitals
  const customDirectiveLabels = useMemo(() => {
    const list: { id: string; label: string }[] = [];
    Object.entries(activeDirectives).forEach(([key, val]) => {
      if (val && !['temp', 'bp', 'pulse', 'spo2'].includes(key)) {
        const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
        list.push({ id: key, label });
      }
    });
    return list;
  }, [activeDirectives]);

  // Save the modified shift record back to EMR central state
  const saveShiftRecord = (updatedRecord: ShiftChart) => {
    const updatedCharts = {
      ...shiftCharts,
      [selectedDate]: updatedRecord
    };
    onUpdateAdmission({
      customFields: {
        ...(activeAdmission.customFields || {}),
        nursingShiftCharts: JSON.stringify(updatedCharts)
      }
    });
  };

  // Toggle Medication Administration Given status
  const handleToggleMed = (medId: string, shiftTime: 'morning' | 'afternoon' | 'evening') => {
    let cancelled = false;
    let adminTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const updatedMeds = currentShiftRecord.medications.map(m => {
      if (m.id === medId) {
        const field = m[shiftTime];
        const wasGiven = field.given;
        const nowGiven = !wasGiven;
        
        if (nowGiven) {
          if (isIvFluid(m.name)) {
            // IV Fluid: prompt for start time only
            const startVal = window.prompt(`Enter Start Time for IV Fluid "${m.name}":`, adminTime);
            if (startVal === null) {
              cancelled = true;
              return m;
            }
            adminTime = startVal;
          } else {
            // Regular Drug: prompt for administration time
            const timeVal = window.prompt(`Enter administration time for drug "${m.name}":`, adminTime);
            if (timeVal === null) {
              cancelled = true;
              return m;
            }
            adminTime = timeVal;
          }
        }

        return {
          ...m,
          [shiftTime]: {
            given: nowGiven,
            time: nowGiven ? adminTime : "",
            sign: nowGiven ? activeNurse : ""
          }
        };
      }
      return m;
    });

    if (cancelled) return;

    saveShiftRecord({
      ...currentShiftRecord,
      medications: updatedMeds
    });
  };

  // Detect if medication name refers to an IV fluid
  const isIvFluid = (name: string): boolean => {
    const lower = name.toLowerCase();
    return ['iv', 'drip', 'ns', 'rl', 'd5', 'fluid', 'infusion', 'intravenous', 'saline'].some(k => lower.includes(k));
  };

  // Automatically sync IV fluid administration to intake log
  const triggerIvFluidIntakeSync = (medName: string, amount: number, shiftTime: string) => {
    const timeLabel = shiftTime.toUpperCase();
    const newIoEntry: ShiftIo = {
      timestamp: new Date().toISOString().slice(0, 16),
      intakeIv: amount,
      intakeOral: 0,
      outputUrine: 0,
      outputOther: 0,
      remarks: `MAR Auto-Sync: ${medName} (${timeLabel})`
    };

    // Add to central fluidBalance log for other modules
    const centralFluid: FluidEntry = {
      id: `fluid-sync-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'intake',
      fluidName: medName,
      amountMl: amount,
      route: 'IV'
    };

    onUpdateAdmission({
      fluidBalance: [...(activeAdmission.fluidBalance || []), centralFluid],
      customFields: {
        ...(activeAdmission.customFields || {}),
        nursingShiftCharts: JSON.stringify({
          ...shiftCharts,
          [selectedDate]: {
            ...currentShiftRecord,
            ioBalance: [...currentShiftRecord.ioBalance, newIoEntry]
          }
        })
      }
    });
  };

  // Save Vitals Entry to shift log
  const handleAddVitals = (e: React.FormEvent) => {
    e.preventDefault();
    const entry: ShiftVital = {
      timestamp: new Date().toISOString().slice(0, 16),
      temp: vitalsInput.temp,
      bp: vitalsInput.bp,
      pulse: vitalsInput.pulse,
      spo2: vitalsInput.spo2,
      customValues: { ...vitalsInput.customValues }
    };

    saveShiftRecord({
      ...currentShiftRecord,
      vitals: [...currentShiftRecord.vitals, entry]
    });

    // Reset inputs
    setVitalsInput({
      temp: "",
      pulse: "",
      bp: "",
      spo2: "",
      customValues: {}
    });
    alert("Vitals entry recorded successfully!");
  };

  // Save Intake / Output Entry
  const handleAddIo = (e: React.FormEvent) => {
    e.preventDefault();
    const entry: ShiftIo = {
      timestamp: new Date().toISOString().slice(0, 16),
      intakeIv: ioInput.intakeIv ? Number(ioInput.intakeIv) : 0,
      intakeOral: ioInput.intakeOral ? Number(ioInput.intakeOral) : 0,
      outputUrine: ioInput.outputUrine ? Number(ioInput.outputUrine) : 0,
      outputOther: ioInput.outputOther ? Number(ioInput.outputOther) : 0,
      remarks: ioInput.remarks
    };

    const updatedIoList = [...currentShiftRecord.ioBalance, entry];
    
    // Synced with Central IPD Fluid balance
    const newCentralFluids: FluidEntry[] = [];
    if (entry.intakeIv > 0) {
      newCentralFluids.push({
        id: `fluid-in-iv-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'intake',
        fluidName: 'IV Fluids',
        amountMl: entry.intakeIv,
        route: 'IV'
      });
    }
    if (entry.intakeOral > 0) {
      newCentralFluids.push({
        id: `fluid-in-oral-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'intake',
        fluidName: 'Oral Fluids',
        amountMl: entry.intakeOral,
        route: 'Oral'
      });
    }
    if (entry.outputUrine > 0) {
      newCentralFluids.push({
        id: `fluid-out-urine-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'output',
        fluidName: 'Urine Output',
        amountMl: entry.outputUrine,
        route: 'Catheter'
      });
    }
    if (entry.outputOther > 0) {
      newCentralFluids.push({
        id: `fluid-out-other-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'output',
        fluidName: 'AG Drain / Emesis',
        amountMl: entry.outputOther,
        route: 'Drain'
      });
    }

    onUpdateAdmission({
      fluidBalance: [...(activeAdmission.fluidBalance || []), ...newCentralFluids],
      customFields: {
        ...(activeAdmission.customFields || {}),
        nursingShiftCharts: JSON.stringify({
          ...shiftCharts,
          [selectedDate]: {
            ...currentShiftRecord,
            ioBalance: updatedIoList
          }
        })
      }
    });

    setIoInput({
      intakeIv: "",
      intakeOral: "",
      outputUrine: "",
      outputOther: "",
      remarks: ""
    });
    alert("I/O Balance logged!");
  };

  // Save Nursing notes text
  const handleSaveNotes = () => {
    saveShiftRecord({
      ...currentShiftRecord,
      notes: nurseNotes,
      nurseName: activeNurse
    });
    alert("Nursing notes saved for shift!");
  };

  // Add IV Fluid Charting Entry and auto-sync to Intake
  const handleAddIvFluid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ivFluidInput.name.trim()) {
      alert("Please enter the IV fluid name.");
      return;
    }
    const newEntry: ShiftIvFluid = {
      id: `iv-${Date.now()}`,
      timestamp: new Date().toISOString().slice(0, 16),
      name: ivFluidInput.name,
      rate: ivFluidInput.rate,
      bagVolume: ivFluidInput.bagVolume,
      startTime: ivFluidInput.startTime,
      endTime: ivFluidInput.endTime
    };

    // Auto-sync volume to Intake/Output balance if volume can be parsed
    const parsedVol = parseInt(ivFluidInput.bagVolume.replace(/[^0-9]/g, ''), 10);
    const updatedIoList = [...currentShiftRecord.ioBalance];
    const newCentralFluids: FluidEntry[] = [];

    if (!isNaN(parsedVol) && parsedVol > 0) {
      const ioEntry: ShiftIo = {
        timestamp: new Date().toISOString().slice(0, 16),
        intakeIv: parsedVol,
        intakeOral: 0,
        outputUrine: 0,
        outputOther: 0,
        remarks: `IV Fluid Chart: ${ivFluidInput.name} (Rate: ${ivFluidInput.rate || '-'}, Bag: ${ivFluidInput.bagVolume})`
      };
      updatedIoList.push(ioEntry);

      newCentralFluids.push({
        id: `fluid-in-iv-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'intake',
        fluidName: ivFluidInput.name,
        amountMl: parsedVol,
        route: 'IV'
      });
    }

    onUpdateAdmission({
      fluidBalance: [...(activeAdmission.fluidBalance || []), ...newCentralFluids],
      customFields: {
        ...(activeAdmission.customFields || {}),
        nursingShiftCharts: JSON.stringify({
          ...shiftCharts,
          [selectedDate]: {
            ...currentShiftRecord,
            ivFluids: [...(currentShiftRecord.ivFluids || []), newEntry],
            ioBalance: updatedIoList
          }
        })
      }
    });

    setIvFluidInput({
      name: "",
      rate: "",
      bagVolume: "",
      startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      endTime: ""
    });
    alert("IV Fluid Chart entry added!");
  };

  // Delete IV Fluid Charting Entry
  const handleDeleteIvFluid = (id: string) => {
    if (confirm("Are you sure you want to delete this IV fluid charting entry?")) {
      const updated = (currentShiftRecord.ivFluids || []).filter(f => f.id !== id);
      saveShiftRecord({
        ...currentShiftRecord,
        ivFluids: updated
      });
    }
  };

  // Delete Day-wise Shift Chart record
  const handleDeleteShiftRecord = (date: string) => {
    if (confirm(`Are you sure you want to delete the nursing record for date: ${date}?`)) {
      const updatedCharts = { ...shiftCharts };
      delete updatedCharts[date];
      
      onUpdateAdmission({
        customFields: {
          ...(activeAdmission.customFields || {}),
          nursingShiftCharts: JSON.stringify(updatedCharts)
        }
      });
      alert(`Nursing record for ${date} deleted.`);
    }
  };

  // Voice entry for Nursing Notes
  const { isRecording: isVoiceRecording, start: startVoice } = useAiVoiceInput((text) => {
    setNurseNotes(prev => (prev + " " + text).trim());
  });

  // Calculate Net Fluid Balance for current shift
  const ioTotals = useMemo(() => {
    let totIntake = 0;
    let totOutput = 0;
    currentShiftRecord.ioBalance.forEach(e => {
      totIntake += e.intakeIv + e.intakeOral;
      totOutput += e.outputUrine + e.outputOther;
    });
    return {
      intake: totIntake,
      output: totOutput,
      balance: totIntake - totOutput
    };
  }, [currentShiftRecord.ioBalance]);

  // Print function for the shift chart
  const handlePrintShiftChart = (customRecord?: ShiftChart) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const record = customRecord || currentShiftRecord;
    const date = record.date;
    
    let totIntake = 0;
    let totOutput = 0;
    record.ioBalance.forEach(e => {
      totIntake += e.intakeIv + e.intakeOral;
      totOutput += e.outputUrine + e.outputOther;
    });
    const recordIoTotals = {
      intake: totIntake,
      output: totOutput,
      balance: totIntake - totOutput
    };

    const medRows = record.medications.map(m => `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 8px; font-weight: bold;">${m.name}</td>
        <td style="padding: 8px; text-align: center;">${m.morning.given ? `Given (${m.morning.time})<br/><small>Sign: ${m.morning.sign}</small>` : '-'}</td>
        <td style="padding: 8px; text-align: center;">${m.afternoon.given ? `Given (${m.afternoon.time})<br/><small>Sign: ${m.afternoon.sign}</small>` : '-'}</td>
        <td style="padding: 8px; text-align: center;">${m.evening.given ? `Given (${m.evening.time})<br/><small>Sign: ${m.evening.sign}</small>` : '-'}</td>
      </tr>
    `).join("");

    const vitalRows = record.vitals.map(v => {
      const customStr = Object.entries(v.customValues)
        .map(([k, val]) => `<strong>${k}:</strong> ${val}`)
        .join(", ");
      return `
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px;">${new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
          <td style="padding: 8px;">${v.temp || '-'}</td>
          <td style="padding: 8px;">${v.pulse || '-'}</td>
          <td style="padding: 8px;">${v.bp || '-'}</td>
          <td style="padding: 8px;">${v.spo2 || '-'}</td>
          <td style="padding: 8px;">${customStr || '-'}</td>
        </tr>
      `;
    }).join("");

    const ioRows = record.ioBalance.map(e => `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 8px;">${new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
        <td style="padding: 8px; text-align: right;">${e.intakeIv + e.intakeOral} ml <small>(IV: ${e.intakeIv}, Oral: ${e.intakeOral})</small></td>
        <td style="padding: 8px; text-align: right;">${e.outputUrine + e.outputOther} ml <small>(Urine: ${e.outputUrine}, Other: ${e.outputOther})</small></td>
        <td style="padding: 8px;">${e.remarks || '-'}</td>
      </tr>
    `).join("");

    const ivFluidRows = (record.ivFluids || []).map(f => `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 8px;">${new Date(f.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
        <td style="padding: 8px; font-weight: bold;">${f.name}</td>
        <td style="padding: 8px;">${f.rate || '-'}</td>
        <td style="padding: 8px;">${f.bagVolume || '-'}</td>
        <td style="padding: 8px;">${f.startTime || '-'}</td>
        <td style="padding: 8px;">${f.endTime || '-'}</td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <html>
      <head>
        <title>Nursing Shift Chart - ${date}</title>
        <style>
          body { font-family: sans-serif; color: #333; padding: 30px; }
          h2 { text-transform: uppercase; border-bottom: 2px solid #333; padding-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 25px; }
          th { background: #f4f4f4; text-align: left; padding: 8px; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #ddd; }
          td { font-size: 12px; }
        </style>
      </head>
      <body>
        <h2>Nursing Shift Log & MAR</h2>
        <p><strong>Patient Name:</strong> ${patient.name} | <strong>Bed:</strong> ${activeAdmission.bedId} | <strong>IPD ID:</strong> ${activeAdmission.id}</p>
        <p><strong>Shift Date:</strong> ${date} (8:00 AM to 8:00 AM Next Day)</p>
        <p><strong>Active Nurse Signature:</strong> ${record.nurseName}</p>
        <hr/>
        
        <h3>1. Medication Administration Record (MAR)</h3>
        <table>
          <thead>
            <tr>
              <th>Medication Name</th>
              <th style="text-align: center;">Morning (08:00 AM)</th>
              <th style="text-align: center;">Afternoon (02:00 PM)</th>
              <th style="text-align: center;">Evening (08:00 PM)</th>
            </tr>
          </thead>
          <tbody>
            ${medRows || '<tr><td colspan="4" style="padding:10px; text-align:center;">No medications recorded.</td></tr>'}
          </tbody>
        </table>

        <h3>2. IV Fluid Charting</h3>
        <table>
          <thead>
            <tr>
              <th>Time Recorded</th>
              <th>IV Fluid Name</th>
              <th>Rate</th>
              <th>Bag Volume</th>
              <th>Start Time</th>
              <th>End Time</th>
            </tr>
          </thead>
          <tbody>
            ${ivFluidRows || '<tr><td colspan="6" style="padding:10px; text-align:center;">No IV fluids charted.</td></tr>'}
          </tbody>
        </table>

        <h3>3. Vitals Flowsheet</h3>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Temp</th>
              <th>Pulse</th>
              <th>BP</th>
              <th>SpO2</th>
              <th>Dynamic Directives</th>
            </tr>
          </thead>
          <tbody>
            ${vitalRows || '<tr><td colspan="6" style="padding:10px; text-align:center;">No vitals logged yet.</td></tr>'}
          </tbody>
        </table>

        <h3>4. Intake / Output Balance Chart</h3>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th style="text-align: right;">Total Intake</th>
              <th style="text-align: right;">Total Output</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${ioRows || '<tr><td colspan="4" style="padding:10px; text-align:center;">No I/O fluids logged.</td></tr>'}
          </tbody>
        </table>
        <p><strong>Total Intake:</strong> ${recordIoTotals.intake} ml | <strong>Total Output:</strong> ${recordIoTotals.output} ml | <strong>Net Balance:</strong> ${recordIoTotals.balance} ml</p>

        <h3>5. Nursing Notes / Observations</h3>
        <p style="white-space: pre-wrap; font-style: italic; background: #fafafa; padding: 15px; border-radius: 8px; border: 1px solid #eee;">${record.notes || 'No observations recorded.'}</p>
        
        <script>window.onload = () => { window.print(); window.close(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="bg-slate-50 p-6 rounded-3xl mt-4 border border-slate-200">
      
      {/* Upper Shift Selector panel */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 mb-6 text-left">
        <div className="flex items-center gap-3">
          <div className="bg-teal-600 p-2.5 rounded-xl text-white">
             🏥
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Nursing MAR Station</h3>
            <p className="text-xs text-slate-400 font-bold uppercase">SHIFT CONTROL: 8:00 AM TO 8:00 AM</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Select Shift Date</label>
            <input 
              type="date" 
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-black bg-slate-50 text-slate-700 outline-none"
            />
          </div>
          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">RN Sign Off Initial</label>
            <input 
              type="text" 
              value={activeNurse}
              onChange={e => setActiveNurse(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-black bg-slate-50 text-slate-700 outline-none w-28"
            />
          </div>
          <button 
            onClick={handlePrintShiftChart}
            className="bg-slate-800 hover:bg-slate-900 text-white font-black text-xs uppercase px-4 py-3.5 rounded-xl transition shadow active:scale-95 border-0 mt-3 cursor-pointer"
          >
             🖨️ Print Shift Chart
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
        
        {/* Left Side (8 cols): MAR Grid & I/O Flowsheet */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* MAR Grid */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
               <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Medication Administration (MAR)</h4>
               <span className="bg-blue-100 text-blue-700 text-[8px] font-black px-2 py-0.5 rounded border border-blue-200 uppercase tracking-widest">
                  Shift Date: {selectedDate}
               </span>
            </div>

            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-slate-100/50 text-slate-500 text-[9px] uppercase tracking-wider border-b">
                        <th className="p-4 font-black w-2/5">Prescribed Medication</th>
                        <th className="p-4 font-black text-center border-l bg-slate-50/20">Morning (08:00)</th>
                        <th className="p-4 font-black text-center border-l bg-slate-50/20">Afternoon (14:00)</th>
                        <th className="p-4 font-black text-center border-l bg-slate-50/20">Evening (20:00)</th>
                     </tr>
                  </thead>
                  <tbody className="text-xs">
                     {currentShiftRecord.medications.length === 0 ? (
                        <tr>
                           <td colSpan={4} className="p-8 text-center text-slate-400 italic uppercase font-bold">
                              No medications synced for this shift. Check Rounds prescription.
                           </td>
                        </tr>
                     ) : currentShiftRecord.medications.map((med) => (
                        <tr key={med.id} className="border-b hover:bg-slate-50/30">
                           <td className="p-4">
                              <p className="font-bold text-slate-800">{med.name}</p>
                              {isIvFluid(med.name) && (
                                 <span className="bg-emerald-100 text-emerald-700 text-[8px] font-black px-1.5 py-0.5 rounded border border-emerald-200 tracking-wider">
                                    IV Fluid (Auto-Syncs I/O)
                                 </span>
                              )}
                           </td>
                           
                           {/* Morning */}
                           <td className="p-4 border-l text-center">
                              {med.morning.given ? (
                                 <button 
                                   onClick={() => handleToggleMed(med.id, 'morning')}
                                   className="bg-emerald-500 text-white font-black px-2.5 py-1.5 rounded-lg border-0 tracking-wide text-[9px] w-full shadow-sm hover:bg-red-500 transition cursor-pointer"
                                 >
                                    ✓ GIVEN ({med.morning.time})<br/>RN: {med.morning.sign}
                                 </button>
                              ) : (
                                 <button 
                                   onClick={() => handleToggleMed(med.id, 'morning')}
                                   className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 font-bold px-3 py-2 rounded-lg text-[9px] w-full transition cursor-pointer"
                                 >
                                    Mark Given
                                 </button>
                              )}
                           </td>

                           {/* Afternoon */}
                           <td className="p-4 border-l text-center">
                              {med.afternoon.given ? (
                                 <button 
                                   onClick={() => handleToggleMed(med.id, 'afternoon')}
                                   className="bg-emerald-500 text-white font-black px-2.5 py-1.5 rounded-lg border-0 tracking-wide text-[9px] w-full shadow-sm hover:bg-red-500 transition cursor-pointer"
                                 >
                                    ✓ GIVEN ({med.afternoon.time})<br/>RN: {med.afternoon.sign}
                                 </button>
                              ) : (
                                 <button 
                                   onClick={() => handleToggleMed(med.id, 'afternoon')}
                                   className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 font-bold px-3 py-2 rounded-lg text-[9px] w-full transition cursor-pointer"
                                 >
                                    Mark Given
                                 </button>
                              )}
                           </td>

                           {/* Evening */}
                           <td className="p-4 border-l text-center">
                              {med.evening.given ? (
                                 <button 
                                   onClick={() => handleToggleMed(med.id, 'evening')}
                                   className="bg-emerald-500 text-white font-black px-2.5 py-1.5 rounded-lg border-0 tracking-wide text-[9px] w-full shadow-sm hover:bg-red-500 transition cursor-pointer"
                                 >
                                    ✓ GIVEN ({med.evening.time})<br/>RN: {med.evening.sign}
                                 </button>
                              ) : (
                                 <button 
                                   onClick={() => handleToggleMed(med.id, 'evening')}
                                   className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 font-bold px-3 py-2 rounded-lg text-[9px] w-full transition cursor-pointer"
                                 >
                                    Mark Given
                                 </button>
                              )}
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>

          {/* IV Fluid Charting Card */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
             <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest text-emerald-700">IV Fluid Charting</h4>
                <span className="bg-emerald-100 text-emerald-700 text-[8px] font-black px-2 py-0.5 rounded border border-emerald-200 uppercase tracking-widest">
                   Auto-Syncs Intake Fluid Volume
                </span>
             </div>
             
             {/* Sub-form */}
             <form onSubmit={handleAddIvFluid} className="p-6 border-b border-slate-100 bg-slate-50/30 grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                <div>
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">IV Fluid Name</label>
                   <input 
                     type="text" 
                     placeholder="e.g. RL 500ml"
                     value={ivFluidInput.name}
                     onChange={e => setIvFluidInput({ ...ivFluidInput, name: e.target.value })}
                     className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold bg-white text-slate-700 outline-none w-full"
                   />
                </div>
                <div>
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Rate</label>
                   <input 
                     type="text" 
                     placeholder="e.g. 100 ml/h"
                     value={ivFluidInput.rate}
                     onChange={e => setIvFluidInput({ ...ivFluidInput, rate: e.target.value })}
                     className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold bg-white text-slate-700 outline-none w-full"
                   />
                </div>
                <div>
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Bag Volume</label>
                   <input 
                     type="text" 
                     placeholder="e.g. 500 ml"
                     value={ivFluidInput.bagVolume}
                     onChange={e => setIvFluidInput({ ...ivFluidInput, bagVolume: e.target.value })}
                     className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold bg-white text-slate-700 outline-none w-full"
                   />
                </div>
                <div>
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Start Time</label>
                   <input 
                     type="text" 
                     placeholder="e.g. 08:30 AM"
                     value={ivFluidInput.startTime}
                     onChange={e => setIvFluidInput({ ...ivFluidInput, startTime: e.target.value })}
                     className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold bg-white text-slate-700 outline-none w-full"
                   />
                </div>
                <div className="flex gap-2">
                   <div className="flex-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">End Time</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 01:30 PM"
                        value={ivFluidInput.endTime}
                        onChange={e => setIvFluidInput({ ...ivFluidInput, endTime: e.target.value })}
                        className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold bg-white text-slate-700 outline-none w-full"
                      />
                   </div>
                   <button 
                     type="submit"
                     className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase px-4 py-2.5 rounded-xl transition shadow border-0 cursor-pointer h-[34px] self-end"
                   >
                      +
                   </button>
                </div>
             </form>

             {/* Table */}
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-slate-50 text-slate-500 text-[9px] uppercase tracking-wider border-b">
                         <th className="p-4 font-black">Time Charted</th>
                         <th className="p-4 font-black">IV Fluid Name</th>
                         <th className="p-4 font-black">Rate</th>
                         <th className="p-4 font-black">Bag Volume</th>
                         <th className="p-4 font-black">Start Time</th>
                         <th className="p-4 font-black">End Time</th>
                         <th className="p-4 font-black text-center">Action</th>
                      </tr>
                   </thead>
                   <tbody className="text-xs">
                      {!(currentShiftRecord.ivFluids && currentShiftRecord.ivFluids.length > 0) ? (
                         <tr>
                            <td colSpan={7} className="p-6 text-center text-slate-400 italic uppercase font-bold bg-white">
                               No IV fluid entries charted for this shift.
                            </td>
                         </tr>
                      ) : currentShiftRecord.ivFluids.map((fluid) => (
                         <tr key={fluid.id} className="border-b last:border-0 hover:bg-slate-50/30 bg-white">
                            <td className="p-4">{new Date(fluid.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td className="p-4 font-bold text-slate-800">{fluid.name}</td>
                            <td className="p-4">{fluid.rate || '-'}</td>
                            <td className="p-4 font-mono font-bold text-slate-700">{fluid.bagVolume || '-'}</td>
                            <td className="p-4 text-emerald-700 font-bold">{fluid.startTime || '-'}</td>
                            <td className="p-4 text-orange-700 font-bold">{fluid.endTime || '-'}</td>
                            <td className="p-4 text-center">
                               <button 
                                 type="button"
                                 onClick={() => handleDeleteIvFluid(fluid.id)}
                                 className="text-red-500 hover:text-red-700 font-black uppercase text-[10px] bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition border-0 cursor-pointer"
                               >
                                  Delete
                               </button>
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>

          {/* I/O Balance log table */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
             <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Intake / Output Flows & Balance</h4>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                   In: <span className="text-blue-600">{ioTotals.intake} ml</span> | Out: <span className="text-orange-600">{ioTotals.output} ml</span> | Balance: <span className={ioTotals.balance >= 0 ? "text-emerald-600" : "text-red-600"}>{ioTotals.balance} ml</span>
                </div>
             </div>

             <div className="overflow-x-auto max-h-60">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-slate-100/50 text-slate-500 text-[9px] uppercase tracking-wider border-b">
                         <th className="p-3 font-black">Time</th>
                         <th className="p-3 font-black text-right">Intake (ml)</th>
                         <th className="p-3 font-black text-right">Output (ml)</th>
                         <th className="p-3 font-black">Remarks</th>
                      </tr>
                   </thead>
                   <tbody className="text-xs">
                      {currentShiftRecord.ioBalance.length === 0 ? (
                         <tr>
                            <td colSpan={4} className="p-6 text-center text-slate-400 italic uppercase font-semibold">No Intake/Output log entries recorded.</td>
                         </tr>
                      ) : currentShiftRecord.ioBalance.map((e, idx) => (
                         <tr key={idx} className="border-b">
                            <td className="p-3 font-bold text-slate-500">{new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td className="p-3 text-right font-black text-blue-600">
                               {e.intakeIv + e.intakeOral > 0 ? `${e.intakeIv + e.intakeOral} ml` : '-'}
                            </td>
                            <td className="p-3 text-right font-black text-orange-600">
                               {e.outputUrine + e.outputOther > 0 ? `${e.outputUrine + e.outputOther} ml` : '-'}
                            </td>
                            <td className="p-3 text-slate-600 font-semibold">{e.remarks}</td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>

        </div>

        {/* Right Side (4 cols): Vitals Form, I/O input, Observations */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Vitals Form */}
          <div className="bg-blue-50/30 border border-blue-200 rounded-3xl p-5 shadow-sm space-y-4">
             <h4 className="font-black text-blue-800 uppercase text-xs tracking-widest border-b pb-2 border-blue-200">
                Shift Vitals Record
             </h4>
             
             <form onSubmit={handleAddVitals} className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-left">
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Temp (°F)</label>
                      <input 
                        type="text" 
                        value={vitalsInput.temp}
                        onChange={e => setVitalsInput({ ...vitalsInput, temp: e.target.value })}
                        className="w-full border rounded-lg px-2.5 py-1.5 text-xs font-bold bg-white outline-none" 
                        placeholder="98.6"
                      />
                   </div>
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Pulse (bpm)</label>
                      <input 
                        type="text" 
                        value={vitalsInput.pulse}
                        onChange={e => setVitalsInput({ ...vitalsInput, pulse: e.target.value })}
                        className="w-full border rounded-lg px-2.5 py-1.5 text-xs font-bold bg-white outline-none" 
                        placeholder="72"
                      />
                   </div>
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">BP (mmHg)</label>
                      <input 
                        type="text" 
                        value={vitalsInput.bp}
                        onChange={e => setVitalsInput({ ...vitalsInput, bp: e.target.value })}
                        className="w-full border rounded-lg px-2.5 py-1.5 text-xs font-bold bg-white outline-none" 
                        placeholder="120/80"
                      />
                   </div>
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">SpO2 (%)</label>
                      <input 
                        type="text" 
                        value={vitalsInput.spo2}
                        onChange={e => setVitalsInput({ ...vitalsInput, spo2: e.target.value })}
                        className="w-full border rounded-lg px-2.5 py-1.5 text-xs font-bold bg-white outline-none" 
                        placeholder="98"
                      />
                   </div>
                </div>

                {/* Dynamic doctor directives inputs */}
                {customDirectiveLabels.length > 0 && (
                   <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 space-y-2 mt-2">
                      <p className="text-[9px] font-black text-teal-800 uppercase tracking-wider">Dynamic Doctor Directives</p>
                      <div className="grid grid-cols-2 gap-2">
                         {customDirectiveLabels.map(d => (
                            <div key={d.id}>
                               <label className="text-[9px] font-bold text-teal-600 uppercase block mb-0.5">{d.label}</label>
                               <input 
                                 type="text" 
                                 value={vitalsInput.customValues[d.id] || ""}
                                 onChange={e => setVitalsInput({
                                    ...vitalsInput,
                                    customValues: { ...vitalsInput.customValues, [d.id]: e.target.value }
                                 })}
                                 className="w-full border border-teal-200 rounded-lg px-2 py-1 text-xs font-bold bg-white outline-none" 
                                 placeholder="Value"
                               />
                            </div>
                         ))}
                      </div>
                   </div>
                )}

                <button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-widest shadow-md transition active:scale-95 cursor-pointer border-0"
                >
                   Record Entry
                </button>
             </form>

             {/* Vitals History List */}
             {currentShiftRecord.vitals.length > 0 && (
                <div className="border-t border-slate-200 pt-3 max-h-40 overflow-y-auto pr-1">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Shift History Tracker (24h)</p>
                   <div className="space-y-1.5">
                      {currentShiftRecord.vitals.map((v, i) => {
                         const customStr = Object.entries(v.customValues)
                           .map(([k, val]) => `${k.toUpperCase()}: ${val}`)
                           .join(", ");
                         return (
                            <div key={i} className="bg-white p-2 rounded-lg border text-[10px] font-bold text-slate-700 leading-normal">
                               <div className="flex justify-between text-[9px] text-slate-400 border-b pb-1 mb-1">
                                  <span>Time: {new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                               </div>
                               <div>T: {v.temp || '-'} | P: {v.pulse || '-'} | BP: {v.bp || '-'} | SpO2: {v.spo2 || '-'}</div>
                               {customStr && <div className="text-teal-600 text-[9px] mt-0.5 font-semibold">{customStr}</div>}
                            </div>
                         );
                      })}
                   </div>
                </div>
             )}
          </div>

          {/* I/O Log Form */}
          <div className="bg-amber-50/40 border border-amber-200 rounded-3xl p-5 shadow-sm space-y-4">
             <h4 className="font-black text-amber-800 uppercase text-xs tracking-widest border-b pb-2 border-amber-200">
                Log Intake / Output Volume
             </h4>

             <form onSubmit={handleAddIo} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Intake IV (ml)</label>
                      <input 
                        type="number" 
                        value={ioInput.intakeIv}
                        onChange={e => setIoInput({ ...ioInput, intakeIv: e.target.value })}
                        className="w-full border rounded-lg px-2.5 py-1.5 text-xs font-black text-blue-700 bg-white outline-none" 
                        placeholder="500"
                      />
                   </div>
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Intake Oral (ml)</label>
                      <input 
                        type="number" 
                        value={ioInput.intakeOral}
                        onChange={e => setIoInput({ ...ioInput, intakeOral: e.target.value })}
                        className="w-full border rounded-lg px-2.5 py-1.5 text-xs font-black text-blue-700 bg-white outline-none" 
                        placeholder="250"
                      />
                   </div>
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Urine Output (ml)</label>
                      <input 
                        type="number" 
                        value={ioInput.outputUrine}
                        onChange={e => setIoInput({ ...ioInput, outputUrine: e.target.value })}
                        className="w-full border rounded-lg px-2.5 py-1.5 text-xs font-black text-orange-700 bg-white outline-none" 
                        placeholder="400"
                      />
                   </div>
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Other Output (ml)</label>
                      <input 
                        type="number" 
                        value={ioInput.outputOther}
                        onChange={e => setIoInput({ ...ioInput, outputOther: e.target.value })}
                        className="w-full border rounded-lg px-2.5 py-1.5 text-xs font-black text-orange-700 bg-white outline-none" 
                        placeholder="100"
                      />
                   </div>
                </div>

                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Remarks</label>
                   <input 
                     type="text" 
                     value={ioInput.remarks}
                     onChange={e => setIoInput({ ...ioInput, remarks: e.target.value })}
                     className="w-full border rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white outline-none" 
                     placeholder="e.g. Oral water / Foley emptied"
                   />
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-widest shadow-md transition active:scale-95 cursor-pointer border-0"
                >
                   Log Fluids
                </button>
             </form>
          </div>

          {/* Nursing Notes */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
             <div className="flex justify-between items-center border-b pb-2">
                <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">
                   Nursing Observations
                </h4>
                <div className="flex gap-1">
                   <button 
                     onClick={startVoice}
                     className={`px-2 py-1 rounded text-[10px] font-black uppercase flex items-center gap-1 border-0 cursor-pointer ${isVoiceRecording ? "bg-red-500 text-white animate-pulse" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                   >
                      🎙️ Dictate
                   </button>
                </div>
             </div>

             <textarea
               value={nurseNotes}
               onChange={e => setNurseNotes(e.target.value)}
               className="w-full h-32 border border-slate-200 rounded-xl p-3 text-xs bg-slate-50/50 focus:bg-white outline-none leading-relaxed"
               placeholder="Write detailed shift nursing notes, complaints, local examination details..."
             />

             <button 
               onClick={handleSaveNotes}
               className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-widest shadow-md transition cursor-pointer border-0"
             >
                Save Notes
             </button>
          </div>

        </div>

      </div>

      {/* Nursing Shift Logs History */}
      <div className="space-y-4 mt-8 border-t border-slate-200 pt-8 text-left">
         <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
            Saved Day-Wise Nursing Shift Logs
         </h4>
         {Object.keys(shiftCharts).length === 0 ? (
            <p className="text-xs text-slate-400 italic">No saved nursing records for this admission.</p>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {Object.values(shiftCharts)
                 .sort((a, b) => b.date.localeCompare(a.date))
                 .map((chart) => (
                    <div 
                      key={chart.date}
                      className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative group hover:border-teal-400 transition-colors flex flex-col justify-between"
                    >
                       <div>
                          <div className="flex justify-between items-start mb-3">
                             <div>
                                <span className="text-[10px] font-black text-teal-600 uppercase tracking-wider block">Shift Date</span>
                                <span className="text-sm font-black text-slate-800">{new Date(chart.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                             </div>
                             <span className="bg-slate-100 text-slate-600 text-[8px] font-black px-2 py-0.5 rounded border uppercase">
                                By: {chart.nurseName || 'Nurse'}
                             </span>
                          </div>
                          
                          <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3 mb-4">
                             <p>💊 <strong>Meds administered:</strong> {chart.medications.filter(m => m.morning.given || m.afternoon.given || m.evening.given).length} drugs</p>
                             <p>📉 <strong>Vitals entries:</strong> {chart.vitals.length} records</p>
                             <p>💧 <strong>Intake/Output:</strong> {chart.ioBalance.length} logs</p>
                             {chart.notes && (
                                <p className="truncate text-slate-500 italic mt-2">"{chart.notes}"</p>
                             )}
                          </div>
                       </div>
                       
                       <div className="flex gap-2 border-t border-slate-100 pt-3">
                          <button
                            onClick={() => {
                              setSelectedDate(chart.date);
                              alert(`Loaded shift log for ${chart.date}. You can now edit inputs above.`);
                            }}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[10px] uppercase px-3 py-2 rounded-lg border-0 cursor-pointer flex-1 transition"
                          >
                             Edit
                          </button>
                          <button
                            onClick={() => handlePrintShiftChart(chart)}
                            className="bg-teal-50 hover:bg-teal-100 text-teal-700 font-black text-[10px] uppercase px-3 py-2 rounded-lg border border-teal-100 cursor-pointer flex-1 transition"
                          >
                             🖨️ Print
                          </button>
                          <button
                            onClick={() => handleDeleteShiftRecord(chart.date)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 font-black text-[10px] uppercase px-3 py-2 rounded-lg border border-red-100 cursor-pointer transition"
                          >
                             Delete
                          </button>
                       </div>
                    </div>
                 ))
               }
            </div>
         )}
      </div>

    </div>
  );
};
