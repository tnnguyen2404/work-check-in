import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, User } from "lucide-react";
import { getAllRecords, CheckInRecord } from "@/localDb/checkins";

interface EmployeeSummary {
  name: string;
  totalMinutes: number;
  sessions: number;
}

const WorkingTime = () => {
  const [summaries, setSummaries] = useState<EmployeeSummary[]>([]);

  useEffect(() => {
    const loadSummaries = async () => {
      const records = await getAllRecords();
      const completedRecords = records.filter((r) => r.checkOutTime && r.workedTime);

      const employeeMap = new Map<string, EmployeeSummary>();

      completedRecords.forEach((record) => {
        const name = record.employeeName;
        const existing = employeeMap.get(name);

        if (existing) {
          existing.totalMinutes += record.workedTime || 0;
          existing.sessions += 1;
        } else {
          employeeMap.set(name, {
            name,
            totalMinutes: record.workedTime || 0,
            sessions: 1,
          });
        }
      });

      const sorted = Array.from(employeeMap.values()).sort(
        (a, b) => b.totalMinutes - a.totalMinutes
      );
      setSummaries(sorted);
    };

    loadSummaries();
  }, []);

  const formatHours = (minutes: number) => {
    const hours = (minutes / 60).toFixed(1);
    return `${hours}h`;
  };

  const formatDetailed = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="font-heading text-xl font-semibold text-foreground">
            Working Time Summary
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-primary" />
                Employee Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summaries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No completed check-ins yet
                </p>
              ) : (
                <div className="space-y-3">
                  {summaries.map((employee) => (
                    <div
                      key={employee.name}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {employee.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {employee.sessions} session{employee.sessions !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-semibold text-primary">
                          {formatHours(employee.totalMinutes)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDetailed(employee.totalMinutes)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default WorkingTime;
