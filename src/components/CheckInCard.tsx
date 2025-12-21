import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, LogIn, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAllRecords, saveRecord, CheckInRecord } from "@/localDb/checkins";
import { calculateWorkedMinutes } from "@/lib/time";

const CheckInCard = () => {
  const [employeeName, setEmployeeName] = useState("");
  const [activeCheckIns, setActiveCheckIns] = useState<CheckInRecord[]>([]);
  const [history, setHistory] = useState<CheckInRecord[]>([]);
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (target.closest('a[href="/working-time"]')) {
        return;
      }

      setTimeout(() => inputRef.current?.focus(), 0);
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Load records from IndexedDB on mount
  useEffect(() => {
    const loadRecords = async () => {
      const records = await getAllRecords();
      const active = records.filter((r) => !r.checkOutTime);
      const completed = records.filter((r) => r.checkOutTime);
      setActiveCheckIns(active);
      setHistory(completed.reverse());
    };
    loadRecords();
  }, []);

  const handleSubmit = async () => {
    if (!employeeName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name.",
        variant: "destructive",
      });
      return;
    }

    const normalizedName = employeeName.trim().toLowerCase();

    // Check if already checked in - if so, check them out
    const existingRecord = activeCheckIns.find(
      (record) => record.employeeName.toLowerCase() === normalizedName
    );

    if (existingRecord) {
      // Check out the user
      const checkOutTime = new Date().toISOString();
      const workedTime = calculateWorkedMinutes(
        existingRecord.checkInTime,
        checkOutTime
      );

      const completedRecord: CheckInRecord = {
        ...existingRecord,
        checkOutTime,
        workedTime,
      };

      await saveRecord(completedRecord);
      setActiveCheckIns((prev) =>
        prev.filter((r) => r.id !== existingRecord.id)
      );
      setHistory((prev) => [completedRecord, ...prev]);
      setEmployeeName("");

      toast({
        title: "Checked out",
        description: `${
          existingRecord.employeeName
        } checked out at ${formatWorkedTime(workedTime)}.`,
      });
      return;
    }

    // New check-in
    const newRecord: CheckInRecord = {
      id: Date.now().toString(),
      employeeName: employeeName.trim(),
      checkInTime: new Date().toISOString(),
      synced: false,
    };

    await saveRecord(newRecord);
    setActiveCheckIns((prev) => [...prev, newRecord]);
    setEmployeeName("");

    toast({
      title: "Checked in",
      description: `${newRecord.employeeName} checked in at ${formatTime(
        newRecord.checkInTime
      )}.`,
    });
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatWorkedTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <div className="space-y-6 w-full max-w-md mx-auto">
      {/* Main Check-In Card */}
      <Card
        className={`shadow-card border-0 overflow-hidden transition-all duration-300 $`}
      >
        <CardHeader className="gradient-primary text-primary-foreground pb-8">
          <CardTitle className="font-heading text-2xl flex items-center gap-3">
            <Clock className="h-6 w-6" />
            Employee Check-In
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Check-in form - always visible */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Your Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Enter your name"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                className="pl-10 h-12 text-base"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                autoFocus
              />
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            className="w-full h-14 text-lg font-semibold gradient-primary hover:opacity-90 transition-opacity shadow-soft"
            size="lg"
          >
            <LogIn className="mr-2 h-5 w-5" />
            Check In / Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckInCard;
