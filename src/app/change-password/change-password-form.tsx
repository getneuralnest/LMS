"use client";

import { useActionState } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { TurnstileField } from "../../components/turnstile-field";
import { changePassword, type PasswordChangeActionState } from "./actions";
import { useState } from "react";

const initialState: PasswordChangeActionState = { error: null };

export function ChangePasswordForm({
  username,
  siteKey,
}: {
  username: string;
  siteKey: string;
}) {
  const [state, formAction, pending] = useActionState(changePassword, initialState);
  const [captchaToken, setCaptchaToken] = useState("");

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Change your password</CardTitle>
        <CardDescription>
          Your temporary password is no longer needed after this change.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium">Username</label>
            <Input id="username" value={username} readOnly />
          </div>
          <div className="space-y-2">
            <label htmlFor="currentPassword" className="text-sm font-medium">
              Temporary password
            </label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">New password</label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm new password
            </label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
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
            {pending ? "Updating..." : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
