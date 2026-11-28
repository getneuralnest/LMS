"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  resendConfirmation,
  updateContactEmail,
  type AccountActionState,
} from "./account-actions";

const initialState: AccountActionState = { error: null, message: null };

export function EmailConfirmationReminder({
  email,
  open,
}: {
  email: string | null;
  open: boolean;
}) {
  const router = useRouter();
  const [changeEmail, setChangeEmail] = useState(false);
  const [resendState, resendAction, resendPending] = useActionState(
    resendConfirmation,
    initialState,
  );
  const [emailState, emailAction, emailPending] = useActionState(
    updateContactEmail,
    initialState,
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="email-reminder-title" className="w-full max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle id="email-reminder-title">Confirm your email</CardTitle>
            <CardDescription>
              {email
                ? `A confirmation message was sent to ${email}.`
                : "Add an email address to receive a confirmation message."}
              {" "}You can continue now, but this reminder will return the next time you sign in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {changeEmail ? (
              <form action={emailAction} className="space-y-3">
                <label htmlFor="replacement-email" className="text-sm font-medium">
                  New email address
                </label>
                <Input
                  id="replacement-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  defaultValue={email ?? ""}
                  required
                />
                {emailState.error && <p role="alert" className="text-sm text-destructive">{emailState.error}</p>}
                {emailState.message && <p role="status" className="text-sm">{emailState.message}</p>}
                <div className="flex gap-2">
                  <Button type="submit" disabled={emailPending}>
                    {emailPending ? "Saving..." : "Save email"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setChangeEmail(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap gap-2">
                <form action={resendAction}>
                  <Button type="submit" variant="outline" disabled={resendPending || !email}>
                    {resendPending ? "Sending..." : "Resend confirmation"}
                  </Button>
                </form>
                <Button type="button" variant="outline" onClick={() => setChangeEmail(true)}>
                  Change email
                </Button>
                <Button type="button" onClick={() => router.replace("/student")}>
                  Continue
                </Button>
              </div>
            )}
            {resendState.error && <p role="alert" className="text-sm text-destructive">{resendState.error}</p>}
            {resendState.message && <p role="status" className="text-sm">{resendState.message}</p>}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
