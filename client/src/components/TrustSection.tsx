import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Building2, Cloud, Database, Globe, MessageSquare, Users } from "lucide-react";

const logos = [
  { icon: Globe, name: "Global" },
  { icon: Cloud, name: "Cloud" },
  { icon: Database, name: "Data" },
  { icon: Building2, name: "Enterprise" },
  { icon: MessageSquare, name: "Communication" },
  { icon: Users, name: "Teams" },
];

const stats = [
  { value: "50+", label: "AI Projects Delivered" },
  { value: "98%", label: "Client Satisfaction" },
  { value: "$10M+", label: "Revenue Generated" },
  { value: "24/7", label: "Support Available" },
];

const testimonials = [
  {
    quote: "They transformed our customer service with an AI solution that reduced response times by 80%.",
    author: "Sarah Chen",
    role: "CTO, TechFlow Inc.",
  },
  {
    quote: "The team delivered our AI product in half the expected time. Exceptional quality and communication.",
    author: "Michael Torres",
    role: "Founder, DataScale",
  },
  {
    quote: "Their strategic approach to AI implementation gave us a clear competitive advantage.",
    author: "Emily Watson",
    role: "VP of Innovation, Global Corp",
  },
];

export function TrustSection() {
  return (
    <section id="about" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
        <div className="text-center space-y-4">
          <Badge variant="secondary">Trusted By Industry Leaders</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold">
            Powering the Future of Business
          </h2>
        </div>

        <motion.div 
          className="flex flex-wrap items-center justify-center gap-8 sm:gap-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          {logos.map((logo) => (
            <div 
              key={logo.name}
              className="text-muted-foreground/40"
              data-testid={`logo-${logo.name.toLowerCase()}`}
            >
              <logo.icon className="w-10 h-10 sm:w-12 sm:h-12" />
            </div>
          ))}
        </motion.div>

        <motion.div 
          className="grid grid-cols-2 sm:grid-cols-4 gap-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          {stats.map((stat) => (
            <Card key={stat.label} className="p-6 text-center" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
              <div className="text-3xl sm:text-4xl font-bold gradient-text mb-2">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </Card>
          ))}
        </motion.div>

        <div className="space-y-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-2">What Our Clients Say</h3>
            <p className="text-muted-foreground">Success stories from our partners</p>
          </div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {testimonials.map((testimonial, index) => (
              <Card 
                key={index} 
                className="p-6 space-y-4"
                data-testid={`card-testimonial-${index}`}
              >
                <p className="text-foreground/90 italic">"{testimonial.quote}"</p>
                <div>
                  <div className="font-medium" data-testid={`text-author-${index}`}>{testimonial.author}</div>
                  <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                </div>
              </Card>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
