import Link from "next/link";
import { Button } from "../components/ui/button";
import { signOut } from "./account-actions";

export type PortalNavigationLink = {
  href: string;
  label: string;
};

export function PortalHeader({
  userName,
  links,
}: {
  userName: string;
  links: PortalNavigationLink[];
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
      <Link href="/" className="font-medium">Class Portal</Link>
      {links.length > 0 && (
        <nav aria-label="Main navigation" className="order-3 flex w-full flex-wrap gap-4 text-sm sm:order-none sm:w-auto">
          {links.map((link) => (
            <Link key={link.href} className="underline underline-offset-4" href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      )}
      <div className="flex items-center gap-4">
        <span className="hidden text-sm text-muted-foreground sm:inline">{userName}</span>
        <form action={signOut}>
          <Button type="submit" variant="outline">Sign out</Button>
        </form>
      </div>
    </header>
  );
}
