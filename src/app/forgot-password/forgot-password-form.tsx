"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { TurnstileField } from "../../components/turnstile-field";
import { forgotPassword, type AccountActionState } from "../account-actions";

const initialState: AccountActionState = { error: null, message: null };

export function ForgotPasswordForm({ siteKey }: { siteKey: string }) {
  const [state, formAction, pending] = useActionState(forgotPassword, initialState);
  const [captchaToken, setCaptchaToken] = useState("");

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>
          Enter your username. Instructions are sent only to an account with a confirmed email.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium">Username</label>
            <Input id="username" name="username" autoComplete="username" maxLength={256} required />
          </div>
          <TurnstileField
            name="captchaToken"
            siteKey={siteKey}
            token={captchaToken}
            onToken={setCaptchaToken}
            resetKey={state}
          />
          {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
          {state.message && <p role="status" className="text-sm">{state.message}</p>}
          <Button type="submit" className="w-full" disabled={pending || !captchaToken}>
            {pending ? "Checking..." : "Send instructions"}
          </Button>
          <Link href="/login" className="block text-center text-sm underline underline-offset-4">
            Return to sign in
          </Link>
        </form>
      </CardContent>
    </Card>
  );
}
