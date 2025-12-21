import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, LogIn, LogOut, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAllRecords, saveRecord, CheckInRecord } from "@/localDb/checkins";
import { calculateWorkedMinutes } from "@/lib/time";

const BLOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

const CheckInCard = () => {
  const [employeeName, setEmployeeName] = useState("");
  const [activeCheckIns, setActiveCheckIns] = useState<CheckInRecord[]>([]);
  const [history, setHistory] = useState<CheckInRecord[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<Map<string, number>>(new Map());
  const { toast } = useToast();

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

  // Check if user is blocked
  const isUserBlocked = (name: string): boolean => {
    const normalizedName = name.trim().toLowerCase();
    const blockedUntil = blockedUsers.get(normalizedName);
    if (!blockedUntil) return false;
    if (Date.now() >= blockedUntil) {
      // Block expired, remove it
      setBlockedUsers((prev) => {
        const newMap = new Map(prev);
        newMap.delete(normalizedName);
        return newMap;
      });
      return false;
    }
    return true;
  };

  // Get remaining block time in minutes
  const getBlockTimeRemaining = (name: string): number => {
    const normalizedName = name.trim().toLowerCase();
    const blockedUntil = blockedUsers.get(normalizedName);
    if (!blockedUntil) return 0;
    return Math.ceil((blockedUntil - Date.now()) / 60000);
  };

  // Block a user for 5 minutes
  const blockUser = (name: string) => {
    const normalizedName = name.trim().toLowerCase();
    setBlockedUsers((prev) => {
      const newMap = new Map(prev);
      newMap.set(normalizedName, Date.now() + BLOCK_DURATION_MS);
      return newMap;
    });
  };

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

    // Check if user is blocked
    if (isUserBlocked(employeeName)) {
      const remaining = getBlockTimeRemaining(employeeName);
      toast({
        title: "Please wait",
        description: `${employeeName} can check in again in ${remaining} minute${remaining !== 1 ? 's' : ''}.`,
        variant: "destructive",
      });
      return;
    }

    // Check if already checked in - if so, check them out
    const existingRecord = activeCheckIns.find(
      (record) => record.employeeName.toLowerCase() === normalizedName
    );

    if (existingRecord) {
      // Check out the user
      const checkOutTime = new Date().toISOString();
      const workedTime = calculateWorkedMinutes(existingRecord.checkInTime, checkOutTime);
      
      const completedRecord: CheckInRecord = {
        ...existingRecord,
        checkOutTime,
        workedTime,
      };

      await saveRecord(completedRecord);
      setActiveCheckIns((prev) => prev.filter((r) => r.id !== existingRecord.id));
      setHistory((prev) => [completedRecord, ...prev]);
      setEmployeeName("");
      
      toast({
        title: "Checked out",
        description: `${existingRecord.employeeName} worked for ${formatWorkedTime(workedTime)}.`,
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
    blockUser(employeeName); // Block for 5 minutes after check-in
    setEmployeeName("");
    
    toast({
      title: "Checked in",
      description: `${newRecord.employeeName} checked in successfully.`,
    });
  };

  const handleQuickCheckOut = async (record: CheckInRecord) => {
    const checkOutTime = new Date().toISOString();
    const workedTime = calculateWorkedMinutes(record.checkInTime, checkOutTime);
    
    const completedRecord: CheckInRecord = {
      ...record,
      checkOutTime,
      workedTime,
    };

    await saveRecord(completedRecord);
    setActiveCheckIns((prev) => prev.filter((r) => r.id !== record.id));
    setHistory((prev) => [completedRecord, ...prev]);
    
    toast({
      title: "Checked out",
      description: `${record.employeeName} worked for ${formatWorkedTime(workedTime)}.`,
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
                type="text"
                placeholder="Enter your name"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                className="pl-10 h-12 text-base"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
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

          {/* Active check-ins list */}
          {activeCheckIns.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-border">
              <p className="text-sm font-medium text-muted-foreground">
                Currently Checked In
              </p>
              {activeCheckIns.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 bg-success/10 rounded-lg border border-success/20"
                >
                  <div>
                    <p className="font-medium text-foreground text-sm">
                      {record.employeeName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Checked in at {formatTime(record.checkInTime)}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleQuickCheckOut(record)}
                    variant="outline"
                    size="sm"
                    className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <LogOut className="mr-1 h-4 w-4" />
                    Out
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Card */}
      {history.length > 0 && (
        <Card className="shadow-card border-0 animate-fade-in">
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-lg text-foreground">
              Today's Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.slice(0, 5).map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium text-foreground text-sm">
                      {record.employeeName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(record.checkInTime)} -{" "}
                      {record.checkOutTime && formatTime(record.checkOutTime)}
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-success/10 text-success">
                    {record.workedTime !== undefined ? formatWorkedTime(record.workedTime) : "Complete"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CheckInCard;
