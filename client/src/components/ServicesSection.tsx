import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Cpu, Building2, Bot, LineChart, Cog, Lightbulb } from "lucide-react";
import { motion } from "framer-motion";

const services = [
  {
    icon: Cpu,
    title: "Business Upgrades",
    description: "Transform your existing operations with AI-powered automation, intelligent analytics, and seamless integrations.",
    features: ["Process Automation", "AI Analytics", "Custom Integrations"],
    color: "primary" as const,
  },
  {
    icon: Building2,
    title: "AI Company Creation",
    description: "Launch your AI venture from concept to market. Full-stack development, go-to-market strategy, and ongoing support.",
    features: ["MVP Development", "Market Strategy", "Technical Architecture"],
    color: "accent" as const,
  },
  {
    icon: Bot,
    title: "Intelligent Assistants",
    description: "Deploy custom AI agents that understand your business context and deliver real value to your customers.",
    features: ["Custom Training", "Multi-channel Deploy", "24/7 Operations"],
    color: "primary" as const,
  },
  {
    icon: LineChart,
    title: "Predictive Analytics",
    description: "Leverage machine learning to forecast trends, optimize operations, and make data-driven decisions.",
    features: ["Demand Forecasting", "Risk Assessment", "Performance Optimization"],
    color: "accent" as const,
  },
  {
    icon: Cog,
    title: "System Integration",
    description: "Connect your existing tools and platforms with intelligent middleware that learns and adapts.",
    features: ["API Development", "Data Pipelines", "Legacy Migration"],
    color: "primary" as const,
  },
  {
    icon: Lightbulb,
    title: "AI Strategy Consulting",
    description: "Strategic guidance on AI adoption, technology selection, and organizational transformation.",
    features: ["Roadmap Development", "Technology Audit", "Change Management"],
    color: "accent" as const,
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function ServicesSection() {
  return (
    <section id="services" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-muted/30 to-transparent" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 space-y-4">
          <Badge variant="secondary">Our Services</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold">
            Comprehensive AI Solutions
          </h2>
          <p className="max-w-2xl mx-auto text-muted-foreground">
            From strategic consulting to full implementation, we provide end-to-end AI services 
            tailored to your business needs.
          </p>
        </div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {services.map((service, index) => (
            <motion.div key={service.title} variants={itemVariants}>
              <Card 
                className="h-full hover-elevate transition-all duration-300 group"
                data-testid={`card-service-${index}`}
              >
                <CardHeader className="space-y-4">
                  <div className={`w-12 h-12 rounded-md flex items-center justify-center ${
                    service.color === 'primary' ? 'bg-primary/10' : 'bg-accent/10'
                  }`}>
                    <service.icon className={`w-6 h-6 ${
                      service.color === 'primary' ? 'text-primary' : 'text-accent'
                    }`} />
                  </div>
                  <CardTitle className="text-xl">{service.title}</CardTitle>
                  <CardDescription className="text-base">
                    {service.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {service.features.map((feature) => (
                      <Badge key={feature} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                  <Button 
                    variant="ghost" 
                    className="gap-2 p-0 h-auto"
                    data-testid={`button-learn-more-${index}`}
                  >
                    Learn more
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
