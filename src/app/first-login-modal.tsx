"use client";

import { useActionState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  claimAccount,
  finishForcedPasswordChange,
  type AccountActionState,
} from "./account-actions";

const initialState: AccountActionState = { error: null };

export function FirstLoginModal({
  requiresClaim,
  currentEmail,
}: {
  requiresClaim: boolean;
  currentEmail: string | null;
}) {
  const [state, claimAction, claimPending] = useActionState(claimAccount, initialState);
  const [resetState, resetAction, resetPending] = useActionState(
    finishForcedPasswordChange,
    initialState,
  );
  const stateToShow = requiresClaim ? state : resetState;
  const formAction = requiresClaim ? claimAction : resetAction;
  const pending = requiresClaim ? claimPending : resetPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-account-title"
        className="w-full max-w-lg"
      >
        <Card>
          <CardHeader>
            <CardTitle id="claim-account-title">Set up your account</CardTitle>
            <CardDescription>
              {requiresClaim
                ? "Add an email address and create a password before continuing. A confirmation email will be sent to that address."
                : "Your password was reset. Choose a new password before continuing."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              {requiresClaim && (
                <div className="space-y-2">
                  <label htmlFor="claim-email" className="text-sm font-medium">Email address</label>
                  <Input
                    id="claim-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    defaultValue={currentEmail ?? ""}
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="claim-password" className="text-sm font-medium">New password</label>
                <Input
                  id="claim-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="claim-confirm-password" className="text-sm font-medium">
                  Confirm new password
                </label>
                <Input
                  id="claim-confirm-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              {stateToShow.error && <p role="alert" className="text-sm text-destructive">{stateToShow.error}</p>}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Setting up..." : "Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
