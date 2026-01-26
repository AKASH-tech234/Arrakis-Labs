
import AnimatedShaderHero from "../ui/animated-shader-hero";

export default function Hero() {
  return (
    <AnimatedShaderHero
      trustBadge={{
        text: "The Mentat Trials · Intelligence Awakened",
      }}
      headline={{
        line1: "Where Code Meets",
        line2: "Desert Intelligence",
      }}
      subtitle="An AI companion forged in silence. It remembers your journey, adapts to your patterns, and guides you toward mastery through the ancient art of deliberate practice."
      buttons={{
        primary: {
          text: "Begin Your Trial",
          href: "/signup",
        },
        secondary: {
          text: "Enter System",
          href: "/login",
        },
      }}
    />
  );
}
