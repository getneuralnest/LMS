"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { TurnstileField } from "../../components/turnstile-field";
import { login, type LoginActionState } from "./actions";

const initialState: LoginActionState = { error: null };

export function LoginForm({ siteKey }: { siteKey: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [captchaToken, setCaptchaToken] = useState("");

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Use the username provided by your teacher.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium">Username</label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              maxLength={256}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={1024}
              required
            />
          </div>
          <TurnstileField
            name="captchaToken"
            siteKey={siteKey}
            token={captchaToken}
            onToken={setCaptchaToken}
            resetKey={state}
          />
          {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending || !captchaToken}>
            {pending ? "Signing in..." : "Sign in"}
          </Button>
          <Link href="/forgot-password" className="block text-center text-sm underline underline-offset-4">
            Forgot password?
          </Link>
        </form>
      </CardContent>
    </Card>
  );
}
