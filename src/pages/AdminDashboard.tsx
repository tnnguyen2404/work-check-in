import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Clock,
  User,
  Calendar as CalendarIcon,
  Plus,
  UserPlus,
  Download,
  MapPin,
} from "lucide-react";
import {
  getAllRecords,
  getAllEmployees,
  getAllLocations,
  saveEmployee,
  saveLocation,
  Employee,
  CheckInRecord,
  Location,
} from "@/localDb/db";
import { Calendar } from "@/components/ui/calendar";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameDay,
  isSameMonth,
  isWithinInterval,
} from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import * as XLSX from "xlsx";
import { DateRange } from "react-day-picker";

interface DayHours {
  date: Date;
  minutes: number;
}

const WorkingTime = () => {
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [storedEmployees, setStoredEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeeId, setNewEmployeeId] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportDateRange, setExportDateRange] = useState<DateRange | undefined>(
    undefined
  );
  const [showAddLocationDialog, setShowAddLocationDialog] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      const allRecords = await getAllRecords();
      const completed = allRecords.filter(
        (r) => r.checkOutTime && r.workedTime
      );
      setRecords(completed);

      const employees = await getAllEmployees();
      setStoredEmployees(employees);

      const locations = await getAllLocations();
      setLocations(locations);

      if (locations.length > 0 && !selectedLocation) {
        setSelectedLocation(locations[0].id);
      }
    };
    loadData();
  }, []);

  // Get unique employee names (combine stored employees with those from records)
  const employees = useMemo(() => {
    if (!selectedLocation) return [];
    const locationEmployees = storedEmployees.filter(
      (e) => e.locationId === selectedLocation
    );
    const namesFromStored = locationEmployees.map((e) => e.name);
    const namesFromRecords = records
      .filter(
        (r) =>
          r.employeeName ===
          locationEmployees.find((e) => e.name === r.employeeName)?.name
      )
      .map((r) => r.employeeName);
    const allNames = new Set([...namesFromRecords, ...namesFromStored]);
    return Array.from(allNames).sort();
  }, [records, storedEmployees, selectedLocation]);

  // Auto-select first employee if none selected
  useEffect(() => {
    if (employees.length > 0) {
      setSelectedEmployee(employees[0]);
    } else {
      setSelectedEmployee(null);
    }
  }, [selectedLocation, employees]);

  const handleAddLocation = async () => {
    const trimmedName = newLocationName.trim();

    if (!trimmedName) {
      toast({ title: "Please enter a location name", variant: "destructive" });
      return;
    }

    if (
      locations.some((l) => l.name.toLowerCase() === trimmedName.toLowerCase())
    ) {
      toast({ title: "Location already exists", variant: "destructive" });
      return;
    }

    const newLocation: Location = {
      id: crypto.randomUUID(),
      name: trimmedName,
      createdAt: new Date().toISOString(),
    };

    await saveLocation(newLocation);
    setLocations((prev) => [...prev, newLocation]);
    setNewLocationName("");
    setShowAddLocationDialog(false);
    setSelectedLocation(newLocation.id);
    toast({ title: `Location "${trimmedName}" added` });
  };

  const handleAddEmployee = async () => {
    if (!selectedLocation) {
      toast({
        title: "Please select a location first",
        variant: "destructive",
      });
      return;
    }

    const trimmedName = newEmployeeName.trim();
    const trimmedId = newEmployeeId.trim();

    if (!trimmedId) {
      toast({ title: "Please enter an ID", variant: "destructive" });
      return;
    }

    if (!trimmedName) {
      toast({ title: "Please enter a name", variant: "destructive" });
      return;
    }

    if (employees.includes(trimmedId)) {
      toast({ title: "Employee ID already exists", variant: "destructive" });
      return;
    }

    if (employees.includes(trimmedName)) {
      toast({
        title: "Employee username already exists",
        variant: "destructive",
      });
      return;
    }

    const newEmployee: Employee = {
      id: trimmedId,
      name: trimmedName,
      locationId: selectedLocation,
      createdAt: new Date().toISOString(),
    };

    await saveEmployee(newEmployee);
    setStoredEmployees((prev) => [...prev, newEmployee]);
    setNewEmployeeName("");
    setShowAddForm(false);
    setSelectedEmployee(trimmedName);
    toast({ title: `Employee "${trimmedName}" added` });
  };

  const handleExportClick = () => {
    setExportDateRange(undefined);
    setShowExportDialog(true);
  };

  const handleExport = () => {
    if (!exportDateRange?.from || !exportDateRange?.to) {
      toast({ title: "Please select a date range", variant: "destructive" });
      return;
    }

    const { from, to } = exportDateRange;

    // Build header row: Employee Name + Total Hours
    const headers = ["Employee Name", "Total Hours"];

    // Build data rows for each employee
    const rows = employees.map((employeeName) => {
      const empRecords = records.filter((r) => r.employeeName === employeeName);
      const totalMinutes = empRecords
        .filter((r) => {
          const recordDate = new Date(r.checkInTime);
          return isWithinInterval(recordDate, { start: from, end: to });
        })
        .reduce((sum, r) => sum + (r.workedTime || 0), 0);

      return [employeeName, formatHours(totalMinutes)];
    });

    // Create workbook and worksheet
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Working Hours");

    // Download
    const fileName = `working_hours_${format(from, "yyyyMMdd")}_${format(
      to,
      "yyyyMMdd"
    )}.xlsx`;
    XLSX.writeFile(wb, fileName);

    setShowExportDialog(false);
    toast({ title: "Export successful" });
  };

  // Get records for selected employee
  const employeeRecords = useMemo(() => {
    if (!selectedEmployee) return [];
    return records.filter((r) => r.employeeName === selectedEmployee);
  }, [records, selectedEmployee]);

  // Calculate hours per day for the selected employee
  const dailyHours = useMemo(() => {
    const dayMap = new Map<string, number>();

    employeeRecords.forEach((record) => {
      const dateKey = format(new Date(record.checkInTime), "yyyy-MM-dd");
      const existing = dayMap.get(dateKey) || 0;
      dayMap.set(dateKey, existing + (record.workedTime || 0));
    });

    return dayMap;
  }, [employeeRecords]);

  // Calculate weekly and monthly totals
  const totals = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

    let monthlyMinutes = 0;
    let weeklyMinutes = 0;
    let totalMinutes = 0;

    employeeRecords.forEach((record) => {
      const recordDate = new Date(record.checkInTime);
      const minutes = record.workedTime || 0;

      totalMinutes += minutes;

      if (recordDate >= monthStart && recordDate <= monthEnd) {
        monthlyMinutes += minutes;
      }

      if (recordDate >= weekStart && recordDate <= weekEnd) {
        weeklyMinutes += minutes;
      }
    });

    return { monthlyMinutes, weeklyMinutes, totalMinutes };
  }, [employeeRecords, currentMonth]);

  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours === 0) return `${mins}m`;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatHoursShort = (minutes: number) => {
    const hours = (minutes / 60).toFixed(1);
    return `${hours}h`;
  };

  // Get hours for a specific day
  const getHoursForDay = (date: Date): number => {
    const dateKey = format(date, "yyyy-MM-dd");
    return dailyHours.get(dateKey) || 0;
  };

  // Get records for selected date
  const selectedDateRecords = useMemo(() => {
    if (!selectedDate || !selectedEmployee) return [];
    return employeeRecords.filter((r) =>
      isSameDay(new Date(r.checkInTime), selectedDate)
    );
  }, [selectedDate, employeeRecords, selectedEmployee]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="w-full px-4 py-4 flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="font-heading text-xl font-semibold text-foreground">
            Admin Dashboard
          </h1>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <MapPin className="h-4 w-4" />
                {selectedLocation
                  ? locations.find((l) => l.id === selectedLocation)?.name ||
                    "Select Location"
                  : "Select Location"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2 bg-popover" align="end">
              <div className="space-y-1">
                {locations.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => setSelectedLocation(loc.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                      selectedLocation === loc.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    {loc.name}
                  </button>
                ))}
                {locations.length === 0 && (
                  <p className="text-sm text-muted-foreground px-3 py-2">
                    No locations
                  </p>
                )}
                <div className="border-t border-border mt-2 pt-2">
                  <button
                    onClick={() => setShowAddLocationDialog(true)}
                    className="w-full text-left px-3 py-2 rounded-md text-sm text-primary hover:bg-muted flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Location
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportClick}
            disabled={employees.length === 0}
            className="ml-auto gap-2"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </header>

      {/* Main Content - 3 Column Layout */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Column 1: Employee List */}
          <div className="lg:col-span-3">
            <Card className="border-border/50 shadow-sm h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="h-4 w-4 text-primary" />
                    Employees
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowAddForm(!showAddForm)}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Add Employee Form */}
                {showAddForm && (
                  <div className="p-4 border-b border-border/30 bg-muted/20">
                    <div className="flex flex-col gap-2">
                      <Input
                        placeholder="Employee ID"
                        value={newEmployeeId}
                        onChange={(e) => setNewEmployeeId(e.target.value)}
                        className="h-9"
                      />
                      <div className="flex gap-2">
                        <Input
                          placeholder="Employee name"
                          value={newEmployeeName}
                          onChange={(e) => setNewEmployeeName(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleAddEmployee()
                          }
                          className="h-9"
                        />
                        <Button
                          size="sm"
                          onClick={handleAddEmployee}
                          className="h-9"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {employees.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 px-4">
                    No employees found
                  </p>
                ) : (
                  <div className="divide-y divide-border/30">
                    {employees.map((name) => (
                      <button
                        key={name}
                        onClick={() => setSelectedEmployee(name)}
                        className={cn(
                          "w-full text-left px-4 py-3 transition-colors hover:bg-muted/50",
                          selectedEmployee === name &&
                            "bg-primary/10 border-l-2 border-primary"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium",
                              selectedEmployee === name
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <span
                            className={cn(
                              "font-medium",
                              selectedEmployee === name
                                ? "text-primary"
                                : "text-foreground"
                            )}
                          >
                            {name}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Column 2: Calendar */}
          <div className="lg:col-span-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  Working Calendar
                  {selectedEmployee && (
                    <span className="text-muted-foreground font-normal">
                      — {selectedEmployee}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedEmployee ? (
                  <p className="text-center text-muted-foreground py-8">
                    Select an employee to view their calendar
                  </p>
                ) : (
                  <>
                    <div className="flex justify-center">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        month={currentMonth}
                        onMonthChange={setCurrentMonth}
                        className="rounded-md border pointer-events-auto"
                        components={{
                          Day: ({ date, ...props }) => {
                            const hours = getHoursForDay(date);
                            const isCurrentMonth = isSameMonth(
                              date,
                              currentMonth
                            );
                            const isToday = isSameDay(date, new Date());
                            const isSelected =
                              selectedDate && isSameDay(date, selectedDate);

                            return (
                              <button
                                onClick={() => setSelectedDate(date)}
                                className={cn(
                                  "relative h-14 w-14 p-1 text-center flex flex-col items-center justify-start rounded-md transition-colors",
                                  !isCurrentMonth && "text-muted-foreground/50",
                                  isToday && "bg-accent",
                                  isSelected &&
                                    "ring-2 ring-primary bg-primary/10",
                                  hours > 0 &&
                                    isCurrentMonth &&
                                    !isSelected &&
                                    "hover:bg-muted/50"
                                )}
                              >
                                <span
                                  className={cn(
                                    "text-sm",
                                    isToday &&
                                      "font-bold text-accent-foreground",
                                    isSelected && "text-primary font-bold"
                                  )}
                                >
                                  {format(date, "d")}
                                </span>
                                {hours > 0 && isCurrentMonth && (
                                  <span className="text-xs text-primary font-medium mt-0.5 bg-primary/10 px-1.5 py-0.5 rounded">
                                    {formatHoursShort(hours)}
                                  </span>
                                )}
                              </button>
                            );
                          },
                        }}
                      />
                    </div>

                    {/* Selected Day Details */}
                    {selectedDate && (
                      <div className="mt-4 p-4 rounded-lg bg-muted/30 border border-border/30">
                        <h3 className="font-medium text-foreground mb-2">
                          {format(selectedDate, "EEEE, MMMM d, yyyy")}
                        </h3>
                        {selectedDateRecords.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No work recorded
                          </p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                              Total:{" "}
                              <span className="font-semibold text-primary">
                                {formatHours(getHoursForDay(selectedDate))}
                              </span>
                            </p>
                            <div className="space-y-1">
                              {selectedDateRecords.map((record) => (
                                <div
                                  key={record.id}
                                  className="flex justify-between text-sm bg-background/50 p-2 rounded"
                                >
                                  <span className="text-muted-foreground">
                                    {format(
                                      new Date(record.checkInTime),
                                      "HH:mm"
                                    )}{" "}
                                    -{" "}
                                    {format(
                                      new Date(record.checkOutTime!),
                                      "HH:mm"
                                    )}
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {formatHours(record.workedTime || 0)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Column 3: Totals */}
          <div className="lg:col-span-3">
            <Card className="border-border/50 shadow-sm h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-primary" />
                  Hour Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedEmployee ? (
                  <p className="text-center text-muted-foreground py-8">
                    Select an employee
                  </p>
                ) : (
                  <div className="space-y-4">
                    {/* This Week */}
                    <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                        This Week
                      </p>
                      <p className="text-2xl font-bold text-foreground">
                        {formatHours(totals.weeklyMinutes)}
                      </p>
                    </div>

                    {/* This Month */}
                    <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                        {format(currentMonth, "MMMM yyyy")}
                      </p>
                      <p className="text-2xl font-bold text-primary">
                        {formatHours(totals.monthlyMinutes)}
                      </p>
                    </div>

                    {/* All Time */}
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                        All Time
                      </p>
                      <p className="text-2xl font-bold text-primary">
                        {formatHours(totals.totalMinutes)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {employeeRecords.length} session
                        {employeeRecords.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Dialog
        open={showAddLocationDialog}
        onOpenChange={setShowAddLocationDialog}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add New Location</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Location name"
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddLocation()}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddLocationDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddLocation}>
              <Plus className="h-4 w-4 mr-2" />
              Add Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export Working Hours</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Select a date range to export all employees' working hours.
            </p>
            <div className="flex justify-center">
              <Calendar
                mode="range"
                selected={exportDateRange}
                onSelect={setExportDateRange}
                numberOfMonths={1}
                className="rounded-md border pointer-events-auto"
              />
            </div>
            {exportDateRange?.from && exportDateRange?.to && (
              <p className="text-sm text-center mt-4 text-muted-foreground">
                {format(exportDateRange.from, "MMM d, yyyy")} —{" "}
                {format(exportDateRange.to, "MMM d, yyyy")}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowExportDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={!exportDateRange?.from || !exportDateRange?.to}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkingTime;
