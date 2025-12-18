import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, LogIn, LogOut, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CheckInRecord {
  id: string;
  employeeName: string;
  checkInTime: Date;
  checkOutTime?: Date;
}

const CheckInCard = () => {
  const [employeeName, setEmployeeName] = useState("");
  const [activeCheckIns, setActiveCheckIns] = useState<CheckInRecord[]>([]);
  const [history, setHistory] = useState<CheckInRecord[]>([]);
  const { toast } = useToast();

  const handleCheckIn = () => {
    if (!employeeName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name to check in.",
        variant: "destructive",
      });
      return;
    }

    // Check if employee is already checked in
    const alreadyCheckedIn = activeCheckIns.some(
      (record) =>
        record.employeeName.toLowerCase() === employeeName.trim().toLowerCase()
    );

    if (alreadyCheckedIn) {
      toast({
        title: "Already checked in",
        description: `${employeeName} is already checked in.`,
        variant: "destructive",
      });
      return;
    }

    const newRecord: CheckInRecord = {
      id: Date.now().toString(),
      employeeName: employeeName.trim(),
      checkInTime: new Date(),
    };

    setActiveCheckIns((prev) => [...prev, newRecord]);
    setEmployeeName("");
  };

  const handleCheckOut = (recordId: string) => {
    const record = activeCheckIns.find((r) => r.id === recordId);
    if (record) {
      const completedRecord = {
        ...record,
        checkOutTime: new Date(),
      };

      setActiveCheckIns((prev) => prev.filter((r) => r.id !== recordId));
      setHistory((prev) => [completedRecord, ...prev]);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
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
                onKeyDown={(e) => e.key === "Enter" && handleCheckIn()}
              />
            </div>
          </div>
          <Button
            onClick={handleCheckIn}
            className="w-full h-14 text-lg font-semibold gradient-primary hover:opacity-90 transition-opacity shadow-soft"
            size="lg"
          >
            <LogIn className="mr-2 h-5 w-5" />
            Check In
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
                    onClick={() => handleCheckOut(record.id)}
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
                    Complete
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
