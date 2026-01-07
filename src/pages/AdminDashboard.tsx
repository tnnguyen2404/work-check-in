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
  Trash2,
} from "lucide-react";
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
  set,
} from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import * as XLSX from "xlsx";
import { DateRange } from "react-day-picker";
import {
  api,
  type Employee,
  type Location,
  type WorkRecord,
} from "@/my_api/backend";

interface DayHours {
  date: Date;
  minutes: number;
}

function recordStartDate(record: WorkRecord) {
  if (typeof record.checkInAt === "number") {
    return new Date(record.checkInAt);
  }
  return new Date(0);
}

function recordEndDate(record: WorkRecord) {
  if (typeof record.checkOutAt === "number") {
    return new Date(record.checkOutAt);
  }
  return null;
}

const WorkingTime = () => {
  const { toast } = useToast();

  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(
    null
  );

  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const [employeeRecords, setEmployeeRecords] = useState<WorkRecord[]>([]);

  // dialogs / forms
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeeId, setNewEmployeeId] = useState("");
  const [newEmployeeIdentifier, setNewEmployeeIdentifier] = useState("");

  const [showAddLocationDialog, setShowAddLocationDialog] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");

  const [confirmDeleteEmployee, setConfirmDeleteEmployee] =
    useState<Employee | null>(null);
  const [confirmDeleteLocation, setConfirmDeleteLocation] =
    useState<Location | null>(null);

  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportDateRange, setExportDateRange] = useState<DateRange | undefined>(
    undefined
  );

  const selectedEmployee = useMemo(() => {
    if (selectedEmployeeId == null) return null;
    return employees.find((e) => e.id === selectedEmployeeId) ?? null;
  }, [employees, selectedEmployeeId]);

  useEffect(() => {
    (async () => {
      try {
        const locs = await api.listLocations();
        setLocations(locs);
        setSelectedLocation(locs[0]?.id ?? null);
      } catch (e: any) {
        toast({
          title: "Failed to load locations",
          description: e?.message || "Request failed",
          variant: "destructive",
        });
      }
    })();
  }, [toast]);

  useEffect(() => {
    if (!selectedLocation) {
      setEmployees([]);
      setSelectedEmployeeId(null);
      return;
    }

    (async () => {
      try {
        const emps = await api.listEmployeesByLocation(selectedLocation);
        setEmployees(emps);
        setSelectedEmployeeId(emps[0]?.id ?? null);
      } catch (e: any) {
        toast({
          title: "Failed to load employees",
          description: e?.message || "Request failed",
          variant: "destructive",
        });
      }
    })();
  }, [selectedLocation, toast]);

  useEffect(() => {
    if (!selectedEmployeeId) {
      setEmployeeRecords([]);
      return;
    }

    const from = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const to = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });

    (async () => {
      try {
        const items = await api.listWorkRecordsByEmployeeRange(
          selectedEmployeeId,
          from.getTime(),
          to.getTime()
        );

        const completed = items.filter((r) => {
          const hasOut = !!recordEndDate(r);
          const wt = r.workedTime ?? 0;
          return hasOut && wt > 0;
        });

        setEmployeeRecords(completed);
      } catch (e: any) {
        toast({
          title: "Failed to load work records",
          description: e?.message || "Request failed",
          variant: "destructive",
        });
      }
    })();
  }, [selectedEmployeeId, currentMonth, toast]);

  const dailyHours = useMemo(() => {
    const dayMap = new Map<string, number>();

    employeeRecords.forEach((record) => {
      const d = recordStartDate(record);
      const k = format(d, "yyyy-MM-dd");
      const prev = dayMap.get(k) || 0;
      dayMap.set(k, prev + (record.workedTime || 0));
    });

    return dayMap;
  }, [employeeRecords]);

  const getHoursForDay = (date: Date): number => {
    const dateKey = format(date, "yyyy-MM-dd");
    return dailyHours.get(dateKey) || 0;
  };

  const totals = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

    let monthlyMinutes = 0;
    let weeklyMinutes = 0;
    let totalMinutes = 0;

    employeeRecords.forEach((record) => {
      const recordDate = recordStartDate(record);
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

  const isNotFound = (e: any) => {
    const msg = String(e?.message || "").toLowerCase();
    return msg.includes("not found") || msg.includes("404");
  };

  const selectedDateRecords = useMemo(() => {
    if (!selectedDate || !selectedEmployee) return [];
    return employeeRecords.filter((r) =>
      isSameDay(new Date(r.checkInAt), selectedDate)
    );
  }, [selectedDate, employeeRecords, selectedEmployee]);

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

    try {
      const newLocation = await api.createLocation(trimmedName);
      setLocations((prev) => [...prev, newLocation]);
      setSelectedLocation(newLocation.id);
      setNewLocationName("");
      setShowAddLocationDialog(false);
      toast({ title: `Location "${trimmedName}" added` });
    } catch (e: any) {
      toast({
        title: "Failed to add location",
        description: e?.message || "Request failed",
        variant: "destructive",
      });
    }
  };

  const handleDeleteLocation = async () => {
    if (!confirmDeleteLocation) return;

    const locID = confirmDeleteLocation.id;

    try {
      await api.deleteLocation(locID);

      setLocations((prev) => prev.filter((l) => l.id !== locID));

      if (selectedLocation === locID) {
        const nextLocation = locations.find((l) => l.id !== locID) || null;
        setSelectedLocation(nextLocation ? nextLocation.id : null);
        setSelectedEmployeeId(null);
      }

      toast({ title: `Location "${confirmDeleteLocation.name}" deleted` });
    } catch (e: any) {
      toast({
        title: "Failed to delete location",
        description: e?.message || "Request failed",
        variant: "destructive",
      });
    } finally {
      setConfirmDeleteLocation(null);
    }
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
    const trimmedIdentifier = newEmployeeIdentifier.trim();

    if (!trimmedId) {
      toast({ title: "Please enter an ID", variant: "destructive" });
      return;
    }

    const idNumber = parseInt(trimmedId, 10);
    if (isNaN(idNumber) || idNumber <= 0) {
      toast({
        title: "Please enter a valid numeric ID",
        variant: "destructive",
      });
      return;
    }

    if (!trimmedName) {
      toast({ title: "Please enter a name", variant: "destructive" });
      return;
    }

    if (!trimmedIdentifier) {
      toast({
        title: "Please enter an unique username",
        variant: "destructive",
      });
      return;
    }

    let existingById: any = null;
    try {
      existingById = await api.getEmployeeById(idNumber);
    } catch (e: any) {
      if (!isNotFound(e)) {
        toast({
          title: "Failed to validate employee ID",
          description: e?.message || "Request failed",
          variant: "destructive",
        });
        return;
      }
    }

    if (existingById) {
      toast({ title: "Employee ID already exists", variant: "destructive" });
      return;
    }

    let existingByIdentifier: any = null;
    try {
      existingByIdentifier = await api.listEmployeesByIdentifier(
        trimmedIdentifier
      );
    } catch (e: any) {
      if (!isNotFound(e)) {
        toast({
          title: "Failed to validate employee identifier",
          description: e?.message || "Request failed",
          variant: "destructive",
        });
        return;
      }
    }

    if (existingByIdentifier) {
      toast({
        title: "Employee's username already exists",
        variant: "destructive",
      });
      return;
    }

    try {
      const newEmployee = await api.createEmployee({
        id: idNumber,
        name: trimmedName,
        identifier: trimmedIdentifier,
        locationId: selectedLocation,
      });
      setEmployees((prev) => [...prev, newEmployee]);
      setNewEmployeeId("");
      setNewEmployeeIdentifier("");
      setNewEmployeeName("");
      setShowAddForm(false);
      setSelectedEmployeeId(newEmployee.id);
      toast({ title: `Employee "${trimmedName}" added` });
    } catch (e: any) {
      toast({
        title: "Failed to add employee",
        description: e?.message || "Request failed",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEmployee = async () => {
    if (!confirmDeleteEmployee) return;

    try {
      await api.deleteEmployee(confirmDeleteEmployee.id);
      setEmployees((prev) =>
        prev.filter((e) => e.id !== confirmDeleteEmployee.id)
      );

      if (selectedEmployeeId === confirmDeleteEmployee.id) {
        const nextEmployee =
          employees.find((e) => e.id !== confirmDeleteEmployee.id) || null;
        setSelectedEmployeeId(nextEmployee ? nextEmployee.id : null);
      }

      toast({ title: `Employee "${confirmDeleteEmployee.name}" deleted` });
    } catch (e: any) {
      toast({
        title: "Failed to delete employee",
        description: e?.message || "Request failed",
        variant: "destructive",
      });
    } finally {
      setConfirmDeleteEmployee(null);
    }
  };

  const handleExportClick = () => {
    setExportDateRange(undefined);
    setShowExportDialog(true);
  };

  const handleExport = async () => {
    if (!selectedLocation) {
      toast({ title: "Please select a location", variant: "destructive" });
      return;
    }

    if (!exportDateRange?.from || !exportDateRange?.to) {
      toast({ title: "Please select a date range", variant: "destructive" });
      return;
    }

    const from = new Date(exportDateRange.from);
    from.setHours(0, 0, 0, 0);
    const to = new Date(exportDateRange.to);
    to.setHours(23, 59, 59, 999);

    try {
      const records = await api.listWorkRecordsByLocationRange(
        selectedLocation,
        from.getTime(),
        to.getTime()
      );

      const totalsByEmp = new Map<number, number>();
      records.forEach((rec) => {
        const minutes = rec.workedTime || 0;
        const d = recordStartDate(rec);
        if (!isWithinInterval(d, { start: from, end: to })) return;
        totalsByEmp.set(
          rec.employeeId,
          (totalsByEmp.get(rec.employeeId) || 0) + minutes
        );
      });

      const fromText = format(from, "yyyy-MM-dd");
      const toText = format(to, "yyyy-MM-dd");

      const aoa: (string | number)[][] = [
        ["Working Hours Report", ""],
        [`${fromText} - ${toText}`, ""],
        ["Employee Name", "Total Hours"],
        ...employees.map((emp) => [
          emp.name,
          formatHours(totalsByEmp.get(emp.id) || 0),
        ]),
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
      ];

      ws["!cols"] = [{ wch: 24 }, { wch: 14 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Working Hours");

      const fileName = `working_hours_${format(from, "yyyyMMdd")}_${format(
        to,
        "yyyyMMdd"
      )}.xlsx`;

      XLSX.writeFile(wb, fileName);

      setShowExportDialog(false);
      toast({ title: "Export successful" });
    } catch (e: any) {
      toast({
        title: "Failed to export",
        description: e?.message || "Request failed",
        variant: "destructive",
      });
    }
  };

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
                  <div
                    key={loc.id}
                    className={cn(
                      "flex items-center gap-2 rounded-md",
                      selectedLocation === loc.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    {/* Select location (left side) */}
                    <button
                      onClick={() => setSelectedLocation(loc.id)}
                      className="flex-1 text-left px-3 py-2 text-sm"
                    >
                      {loc.name}
                    </button>

                    {/* Delete location (right side) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation(); // prevents selecting when clicking trash
                        setConfirmDeleteLocation(loc); // <-- open confirm dialog
                      }}
                      className={cn(
                        "p-2 rounded-md",
                        selectedLocation === loc.id
                          ? "hover:bg-primary/20"
                          : "hover:bg-muted"
                      )}
                      aria-label={`Delete location ${loc.name}`}
                      title="Delete location"
                    >
                      <Trash2
                        className={cn(
                          "h-4 w-4",
                          selectedLocation === loc.id
                            ? "text-primary-foreground/90"
                            : "text-destructive"
                        )}
                      />
                    </button>
                  </div>
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
            disabled={!selectedLocation || employees.length === 0}
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
                    disabled={!selectedLocation}
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
                        type="number"
                      />
                      <div className="flex flex-col gap-2 flex-1">
                        <Input
                          placeholder="Employee fullname"
                          value={newEmployeeName}
                          onChange={(e) => setNewEmployeeName(e.target.value)}
                          className="h-9"
                        />

                        <Input
                          placeholder="Employee username"
                          value={newEmployeeIdentifier}
                          onChange={(e) =>
                            setNewEmployeeIdentifier(e.target.value)
                          }
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
                    {employees.map((emp) => {
                      const isSelected = selectedEmployeeId === emp.id;
                      return (
                        <div
                          key={emp.id}
                          className={cn(
                            "flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50",
                            isSelected &&
                              "bg-primary/10 border-l-2 border-primary"
                          )}
                        >
                          <button
                            onClick={() => setSelectedEmployeeId(emp.id)}
                            className="flex items-center gap-3 flex-1 text-left"
                          >
                            <div
                              className={cn(
                                "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium",
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {emp.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span
                                className={cn(
                                  "font-medium",
                                  isSelected
                                    ? "text-primary"
                                    : "text-foreground"
                                )}
                              >
                                {emp.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {emp.identifier}
                              </span>
                            </div>
                          </button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setConfirmDeleteEmployee(emp)}
                            disabled={!emp}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
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
                      — {selectedEmployee.name}
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
                                      new Date(record.checkInAt),
                                      "HH:mm"
                                    )}{" "}
                                    -{" "}
                                    {format(
                                      new Date(record.checkOutAt!),
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
                onSelect={(range, selectedDay) => {
                  setExportDateRange((prev) => {
                    if (prev?.from && prev?.to) {
                      if (!selectedDay) return undefined;
                      return { from: selectedDay, to: undefined };
                    }

                    return range ?? undefined;
                  });
                }}
                numberOfMonths={1}
                className="rounded-md border pointer-events-auto"
              />
            </div>
            {exportDateRange?.from && (
              <p className="text-sm text-center mt-4 text-muted-foreground">
                {format(exportDateRange.from, "MMM d, yyyy")} —{" "}
                {exportDateRange.to
                  ? format(exportDateRange.to, "MMM d, yyyy")
                  : "Select end date"}
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

      {/* Confirm delete employee */}
      <Dialog
        open={!!confirmDeleteEmployee}
        onOpenChange={(open) => !open && setConfirmDeleteEmployee(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete employee?</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <span className="font-medium">{confirmDeleteEmployee?.name}</span>
              .
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteEmployee(null)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteEmployee}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete location */}
      <Dialog
        open={!!confirmDeleteLocation}
        onOpenChange={(open) => !open && setConfirmDeleteLocation(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete location?</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <span className="font-medium">{confirmDeleteLocation?.name}</span>{" "}
              and remove all employees in that location.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteLocation(null)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteLocation}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkingTime;
