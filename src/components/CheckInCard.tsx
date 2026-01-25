import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, LogIn, CreditCard, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/my_api/backend";

type Notice = {
  title: string;
  description: string;
  kind: "success" | "error";
} | null;

const CheckInCard = () => {
  const [employeeInput, setEmployeeInput] = useState("");
  const { toast } = useToast();
  const [notice, setNotice] = useState<Notice>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const successAudioRef = useRef<HTMLAudioElement | null>(null);
  const errorAudioRef = useRef<HTMLAudioElement | null>(null);

  const SCAN_MIN_LENGTH = 6;
  const SCAN_MAX_AVG_TIME_MS = 35;
  const SCAN_RESET_TIME_MS = 250;

  const scanBufRef = useRef("");
  const scanIntervalRef = useRef<number[]>([]);
  const lastKeyAtRef = useRef<number | null>(null);
  const scanResetTimerRef = useRef<number | null>(null);

  function formatTime(isoString) {
    return new Date(isoString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  function formatMinutes(minutes: number | null) {
    if (minutes == null) return "N/A";
    const hrs = Math.floor(minutes / 60);
    if (hrs <= 0) return `${minutes}m`;
    const mins = minutes % 60;
    return `${hrs}h ${mins}m`;
  }

  const showNotice = (n: Notice, ms = 5000) => {
    setNotice(n);

    if (n?.kind === "success") {
      successAudioRef.current?.play().catch(() => {});
    }

    if (n?.kind === "error") {
      errorAudioRef.current?.play().catch(() => {});
    }

    window.setTimeout(() => {
      setNotice(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    }, ms);
  };

  const resetScan = () => {
    scanBufRef.current = "";
    scanIntervalRef.current = [];
    lastKeyAtRef.current = null;
    if (scanResetTimerRef.current) {
      window.clearTimeout(scanResetTimerRef.current);
      scanResetTimerRef.current = null;
    }
  };

  const isLikelyScan = () => {
    const buf = scanBufRef.current;
    const intervals = scanIntervalRef.current;
    if (buf.length < SCAN_MIN_LENGTH) return false;
    if (intervals.length === 0) return false;
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return avg <= SCAN_MAX_AVG_TIME_MS;
  };

  const scheduleScanReset = () => {
    if (scanResetTimerRef.current)
      window.clearTimeout(scanResetTimerRef.current);
    scanResetTimerRef.current = window.setTimeout(
      resetScan,
      SCAN_RESET_TIME_MS,
    );
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const key = e.key;

    if (key === "Enter" || key === "Tab") {
      const scanned = isLikelyScan() ? scanBufRef.current : null;
      resetScan();

      if (scanned) {
        e.preventDefault();
        handleSubmit(scanned);
        return;
      }

      if (key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
      return;
    }

    if (key === "Backspace" || key === "Escape") {
      resetScan();
      return;
    }

    const isChar = key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!isChar) return;

    const now = Date.now();
    if (lastKeyAtRef.current != null) {
      scanIntervalRef.current.push(now - lastKeyAtRef.current);
    }
    lastKeyAtRef.current = now;
    scanBufRef.current += key;
    scheduleScanReset();
  };

  useEffect(() => {
    successAudioRef.current = new Audio("/sounds/success.mp3");
    errorAudioRef.current = new Audio("/sounds/error.mp3");

    inputRef.current?.focus();

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (target.closest('a[href="/admin-login"]')) return;

      inputRef.current?.focus();
    };

    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, []);

  const handleSubmit = async (raw?: string) => {
    const value = (raw ?? employeeInput).trim();

    if (!value) {
      showNotice({
        kind: "error",
        title: "ID or Username required",
        description: "Please enter your id or username.",
      });
      return;
    }

    try {
      const result = await api.scanToggle(value);

      setEmployeeInput("");
      resetScan();

      if (result.action === "checkin") {
        const when = result.workRecord.checkInAt;

        showNotice({
          kind: "success",
          title: "Checked in",
          description: `${result.employee.name} checked in at ${formatTime(
            when,
          )}.`,
        });
      } else {
        showNotice({
          kind: "success",
          title: "Checked out",
          description: `${result.employee.name} checked out at ${formatTime(
            result.checkOutAt,
          )} • Worked: ${formatMinutes(result.workedTime)}.`,
        });
      }
    } catch (e: any) {
      showNotice({
        kind: "error",
        title: "Scan failed",
        description: e?.message || "Request failed",
      });
      setEmployeeInput("");
      resetScan();
      inputRef.current?.focus();
    }
  };

  const handleManualSubmit = () => {
    resetScan();
    handleSubmit();
  };

  return (
    <div className="space-y-6 w-full max-w-md mx-auto">
      <Card className="shadow-card border-0 overflow-hidden transition-all duration-300">
        <CardHeader className="gradient-primary text-primary-foreground pb-8">
          <CardTitle className="font-heading text-2xl flex items-center gap-3">
            <Clock className="h-6 w-6" />
            Employee Check-In
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-6">
          {notice ? (
            <div className="min-h-[220px] flex flex-col items-center justify-center text-center gap-3">
              {notice.kind === "success" ? (
                <CheckCircle className="h-12 w-12 text-green-600" />
              ) : (
                <XCircle className="h-12 w-12 text-red-600" />
              )}

              <div
                className={`text-3xl font-semibold ${
                  notice.kind === "error" ? "text-red-600" : ""
                }`}
              >
                {notice.title}
              </div>

              <div className="text-lg text-muted-foreground">
                {notice.description}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Your Name
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    type="text"
                    placeholder="Enter your ID or username"
                    value={employeeInput}
                    onChange={(e) => setEmployeeInput(e.target.value)}
                    className="pl-10 h-12 text-base"
                    onKeyDown={handleInputKeyDown}
                    autoFocus
                  />
                </div>
              </div>

              <Button
                onClick={handleManualSubmit}
                className="w-full h-14 text-lg font-semibold gradient-primary hover:opacity-90 transition-opacity shadow-soft"
                size="lg"
              >
                <LogIn className="mr-2 h-5 w-5" />
                Check In / Out
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckInCard;
