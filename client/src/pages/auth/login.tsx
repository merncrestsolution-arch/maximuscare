import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBranding } from "@/context/branding-context";
import { SiteCreditFooter } from "@/components/site-credit-footer";
import { LoginStyleSplash } from "@/components/auth/login-style-splash";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const { login } = useAuth();
  const { logoUri } = useBranding();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
      toast({ title: "Sign in failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh touch-manipulation flex-col bg-white px-safe safe-top">
      {loading && (
        <LoginStyleSplash message="Signing you in…" data-testid="login-loading-overlay" />
      )}
      <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md overflow-hidden border-2 border-black bg-white shadow-lg">
        <CardHeader className="space-y-1 pb-2 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-2 border-black bg-white shadow-md">
              <img src={logoUri} alt="Maximus Care logo" className="h-full w-full object-contain p-1" data-testid="img-logo" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-black">Maximus Care</CardTitle>
          <CardDescription className="text-base text-black/80">Physio &amp; Rehab Unit Management</CardDescription>
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
                className="h-12 rounded-xl border-black/80 bg-white text-black placeholder:text-neutral-400"
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <PasswordInput 
                placeholder="Password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                required 
                className="h-12 rounded-xl border-black/80 bg-white text-black placeholder:text-neutral-400"
                data-testid="input-password"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive text-center" role="alert" data-testid="text-login-error">
                {error}
              </p>
            )}
            <Button
              type="submit"
              variant="outline"
              className="h-12 w-full border-2 border-black bg-white text-base font-semibold text-black hover:bg-neutral-50"
              disabled={loading}
              data-testid="button-login"
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Default: admin@maximuscare.com / admin123
          </p>
        </CardContent>
      </Card>
      </div>
      <SiteCreditFooter />
    </div>
  );
}
