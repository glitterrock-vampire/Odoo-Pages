import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8 animate-in fade-in zoom-in duration-700">
      <div className="space-y-4">
        <h1 className="text-9xl font-black text-primary/10 font-display">404</h1>
        <h2 className="text-4xl font-extrabold text-primary font-display">Stage is Empty</h2>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          We couldn't find the page you're looking for. It might have moved or doesn't exist.
        </p>
      </div>
      <Link href="/">
        <Button size="lg" className="rounded-full font-bold shadow-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 text-lg px-8">
          Return to Dashboard
        </Button>
      </Link>
    </div>
  );
}
