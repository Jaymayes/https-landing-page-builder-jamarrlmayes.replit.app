import { Button } from "@/components/ui/button";
import { useTheme } from "./ThemeProvider";
import { Moon, Sun, Sparkles } from "lucide-react";

export function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <a href="/" className="flex items-center gap-2" data-testid="link-home">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg hidden sm:block">Referral Service LLC</span>
          </a>

          <nav className="hidden md:flex items-center gap-6">
            <a 
              href="#services" 
              className="text-sm text-muted-foreground"
              data-testid="link-services"
            >
              Services
            </a>
            <a 
              href="#about" 
              className="text-sm text-muted-foreground"
              data-testid="link-about"
            >
              About
            </a>
            <a 
              href="#contact" 
              className="text-sm text-muted-foreground"
              data-testid="link-contact"
            >
              Contact
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={toggleTheme}
              data-testid="button-theme-toggle"
            >
              {theme === "light" ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </Button>
            <Button data-testid="button-get-started">
              Get Started
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
