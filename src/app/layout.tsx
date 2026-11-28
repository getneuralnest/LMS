import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createClient } from "../utils/supabase/server";
import { FirstLoginModal } from "./first-login-modal";
import { PortalHeader } from "./portal-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Class Portal",
  description: "Class attendance, ledger, and learning portal",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let claimProfile: { claimed_at: string | null; contact_email: string | null } | null = null;
  let navigationLinks: Array<{ href: string; label: string }> = [];
  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw new Error("Could not load navigation permissions.");

    if (profile?.is_admin) {
      navigationLinks = [
        { href: "/admin", label: "Home" },
        { href: "/admin/teachers", label: "Teachers" },
        { href: "/admin/students", label: "Students" },
      ];
    } else {
      const { data: memberships, error: membershipsError } = await supabase
        .from("class_members")
        .select("role")
        .eq("user_id", user.id);
      if (membershipsError) throw new Error("Could not load navigation permissions.");

      if (memberships.some((membership) => membership.role === "teacher")) {
        navigationLinks = [
          { href: "/teacher", label: "Home" },
          { href: "/teacher/students", label: "Students" },
          { href: "/teacher/attendance", label: "Attendance" },
          { href: "/teacher/ledger", label: "CR ledger" },
        ];
      } else if (memberships.some((membership) => membership.role === "cr")) {
        navigationLinks = [
          { href: "/student", label: "Home" },
          { href: "/teacher/ledger", label: "CR ledger" },
        ];
      } else if (memberships.some((membership) => membership.role === "student")) {
        navigationLinks = [{ href: "/student", label: "Home" }];
      }
    }
  }

  if (user?.app_metadata.must_change_password === true) {
    const { data, error } = await supabase
      .from("profiles")
      .select("claimed_at,contact_email")
      .eq("id", user.id)
      .maybeSingle();
    if (error || !data) throw new Error("Could not verify account setup status.");
    claimProfile = data;
  }

  return (
    <html lang="en">
      <body>
        {user && (
          <PortalHeader
            userName={user.user_metadata.full_name ?? "Account"}
            links={navigationLinks}
          />
        )}
        {children}
        {user?.app_metadata.must_change_password === true && claimProfile && (
          <FirstLoginModal
            requiresClaim={!claimProfile.claimed_at}
            currentEmail={claimProfile.contact_email}
          />
        )}
      </body>
    </html>
  );
}
