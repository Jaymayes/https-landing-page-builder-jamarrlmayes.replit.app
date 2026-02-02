import { Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer id="contact" className="py-12 border-t border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">Referral Service LLC</span>
            </div>
            <p className="text-sm text-muted-foreground">
              AI Venture Studio transforming businesses through intelligent solutions.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Services</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" data-testid="link-footer-business-upgrades">Business Upgrades</a></li>
              <li><a href="#" data-testid="link-footer-ai-company">AI Company Creation</a></li>
              <li><a href="#" data-testid="link-footer-assistants">Intelligent Assistants</a></li>
              <li><a href="#" data-testid="link-footer-consulting">Consulting</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" data-testid="link-footer-about">About Us</a></li>
              <li><a href="#" data-testid="link-footer-case-studies">Case Studies</a></li>
              <li><a href="#" data-testid="link-footer-careers">Careers</a></li>
              <li><a href="#" data-testid="link-footer-contact">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>hello@referralservice.ai</li>
              <li>+1 (555) 123-4567</li>
              <li>San Francisco, CA</li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground" data-testid="text-copyright">
            © {new Date().getFullYear()} Referral Service LLC. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#" data-testid="link-privacy">Privacy Policy</a>
            <a href="#" data-testid="link-terms">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
