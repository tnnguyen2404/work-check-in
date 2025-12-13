import { useState, useEffect } from "react";

const LiveClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="text-center animate-fade-in">
      <div className="font-heading text-6xl md:text-7xl font-bold tracking-tight text-foreground mb-2">
        {formatTime(time)}
      </div>
      <div className="text-lg text-muted-foreground">
        {formatDate(time)}
      </div>
    </div>
  );
};

export default LiveClock;
