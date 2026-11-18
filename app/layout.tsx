import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import Nav from "@/components/Nav";
import PasscodeModal from "@/components/PasscodeModal";
import { getRates } from "@/lib/fx";
import { readStore } from "@/lib/store";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const display = Fraunces({ variable: "--font-display", subsets: ["latin"], axes: ["opsz"] });

const owner = process.env.OWNER_NAME ?? "Ethan";

// Absolute address for share previews (WhatsApp, iMessage, etc.). Vercel provides the production domain.
const site = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
const description = "A die-cast model aircraft collection: every plane catalogued, valued and parked at a 3D Changi airport.";

export const metadata: Metadata = {
  metadataBase: site ? new URL(`https://${site}`) : undefined,
  title: { default: `${owner}'s Hangar`, template: `%s · ${owner}'s Hangar` },
  description,
  // The preview picture itself is app/opengraph-image.jpg (1200×630), picked up automatically.
  openGraph: { type: "website", siteName: `${owner}'s Hangar`, title: `${owner}'s Hangar`, description },
  twitter: { card: "summary_large_image", title: `${owner}'s Hangar`, description },
};

export const viewport: Viewport = { themeColor: "#070b14" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [store, fx] = await Promise.all([readStore().catch(() => null), getRates()]);
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Nav owner={store?.settings.owner ?? owner} currency={store?.settings.currency ?? "SGD"} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 sm:px-6">{children}</main>
        <footer className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6">
          <p className="label !normal-case !tracking-normal text-faint">
            Catalogue photos and prices come from Airplane Model SG, Aviation Retail Direct, The Airplane Shop and West Coast Diecast. Prices are a guide, not a valuation,
            and are converted to your display currency at {fx.live ? `exchange rates from ${fx.asOf}` : "approximate exchange rates"}.
          </p>
        </footer>
        <PasscodeModal />
      </body>
    </html>
  );
}
