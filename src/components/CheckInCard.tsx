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
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<CheckInRecord | null>(null);
  const [history, setHistory] = useState<CheckInRecord[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
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

    setIsAnimating(true);
    const newRecord: CheckInRecord = {
      id: Date.now().toString(),
      employeeName: employeeName.trim(),
      checkInTime: new Date(),
    };
    
    setCurrentRecord(newRecord);
    setIsCheckedIn(true);
    
    toast({
      title: "Checked In!",
      description: `Welcome, ${employeeName}! Your check-in time has been recorded.`,
    });

    setTimeout(() => setIsAnimating(false), 500);
  };

  const handleCheckOut = () => {
    if (currentRecord) {
      setIsAnimating(true);
      const completedRecord = {
        ...currentRecord,
        checkOutTime: new Date(),
      };
      
      setHistory((prev) => [completedRecord, ...prev]);
      setCurrentRecord(null);
      setIsCheckedIn(false);
      setEmployeeName("");
      
      toast({
        title: "Checked Out!",
        description: "Have a great day! Your check-out time has been recorded.",
      });

      setTimeout(() => setIsAnimating(false), 500);
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
      <Card className={`shadow-card border-0 overflow-hidden transition-all duration-300 ${isAnimating ? 'animate-check-in' : ''}`}>
        <CardHeader className="gradient-primary text-primary-foreground pb-8">
          <CardTitle className="font-heading text-2xl flex items-center gap-3">
            <Clock className="h-6 w-6" />
            Employee Check-In
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {!isCheckedIn ? (
            <>
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
            </>
          ) : (
            <div className="space-y-6">
              <div className="text-center p-6 bg-success/10 rounded-lg border border-success/20">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success/20 mb-3">
                  <div className="w-3 h-3 rounded-full bg-success animate-pulse" />
                </div>
                <p className="text-lg font-medium text-foreground mb-1">
                  {currentRecord?.employeeName}
                </p>
                <p className="text-sm text-muted-foreground">
                  Checked in at {currentRecord && formatTime(currentRecord.checkInTime)}
                </p>
              </div>
              <Button
                onClick={handleCheckOut}
                variant="outline"
                className="w-full h-14 text-lg font-semibold border-2 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
                size="lg"
              >
                <LogOut className="mr-2 h-5 w-5" />
                Check Out
              </Button>
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
                      {formatTime(record.checkInTime)} - {record.checkOutTime && formatTime(record.checkOutTime)}
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
