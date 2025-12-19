import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import LiveClock from "@/components/LiveClock";
import CheckInCard from "@/components/CheckInCard";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-heading text-xl font-semibold text-foreground">
            TimeTrack
          </h1>
          <Link to="/working-time">
            <Button variant="outline" size="sm" className="gap-2">
              <Clock className="h-4 w-4" />
              Working Hours
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 md:py-16">
        <div className="max-w-2xl mx-auto space-y-12">
          {/* Clock Section */}
          <section className="text-center">
            <LiveClock />
          </section>

          {/* Check-In Section */}
          <section>
            <CheckInCard />
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-auto">
        <div className="container mx-auto px-4 py-4">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} TimeTrack • Employee Check-In System
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
