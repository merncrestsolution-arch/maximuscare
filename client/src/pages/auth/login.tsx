import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBranding } from "@/context/branding-context";
import { SiteCreditFooter } from "@/components/site-credit-footer";

export default function LoginPage() {
  const { login } = useAuth();
  const { logoUri } = useBranding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
    } catch (error) {
      alert("Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-br from-background via-accent/20 to-background px-safe safe-top touch-manipulation">
      <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-border/80 overflow-hidden">
        <CardHeader className="space-y-1 text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="h-24 w-24 rounded-2xl overflow-hidden shadow-lg border-2 border-primary/20 bg-card flex items-center justify-center ring-4 ring-primary/5">
              <img src={logoUri} alt="Maximus Care logo" className="w-full h-full object-contain p-1" data-testid="img-logo" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-primary">Maximus Care</CardTitle>
          <CardDescription className="text-base">Physio & Rehab Unit Management</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Input 
                type="email" 
                placeholder="Email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                required 
                className="h-12"
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <PasswordInput 
                placeholder="Password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                required 
                className="h-12"
                data-testid="input-password"
              />
            </div>
            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading} data-testid="button-login">
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
      </div>
      <SiteCreditFooter />
    </div>
  );
}
